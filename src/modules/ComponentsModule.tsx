import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useQMS } from '../context/QMSContext';
import { Component, ComponentCategory } from '../types';
import { getComponentCrossReferences } from '../utils/crossReference';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { MachineBomImportModal } from '../components/MachineBomImportModal';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  Tag,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Upload,
  Download,
  AlertCircle,
  FolderKanban,
  Cpu,
  Hammer,
  ExternalLink,
  Layers,
  Trash2,
} from 'lucide-react';

interface ParsedComponentRow {
  partNumber: string;
  description: string;
  category: ComponentCategory;
  machineTypes: string[];
  defaultDrawingNumber: string;
  currentDrawingRevision: string;
  materialSpecification: string;
  criticalComponent: boolean;
  traceabilityRequired: boolean;
  permanentIdRequired: boolean;
  notes: string;
  valid: boolean;
  validationMessage?: string;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseBooleanCell(raw: string, defaultValue: boolean): boolean {
  const clean = (raw || '').trim().toUpperCase();
  if (!clean) return defaultValue;
  if (['YES', 'TRUE', '1', 'Y', 'CRITICAL', 'REQUIRED', 'REQ'].includes(clean)) return true;
  if (['NO', 'FALSE', '0', 'N', 'STANDARD', 'NON-CRITICAL', 'OPTIONAL', 'NOT REQ'].includes(clean))
    return false;
  return defaultValue;
}

export const ComponentsModule: React.FC = () => {
  const {
    db,
    currentUser,
    addComponent,
    importComponents,
    updateComponent,
    deleteComponent,
    clearCollectionList,
    crossNavTarget,
    navigateToCrossRef,
    clearCrossNavTarget,
  } = useQMS();

  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const [confirmDeleteCompId, setConfirmDeleteCompId] = useState<string | null>(null);
  const [confirmClearCompsList, setConfirmClearCompsList] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [criticalFilter, setCriticalFilter] = useState<'ALL' | 'CRITICAL' | 'NON_CRITICAL'>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMachineBomModalOpen, setIsMachineBomModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);

  useEffect(() => {
    if (crossNavTarget && crossNavTarget.tab === 'components') {
      if (crossNavTarget.searchQuery) {
        setSearchTerm(crossNavTarget.searchQuery);
        const matched = db.components.find(
          (c) =>
            c.partNumber.toUpperCase() === crossNavTarget.searchQuery?.toUpperCase() ||
            c.id === crossNavTarget.recordId
        );
        if (matched) {
          setSelectedComponent(matched);
        }
      }
      clearCrossNavTarget();
    }
  }, [crossNavTarget, db.components, clearCrossNavTarget]);

  const crossRefsByCompId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getComponentCrossReferences>>();
    db.components.forEach((c) => {
      map.set(c.id, getComponentCrossReferences(db, c));
    });
    return map;
  }, [db]);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedComponentRow[]>([]);
  const [importMessage, setImportMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState<{
    partNumber: string;
    description: string;
    category: ComponentCategory;
    machineTypes: string[];
    criticalComponent: boolean;
    defaultDrawingNumber: string;
    currentDrawingRevision: string;
    materialSpecification: string;
    traceabilityRequired: boolean;
    permanentIdRequired: boolean;
    active: boolean;
    notes: string;
  }>({
    partNumber: '',
    description: '',
    category: 'SHAFT',
    machineTypes: ['DIVIDER'],
    criticalComponent: true,
    defaultDrawingNumber: 'DWG-DIV-101',
    currentDrawingRevision: 'C',
    materialSpecification: 'EN24T High-Tensile Alloy Steel',
    traceabilityRequired: true,
    permanentIdRequired: true,
    active: true,
    notes: '',
  });

  const canManage = ['ENGINEERING', 'HSEQ', 'ADMINISTRATOR', 'MACHINE_MANAGER', 'INSPECTOR'].includes(
    currentUser.role
  );

  const filteredComponents = useMemo(() => {
    return db.components.filter((c) => {
      const matchesSearch =
        c.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.defaultDrawingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.materialSpecification.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCat = categoryFilter === 'ALL' || c.category === categoryFilter;
      const matchesCrit =
        criticalFilter === 'ALL' ||
        (criticalFilter === 'CRITICAL' && c.criticalComponent) ||
        (criticalFilter === 'NON_CRITICAL' && !c.criticalComponent);

      return matchesSearch && matchesCat && matchesCrit;
    });
  }, [db.components, searchTerm, categoryFilter, criticalFilter]);

  const parseRawPartRows = (rawRows: any[][]): ParsedComponentRow[] => {
    const nonEmpty = rawRows.filter(
      (r) => Array.isArray(r) && r.some((cell) => String(cell || '').trim() !== '')
    );
    if (nonEmpty.length === 0) return [];

    const firstRowLower = nonEmpty[0].map((c) => String(c || '').trim().toLowerCase());
    const hasHeader = firstRowLower.some(
      (h) =>
        h.includes('part') ||
        h.includes('description') ||
        h.includes('drawing') ||
        h.includes('material') ||
        h === 'item'
    );
    const startIdx = hasHeader ? 1 : 0;

    // Detect if the uploaded spreadsheet is a Drawing BOM / Parts List (ITEM | QTY | PART NUMBER | DESCRIPTION | MATERIAL | DESIGNATION)
    const isDrawingBomFormat =
      hasHeader &&
      firstRowLower.some((h) => h === 'item' || h === 'qty' || h === 'quantity') &&
      firstRowLower.some((h) => h.includes('part'));

    const findCol = (keywords: string[], fallbackIdx: number) => {
      if (!hasHeader) return fallbackIdx;
      const idx = firstRowLower.findIndex((h) => keywords.some((kw) => h.includes(kw)));
      return idx >= 0 ? idx : fallbackIdx;
    };

    const idxPartNo = isDrawingBomFormat ? findCol(['part', 'drawing'], 2) : findCol(['part'], 0);
    const idxDesc = isDrawingBomFormat ? findCol(['desc'], 3) : findCol(['desc'], 1);
    const idxCat = isDrawingBomFormat ? -1 : findCol(['category', 'cat'], 2);
    const idxMachines = isDrawingBomFormat ? -1 : findCol(['machine'], 3);
    const idxDrawingNo = isDrawingBomFormat
      ? -1
      : findCol(['default drawing', 'drawing number', 'drawing no'], 4);
    const idxRev = isDrawingBomFormat ? -1 : findCol(['revision', 'rev'], 5);
    const idxMaterial = isDrawingBomFormat ? findCol(['material', 'mat'], 4) : findCol(['material', 'spec'], 6);
    const idxCritical = isDrawingBomFormat ? -1 : findCol(['critical'], 7);
    const idxTraceability = isDrawingBomFormat ? -1 : findCol(['traceability'], 8);
    const idxPermId = isDrawingBomFormat ? -1 : findCol(['permanent'], 9);
    const idxNotes = isDrawingBomFormat
      ? findCol(['designation', 'note', 'vendor'], 5)
      : findCol(['note', 'remark'], 10);

    const existingParts = new Set(db.components.map((c) => c.partNumber.trim().toUpperCase()));
    const seenInFile = new Set<string>();
    const allowedCategories: ComponentCategory[] = [
      'SHAFT',
      'DRUM',
      'ROLLER',
      'BEARING_BLOCK',
      'SPROCKET',
      'HOUSING',
      'FRAME',
      'GEAR',
      'OTHER',
    ];

    return nonEmpty.slice(startIdx).map((cols) => {
      const partNumber = String(cols[idxPartNo] ?? '').trim().toUpperCase();
      const description = String(cols[idxDesc] ?? '').trim();

      const rawCat =
        idxCat >= 0
          ? String(cols[idxCat] || 'OTHER')
              .trim()
              .toUpperCase()
              .replace(/\s+/g, '_')
          : 'OTHER';
      const category: ComponentCategory = allowedCategories.includes(rawCat as ComponentCategory)
        ? (rawCat as ComponentCategory)
        : 'OTHER';

      const machinesRaw = idxMachines >= 0 ? String(cols[idxMachines] || 'DIVIDER').trim() : 'DIVIDER';
      const machineTypes = machinesRaw
        ? machinesRaw
            .split(/[;|,]/)
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
        : ['DIVIDER'];

      // If Drawing Number not provided or BOM format where part ends with -01/-02, derive parent -00 drawing number
      let defaultDrawingNumber =
        idxDrawingNo >= 0 ? String(cols[idxDrawingNo] || '').trim().toUpperCase() : '';
      if (!defaultDrawingNumber && partNumber) {
        defaultDrawingNumber = /-\d{2}$/.test(partNumber)
          ? partNumber.replace(/-\d{2}$/, '-00')
          : partNumber;
      }

      const currentDrawingRevision =
        idxRev >= 0 ? String(cols[idxRev] || '0').trim().toUpperCase() || '0' : '0';

      const materialSpecification =
        String(cols[idxMaterial] || 'S/S 304 SATIN').trim() || 'AS PER DRAWING';

      const criticalComponent =
        idxCritical >= 0 ? parseBooleanCell(String(cols[idxCritical] ?? ''), true) : true;
      const traceabilityRequired =
        idxTraceability >= 0 ? parseBooleanCell(String(cols[idxTraceability] ?? ''), true) : true;
      const permanentIdRequired =
        idxPermId >= 0 ? parseBooleanCell(String(cols[idxPermId] ?? ''), true) : true;

      const notes = idxNotes >= 0 ? String(cols[idxNotes] ?? '').trim() : '';

      let valid = true;
      let validationMessage = 'Ready to import';
      if (!partNumber || !description) {
        valid = false;
        validationMessage = 'Missing required Part Number or Description';
      } else if (existingParts.has(partNumber)) {
        valid = false;
        validationMessage = 'Duplicate Part Number (already in Component Master)';
      } else if (seenInFile.has(partNumber)) {
        valid = false;
        validationMessage = 'Duplicate Part Number within uploaded file';
      } else {
        seenInFile.add(partNumber);
      }

      return {
        partNumber,
        description,
        category,
        machineTypes: machineTypes.length > 0 ? machineTypes : ['DIVIDER'],
        defaultDrawingNumber,
        currentDrawingRevision,
        materialSpecification,
        criticalComponent,
        traceabilityRequired,
        permanentIdRequired,
        notes,
        valid,
        validationMessage,
      };
    });
  };

  const handleCreateComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partNumber.trim() || !formData.description.trim()) {
      alert('Part Number and Description are required.');
      return;
    }

    const ok = await addComponent({
      partNumber: formData.partNumber.trim().toUpperCase(),
      description: formData.description.trim(),
      category: formData.category,
      machineTypes: formData.machineTypes,
      criticalComponent: formData.criticalComponent,
      defaultDrawingNumber: formData.defaultDrawingNumber.trim().toUpperCase(),
      currentDrawingRevision: formData.currentDrawingRevision.trim().toUpperCase(),
      drawingNumber: formData.defaultDrawingNumber.trim().toUpperCase(),
      materialSpecification: formData.materialSpecification.trim(),
      traceabilityRequired: formData.traceabilityRequired,
      permanentIdRequired: formData.permanentIdRequired,
      active: formData.active,
      notes: formData.notes.trim(),
    });

    if (ok) {
      setIsCreateModalOpen(false);
      setFormData({
        partNumber: '',
        description: '',
        category: 'SHAFT',
        machineTypes: ['DIVIDER'],
        criticalComponent: true,
        defaultDrawingNumber: 'DWG-DIV-101',
        currentDrawingRevision: 'C',
        materialSpecification: 'EN24T High-Tensile Alloy Steel',
        traceabilityRequired: true,
        permanentIdRequired: true,
        active: true,
        notes: '',
      });
    }
  };

  const handleToggleFlag = async (
    comp: Component,
    field: 'criticalComponent' | 'traceabilityRequired' | 'permanentIdRequired' | 'active'
  ) => {
    if (!canManage) {
      alert(
        `Only authorized Engineering, HSEQ, or Administrator users may modify Component Master flags (Your role: ${currentUser.role}).`
      );
      return;
    }
    await updateComponent(comp.id, { [field]: !comp[field] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            Component Master &amp; Parts Register
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manufacturing records validate Part Numbers against this register and dynamically enforce Critical Component, Traceability, and Permanent ID flags.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              const templateRows = [
                {
                  'Part Number': 'T0559-058-719-00-02-012-01',
                  Description: '55,2 X 2 THK PLT X 55,6 LG (BULK HOPPER CORNER 4)',
                  Category: 'FRAME',
                  'Machine Types': 'DIVIDER',
                  'Default Drawing Number': 'T0559-058-719-00-02-012-00',
                  'Current Revision': '0',
                  'Material Specification': 'S/S 304 SATIN',
                  'Critical Component': 'YES',
                  'Traceability Required': 'YES',
                  'Permanent ID Required': 'YES',
                  Notes: 'MANUF-INT — Bulk Hopper Corner 4 Plate Item 1',
                },
                {
                  'Part Number': 'T0559-058-719-00-02-012-02',
                  Description: '20 X 2 THK PLT X 88,3 LG (BULK HOPPER CORNER 4)',
                  Category: 'FRAME',
                  'Machine Types': 'DIVIDER',
                  'Default Drawing Number': 'T0559-058-719-00-02-012-00',
                  'Current Revision': '0',
                  'Material Specification': 'S/S 304 SATIN',
                  'Critical Component': 'YES',
                  'Traceability Required': 'YES',
                  'Permanent ID Required': 'YES',
                  Notes: 'MANUF-INT — Bulk Hopper Corner 4 Plate Item 2',
                },
              ];
              const criteriaRows = [
                {
                  Column: 'Part Number',
                  Required: 'YES (Mandatory & Unique)',
                  Allowed_Format: 'Uppercase Part Code e.g. T0559-058-719-00-02-012-01 or PART-DIV-010',
                },
                {
                  Column: 'Description',
                  Required: 'YES (Mandatory)',
                  Allowed_Format: 'Part description / dimensions e.g. 55,2 X 2 THK PLT X 55,6 LG',
                },
                {
                  Column: 'Category',
                  Required: 'Optional (default: OTHER)',
                  Allowed_Format: 'SHAFT, DRUM, ROLLER, BEARING_BLOCK, SPROCKET, HOUSING, FRAME, GEAR, OTHER',
                },
                {
                  Column: 'Machine Types',
                  Required: 'Optional (default: DIVIDER)',
                  Allowed_Format: `Semicolon-separated: ${db.settings.machineTypes.join(', ')}`,
                },
                {
                  Column: 'Default Drawing Number',
                  Required: 'Optional (auto-derived if blank)',
                  Allowed_Format: 'Approved Drawing Number e.g. T0559-058-719-00-02-012-00',
                },
                {
                  Column: 'Current Revision',
                  Required: 'Optional (default: 0)',
                  Allowed_Format: 'Revision code e.g. 0, 1, A, B, C',
                },
                {
                  Column: 'Material Specification',
                  Required: 'Optional (default: S/S 304 SATIN)',
                  Allowed_Format: 'Material grade e.g. S/S 304 SATIN, EN24T, AISI 316L',
                },
                {
                  Column: 'Critical Component',
                  Required: 'Optional (default: YES)',
                  Allowed_Format: 'YES or NO',
                },
                {
                  Column: 'Traceability Required',
                  Required: 'Optional (default: YES)',
                  Allowed_Format: 'YES or NO',
                },
                {
                  Column: 'Permanent ID Required',
                  Required: 'Optional (default: YES)',
                  Allowed_Format: 'YES or NO',
                },
                {
                  Column: 'Notes',
                  Required: 'Optional',
                  Allowed_Format: 'Free text engineering / manufacturing notes',
                },
              ];
              const wb = XLSX.utils.book_new();
              const wsParts = XLSX.utils.json_to_sheet(templateRows);
              wsParts['!cols'] = [
                { wch: 28 },
                { wch: 42 },
                { wch: 16 },
                { wch: 18 },
                { wch: 28 },
                { wch: 16 },
                { wch: 24 },
                { wch: 18 },
                { wch: 20 },
                { wch: 20 },
                { wch: 36 },
              ];
              const wsCriteria = XLSX.utils.json_to_sheet(criteriaRows);
              wsCriteria['!cols'] = [{ wch: 24 }, { wch: 30 }, { wch: 64 }];
              XLSX.utils.book_append_sheet(wb, wsParts, 'Parts_Import');
              XLSX.utils.book_append_sheet(wb, wsCriteria, 'Criteria_Guide');
              XLSX.writeFile(wb, 'MACHINE_QMS_Parts_Import_Template.xlsx');
            }}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            Download Excel Template (.xlsx)
          </button>

          <button
            onClick={() => {
              const exportRows = db.components.map((c) => ({
                'Part Number': c.partNumber,
                Description: c.description,
                Category: c.category,
                'Machine Types': (c.machineTypes || []).join(';'),
                'Default Drawing Number': c.defaultDrawingNumber,
                'Current Revision': c.currentDrawingRevision,
                'Material Specification': c.materialSpecification,
                'Critical Component': c.criticalComponent ? 'YES' : 'NO',
                'Traceability Required': c.traceabilityRequired ? 'YES' : 'NO',
                'Permanent ID Required': c.permanentIdRequired ? 'YES' : 'NO',
                Status: c.active ? 'ACTIVE' : 'INACTIVE',
                Notes: c.notes || '',
              }));
              const wb = XLSX.utils.book_new();
              const ws = XLSX.utils.json_to_sheet(exportRows);
              XLSX.utils.book_append_sheet(wb, ws, 'Parts_Component_Master');
              XLSX.writeFile(
                wb,
                `MACHINE_QMS_Parts_Component_Master_${new Date().toISOString().slice(0, 10)}.xlsx`
              );
            }}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            Export Excel (.xlsx)
          </button>

          <button
            onClick={() => setIsMachineBomModalOpen(true)}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            title="Upload a multi-sheet Machine CAD BOM & Progress Excel workbook (.xlsx) per machine to extract and populate Project, Machine, Controlled Drawings, and Parts"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Machine CAD BOM (.xlsx)
          </button>

          <button
            onClick={() => {
              setImportMessage(null);
              setPasteText('');
              setParsedRows([]);
              setIsImportModalOpen(true);
            }}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Parts (.xlsx / .csv)
          </button>

          {canManage && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Register New Component
            </button>
          )}

          {isAdmin && db.components.length > 0 && (
            <>
              {!confirmClearCompsList ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearCompsList(true)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                  title="Administrator: Clear entire Component Master / Parts List"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Parts List ({db.components.length})
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded text-xs">
                  <span className="font-bold text-rose-900">Clear all {db.components.length} parts?</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await clearCollectionList('components');
                      setConfirmClearCompsList(false);
                    }}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[11px]"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearCompsList(false)}
                    className="px-2 py-0.5 bg-white text-slate-700 border border-slate-300 rounded font-semibold text-[11px]"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Part Number (e.g. PART-DIV-001 or T0559-058-719-00-02-012-01), description, drawing, material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 py-1.5 px-2.5"
          >
            <option value="ALL">All Categories</option>
            <option value="SHAFT">Shaft</option>
            <option value="DRUM">Drum</option>
            <option value="ROLLER">Roller</option>
            <option value="BEARING_BLOCK">Bearing Block</option>
            <option value="SPROCKET">Sprocket</option>
            <option value="HOUSING">Housing</option>
            <option value="FRAME">Frame</option>
            <option value="GEAR">Gear</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={criticalFilter}
            onChange={(e) => setCriticalFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 py-1.5 px-2.5"
          >
            <option value="ALL">All Criticality</option>
            <option value="CRITICAL">Critical Components Only</option>
            <option value="NON_CRITICAL">Non-Critical Only</option>
          </select>
        </div>
      </div>

      {/* Component Master Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white uppercase font-mono text-[10px] tracking-wider">
                <th className="py-3 px-4">Part Number</th>
                <th className="py-3 px-4">Description &amp; Category</th>
                <th className="py-3 px-4">Allocated Drawing / Rev</th>
                <th className="py-3 px-4">Allocated Projects &amp; Machines</th>
                <th className="py-3 px-4">Material Spec</th>
                <th className="py-3 px-4 text-center">QMS Flags</th>
                <th className="py-3 px-4 text-center">Mfg Records</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredComponents.map((comp) => {
                const xref =
                  crossRefsByCompId.get(comp.id) || getComponentCrossReferences(db, comp);
                const primaryDwg =
                  xref.drawings.find((d) => d.isCurrent) || xref.drawings[0];

                return (
                  <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700 align-top">
                      {comp.partNumber}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="font-bold text-slate-900">{comp.description}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {comp.category} • Types: {comp.machineTypes.join(', ')}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono align-top">
                      <button
                        type="button"
                        onClick={() =>
                          navigateToCrossRef(
                            'drawings',
                            comp.defaultDrawingNumber,
                            primaryDwg?.id
                          )
                        }
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded font-bold text-emerald-900 transition-colors"
                        title="Open Drawing in Drawings Register"
                      >
                        <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                        {comp.defaultDrawingNumber} Rev{' '}
                        {primaryDwg?.revision || comp.currentDrawingRevision}
                      </button>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {xref.projects.length === 0 ? (
                            <span className="text-[10px] text-slate-400 italic">No projects</span>
                          ) : (
                            xref.projects.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() =>
                                  navigateToCrossRef('projects', p.projectNumber, p.id)
                                }
                                className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded font-mono text-[10px] font-bold inline-flex items-center gap-1"
                                title={`${p.projectName} — Click to open in Project Register`}
                              >
                                <FolderKanban className="w-2.5 h-2.5 text-blue-600" />
                                {p.projectNumber}
                              </button>
                            ))
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {xref.machines.slice(0, 3).map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() =>
                                navigateToCrossRef('machines', m.serialNumber, m.id)
                              }
                              className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-mono text-[10px]"
                              title={`Machine ${m.serialNumber} (${m.machineType})`}
                            >
                              {m.serialNumber}
                            </button>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 align-top">
                      {comp.materialSpecification}
                    </td>
                    <td className="py-3 px-4 text-center align-top space-y-1">
                      <div>
                        <button
                          onClick={() => handleToggleFlag(comp, 'criticalComponent')}
                          title="Click to toggle Critical Component flag"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            comp.criticalComponent
                              ? 'bg-rose-100 text-rose-900 border-rose-300'
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          {comp.criticalComponent ? 'CRITICAL' : 'STANDARD'}
                        </button>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleToggleFlag(comp, 'traceabilityRequired')}
                          title="Toggle Traceability Req"
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${
                            comp.traceabilityRequired
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : 'bg-slate-100 text-slate-500 border-slate-300'
                          }`}
                        >
                          {comp.traceabilityRequired ? 'TRACE' : 'NO-TRC'}
                        </button>
                        <button
                          onClick={() => handleToggleFlag(comp, 'permanentIdRequired')}
                          title="Toggle Permanent ID Req"
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${
                            comp.permanentIdRequired
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-slate-100 text-slate-500 border-slate-300'
                          }`}
                        >
                          {comp.permanentIdRequired ? 'PERM-ID' : 'NO-ID'}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center align-top">
                      <span className="font-mono font-bold bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
                        {xref.manufacturingRecords.length}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right align-top whitespace-nowrap space-x-1">
                      <button
                        type="button"
                        onClick={() => setSelectedComponent(comp)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1"
                      >
                        <Layers className="w-3 h-3 text-amber-400" />
                        Cross-Ref
                      </button>
                      <button
                        onClick={() => handleToggleFlag(comp, 'active')}
                        title="Click to toggle Active / Inactive status"
                      >
                        <StatusBadge status={comp.active ? 'ACTIVE' : 'INACTIVE'} />
                      </button>
                      {isAdmin && (
                        <>
                          {confirmDeleteCompId !== comp.id ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteCompId(comp.id)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-[11px] font-bold inline-flex items-center gap-1"
                              title={`Delete Part ${comp.partNumber}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded text-[10px]">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteComponent(comp.id);
                                  setConfirmDeleteCompId(null);
                                }}
                                className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteCompId(null)}
                                className="px-1.5 py-0.5 bg-white text-slate-700 border border-slate-300 rounded font-semibold"
                              >
                                Cancel
                              </button>
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Component Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New Component in Component Master"
        subtitle="Defines Part Number, default Approved Drawing, and QMS Applicability Flags"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateComponent} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Part Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. PART-DIV-010"
                value={formData.partNumber}
                onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Category *</label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value as ComponentCategory })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
              >
                <option value="SHAFT">SHAFT</option>
                <option value="DRUM">DRUM</option>
                <option value="ROLLER">ROLLER</option>
                <option value="BEARING_BLOCK">BEARING_BLOCK</option>
                <option value="SPROCKET">SPROCKET</option>
                <option value="HOUSING">HOUSING</option>
                <option value="FRAME">FRAME</option>
                <option value="GEAR">GEAR</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Component Description *</label>
            <input
              type="text"
              required
              placeholder="e.g. Secondary Eccentric Drive Shaft"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Default Drawing Number *</label>
              <input
                type="text"
                required
                value={formData.defaultDrawingNumber}
                onChange={(e) =>
                  setFormData({ ...formData, defaultDrawingNumber: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Current Revision *</label>
              <input
                type="text"
                required
                value={formData.currentDrawingRevision}
                onChange={(e) =>
                  setFormData({ ...formData, currentDrawingRevision: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Material Specification *</label>
              <input
                type="text"
                required
                value={formData.materialSpecification}
                onChange={(e) =>
                  setFormData({ ...formData, materialSpecification: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
            <div className="font-bold text-slate-800 uppercase font-mono text-[10px]">
              Mandatory QMS Applicability Controls
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.criticalComponent}
                onChange={(e) =>
                  setFormData({ ...formData, criticalComponent: e.target.checked })
                }
              />
              <span className="font-semibold text-slate-800">
                Critical Component (Enforces Approved Drawing &amp; Full QMS Inspection Sheet)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.traceabilityRequired}
                onChange={(e) =>
                  setFormData({ ...formData, traceabilityRequired: e.target.checked })
                }
              />
              <span className="font-semibold text-slate-800">
                Traceability Reference Required (QG-01)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.permanentIdRequired}
                onChange={(e) =>
                  setFormData({ ...formData, permanentIdRequired: e.target.checked })
                }
              />
              <span className="font-semibold text-slate-800">
                Permanent Physical Identification Required (QG-06: Laser/Stamp/Engrave Verification)
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
            >
              Register Component
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Parts / Components from Excel / CSV Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Bulk Import Parts / Components (Excel / CSV)"
        subtitle="Upload an Excel (.xlsx) or CSV (.csv) file or paste rows copied directly from an Excel sheet"
        maxWidth="4xl"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Required Excel Columns (in order — or standard Drawing BOM format):
            </div>
            <div className="font-mono text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200 overflow-x-auto">
              1. Part Number* | 2. Description* | 3. Category | 4. Machine Types (; separated) | 5. Default Drawing Number | 6. Current Revision | 7. Material Specification | 8. Critical Component (YES/NO) | 9. Traceability Required (YES/NO) | 10. Permanent ID Required (YES/NO) | 11. Notes
            </div>
            <div className="text-[11px] text-slate-500">
              <strong>Allowed Categories:</strong>{' '}
              <code className="font-mono">
                SHAFT, DRUM, ROLLER, BEARING_BLOCK, SPROCKET, HOUSING, FRAME, GEAR, OTHER
              </code>{' '}
              &nbsp;|&nbsp; Also supports importing standard Drawing Parts Lists (
              <code className="font-mono">ITEM | QTY | PART NUMBER | DESCRIPTION | MATERIAL | DESIGNATION</code>).
            </div>
          </div>

          {importMessage && (
            <div
              className={`p-3 rounded-lg border flex items-start gap-2 font-semibold ${
                importMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {importMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{importMessage.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Option A: Upload Excel (.xlsx, .xls) or CSV (.csv) File
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt,.tsv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
                      const workbook = XLSX.read(data, { type: 'array' });
                      const firstSheetName = workbook.SheetNames[0];
                      const worksheet = workbook.Sheets[firstSheetName];
                      const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
                        header: 1,
                        defval: '',
                        raw: false,
                      });
                      const rows = parseRawPartRows(rawRows);
                      setParsedRows(rows);
                    } catch (err: any) {
                      setImportMessage({
                        type: 'error',
                        text: `Failed reading Excel/CSV file: ${err.message || 'Invalid file'}`,
                      });
                    }
                  };
                  reader.readAsArrayBuffer(file);
                }}
                className="w-full p-2 bg-white border border-slate-300 rounded text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Option B: Copy &amp; Paste Rows Directly from Excel
              </label>
              <textarea
                rows={3}
                value={pasteText}
                onChange={(e) => {
                  const text = e.target.value;
                  setPasteText(text);
                  const lines = text
                    .replace(/\r\n/g, '\n')
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean);
                  if (lines.length === 0) {
                    setParsedRows([]);
                    return;
                  }
                  const delim = lines[0].includes('\t') ? '\t' : ',';
                  const rawRows = lines.map((line) => parseCsvLine(line, delim));
                  setParsedRows(parseRawPartRows(rawRows));
                }}
                placeholder="Paste Excel rows here (Tab-separated or Comma-separated)..."
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono text-[11px]"
              />
            </div>
          </div>

          {parsedRows.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-900 text-white px-3 py-2 font-mono text-[11px] font-bold flex items-center justify-between">
                <span>PREVIEW PARSED PART ROWS ({parsedRows.length})</span>
                <span>
                  Valid: {parsedRows.filter((r) => r.valid).length} | Invalid/Duplicate:{' '}
                  {parsedRows.filter((r) => !r.valid).length}
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] uppercase text-slate-600">
                      <th className="py-2 px-2.5">Part Number</th>
                      <th className="py-2 px-2.5">Description</th>
                      <th className="py-2 px-2.5">Category</th>
                      <th className="py-2 px-2.5">Default Drawing</th>
                      <th className="py-2 px-2.5">Material</th>
                      <th className="py-2 px-2.5">Critical</th>
                      <th className="py-2 px-2.5">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className={r.valid ? 'bg-white' : 'bg-rose-50/60'}>
                        <td className="py-2 px-2.5 font-mono font-bold text-blue-700">
                          {r.partNumber || 'MISSING'}
                        </td>
                        <td className="py-2 px-2.5 font-semibold text-slate-900">
                          {r.description || 'MISSING'}
                        </td>
                        <td className="py-2 px-2.5 font-mono text-[10px]">{r.category}</td>
                        <td className="py-2 px-2.5 font-mono text-[10px]">
                          {r.defaultDrawingNumber} (Rev {r.currentDrawingRevision})
                        </td>
                        <td className="py-2 px-2.5 font-mono text-[10px]">
                          {r.materialSpecification}
                        </td>
                        <td className="py-2 px-2.5 font-mono text-[10px]">
                          {r.criticalComponent ? 'CRITICAL' : 'STANDARD'}
                        </td>
                        <td
                          className={`py-2 px-2.5 font-semibold ${
                            r.valid ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {r.validationMessage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium"
            >
              Close
            </button>
            <button
              type="button"
              disabled={parsedRows.filter((r) => r.valid).length === 0}
              onClick={async () => {
                const validRows = parsedRows.filter((r) => r.valid);
                const res = await importComponents(validRows);
                if (res.ok) {
                  setImportMessage({
                    type: 'success',
                    text: `Successfully imported ${res.importedCount} part(s) into the Component Master Register.`,
                  });
                  setParsedRows([]);
                  setPasteText('');
                } else {
                  setImportMessage({
                    type: 'error',
                    text: res.error || 'Failed to import parts.',
                  });
                }
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded font-bold shadow-xs"
            >
              Import {parsedRows.filter((r) => r.valid).length} Valid Part(s)
            </button>
          </div>
        </div>
      </Modal>

      {/* Part / Component Cross-Reference Dossier Modal */}
      {selectedComponent &&
        (() => {
          const xref =
            crossRefsByCompId.get(selectedComponent.id) ||
            getComponentCrossReferences(db, selectedComponent);

          return (
            <Modal
              isOpen={true}
              onClose={() => setSelectedComponent(null)}
              title={`Part / Component Cross-Reference Dossier: ${selectedComponent.partNumber}`}
              subtitle={`${selectedComponent.description} • Material: ${selectedComponent.materialSpecification}`}
              maxWidth="3xl"
            >
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 text-white p-3.5 rounded-lg font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[9px]">PART NUMBER</span>
                    <span className="font-bold text-amber-300">
                      {selectedComponent.partNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">LINKED DRAWINGS</span>
                    <span className="font-bold text-emerald-300">
                      {xref.drawings.length} Drawing(s)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">ALLOCATED PROJECTS</span>
                    <span className="font-bold text-blue-300">
                      {xref.projects.length} Project(s)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">MACHINES / MFG</span>
                    <span className="font-bold text-indigo-300">
                      {xref.machines.length} Mch / {xref.manufacturingRecords.length} Mfg
                    </span>
                  </div>
                </div>

                {/* Linked Drawings */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Linked Engineering Drawings ({xref.drawings.length})</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {xref.drawings.map((d) => (
                      <div
                        key={d.id}
                        className="p-2.5 flex items-center justify-between hover:bg-slate-50"
                      >
                        <div>
                          <div className="font-mono font-bold text-emerald-900">
                            {d.drawingNumber} (Rev {d.revision}) — {d.drawingTitle}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Status: {d.drawingStatus} | Effective: {d.effectiveDate}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedComponent(null);
                            navigateToCrossRef('drawings', d.drawingNumber, d.id);
                          }}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-semibold inline-flex items-center gap-1"
                        >
                          <span>Open Drawing</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Allocated Projects & Machines */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-1.5">
                      <FolderKanban className="w-4 h-4 text-blue-600" />
                      <span>Allocated Projects ({xref.projects.length})</span>
                    </div>
                    <div className="divide-y divide-slate-200 max-h-40 overflow-y-auto">
                      {xref.projects.map((p) => (
                        <div
                          key={p.id}
                          className="p-2.5 flex items-center justify-between hover:bg-slate-50"
                        >
                          <div>
                            <div className="font-mono font-bold text-blue-900">
                              {p.projectNumber}
                            </div>
                            <div className="text-[10px] text-slate-600">{p.projectName}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedComponent(null);
                              navigateToCrossRef('projects', p.projectNumber, p.id);
                            }}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded font-semibold text-[10px] inline-flex items-center gap-1"
                          >
                            <span>Project</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-blue-600" />
                      <span>Allocated Machines ({xref.machines.length})</span>
                    </div>
                    <div className="divide-y divide-slate-200 max-h-40 overflow-y-auto">
                      {xref.machines.map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 flex items-center justify-between hover:bg-slate-50"
                        >
                          <div>
                            <div className="font-mono font-bold text-slate-900">
                              {m.serialNumber}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {m.machineType} • {m.customer}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedComponent(null);
                              navigateToCrossRef('machines', m.serialNumber, m.id);
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded font-semibold text-[10px] inline-flex items-center gap-1"
                          >
                            <span>Machine</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Manufacturing Records */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-1.5">
                    <Hammer className="w-4 h-4 text-indigo-600" />
                    <span>
                      Manufacturing &amp; Traceability Records ({xref.manufacturingRecords.length})
                    </span>
                  </div>
                  <div className="divide-y divide-slate-200 max-h-40 overflow-y-auto">
                    {xref.manufacturingRecords.length === 0 ? (
                      <div className="p-3 text-center text-slate-400">
                        No manufacturing records logged for this part yet.
                      </div>
                    ) : (
                      xref.manufacturingRecords.map((r) => (
                        <div
                          key={r.id}
                          className="p-2.5 flex items-center justify-between hover:bg-slate-50"
                        >
                          <div className="font-mono">
                            <span className="font-bold text-indigo-900">
                              {r.traceabilityNumber}
                            </span>{' '}
                            — Machine: {r.machineSerialNumber} (Project: {r.projectNumber}) | Qty:{' '}
                            {r.quantity}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedComponent(null);
                              navigateToCrossRef('manufacturing', r.traceabilityNumber, r.id);
                            }}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded font-semibold text-[10px] inline-flex items-center gap-1"
                          >
                            <span>Open Mfg</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSelectedComponent(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </Modal>
          );
        })()}
      <MachineBomImportModal
        isOpen={isMachineBomModalOpen}
        onClose={() => setIsMachineBomModalOpen(false)}
      />
    </div>
  );
};
