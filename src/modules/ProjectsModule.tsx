import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useQMS } from '../context/QMSContext';
import { Project, ProjectStatus } from '../types';
import { getProjectCrossReferences } from '../utils/crossReference';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import {
  FolderKanban,
  Plus,
  Search,
  Calendar,
  Cpu,
  ArrowRight,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Layers,
  Wrench,
  Hammer,
  ExternalLink,
  Link2,
  Edit3,
  Trash2,
} from 'lucide-react';

interface ProjectsModuleProps {
  onViewMachineComponents: (serialNumber: string) => void;
}

interface ParsedProjectRow {
  rowNum: number;
  projectNumber: string;
  projectName: string;
  customer: string;
  machineType: string;
  machineSerialNumbers: string[];
  projectStatus: ProjectStatus;
  startDate: string;
  targetCompletionDate: string;
  notes: string;
  valid: boolean;
  reason?: string;
}

const VALID_PROJECT_STATUSES: ProjectStatus[] = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'];

export const ProjectsModule: React.FC<ProjectsModuleProps> = ({ onViewMachineComponents }) => {
  const {
    db,
    currentUser,
    addProject,
    updateProject,
    importProjects,
    deleteProject,
    clearCollectionList,
    crossNavTarget,
    navigateToCrossRef,
    clearCrossNavTarget,
  } = useQMS();

  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);
  const [confirmClearProjectsList, setConfirmClearProjectsList] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Quick-allocation selectors inside the Project Dossier Modal
  const [quickAddDrawingNo, setQuickAddDrawingNo] = useState('');
  const [quickAddPartNo, setQuickAddPartNo] = useState('');
  const [quickAddMachineSn, setQuickAddMachineSn] = useState('');

  // Excel / CSV Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedProjectRow[]>([]);
  const [importMessage, setImportMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [formData, setFormData] = useState({
    projectNumber: '',
    projectName: '',
    customer: '',
    machineType: 'DIVIDER',
    selectedSerials: [] as string[],
    selectedDrawings: [] as string[],
    selectedParts: [] as string[],
    projectStatus: 'ACTIVE' as ProjectStatus,
    startDate: new Date().toISOString().split('T')[0],
    targetCompletionDate: '',
    notes: '',
  });

  // Handle incoming cross-navigation from Machines, Drawings, Parts, or Manufacturing tabs
  useEffect(() => {
    if (crossNavTarget && crossNavTarget.tab === 'projects') {
      if (crossNavTarget.searchQuery) {
        setSearchTerm(crossNavTarget.searchQuery);
        const matched = db.projects.find(
          (p) =>
            p.projectNumber.toUpperCase() === crossNavTarget.searchQuery?.toUpperCase() ||
            p.id === crossNavTarget.recordId
        );
        if (matched) {
          setSelectedProjectId(matched.id);
        }
      }
      clearCrossNavTarget();
    }
  }, [crossNavTarget, db.projects, clearCrossNavTarget]);

  const selectedProject = useMemo(
    () => db.projects.find((p) => p.id === selectedProjectId) || null,
    [db.projects, selectedProjectId]
  );

  // Precompute cross-references for all projects
  const crossRefsByProjectId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getProjectCrossReferences>>();
    db.projects.forEach((p) => {
      map.set(p.id, getProjectCrossReferences(db, p));
    });
    return map;
  }, [db]);

  const filteredProjects = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return db.projects;
    return db.projects.filter((p) => {
      const xref = crossRefsByProjectId.get(p.id);
      const dwgMatch = xref?.drawings.some(
        (d) =>
          d.drawingNumber.toLowerCase().includes(q) || d.drawingTitle.toLowerCase().includes(q)
      );
      const partMatch = xref?.parts.some(
        (pt) =>
          pt.partNumber.toLowerCase().includes(q) || pt.description.toLowerCase().includes(q)
      );
      const mchMatch = xref?.machines.some((m) => m.serialNumber.toLowerCase().includes(q));
      return (
        p.projectNumber.toLowerCase().includes(q) ||
        p.projectName.toLowerCase().includes(q) ||
        p.customer.toLowerCase().includes(q) ||
        Boolean(dwgMatch) ||
        Boolean(partMatch) ||
        Boolean(mchMatch)
      );
    });
  }, [db.projects, searchTerm, crossRefsByProjectId]);

  const currentDrawingsList = useMemo(
    () => db.drawings.filter((d) => d.isCurrent),
    [db.drawings]
  );

  const openCreateProjectModal = () => {
    setEditingProject(null);
    setFormData({
      projectNumber: '',
      projectName: '',
      customer: '',
      machineType: 'DIVIDER',
      selectedSerials: [],
      selectedDrawings: [],
      selectedParts: [],
      projectStatus: 'ACTIVE',
      startDate: new Date().toISOString().split('T')[0],
      targetCompletionDate: '',
      notes: '',
    });
    setIsCreateModalOpen(true);
  };

  const openEditProjectModal = (project: Project) => {
    const xref = crossRefsByProjectId.get(project.id) || getProjectCrossReferences(db, project);
    setEditingProject(project);
    setFormData({
      projectNumber: project.projectNumber,
      projectName: project.projectName,
      customer: project.customer,
      machineType: project.machineType || 'DIVIDER',
      selectedSerials: Array.from(
        new Set([
          ...(project.associatedSerialNumbers || []),
          ...xref.machines.map((m) => m.serialNumber),
        ])
      ),
      selectedDrawings: Array.from(
        new Set([
          ...(project.allocatedDrawingNumbers || []),
          ...xref.drawings.map((d) => d.drawingNumber),
        ])
      ),
      selectedParts: Array.from(
        new Set([
          ...(project.allocatedPartNumbers || []),
          ...xref.parts.map((pt) => pt.partNumber),
        ])
      ),
      projectStatus: project.projectStatus,
      startDate: project.startDate,
      targetCompletionDate: project.targetCompletionDate,
      notes: project.notes || '',
    });
    setIsCreateModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectNumber || !formData.projectName || !formData.customer) return;

    if (editingProject) {
      const ok = await updateProject(editingProject.id, {
        projectNumber: formData.projectNumber.trim().toUpperCase(),
        projectName: formData.projectName.trim(),
        customer: formData.customer.trim(),
        machineType: formData.machineType,
        associatedSerialNumbers: formData.selectedSerials,
        machineSerialNumbers: formData.selectedSerials,
        allocatedDrawingNumbers: formData.selectedDrawings,
        allocatedPartNumbers: formData.selectedParts,
        projectStatus: formData.projectStatus,
        startDate: formData.startDate,
        targetCompletionDate: formData.targetCompletionDate || '2026-12-31',
        notes: formData.notes,
      });
      if (ok) {
        setIsCreateModalOpen(false);
        setEditingProject(null);
      }
      return;
    }

    const ok = await addProject({
      projectNumber: formData.projectNumber.trim().toUpperCase(),
      projectName: formData.projectName.trim(),
      customer: formData.customer.trim(),
      machineType: formData.machineType,
      associatedSerialNumbers: formData.selectedSerials,
      machineSerialNumbers: formData.selectedSerials,
      allocatedDrawingNumbers: formData.selectedDrawings,
      allocatedPartNumbers: formData.selectedParts,
      projectStatus: formData.projectStatus,
      startDate: formData.startDate,
      targetCompletionDate: formData.targetCompletionDate || '2026-12-31',
      notes: formData.notes,
    });

    if (ok) {
      setIsCreateModalOpen(false);
    }
  };

  const toggleItemInList = (
    listKey: 'selectedSerials' | 'selectedDrawings' | 'selectedParts',
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [listKey]: prev[listKey].includes(value)
        ? prev[listKey].filter((item) => item !== value)
        : [...prev[listKey], value],
    }));
  };

  // Quick-allocate Drawing, Part, or Machine from inside the Project Dossier Modal
  const handleQuickAllocateDrawing = async (project: Project) => {
    if (!quickAddDrawingNo) return;
    const currentDwgs = project.allocatedDrawingNumbers || [];
    if (!currentDwgs.includes(quickAddDrawingNo)) {
      await updateProject(project.id, {
        allocatedDrawingNumbers: [...currentDwgs, quickAddDrawingNo],
      });
    }
    setQuickAddDrawingNo('');
  };

  const handleQuickAllocatePart = async (project: Project) => {
    if (!quickAddPartNo) return;
    const currentParts = project.allocatedPartNumbers || [];
    if (!currentParts.includes(quickAddPartNo)) {
      await updateProject(project.id, {
        allocatedPartNumbers: [...currentParts, quickAddPartNo],
      });
    }
    setQuickAddPartNo('');
  };

  const handleQuickAllocateMachine = async (project: Project) => {
    if (!quickAddMachineSn) return;
    const currentSerials = project.associatedSerialNumbers || [];
    if (!currentSerials.includes(quickAddMachineSn)) {
      await updateProject(project.id, {
        associatedSerialNumbers: [...currentSerials, quickAddMachineSn],
        machineSerialNumbers: [...currentSerials, quickAddMachineSn],
      });
    }
    setQuickAddMachineSn('');
  };

  // Download native .xlsx Excel Template for Projects
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Project Number*': 'PRJ-2026-201',
        'Project Name*': 'Automated High-Speed Divider & Rounder Line #4',
        'Customer*': 'Sunrise Industrial Bakeries',
        'Machine Type': 'DIVIDER',
        'Machine Serial Numbers (; separated)': 'DIV-SN-2026-001; RND-SN-2026-001',
        'Project Status': 'ACTIVE',
        'Start Date (YYYY-MM-DD)': '2026-04-01',
        'Target Completion Date (YYYY-MM-DD)': '2026-08-30',
        Notes: 'Full critical component traceability required',
      },
      {
        'Project Number*': 'PRJ-2026-202',
        'Project Name*': 'Intermediate Overhead Proofer Line #2',
        'Customer*': 'Continental Foods Group',
        'Machine Type': 'OVERHEAD PROOFER',
        'Machine Serial Numbers (; separated)': '',
        'Project Status': 'PLANNING',
        'Start Date (YYYY-MM-DD)': '2026-05-15',
        'Target Completion Date (YYYY-MM-DD)': '2026-10-15',
        Notes: 'Stainless steel frame execution',
      },
    ];

    const criteriaGuide = [
      { Field: 'Project Number*', Requirement: 'REQUIRED (Unique)', Allowed_Values: 'e.g. PRJ-2026-201, T0559' },
      { Field: 'Project Name*', Requirement: 'REQUIRED', Allowed_Values: 'Full contract/project description' },
      { Field: 'Customer*', Requirement: 'REQUIRED', Allowed_Values: 'Client / customer company name' },
      {
        Field: 'Machine Type',
        Requirement: 'Optional (defaults to DIVIDER)',
        Allowed_Values: db.settings.machineTypes.join(', '),
      },
      {
        Field: 'Machine Serial Numbers (; separated)',
        Requirement: 'Optional',
        Allowed_Values: 'Semicolon-separated serials, e.g. DIV-SN-2026-001; RND-SN-2026-001',
      },
      {
        Field: 'Project Status',
        Requirement: 'Optional (defaults to ACTIVE)',
        Allowed_Values: 'PLANNING, ACTIVE, ON_HOLD, COMPLETED',
      },
      { Field: 'Start Date (YYYY-MM-DD)', Requirement: 'Optional', Allowed_Values: 'YYYY-MM-DD' },
      {
        Field: 'Target Completion Date (YYYY-MM-DD)',
        Requirement: 'Optional',
        Allowed_Values: 'YYYY-MM-DD',
      },
      { Field: 'Notes', Requirement: 'Optional', Allowed_Values: 'Any project notes or specifications' },
    ];

    const wb = XLSX.utils.book_new();
    const wsProjects = XLSX.utils.json_to_sheet(templateData);
    wsProjects['!cols'] = [
      { wch: 18 },
      { wch: 42 },
      { wch: 28 },
      { wch: 20 },
      { wch: 36 },
      { wch: 16 },
      { wch: 22 },
      { wch: 30 },
      { wch: 40 },
    ];
    const wsCriteria = XLSX.utils.json_to_sheet(criteriaGuide);
    wsCriteria['!cols'] = [{ wch: 34 }, { wch: 28 }, { wch: 55 }];

    XLSX.utils.book_append_sheet(wb, wsProjects, 'Projects_Import');
    XLSX.utils.book_append_sheet(wb, wsCriteria, 'Criteria_Guide');
    XLSX.writeFile(wb, 'MACHINE_QMS_Project_Import_Template.xlsx');
  };

  // Export current Projects with their cross-referenced Machines, Drawings, and Parts to native .xlsx
  const handleExportProjectsExcel = () => {
    const exportData = db.projects.map((p) => {
      const xref = crossRefsByProjectId.get(p.id) || getProjectCrossReferences(db, p);
      return {
        'Project Number': p.projectNumber,
        'Project Name': p.projectName,
        Customer: p.customer,
        'Machine Type': p.machineType || 'DIVIDER',
        'Machine Serial Numbers': xref.machines.map((m) => m.serialNumber).join('; '),
        'Allocated Drawings': xref.drawings.map((d) => `${d.drawingNumber} (Rev ${d.revision})`).join('; '),
        'Allocated Parts': xref.parts.map((pt) => pt.partNumber).join('; '),
        'Manufacturing Records': xref.manufacturingRecords.map((r) => r.traceabilityNumber).join('; '),
        'Project Status': p.projectStatus,
        'Start Date': p.startDate,
        'Target Completion Date': p.targetCompletionDate,
        'Created By': p.createdBy,
        Notes: p.notes || '',
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 38 },
      { wch: 26 },
      { wch: 18 },
      { wch: 30 },
      { wch: 38 },
      { wch: 38 },
      { wch: 28 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 35 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Projects_Register');
    XLSX.writeFile(
      wb,
      `MACHINE_QMS_Projects_Register_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const parseRawGridRows = (grid: any[][]): ParsedProjectRow[] => {
    const nonEmpty = grid.filter(
      (r) => Array.isArray(r) && r.some((cell) => String(cell ?? '').trim().length > 0)
    );
    if (nonEmpty.length === 0) return [];

    const firstRowCells = nonEmpty[0].map((c) => String(c ?? '').toLowerCase().trim());
    const hasHeader =
      firstRowCells.some((c) => c.includes('project number') || c.includes('project_number') || c === 'project') ||
      firstRowCells.some((c) => c.includes('customer'));

    const startIdx = hasHeader ? 1 : 0;
    const findCol = (keywords: string[], fallbackIdx: number) => {
      if (!hasHeader) return fallbackIdx;
      const found = firstRowCells.findIndex((cell) => keywords.some((kw) => cell.includes(kw)));
      return found >= 0 ? found : fallbackIdx;
    };

    const idxProjNum = findCol(['project number', 'project no', 'project_number', 'code'], 0);
    const idxProjName = findCol(['project name', 'project_name', 'description', 'title'], 1);
    const idxCustomer = findCol(['customer', 'client'], 2);
    const idxMachineType = findCol(['machine type', 'machine_type', 'type'], 3);
    const idxSerials = findCol(['serial', 'machines'], 4);
    const idxStatus = findCol(['status'], 5);
    const idxStart = findCol(['start date', 'start_date', 'start'], 6);
    const idxTarget = findCol(['target', 'completion', 'due', 'end'], 7);
    const idxNotes = findCol(['note', 'comment', 'remark'], 8);

    const existingNums = new Set(db.projects.map((p) => p.projectNumber.trim().toUpperCase()));
    const seenInBatch = new Set<string>();

    return nonEmpty.slice(startIdx).map((cols, idx) => {
      const rowNum = startIdx + idx + 1;
      const projectNumber = String(cols[idxProjNum] ?? '').trim().toUpperCase();
      const projectName = String(cols[idxProjName] ?? '').trim();
      const customer = String(cols[idxCustomer] ?? '').trim();
      const rawType = String(cols[idxMachineType] ?? 'DIVIDER').trim().toUpperCase() || 'DIVIDER';
      const rawSerials = String(cols[idxSerials] ?? '').trim();
      const serials = rawSerials
        ? rawSerials
            .split(/[;|,]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const rawStatus = String(cols[idxStatus] ?? 'ACTIVE')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_') as ProjectStatus;
      const projectStatus: ProjectStatus = VALID_PROJECT_STATUSES.includes(rawStatus)
        ? rawStatus
        : 'ACTIVE';
      const startDate =
        String(cols[idxStart] ?? '').trim() || new Date().toISOString().split('T')[0];
      const targetCompletionDate = String(cols[idxTarget] ?? '').trim() || '2026-12-31';
      const notes = String(cols[idxNotes] ?? '').trim();

      let valid = true;
      let reason = 'Ready to import';

      if (!projectNumber || !projectName || !customer) {
        valid = false;
        reason = 'Missing required field (Project Number, Project Name, or Customer)';
      } else if (existingNums.has(projectNumber)) {
        valid = false;
        reason = `Duplicate: ${projectNumber} already exists in register`;
      } else if (seenInBatch.has(projectNumber)) {
        valid = false;
        reason = `Duplicate in file: ${projectNumber}`;
      } else {
        seenInBatch.add(projectNumber);
      }

      return {
        rowNum,
        projectNumber,
        projectName,
        customer,
        machineType: rawType,
        machineSerialNumbers: serials,
        projectStatus,
        startDate,
        targetCompletionDate,
        notes,
        valid,
        reason,
      };
    });
  };

  const splitDelimitedLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseProjectImportText = (raw: string): ParsedProjectRow[] => {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return [];
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const grid = lines.map((line) => splitDelimitedLine(line, delimiter));
    return parseRawGridRows(grid);
  };

  const handlePasteChange = (val: string) => {
    setPasteText(val);
    setImportMessage(null);
    setParsedRows(parseProjectImportText(val));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const grid = XLSX.utils.sheet_to_json<any[]>(worksheet, {
            header: 1,
            raw: false,
            defval: '',
          });
          setImportMessage(null);
          setPasteText(`[Loaded Excel Workbook: ${file.name} — Sheet: ${firstSheetName}]`);
          setParsedRows(parseRawGridRows(grid));
        } catch (err: any) {
          setImportMessage({
            type: 'error',
            text: 'Failed to parse Excel workbook: ' + (err.message || 'Invalid file'),
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = String(ev.target?.result || '');
        handlePasteChange(content);
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.valid);
    if (validRows.length === 0) {
      setImportMessage({
        type: 'error',
        text: 'No valid project rows to import. Check the preview table below.',
      });
      return;
    }

    setIsImporting(true);
    setImportMessage(null);
    try {
      const res = await importProjects(
        validRows.map((r) => ({
          projectNumber: r.projectNumber,
          projectName: r.projectName,
          customer: r.customer,
          machineType: r.machineType,
          machineSerialNumbers: r.machineSerialNumbers,
          projectStatus: r.projectStatus,
          startDate: r.startDate,
          targetCompletionDate: r.targetCompletionDate,
          notes: r.notes,
        }))
      );

      if (res.ok) {
        setImportMessage({
          type: 'success',
          text: `Successfully imported ${res.importedCount} project(s) into the Project Register${
            res.skippedCount > 0 ? ` (${res.skippedCount} skipped)` : ''
          }.`,
        });
        setPasteText('');
        setParsedRows([]);
      } else {
        setImportMessage({
          type: 'error',
          text: res.error || 'Failed to import projects.',
        });
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-blue-600" />
            3. Project Register &amp; Cross-Allocated Engineering Dossier
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live bi-directional cross-referencing of allocated Machines, Engineering Drawings, BOM Parts / Components, and Manufacturing Records per Project
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
            title="Download Excel (.xlsx) Template with Criteria Guide"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            Download Excel Template (.xlsx)
          </button>

          <button
            onClick={handleExportProjectsExcel}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
            title="Export Current Projects Register & Allocations to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            Export Excel (.xlsx)
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
            Import Excel / CSV
          </button>

          <button
            onClick={openCreateProjectModal}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Register Project
          </button>

          {isAdmin && db.projects.length > 0 && (
            <>
              {!confirmClearProjectsList ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearProjectsList(true)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                  title="Administrator: Clear entire Projects List"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear List ({db.projects.length})
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded text-xs">
                  <span className="font-bold text-rose-900">Clear all {db.projects.length} projects?</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await clearCollectionList('projects');
                      setConfirmClearProjectsList(false);
                    }}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[11px]"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearProjectsList(false)}
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

      {/* Search */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Project Number (e.g. PRJ-2026-104, T0559), Project Name, Customer, Drawing Number, Part Number, or Machine Serial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Projects Grid with Complete Cross-References (Machines, Drawings, Parts, Mfg Records) */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <FolderKanban className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-base text-slate-800">No Projects in Register</h3>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            The project register is clean (blank slate). Click "+ Register Project" or "Import Projects (Excel / CSV)" above to register your first customer project and link machines.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredProjects.map((project) => {
          const xref =
            crossRefsByProjectId.get(project.id) || getProjectCrossReferences(db, project);
          const currentDrawings = xref.drawings.filter((d) => d.isCurrent);
          const displayDrawings =
            currentDrawings.length > 0 ? currentDrawings : xref.drawings;

          return (
            <div
              key={project.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:border-blue-300 transition-colors"
            >
              <div className="space-y-3.5">
                {/* Top Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                        {project.projectNumber}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {project.machineType || 'DIVIDER'}
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-slate-900 mt-1.5">
                      {project.projectName}
                    </h3>
                    <div className="text-xs text-slate-600 font-medium">{project.customer}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={project.projectStatus} />
                    <button
                      type="button"
                      onClick={() => openEditProjectModal(project)}
                      className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200"
                      title="Edit Project & Allocations"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <>
                        {confirmDeleteProjectId !== project.id ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteProjectId(project.id)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded border border-transparent hover:border-rose-200"
                            title={`Delete Project ${project.projectNumber}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded text-[10px]">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteProject(project.id);
                                setConfirmDeleteProjectId(null);
                              }}
                              className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteProjectId(null)}
                              className="px-1.5 py-0.5 bg-white text-slate-700 border border-slate-300 rounded font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Summary Cross-Reference Counter Pills */}
                <div className="grid grid-cols-4 gap-2 bg-slate-900 text-white p-2.5 rounded-lg font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className="text-left hover:bg-slate-800 p-1 rounded transition-colors"
                  >
                    <span className="text-slate-400 block text-[9px] uppercase">Machines</span>
                    <span className="font-black text-blue-300 text-xs">
                      {xref.machines.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className="text-left hover:bg-slate-800 p-1 rounded transition-colors"
                  >
                    <span className="text-slate-400 block text-[9px] uppercase">Drawings</span>
                    <span className="font-black text-emerald-300 text-xs">
                      {displayDrawings.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className="text-left hover:bg-slate-800 p-1 rounded transition-colors"
                  >
                    <span className="text-slate-400 block text-[9px] uppercase">
                      Allocated Parts
                    </span>
                    <span className="font-black text-amber-300 text-xs">{xref.parts.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className="text-left hover:bg-slate-800 p-1 rounded transition-colors"
                  >
                    <span className="text-slate-400 block text-[9px] uppercase">Mfg Records</span>
                    <span className="font-black text-indigo-300 text-xs">
                      {xref.manufacturingRecords.length}
                    </span>
                  </button>
                </div>

                {/* 1. Allocated Machines */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-600 flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-blue-600" />
                    <span>Allocated Machine Serials ({xref.machines.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {xref.machines.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">
                        No machines linked yet
                      </span>
                    ) : (
                      xref.machines.map((m) => (
                        <button
                          key={m.serialNumber}
                          type="button"
                          onClick={() => navigateToCrossRef('machines', m.serialNumber, m.id)}
                          className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded font-mono text-[11px] font-bold border border-blue-200 inline-flex items-center gap-1 transition-colors"
                          title={`Open Machine ${m.serialNumber} (${m.machineType}) in Machine Register`}
                        >
                          <Cpu className="w-3 h-3 text-blue-600" />
                          <span>{m.serialNumber}</span>
                          <span className="text-[9px] text-blue-600 font-normal">
                            ({m.machineType})
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Allocated Engineering Drawings */}
                <div className="space-y-1 pt-2 border-t border-slate-100">
                  <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-600 flex items-center gap-1">
                    <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                    <span>Allocated Engineering Drawings ({displayDrawings.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {displayDrawings.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">
                        No drawings allocated yet
                      </span>
                    ) : (
                      displayDrawings.slice(0, 6).map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => navigateToCrossRef('drawings', d.drawingNumber, d.id)}
                          className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 rounded font-mono text-[11px] font-bold border border-emerald-200 inline-flex items-center gap-1 transition-colors"
                          title={`${d.drawingTitle} — Click to open in Drawings Register`}
                        >
                          <span>{d.drawingNumber}</span>
                          <span className="text-[9px] bg-emerald-200/70 text-emerald-900 px-1 rounded">
                            REV {d.revision}
                          </span>
                        </button>
                      ))
                    )}
                    {displayDrawings.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setSelectedProjectId(project.id)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-mono text-[10px] font-bold"
                      >
                        +{displayDrawings.length - 6} more...
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Allocated Parts / Components */}
                <div className="space-y-1 pt-2 border-t border-slate-100">
                  <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-600 flex items-center gap-1">
                    <Wrench className="w-3 h-3 text-amber-600" />
                    <span>Allocated Parts &amp; Components ({xref.parts.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {xref.parts.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">
                        No parts allocated yet
                      </span>
                    ) : (
                      xref.parts.slice(0, 6).map((pt) => (
                        <button
                          key={pt.partNumber}
                          type="button"
                          onClick={() =>
                            navigateToCrossRef('components', pt.partNumber, pt.component?.id)
                          }
                          className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-950 rounded font-mono text-[11px] font-bold border border-amber-200 inline-flex items-center gap-1 transition-colors"
                          title={`${pt.description} (Dwg: ${pt.drawingNumber} Rev ${pt.revision}) — Click to open in Component Master`}
                        >
                          <span>{pt.partNumber}</span>
                          <span className="text-[9px] text-amber-800 font-sans font-normal truncate max-w-28">
                            {pt.description}
                          </span>
                        </button>
                      ))
                    )}
                    {xref.parts.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setSelectedProjectId(project.id)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-mono text-[10px] font-bold"
                      >
                        +{xref.parts.length - 6} more...
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {project.startDate} &rarr;{' '}
                  {project.targetCompletionDate}
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Inspect Allocated Drawings &amp; Parts ({xref.parts.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Create / Edit Project Modal with Machine, Drawing, and Part Allocation */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingProject(null);
        }}
        title={editingProject ? `Edit Project: ${editingProject.projectNumber}` : 'Register New Project'}
        subtitle="Link customer contract with allocated Machine Serials, Controlled Drawings, and BOM Parts"
        maxWidth="3xl"
      >
        <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Project Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. PRJ-2026-D05 or T0559"
                value={formData.projectNumber}
                onChange={(e) => setFormData({ ...formData, projectNumber: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold uppercase text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Customer <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Apex Industrial Bakeries"
                value={formData.customer}
                onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Project Status</label>
              <select
                value={formData.projectStatus}
                onChange={(e) =>
                  setFormData({ ...formData, projectStatus: e.target.value as ProjectStatus })
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
              >
                {VALID_PROJECT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Project Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Industrial 8-Pocket High-Speed Dough Divider Installation"
              value={formData.projectName}
              onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Primary Machine Type</label>
              <select
                value={formData.machineType}
                onChange={(e) => setFormData({ ...formData, machineType: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
              >
                {db.settings.machineTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Target Completion Date</label>
              <input
                type="date"
                value={formData.targetCompletionDate}
                onChange={(e) =>
                  setFormData({ ...formData, targetCompletionDate: e.target.value })
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
              />
            </div>
          </div>

          {/* Bi-Directional Allocation Selectors: Machines, Drawings, and Parts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                1. Allocate Machines ({formData.selectedSerials.length})
              </label>
              <div className="p-2.5 bg-slate-50 border border-slate-300 rounded max-h-36 overflow-y-auto space-y-1">
                {db.machines.map((m) => (
                  <label
                    key={m.serialNumber}
                    className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={formData.selectedSerials.includes(m.serialNumber)}
                      onChange={() => toggleItemInList('selectedSerials', m.serialNumber)}
                    />
                    <span className="font-mono font-bold text-slate-800">{m.serialNumber}</span>
                    <span className="text-[10px] text-slate-500 truncate">({m.machineType})</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                2. Allocate Drawings ({formData.selectedDrawings.length})
              </label>
              <div className="p-2.5 bg-slate-50 border border-slate-300 rounded max-h-36 overflow-y-auto space-y-1">
                {currentDrawingsList.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={formData.selectedDrawings.includes(d.drawingNumber)}
                      onChange={() => toggleItemInList('selectedDrawings', d.drawingNumber)}
                    />
                    <span className="font-mono font-bold text-emerald-900">{d.drawingNumber}</span>
                    <span className="text-[10px] text-slate-500 truncate">{d.drawingTitle}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                3. Allocate Parts ({formData.selectedParts.length})
              </label>
              <div className="p-2.5 bg-slate-50 border border-slate-300 rounded max-h-36 overflow-y-auto space-y-1">
                {db.components.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={formData.selectedParts.includes(c.partNumber)}
                      onChange={() => toggleItemInList('selectedParts', c.partNumber)}
                    />
                    <span className="font-mono font-bold text-amber-900">{c.partNumber}</span>
                    <span className="text-[10px] text-slate-500 truncate">{c.description}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Project Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
              placeholder="Scope, delivery constraints, specific customer technical contacts..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingProject(null);
              }}
              className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-xs"
            >
              {editingProject ? 'Save Project & Allocations' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Project Full Cross-Reference & Allocation Dossier Modal */}
      {selectedProject &&
        (() => {
          const xref =
            crossRefsByProjectId.get(selectedProject.id) ||
            getProjectCrossReferences(db, selectedProject);

          return (
            <Modal
              isOpen={true}
              onClose={() => setSelectedProjectId(null)}
              title={`Project Cross-Reference Dossier: ${selectedProject.projectNumber}`}
              subtitle={`${selectedProject.projectName} — Customer: ${selectedProject.customer}`}
              maxWidth="4xl"
            >
              <div className="space-y-5 text-xs">
                {/* Summary Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-900 text-white p-3.5 rounded-lg font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[9px]">PROJECT No</span>
                    <span className="font-bold text-blue-300">
                      {selectedProject.projectNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">STATUS</span>
                    <StatusBadge status={selectedProject.projectStatus} />
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">ALLOCATED DRAWINGS</span>
                    <span className="font-bold text-emerald-300">
                      {xref.drawings.length} Drawing(s)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">ALLOCATED PARTS / BOM</span>
                    <span className="font-bold text-amber-300">{xref.parts.length} Part(s)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">MACHINES &amp; MFG</span>
                    <span className="font-bold text-indigo-300">
                      {xref.machines.length} Mch / {xref.manufacturingRecords.length} Mfg
                    </span>
                  </div>
                </div>

                {/* SECTION 1: ALLOCATED DRAWINGS */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <div className="bg-slate-100 px-3.5 py-2.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>
                        1. Allocated Engineering Drawings ({xref.drawings.length} Drawing
                        {xref.drawings.length === 1 ? '' : 's'})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={quickAddDrawingNo}
                        onChange={(e) => setQuickAddDrawingNo(e.target.value)}
                        className="px-2 py-1 border border-slate-300 rounded bg-white font-mono text-[11px]"
                      >
                        <option value="">+ Allocate Drawing to Project...</option>
                        {currentDrawingsList.map((d) => (
                          <option key={d.id} value={d.drawingNumber}>
                            {d.drawingNumber} (Rev {d.revision}) — {d.drawingTitle}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!quickAddDrawingNo}
                        onClick={() => handleQuickAllocateDrawing(selectedProject)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <Link2 className="w-3 h-3" /> Link
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                          <th className="py-2 px-3">Drawing Number</th>
                          <th className="py-2 px-3">Rev</th>
                          <th className="py-2 px-3">Drawing Title</th>
                          <th className="py-2 px-3">Element / Ref</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {xref.drawings.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-400">
                              No drawings allocated to this project yet. Use the dropdown above to allocate a drawing.
                            </td>
                          </tr>
                        ) : (
                          xref.drawings.map((d) => (
                            <tr key={d.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-emerald-900">
                                {d.drawingNumber}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold">
                                REV {d.revision}{' '}
                                {d.isCurrent ? (
                                  <span className="text-[9px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded">
                                    CURRENT
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-900">
                                {d.drawingTitle}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-600">
                                {d.elementCode || d.projectReference || '—'}
                              </td>
                              <td className="py-2 px-3">
                                <StatusBadge status={d.drawingStatus} />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedProjectId(null);
                                    navigateToCrossRef('drawings', d.drawingNumber, d.id);
                                  }}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-semibold inline-flex items-center gap-1"
                                >
                                  <span>Open Drawing</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECTION 2: ALLOCATED PARTS / COMPONENTS */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <div className="bg-slate-100 px-3.5 py-2.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-amber-600" />
                      <span>
                        2. Allocated Parts &amp; Components on Project ({xref.parts.length} Part
                        {xref.parts.length === 1 ? '' : 's'})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={quickAddPartNo}
                        onChange={(e) => setQuickAddPartNo(e.target.value)}
                        className="px-2 py-1 border border-slate-300 rounded bg-white font-mono text-[11px]"
                      >
                        <option value="">+ Allocate Part to Project...</option>
                        {db.components.map((c) => (
                          <option key={c.id} value={c.partNumber}>
                            {c.partNumber} — {c.description}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!quickAddPartNo}
                        onClick={() => handleQuickAllocatePart(selectedProject)}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <Link2 className="w-3 h-3" /> Link
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                          <th className="py-2 px-3">Part Number</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3">Qty</th>
                          <th className="py-2 px-3">Material</th>
                          <th className="py-2 px-3">Allocated Drawing &amp; Rev</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {xref.parts.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-400">
                              No parts allocated yet.
                            </td>
                          </tr>
                        ) : (
                          xref.parts.map((pt) => (
                            <tr key={pt.partNumber} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-blue-900">
                                {pt.partNumber}
                              </td>
                              <td className="py-2 px-3 text-slate-900 font-medium">
                                {pt.description}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold">{pt.quantity}</td>
                              <td className="py-2 px-3 font-mono text-slate-600">
                                {pt.material}
                              </td>
                              <td className="py-2 px-3 font-mono">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedProjectId(null);
                                    navigateToCrossRef(
                                      'drawings',
                                      pt.drawingNumber,
                                      pt.drawing?.id
                                    );
                                  }}
                                  className="text-emerald-800 hover:underline font-bold"
                                >
                                  {pt.drawingNumber} (Rev {pt.revision})
                                </button>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedProjectId(null);
                                    navigateToCrossRef(
                                      'components',
                                      pt.partNumber,
                                      pt.component?.id
                                    );
                                  }}
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded font-semibold inline-flex items-center gap-1"
                                >
                                  <span>Open Part</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECTION 3: ALLOCATED MACHINES & MANUFACTURING RECORDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-blue-600" />
                        <span>3. Allocated Machines ({xref.machines.length})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <select
                          value={quickAddMachineSn}
                          onChange={(e) => setQuickAddMachineSn(e.target.value)}
                          className="px-2 py-1 border border-slate-300 rounded bg-white font-mono text-[10px]"
                        >
                          <option value="">+ Link Machine...</option>
                          {db.machines.map((m) => (
                            <option key={m.id} value={m.serialNumber}>
                              {m.serialNumber} ({m.machineType})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!quickAddMachineSn}
                          onClick={() => handleQuickAllocateMachine(selectedProject)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded font-bold text-[10px]"
                        >
                          Link
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-200 max-h-44 overflow-y-auto">
                      {xref.machines.map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 flex items-center justify-between hover:bg-slate-50"
                        >
                          <div>
                            <div className="font-mono font-bold text-blue-900">
                              {m.serialNumber}{' '}
                              <span className="text-[10px] text-slate-500">({m.machineType})</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Mfg: {m.manufacturingStatus} | Assy: {m.assemblyStatus}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProjectId(null);
                                navigateToCrossRef('machines', m.serialNumber, m.id);
                              }}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded font-semibold text-[10px] inline-flex items-center gap-1"
                            >
                              <span>Machine Reg</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProjectId(null);
                                onViewMachineComponents(m.serialNumber);
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[10px]"
                            >
                              Traceability
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-1.5">
                      <Hammer className="w-4 h-4 text-indigo-600" />
                      <span>
                        4. Manufacturing Records ({xref.manufacturingRecords.length})
                      </span>
                    </div>
                    <div className="divide-y divide-slate-200 max-h-44 overflow-y-auto">
                      {xref.manufacturingRecords.length === 0 ? (
                        <div className="p-4 text-center text-slate-400">
                          No manufacturing records logged for this project yet.
                        </div>
                      ) : (
                        xref.manufacturingRecords.map((r) => (
                          <div
                            key={r.id}
                            className="p-2.5 flex items-center justify-between hover:bg-slate-50"
                          >
                            <div>
                              <div className="font-mono font-bold text-indigo-900">
                                {r.traceabilityNumber} — {r.partNumber}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                Machine: {r.machineSerialNumber} | Dwg: {r.drawingNumber} Rev{' '}
                                {r.drawingRevision}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProjectId(null);
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
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSelectedProjectId(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
                  >
                    Close Dossier
                  </button>
                </div>
              </div>
            </Modal>
          );
        })()}

      {/* Import Projects from Excel / CSV Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Bulk Import Projects (Excel / CSV)"
        subtitle="Upload an Excel workbook (.xlsx / .xls), CSV file, or paste rows copied directly from Excel"
        maxWidth="4xl"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Required Excel Columns (in order):
            </div>
            <div className="font-mono text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200 overflow-x-auto">
              1. Project Number* | 2. Project Name* | 3. Customer* | 4. Machine Type | 5. Machine Serial Numbers (; separated) | 6. Project Status | 7. Start Date (YYYY-MM-DD) | 8. Target Completion Date (YYYY-MM-DD) | 9. Notes
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
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-lg p-5 bg-slate-50 hover:bg-emerald-50/30 cursor-pointer transition-colors">
                <Upload className="w-6 h-6 text-emerald-600 mb-1.5" />
                <span className="font-bold text-slate-800">
                  Click to select Excel (.xlsx / .xls) or CSV file
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Option B: Paste Rows Directly from Excel or CSV
              </label>
              <textarea
                rows={4}
                value={pasteText}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder={`PRJ-2026-301\tHigh-Speed Divider Line\tPremier Bakeries\tDIVIDER\tDIV-SN-2026-001\tACTIVE\t2026-04-01\t2026-08-30\tTurnkey line`}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px] text-slate-900"
              />
            </div>
          </div>

          {parsedRows.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-900 text-white px-3.5 py-2 flex items-center justify-between">
                <span className="font-mono font-bold text-[11px] uppercase">
                  Import Preview ({parsedRows.filter((r) => r.valid).length} Valid /{' '}
                  {parsedRows.length} Total Rows)
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] uppercase text-slate-600">
                      <th className="py-2 px-3">Row</th>
                      <th className="py-2 px-3">Project Number</th>
                      <th className="py-2 px-3">Project Name</th>
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3">Machine Serials</th>
                      <th className="py-2 px-3">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.rowNum}
                        className={row.valid ? 'bg-white' : 'bg-rose-50/60 text-rose-900'}
                      >
                        <td className="py-1.5 px-3 font-mono">{row.rowNum}</td>
                        <td className="py-1.5 px-3 font-mono font-bold">
                          {row.projectNumber || '—'}
                        </td>
                        <td className="py-1.5 px-3 font-semibold">{row.projectName || '—'}</td>
                        <td className="py-1.5 px-3">{row.customer || '—'}</td>
                        <td className="py-1.5 px-3 font-mono">
                          {row.machineSerialNumbers.join(', ') || 'None'}
                        </td>
                        <td className="py-1.5 px-3">
                          <span
                            className={`font-semibold ${
                              row.valid ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {row.reason}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              Download Excel Template (.xlsx)
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isImporting || parsedRows.filter((r) => r.valid).length === 0}
                onClick={handleExecuteImport}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded font-bold shadow-xs flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                {isImporting
                  ? 'Importing...'
                  : `Import ${parsedRows.filter((r) => r.valid).length} Valid Project(s)`}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
