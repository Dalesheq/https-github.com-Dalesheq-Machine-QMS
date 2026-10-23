import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useQMS } from '../context/QMSContext';
import { Machine, MachineManufacturingStatus, MachineAssemblyStatus } from '../types';
import { getMachineCrossReferences } from '../utils/crossReference';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { MachineBomImportModal } from '../components/MachineBomImportModal';
import {
  Cpu,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  FolderKanban,
  Wrench,
  Hammer,
  ExternalLink,
  Layers,
  Trash2,
  Boxes,
} from 'lucide-react';

interface ParsedMachineRow {
  serialNumber: string;
  machineType: string;
  customer: string;
  projectNumber: string;
  projectName: string;
  manufacturingStatus: MachineManufacturingStatus;
  assemblyStatus: MachineAssemblyStatus;
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

interface MachinesModuleProps {
  onViewMachineComponents: (serialNumber: string) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
}

export const MachinesModule: React.FC<MachinesModuleProps> = ({
  onViewMachineComponents,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) => {
  const {
    db,
    currentUser,
    addMachine,
    importMachines,
    deleteMachine,
    clearCollectionList,
    crossNavTarget,
    navigateToCrossRef,
    clearCrossNavTarget,
  } = useQMS();
  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const [confirmDeleteMachineId, setConfirmDeleteMachineId] = useState<string | null>(null);
  const [confirmClearMachinesList, setConfirmClearMachinesList] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  useEffect(() => {
    if (crossNavTarget && crossNavTarget.tab === 'machines') {
      if (crossNavTarget.searchQuery) {
        setSearchTerm(crossNavTarget.searchQuery);
        const matched = db.machines.find(
          (m) =>
            m.serialNumber.toUpperCase() === crossNavTarget.searchQuery?.toUpperCase() ||
            m.id === crossNavTarget.recordId
        );
        if (matched) {
          setSelectedMachine(matched);
        }
      }
      clearCrossNavTarget();
    }
  }, [crossNavTarget, db.machines, clearCrossNavTarget]);

  const crossRefsByMachineId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getMachineCrossReferences>>();
    db.machines.forEach((m) => {
      map.set(m.id, getMachineCrossReferences(db, m));
    });
    return map;
  }, [db]);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMachineBomModalOpen, setIsMachineBomModalOpen] = useState(false);
  const [bomTargetMachine, setBomTargetMachine] = useState<Machine | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedMachineRow[]>([]);
  const [importMessage, setImportMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    machineType: 'DIVIDER',
    serialNumber: '',
    customer: '',
    projectNumber: '',
    projectName: '',
    manufacturingStatus: 'IN_PRODUCTION' as MachineManufacturingStatus,
    assemblyStatus: 'NOT_STARTED' as MachineAssemblyStatus,
    notes: '',
  });

  const filteredMachines = db.machines.filter((m) => {
    const matchesSearch =
      m.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.projectNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.projectName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === 'ALL' || m.machineType === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || m.manufacturingStatus === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const parseRawMachineRows = (rawRows: any[][]): ParsedMachineRow[] => {
    const nonEmpty = rawRows.filter(
      (r) => Array.isArray(r) && r.some((cell) => String(cell || '').trim() !== '')
    );
    if (nonEmpty.length === 0) return [];

    const firstRowLower = nonEmpty[0].map((c) => String(c || '').trim().toLowerCase());
    const hasHeader =
      firstRowLower.some((h) => h.includes('serial') || h.includes('machine') || h.includes('customer'));
    const startIdx = hasHeader ? 1 : 0;

    // Map column indices dynamically if header exists, else positional:
    // 0: Serial Number, 1: Machine Type, 2: Customer, 3: Project Number, 4: Project Name, 5: Manufacturing Status, 6: Assembly Status, 7: Notes
    const findCol = (keywords: string[], fallbackIdx: number) => {
      if (!hasHeader) return fallbackIdx;
      const idx = firstRowLower.findIndex((h) => keywords.some((kw) => h.includes(kw)));
      return idx >= 0 ? idx : fallbackIdx;
    };

    const idxSerial = findCol(['serial'], 0);
    const idxType = findCol(['machine type', 'type'], 1);
    const idxCustomer = findCol(['customer', 'client'], 2);
    const idxProjNum = findCol(['project number', 'project no', 'project code'], 3);
    const idxProjName = findCol(['project name', 'contract'], 4);
    const idxMfgStatus = findCol(['manufacturing status', 'mfg status', 'production status'], 5);
    const idxAssyStatus = findCol(['assembly status', 'assembly stage', 'assembly'], 6);
    const idxNotes = findCol(['note', 'comment', 'remark'], 7);

    const existingSerials = new Set(db.machines.map((m) => m.serialNumber.trim().toUpperCase()));
    const seenInFile = new Set<string>();

    const allowedMfgStatuses: MachineManufacturingStatus[] = [
      'PLANNED',
      'IN_PRODUCTION',
      'QUALITY_HOLD',
      'COMPLETED',
      'DELIVERED',
    ];
    const allowedAssyStatuses: MachineAssemblyStatus[] = [
      'NOT_STARTED',
      'SUB_ASSEMBLY',
      'FINAL_ASSEMBLY',
      'TESTING',
      'RELEASED',
    ];

    return nonEmpty.slice(startIdx).map((cols) => {
      const serialNumber = String(cols[idxSerial] ?? '').trim().toUpperCase();
      const machineType = String(cols[idxType] || 'DIVIDER').trim().toUpperCase() || 'DIVIDER';
      const customer = String(cols[idxCustomer] ?? '').trim();
      const projectNumber = String(cols[idxProjNum] || 'PRJ-UNASSIGNED').trim().toUpperCase();
      const projectName = String(cols[idxProjName] || `${machineType} Build`).trim();

      const rawMfg = String(cols[idxMfgStatus] || 'IN_PRODUCTION')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');
      const manufacturingStatus: MachineManufacturingStatus = allowedMfgStatuses.includes(
        rawMfg as MachineManufacturingStatus
      )
        ? (rawMfg as MachineManufacturingStatus)
        : 'IN_PRODUCTION';

      const rawAssy = String(cols[idxAssyStatus] || 'NOT_STARTED')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');
      const assemblyStatus: MachineAssemblyStatus = allowedAssyStatuses.includes(
        rawAssy as MachineAssemblyStatus
      )
        ? (rawAssy as MachineAssemblyStatus)
        : 'NOT_STARTED';

      const notes = String(cols[idxNotes] ?? '').trim();

      let valid = true;
      let validationMessage = 'Ready to import';
      if (!serialNumber || !customer) {
        valid = false;
        validationMessage = 'Missing required Serial Number or Customer';
      } else if (existingSerials.has(serialNumber)) {
        valid = false;
        validationMessage = 'Duplicate Serial Number (already in register)';
      } else if (seenInFile.has(serialNumber)) {
        valid = false;
        validationMessage = 'Duplicate Serial Number within uploaded file';
      } else {
        seenInFile.add(serialNumber);
      }

      return {
        serialNumber,
        machineType,
        customer,
        projectNumber,
        projectName,
        manufacturingStatus,
        assemblyStatus,
        notes,
        valid,
        validationMessage,
      };
    });
  };

  const handleCreateMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serialNumber.trim() || !formData.customer.trim()) {
      alert('Serial Number and Customer are required.');
      return;
    }

    const ok = await addMachine({
      machineType: formData.machineType,
      serialNumber: formData.serialNumber.trim().toUpperCase(),
      customer: formData.customer.trim(),
      projectNumber: formData.projectNumber.trim().toUpperCase() || 'PRJ-UNASSIGNED',
      projectName: formData.projectName.trim() || `${formData.machineType} Build`,
      manufacturingStatus: formData.manufacturingStatus,
      assemblyStatus: formData.assemblyStatus,
      notes: formData.notes.trim(),
    });

    if (ok) {
      setIsCreateModalOpen(false);
      setFormData({
        machineType: 'DIVIDER',
        serialNumber: '',
        customer: '',
        projectNumber: '',
        projectName: '',
        manufacturingStatus: 'IN_PRODUCTION',
        assemblyStatus: 'NOT_STARTED',
        notes: '',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            Machine Register
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Initial focus on the DIVIDER manufacturing line. Configurable for Prover, Oven, Cooler, Conveyor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              const templateRows = [
                {
                  'Serial Number': 'DIV-SN-2026-008',
                  'Machine Type': 'DIVIDER',
                  Customer: 'Cape Artisan Bakeries',
                  'Project Number': 'PRJ-2026-D08',
                  'Project Name': 'Industrial 6-Pocket Dough Divider Line',
                  'Manufacturing Status': 'IN_PRODUCTION',
                  'Assembly Status': 'SUB_ASSEMBLY',
                  Notes: 'Stainless steel food-grade hopper build',
                },
                {
                  'Serial Number': 'RND-SN-2026-004',
                  'Machine Type': 'ROUNDER',
                  Customer: 'SunBake Foods (Pty) Ltd',
                  'Project Number': 'PRJ-2026-P04',
                  'Project Name': 'High-Capacity Conical Rounder',
                  'Manufacturing Status': 'PLANNED',
                  'Assembly Status': 'NOT_STARTED',
                  Notes: 'Paired with DIV-SN-2026-008',
                },
              ];
              const criteriaRows = [
                {
                  Column: 'Serial Number',
                  Required: 'YES (Mandatory & Unique)',
                  Allowed_Format: 'Uppercase serial e.g. DIV-SN-2026-008',
                },
                {
                  Column: 'Machine Type',
                  Required: 'Optional (default: DIVIDER)',
                  Allowed_Format: db.settings.machineTypes.join(', '),
                },
                {
                  Column: 'Customer',
                  Required: 'YES (Mandatory)',
                  Allowed_Format: 'Customer / company name',
                },
                {
                  Column: 'Project Number',
                  Required: 'Optional (default: PRJ-UNASSIGNED)',
                  Allowed_Format: 'Project reference code e.g. PRJ-2026-D08',
                },
                {
                  Column: 'Project Name',
                  Required: 'Optional',
                  Allowed_Format: 'Project / contract title',
                },
                {
                  Column: 'Manufacturing Status',
                  Required: 'Optional (default: IN_PRODUCTION)',
                  Allowed_Format: 'PLANNED, IN_PRODUCTION, ASSEMBLY, QUALITY_HOLD, RELEASED, COMPLETED',
                },
                {
                  Column: 'Assembly Status',
                  Required: 'Optional (default: NOT_STARTED)',
                  Allowed_Format: 'NOT_STARTED, SUB_ASSEMBLY, FINAL_ASSEMBLY, TESTING, READY',
                },
                {
                  Column: 'Notes',
                  Required: 'Optional',
                  Allowed_Format: 'Free text engineering / quality notes',
                },
              ];
              const wb = XLSX.utils.book_new();
              const wsMachines = XLSX.utils.json_to_sheet(templateRows);
              wsMachines['!cols'] = [
                { wch: 20 },
                { wch: 16 },
                { wch: 26 },
                { wch: 18 },
                { wch: 36 },
                { wch: 22 },
                { wch: 18 },
                { wch: 40 },
              ];
              const wsCriteria = XLSX.utils.json_to_sheet(criteriaRows);
              wsCriteria['!cols'] = [{ wch: 24 }, { wch: 30 }, { wch: 56 }];
              XLSX.utils.book_append_sheet(wb, wsMachines, 'Machines_Import');
              XLSX.utils.book_append_sheet(wb, wsCriteria, 'Criteria_Guide');
              XLSX.writeFile(wb, 'MACHINE_QMS_Machine_Import_Template.xlsx');
            }}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            Download Excel Template (.xlsx)
          </button>

          <button
            onClick={() => {
              const exportRows = db.machines.map((m) => ({
                'Serial Number': m.serialNumber,
                'Machine Type': m.machineType,
                Customer: m.customer,
                'Project Number': m.projectNumber,
                'Project Name': m.projectName,
                'Manufacturing Status': m.manufacturingStatus,
                'Assembly Status': m.assemblyStatus,
                'Created By': m.createdBy,
                'Date Created': m.dateCreated,
                Notes: m.notes || '',
              }));
              const wb = XLSX.utils.book_new();
              const ws = XLSX.utils.json_to_sheet(exportRows);
              XLSX.utils.book_append_sheet(wb, ws, 'Machines');
              XLSX.writeFile(
                wb,
                `MACHINE_QMS_Machines_${new Date().toISOString().slice(0, 10)}.xlsx`
              );
            }}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            Export Excel (.xlsx)
          </button>

          <button
            onClick={() => {
              setBomTargetMachine(null);
              setIsMachineBomModalOpen(true);
            }}
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
            Import Machines List (.xlsx / .csv)
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Register Machine
          </button>

          {isAdmin && db.machines.length > 0 && (
            <>
              {!confirmClearMachinesList ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearMachinesList(true)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                  title="Administrator: Clear entire Machines List"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear List ({db.machines.length})
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded text-xs">
                  <span className="font-bold text-rose-900">Clear all {db.machines.length} machines?</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await clearCollectionList('machines');
                      setConfirmClearMachinesList(false);
                    }}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[11px]"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearMachinesList(false)}
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

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by serial number, customer, project number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 py-1.5 px-2.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Machine Types</option>
            {db.settings.machineTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 py-1.5 px-2.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="IN_PRODUCTION">In Production</option>
            <option value="ASSEMBLY">Assembly</option>
            <option value="QUALITY_HOLD">Quality Hold</option>
            <option value="RELEASED">Released</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* Machines Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-600 border-b border-slate-200 uppercase font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Serial Number</th>
                <th className="py-2.5 px-4">Machine Type</th>
                <th className="py-2.5 px-4">Customer &amp; Allocated Project</th>
                <th className="py-2.5 px-4">Allocated Drawings &amp; Parts</th>
                <th className="py-2.5 px-4">Mfg &amp; Assembly Status</th>
                <th className="py-2.5 px-4">Mfg Records</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredMachines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No machines match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredMachines.map((machine) => {
                  const xref =
                    crossRefsByMachineId.get(machine.id) ||
                    getMachineCrossReferences(db, machine);
                  const currentDwgs = xref.drawings.filter((d) => d.isCurrent);
                  const displayDwgs = currentDwgs.length > 0 ? currentDwgs : xref.drawings;

                  return (
                    <tr key={machine.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700 align-top">
                        {machine.serialNumber}
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-800 rounded font-semibold text-[11px]">
                          {machine.machineType}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="font-bold text-slate-900">{machine.customer}</div>
                        <button
                          type="button"
                          onClick={() =>
                            navigateToCrossRef(
                              'projects',
                              machine.projectNumber,
                              xref.project?.id
                            )
                          }
                          className="mt-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded font-mono text-[10px] font-bold inline-flex items-center gap-1"
                          title="Open Project in Project Register"
                        >
                          <FolderKanban className="w-3 h-3 text-blue-600" />
                          <span>{machine.projectNumber}</span>
                          <span className="font-sans font-normal text-slate-600 truncate max-w-36">
                            — {machine.projectName}
                          </span>
                        </button>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {displayDwgs.slice(0, 3).map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() =>
                                  navigateToCrossRef('drawings', d.drawingNumber, d.id)
                                }
                                className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded font-mono text-[10px] font-bold"
                                title={`${d.drawingTitle} — Click to open in Drawings tab`}
                              >
                                {d.drawingNumber} (Rev {d.revision})
                              </button>
                            ))}
                            {displayDwgs.length > 3 && (
                              <span className="text-[10px] font-mono text-slate-500">
                                +{displayDwgs.length - 3} dwgs
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {xref.parts.slice(0, 3).map((pt) => (
                              <button
                                key={pt.partNumber}
                                type="button"
                                onClick={() =>
                                  navigateToCrossRef(
                                    'components',
                                    pt.partNumber,
                                    pt.component?.id
                                  )
                                }
                                className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded font-mono text-[10px] font-semibold"
                                title={`${pt.description} — Click to open in Component Master`}
                              >
                                {pt.partNumber}
                              </button>
                            ))}
                            {xref.parts.length > 3 && (
                              <span className="text-[10px] font-mono text-slate-500">
                                +{xref.parts.length - 3} parts
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top space-y-1">
                        <div>
                          <StatusBadge status={machine.manufacturingStatus} />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            {machine.assemblyStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span className="font-mono font-bold bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
                          {xref.manufacturingRecords.length} record
                          {xref.manufacturingRecords.length !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 align-top whitespace-nowrap">
                        <button
                          onClick={() => {
                            setBomTargetMachine(machine);
                            setIsMachineBomModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1"
                          title={`Import CAD BOM & Engineering Drawings Excel (.xlsx) for Machine ${machine.serialNumber}`}
                        >
                          <Upload className="w-3 h-3" />
                          Import BOM (.xlsx)
                        </button>
                        <button
                          onClick={() => setSelectedMachine(machine)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1"
                          title="View Machine Cross-References (Project, Drawings, Parts, Mfg Records)"
                        >
                          <Layers className="w-3 h-3 text-blue-400" />
                          Allocations ({xref.parts.length})
                        </button>
                        <button
                          onClick={() => onViewMachineComponents(machine.serialNumber)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-semibold border border-blue-200 inline-flex items-center gap-1"
                        >
                          Traceability <ArrowRight className="w-3 h-3" />
                        </button>
                        {isAdmin && (
                          <>
                            {confirmDeleteMachineId !== machine.id ? (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteMachineId(machine.id)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-[11px] font-bold inline-flex items-center gap-1"
                                title={`Delete Machine ${machine.serialNumber}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded text-[10px]">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteMachine(machine.id);
                                    setConfirmDeleteMachineId(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteMachineId(null)}
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Machine Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New Machine Serial"
        subtitle="Add a new machine to the Quality Register (Initial standard: DIVIDER)"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateMachine} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Machine Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.machineType}
                onChange={(e) => setFormData({ ...formData, machineType: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900 font-medium"
                required
              >
                {db.settings.machineTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Machine Serial Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. DIV-2026-00125"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono font-bold uppercase"
                required
              />
              <span className="text-[10px] text-slate-500">Must be unique across all machines</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Apex Industrial Bakeries"
                value={formData.customer}
                onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Project Number</label>
              <input
                type="text"
                placeholder="e.g. PRJ-2026-D04"
                value={formData.projectNumber}
                onChange={(e) => setFormData({ ...formData, projectNumber: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Project Name</label>
            <input
              type="text"
              placeholder="e.g. High Throughput Dough Processing Line"
              value={formData.projectName}
              onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Manufacturing Status</label>
              <select
                value={formData.manufacturingStatus}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    manufacturingStatus: e.target.value as MachineManufacturingStatus,
                  })
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
              >
                <option value="PLANNED">PLANNED</option>
                <option value="IN_PRODUCTION">IN PRODUCTION</option>
                <option value="ASSEMBLY">ASSEMBLY</option>
                <option value="QUALITY_HOLD">QUALITY HOLD</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Assembly Status</label>
              <select
                value={formData.assemblyStatus}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    assemblyStatus: e.target.value as MachineAssemblyStatus,
                  })
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
              >
                <option value="NOT_STARTED">NOT STARTED</option>
                <option value="SUB_ASSEMBLY">SUB ASSEMBLY</option>
                <option value="FINAL_ASSEMBLY">FINAL ASSEMBLY</option>
                <option value="TESTING">TESTING</option>
                <option value="READY">READY</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Engineering / Quality Notes
            </label>
            <textarea
              rows={3}
              placeholder="Specific customer requirements, special bearing clearances, surface treatment specs..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-xs"
            >
              Save Machine to Register
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Machines from Excel / CSV Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Bulk Import Machines (Excel / CSV)"
        subtitle="Upload an Excel (.xlsx) or CSV (.csv) file or paste rows copied directly from an Excel sheet"
        maxWidth="4xl"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-bold text-indigo-950">
                Importing a CAD BOM &amp; Progress Excel Workbook (e.g. T0559-058-719-00-00-000-00)?
              </div>
              <div className="text-[11px] text-indigo-800">
                Use the dedicated Machine CAD BOM Importer to extract all hierarchy levels (M, SA, A, P, B), CAD BOM columns, and Progress sheet fields per machine.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsImportModalOpen(false);
                setBomTargetMachine(null);
                setIsMachineBomModalOpen(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-xs flex items-center gap-1.5 shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Open Machine CAD BOM Importer (.xlsx)
            </button>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Required Excel Columns (in order):
            </div>
            <div className="font-mono text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200 overflow-x-auto">
              1. Serial Number* | 2. Machine Type | 3. Customer* | 4. Project Number | 5. Project Name | 6. Manufacturing Status | 7. Assembly Status | 8. Notes
            </div>
            <div className="text-[11px] text-slate-500">
              <strong>Allowed Machine Types:</strong>{' '}
              <code className="font-mono">{db.settings.machineTypes.join(', ')}</code> &nbsp;|&nbsp;
              <strong>Manufacturing Statuses:</strong>{' '}
              <code className="font-mono">
                PLANNED, IN_PRODUCTION, ASSEMBLY, QUALITY_HOLD, RELEASED, COMPLETED
              </code>
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
                      const rows = parseRawMachineRows(rawRows);
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
                  setParsedRows(parseRawMachineRows(rawRows));
                }}
                placeholder="Paste Excel rows here (Tab-separated or Comma-separated)..."
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono text-[11px]"
              />
            </div>
          </div>

          {parsedRows.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-900 text-white px-3 py-2 font-mono text-[11px] font-bold flex items-center justify-between">
                <span>PREVIEW PARSED MACHINE ROWS ({parsedRows.length})</span>
                <span>
                  Valid: {parsedRows.filter((r) => r.valid).length} | Invalid/Duplicate:{' '}
                  {parsedRows.filter((r) => !r.valid).length}
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] uppercase text-slate-600">
                      <th className="py-2 px-2.5">Serial Number</th>
                      <th className="py-2 px-2.5">Machine Type</th>
                      <th className="py-2 px-2.5">Customer</th>
                      <th className="py-2 px-2.5">Project</th>
                      <th className="py-2 px-2.5">Mfg Status</th>
                      <th className="py-2 px-2.5">Assembly Status</th>
                      <th className="py-2 px-2.5">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className={r.valid ? 'bg-white' : 'bg-rose-50/60'}>
                        <td className="py-2 px-2.5 font-mono font-bold text-blue-700">
                          {r.serialNumber || 'MISSING'}
                        </td>
                        <td className="py-2 px-2.5 font-mono">{r.machineType}</td>
                        <td className="py-2 px-2.5 font-semibold text-slate-900">
                          {r.customer || 'MISSING'}
                        </td>
                        <td className="py-2 px-2.5 font-mono text-[10px]">
                          {r.projectNumber} — {r.projectName}
                        </td>
                        <td className="py-2 px-2.5">
                          <StatusBadge status={r.manufacturingStatus} />
                        </td>
                        <td className="py-2 px-2.5 font-mono text-[10px]">
                          {r.assemblyStatus.replace(/_/g, ' ')}
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
                const res = await importMachines(validRows);
                if (res.ok) {
                  setImportMessage({
                    type: 'success',
                    text: `Successfully imported ${res.importedCount} machine(s) into the Machine Register.`,
                  });
                  setParsedRows([]);
                  setPasteText('');
                } else {
                  setImportMessage({
                    type: 'error',
                    text: res.error || 'Failed to import machines.',
                  });
                }
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded font-bold shadow-xs"
            >
              Import {parsedRows.filter((r) => r.valid).length} Valid Machine(s)
            </button>
          </div>
        </div>
      </Modal>

      {/* Machine Full Cross-Reference & Specification Modal */}
      {selectedMachine &&
        (() => {
          const xref =
            crossRefsByMachineId.get(selectedMachine.id) ||
            getMachineCrossReferences(db, selectedMachine);

          return (
            <Modal
              isOpen={true}
              onClose={() => setSelectedMachine(null)}
              title={`Machine Cross-Reference Dossier: ${selectedMachine.serialNumber}`}
              subtitle={`${selectedMachine.machineType} • Customer: ${selectedMachine.customer} • Project: ${selectedMachine.projectNumber}`}
              maxWidth="4xl"
            >
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 text-white p-3.5 rounded-lg font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[9px]">MACHINE SERIAL</span>
                    <span className="font-bold text-blue-300">{selectedMachine.serialNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">ALLOCATED PROJECT</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMachine(null);
                        navigateToCrossRef(
                          'projects',
                          selectedMachine.projectNumber,
                          xref.project?.id
                        );
                      }}
                      className="font-bold text-emerald-300 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{selectedMachine.projectNumber}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">ALLOCATED DRAWINGS</span>
                    <span className="font-bold text-amber-300">
                      {xref.drawings.length} Drawing(s)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">ALLOCATED PARTS</span>
                    <span className="font-bold text-indigo-300">{xref.parts.length} Part(s)</span>
                  </div>
                </div>

                {/* Allocated Drawings for this Machine */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>
                      Allocated Engineering Drawings ({xref.drawings.length})
                    </span>
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                          <th className="py-1.5 px-3">Drawing Number</th>
                          <th className="py-1.5 px-3">Rev</th>
                          <th className="py-1.5 px-3">Title</th>
                          <th className="py-1.5 px-3">Status</th>
                          <th className="py-1.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {xref.drawings.map((d) => (
                          <tr key={d.id} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 font-mono font-bold text-emerald-900">
                              {d.drawingNumber}
                            </td>
                            <td className="py-1.5 px-3 font-mono font-bold">REV {d.revision}</td>
                            <td className="py-1.5 px-3">{d.drawingTitle}</td>
                            <td className="py-1.5 px-3">
                              <StatusBadge status={d.drawingStatus} />
                            </td>
                            <td className="py-1.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMachine(null);
                                  navigateToCrossRef('drawings', d.drawingNumber, d.id);
                                }}
                                className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-semibold inline-flex items-center gap-1"
                              >
                                <span>Open Drawing</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Allocated Parts for this Machine */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-amber-600" />
                    <span>Allocated Parts &amp; Components ({xref.parts.length})</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                          <th className="py-1.5 px-3">Part Number</th>
                          <th className="py-1.5 px-3">Description</th>
                          <th className="py-1.5 px-3">Drawing &amp; Rev</th>
                          <th className="py-1.5 px-3">Material</th>
                          <th className="py-1.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {xref.parts.map((pt) => (
                          <tr key={pt.partNumber} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 font-mono font-bold text-blue-900">
                              {pt.partNumber}
                            </td>
                            <td className="py-1.5 px-3 font-medium">{pt.description}</td>
                            <td className="py-1.5 px-3 font-mono">
                              {pt.drawingNumber} (Rev {pt.revision})
                            </td>
                            <td className="py-1.5 px-3 font-mono text-slate-600">{pt.material}</td>
                            <td className="py-1.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMachine(null);
                                  navigateToCrossRef(
                                    'components',
                                    pt.partNumber,
                                    pt.component?.id
                                  );
                                }}
                                className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded font-semibold inline-flex items-center gap-1"
                              >
                                <span>Open Part</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Explicit Component Fitment Register */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-900 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-emerald-600" />
                      <span>
                        Explicit Component Fitments ({
                          (db.componentFitments || []).filter(
                            (f) => f.machineSerialNumber === selectedMachine.serialNumber && f.fitmentStatus === 'FITTED'
                          ).length
                        })
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      Physical Machine Assembly
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {(() => {
                      const fitments = (db.componentFitments || []).filter(
                        (f) => f.machineSerialNumber === selectedMachine.serialNumber && f.fitmentStatus === 'FITTED'
                      );
                      const mfgForSerial = db.manufacturingRecords.filter(
                        (r) => r.machineSerialNumber === selectedMachine.serialNumber
                      );
                      const fittedTraceabilityNumbers = new Set(fitments.map((f) => f.traceabilityNumber));
                      const unfittedMfg = mfgForSerial.filter(
                        (r) => !fittedTraceabilityNumbers.has(r.traceabilityNumber)
                      );

                      if (fitments.length === 0 && unfittedMfg.length === 0) {
                        return (
                          <div className="p-3 text-center text-slate-400">
                            No component fitments or manufactured parts recorded for this machine.
                          </div>
                        );
                      }

                      return (
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                              <th className="py-1.5 px-3">Traceability / Part</th>
                              <th className="py-1.5 px-3">Description</th>
                              <th className="py-1.5 px-3">Location on Machine</th>
                              <th className="py-1.5 px-3">Installed By &amp; Date</th>
                              <th className="py-1.5 px-3">Fitment Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {fitments.map((f) => (
                              <tr key={f.id} className="hover:bg-slate-50">
                                <td className="py-1.5 px-3 font-mono font-bold text-emerald-900">
                                  {f.traceabilityNumber}
                                  <div className="text-[10px] text-slate-500 font-normal">{f.partNumber}</div>
                                </td>
                                <td className="py-1.5 px-3 font-medium">{f.partDescription}</td>
                                <td className="py-1.5 px-3 font-mono text-slate-700">
                                  {f.locationOnMachine || 'Main Body'}
                                </td>
                                <td className="py-1.5 px-3 font-mono text-slate-600">
                                  {f.fittedBy} ({f.fittedAt.split('T')[0]})
                                </td>
                                <td className="py-1.5 px-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    FITTED
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {unfittedMfg.map((u) => (
                              <tr key={u.id} className="hover:bg-slate-50 opacity-75">
                                <td className="py-1.5 px-3 font-mono font-bold text-slate-700">
                                  {u.traceabilityNumber}
                                  <div className="text-[10px] text-slate-500 font-normal">{u.partNumber}</div>
                                </td>
                                <td className="py-1.5 px-3 text-slate-700">{u.componentDescription}</td>
                                <td className="py-1.5 px-3 text-slate-400 italic">Not Installed</td>
                                <td className="py-1.5 px-3 text-slate-400 font-mono">Manufactured ({u.manufacturingDate || 'N/A'})</td>
                                <td className="py-1.5 px-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    NOT FITTED
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>

                {/* Manufacturing Records for this Machine */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-1.5">
                    <Hammer className="w-4 h-4 text-indigo-600" />
                    <span>
                      Manufacturing &amp; Traceability Records ({xref.manufacturingRecords.length})
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-200">
                    {xref.manufacturingRecords.length === 0 ? (
                      <div className="p-3 text-center text-slate-400">
                        No manufacturing records logged for this machine serial yet.
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
                            — {r.partNumber} ({r.componentDescription}) | Dwg: {r.drawingNumber}{' '}
                            Rev {r.drawingRevision}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMachine(null);
                              navigateToCrossRef('manufacturing', r.traceabilityNumber, r.id);
                            }}
                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded font-semibold inline-flex items-center gap-1"
                          >
                            <span>Open Record</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => setSelectedMachine(null)}
                    className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium"
                  >
                    Close
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedMachine;
                        setSelectedMachine(null);
                        setBomTargetMachine(target);
                        setIsMachineBomModalOpen(true);
                      }}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Import CAD BOM &amp; Drawings (.xlsx) for {selectedMachine.serialNumber}
                    </button>
                    <button
                      onClick={() => {
                        const serial = selectedMachine.serialNumber;
                        setSelectedMachine(null);
                        onViewMachineComponents(serial);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-2"
                    >
                      View Linked Components Traceability <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Modal>
          );
        })()}

      <MachineBomImportModal
        isOpen={isMachineBomModalOpen}
        onClose={() => setIsMachineBomModalOpen(false)}
        preselectedMachineSerial={bomTargetMachine?.serialNumber}
      />
    </div>
  );
};
