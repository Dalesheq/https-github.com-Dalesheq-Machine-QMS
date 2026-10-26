import React, { useState, useMemo, useEffect } from 'react';
import { useQMS } from '../context/QMSContext';
import {
  DaleInspectionRecord,
  DaleProcessType,
  DaleChecklistResult,
  WorkshopDepartment,
  NCR,
  FileAttachmentMetadata,
} from '../types';
import {
  WORKSHOP_DEPARTMENTS,
  getDepartmentById,
} from '../utils/departmentsData';
import {
  DALE_PROCESS_DEFINITIONS,
  DALE_CANONICAL_PROCESS_KEYS,
  getDaleProcessDefinition,
  getAllDaleProcessDefinitions,
  getDefaultDalePoints,
  generateProjectMachineInspectionPool,
  ManufacturedPartContext,
} from '../utils/daleInspectionTemplates';
import { Modal } from '../components/Modal';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Plus,
  Printer,
  Search,
  Filter,
  AlertTriangle,
  FileText,
  Trash2,
  Eye,
  Check,
  ShieldCheck,
  ExternalLink,
  Download,
  Flame,
  Cpu,
  Boxes,
  RotateCw,
  RotateCcw,
  Layers,
  Zap,
  Bot,
  Snowflake,
  Award,
  Sparkles,
  Camera,
  Paperclip,
  FolderPlus,
  Building2,
  Cog,
  ShieldAlert,
  Info,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Workflow,
  CheckSquare,
  Database,
} from 'lucide-react';

interface DaleInspectionsModuleProps {
  initialProcessFilter?: DaleProcessType | 'ALL';
}

export interface WorkflowStageInfo {
  step: number;
  key: string;
  title: string;
  action: string;
  summary: string;
  departments: WorkshopDepartment[];
  accentBorder: string;
  accentBg: string;
  accentText: string;
}

export const WORKFLOW_STAGES: WorkflowStageInfo[] = [
  {
    step: 1,
    key: 'DRAWING',
    title: '1. DRAWING',
    action: 'Engineering Release & Revisions',
    summary: 'Approved manufacturing prints, tolerances, revision control & BOM parts specifications.',
    departments: ['ENGINEERING_DESIGN', 'EXECUTIVE_ADMIN'],
    accentBorder: 'border-violet-300',
    accentBg: 'bg-violet-50',
    accentText: 'text-violet-700',
  },
  {
    step: 2,
    key: 'MANUFACTURE',
    title: '2. MANUFACTURE',
    action: 'Factory Machining & Assembly',
    summary: 'CNC turning, TIG welding, conveyor beds, spiral drums, panels, robotics & refrigeration.',
    departments: [
      'GRINDING_BAY',
      'SHEET_METAL',
      'ELECTRICAL',
      'MACHINE_SHOP',
      'BLASTING_BAY',
      'WELDING',
      'FITTING',
      'GRINDING_POLISH_FINISH',
      'CNC_MACHINING',
      'FABRICATION_WELDING',
      'CONVEYOR_SYSTEMS',
      'SPIRAL_SYSTEMS',
      'MECHANICAL_ASSEMBLY',
      'ELECTRICAL_PANELS',
      'ROBOTICS_AUTOMATION',
      'REFRIGERATION_COOLING',
      'MACHINE_SHOP_MGMT',
    ],
    accentBorder: 'border-amber-300',
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-700',
  },
  {
    step: 3,
    key: 'INSPECT',
    title: '3. INSPECT',
    action: 'Quality Checklist Verification',
    summary: 'Pool of sheets conducive to each project/machine. Zero default pass; inspector checks all points.',
    departments: ['QUALITY_METROLOGY'],
    accentBorder: 'border-blue-300',
    accentBg: 'bg-blue-50',
    accentText: 'text-blue-700',
  },
  {
    step: 4,
    key: 'CORRECT',
    title: '4. CORRECT IF REQUIRED',
    action: 'Defect Containment & NCR',
    summary: 'Automated NCR on defect; workshop quarantine bay holding point & approved concession deviations.',
    departments: ['HSEQ_COMPLIANCE', 'ENGINEERING_DESIGN'],
    accentBorder: 'border-rose-300',
    accentBg: 'bg-rose-50',
    accentText: 'text-rose-700',
  },
  {
    step: 5,
    key: 'PASS',
    title: '5. PASS',
    action: 'Conformance Verification',
    summary: '100% of dimensions and tolerances verified against drawing; inspector stamp & date sign-off.',
    departments: ['QUALITY_METROLOGY', 'HSEQ_COMPLIANCE'],
    accentBorder: 'border-emerald-300',
    accentBg: 'bg-emerald-50',
    accentText: 'text-emerald-700',
  },
  {
    step: 6,
    key: 'RELEASE',
    title: '6. RELEASE',
    action: 'Factory Acceptance & Workshop Release',
    summary: 'Final workshop release (FAT) before packing, crating or dispatch. Installation excluded.',
    departments: ['QUALITY_METROLOGY', 'MACHINE_SHOP_MGMT', 'EXECUTIVE_ADMIN'],
    accentBorder: 'border-cyan-300',
    accentBg: 'bg-cyan-50',
    accentText: 'text-cyan-700',
  },
];

export const DaleInspectionsModule: React.FC<DaleInspectionsModuleProps> = ({
  initialProcessFilter = 'ALL',
}) => {
  const {
    db,
    currentUser,
    createDaleInspection,
    createDaleInspectionsBatch,
    updateDaleInspection,
    updateDaleInspectionPoint,
    setAllDaleInspectionPointsPass,
    setAllDaleInspectionPointsNA,
    resetDaleInspectionPointsToOpen,
    approveDaleInspection,
    submitDaleInspection,
    deleteDaleInspection,
    createNCR,
    uploadAttachmentFile,
    activeWorkshopDepartment,
    setActiveWorkshopDepartment,
    navigateToCrossRef,
  } = useQMS();

  const isAdmin = currentUser.role === 'ADMINISTRATOR';

  // 1. Department Workflow Filter State
  const [departmentFilter, setDepartmentFilter] = useState<WorkshopDepartment | 'ALL'>(activeWorkshopDepartment);

  // Sync with global department filter if it changes
  useEffect(() => {
    setDepartmentFilter(activeWorkshopDepartment);
  }, [activeWorkshopDepartment]);

  // 2. Project & Machine Context State ("conducive to each separate project/machine")
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [selectedMachineSerial, setSelectedMachineSerial] = useState<string>('ALL');

  // 2. Process & Search Filter State
  const [activeProcessTab, setActiveProcessTab] = useState<DaleProcessType | 'ALL'>(initialProcessFilter);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PASS' | 'FAIL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');

  // 3. Modals State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isTemplatePoolModalOpen, setIsTemplatePoolModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printTargetSheet, setPrintTargetSheet] = useState<DaleInspectionRecord | null>(null);
  const [isRaiseNcrModalOpen, setIsRaiseNcrModalOpen] = useState(false);
  const [ncrPointDesc, setNcrPointDesc] = useState('');
  const [ncrDefectDesc, setNcrDefectDesc] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [autoNcrAlert, setAutoNcrAlert] = useState<{ ncrNumber: string; pointDesc: string; mfgRecordId?: string } | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [poolFeedback, setPoolFeedback] = useState<string | null>(null);
  const [isWorkflowPipelineExpanded, setIsWorkflowPipelineExpanded] = useState<boolean>(true);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);
  const [viewingNcrNumber, setViewingNcrNumber] = useState<string | null>(null);

  // Helper to retrieve manufactured parts for a given project / machine serial
  const getManufacturedPartsForMachine = (prjNumber: string, machineSerial: string): ManufacturedPartContext[] => {
    const parts: ManufacturedPartContext[] = [];
    const seen = new Set<string>();

    // 1. From manufacturing records
    (db.manufacturingRecords || []).forEach((mr) => {
      const matchPrj = prjNumber === 'ALL' || mr.projectNumber === prjNumber;
      const matchSerial =
        machineSerial === 'ALL' ||
        mr.machineSerialNumber === machineSerial ||
        mr.machineSerialNumber.includes(machineSerial);

      if (matchPrj && matchSerial && !seen.has(mr.partNumber)) {
        seen.add(mr.partNumber);
        const comp = (db.components || []).find((c) => c.partNumber === mr.partNumber);
        parts.push({
          partNumber: mr.partNumber,
          description: mr.componentDescription || comp?.description || mr.partNumber,
          drawingNumber: mr.drawingNumber,
          revision: mr.drawingRevision,
          category: comp?.category,
        });
      }
    });

    // 2. From drawings parts list (e.g. T0559 vibratory infeed element 719 parts)
    (db.drawings || []).forEach((dwg) => {
      const isLinkedToPrj =
        prjNumber !== 'ALL' &&
        (dwg.projectReference?.includes(prjNumber) || dwg.drawingNumber.includes(prjNumber));
      const isLinkedToSerial =
        machineSerial !== 'ALL' && dwg.projectReference?.includes(machineSerial);

      if (isLinkedToPrj || isLinkedToSerial) {
        if (dwg.partsList) {
          dwg.partsList.forEach((p) => {
            if (!seen.has(p.partNumber)) {
              seen.add(p.partNumber);
              const isPlate =
                p.description.includes('PLATE') ||
                p.description.includes('CHUTE') ||
                p.description.includes('BRACKET') ||
                p.description.includes('SUPPORT');
              parts.push({
                partNumber: p.partNumber,
                description: p.description,
                drawingNumber: dwg.drawingNumber,
                revision: dwg.revision,
                material: p.material,
                category: isPlate ? 'PLATE' : 'HOUSING',
              });
            }
          });
        }
      }
    });

    // 3. Fallback to Component Master for machine type
    if (parts.length === 0) {
      const machObj = (db.machines || []).find(
        (m) => (prjNumber !== 'ALL' && m.projectNumber === prjNumber) || m.serialNumber === machineSerial
      );
      const mType = machObj?.machineType || '';
      (db.components || []).forEach((c) => {
        if (c.machineTypes.includes(mType) && !seen.has(c.partNumber)) {
          seen.add(c.partNumber);
          parts.push({
            partNumber: c.partNumber,
            description: c.description,
            drawingNumber: c.defaultDrawingNumber || c.drawingNumber,
            revision: c.currentDrawingRevision,
            category: c.category,
          });
        }
      });
    }

    return parts;
  };

  // Available Projects list
  const availableProjects = useMemo(() => {
    const prjList = db.projects || [];
    const fromSheets = (db.daleInspections || []).map((s) => s.projectNumber);
    const set = new Set([...prjList.map((p) => p.projectNumber), ...fromSheets]);
    return Array.from(set).filter(Boolean);
  }, [db.projects, db.daleInspections]);

  // Available Machines list (filtered by selected project if one is active)
  const availableMachines = useMemo(() => {
    let machList = db.machines || [];
    if (selectedProject !== 'ALL') {
      machList = machList.filter((m) => m.projectNumber === selectedProject);
    }
    return machList;
  }, [db.machines, selectedProject]);

  // Manufactured parts in workshop for currently selected project/machine
  const currentContextManufacturedParts = useMemo(() => {
    return getManufacturedPartsForMachine(selectedProject, selectedMachineSerial);
  }, [selectedProject, selectedMachineSerial, db.manufacturingRecords, db.drawings, db.components]);

  // New Inspection Form state
  const [newForm, setNewForm] = useState<{
    processType: DaleProcessType;
    projectNumber: string;
    machineOrAssembly: string;
    partName: string;
    partOrSerialNo: string;
    drawingNumber: string;
    drawingRevision: string;
    partDescription: string;
    inspector: string;
    inspectionDate: string;
  }>({
    processType: 'FABRICATION_WELDING',
    projectNumber: selectedProject !== 'ALL' ? selectedProject : 'T0559',
    machineOrAssembly: 'BULK HOPPER — VIBRATORY INFEED SUB-ASSY (T0559-SN-001)',
    partName: 'Stainless Steel Infeed Chute Assembly',
    partOrSerialNo: '719-00-02-006-01',
    drawingNumber: 'T0559-058-719-00-02-00',
    drawingRevision: '0',
    partDescription: 'INFEED CHUTE PLATE, 1,5mm x 507,1mm x 557,3mm (S/S 304 SATIN)',
    inspector: currentUser.name,
    inspectionDate: new Date().toISOString().split('T')[0],
  });

  // Keep newForm synchronized when project changes
  useEffect(() => {
    if (selectedProject !== 'ALL') {
      const mach = db.machines.find((m) => m.projectNumber === selectedProject);
      setNewForm((prev) => ({
        ...prev,
        projectNumber: selectedProject,
        machineOrAssembly: mach ? `${mach.projectName} (${mach.serialNumber})` : prev.machineOrAssembly,
      }));
    }
  }, [selectedProject, db.machines]);

  // Filtered Inspection Sheets (Strictly conducive to selected project & machine)
  const filteredSheets = useMemo(() => {
    const list = db.daleInspections || [];
    const deptObj = departmentFilter !== 'ALL' ? getDepartmentById(departmentFilter) : null;
    return list.filter((sheet) => {
      // 0. Department Workflow match (if department filter is set)
      if (deptObj && !deptObj.linkedProcesses.includes(sheet.processType)) {
        return false;
      }
      // 1. Project match
      if (selectedProject !== 'ALL' && sheet.projectNumber !== selectedProject) {
        return false;
      }
      // 2. Machine match
      if (
        selectedMachineSerial !== 'ALL' &&
        !sheet.machineOrAssembly.includes(selectedMachineSerial) &&
        !sheet.partOrSerialNo.includes(selectedMachineSerial)
      ) {
        return false;
      }
      // 3. Process Type match
      if (activeProcessTab !== 'ALL') {
        // Handle canonical vs alias matching
        const isMatch =
          sheet.processType === activeProcessTab ||
          (activeProcessTab === 'MACHINED_COMPONENTS' && sheet.processType === 'MACHINED_PARTS') ||
          (activeProcessTab === 'MECHANICAL_ASSEMBLY' && sheet.processType === 'ASSEMBLY') ||
          (activeProcessTab === 'ELECTRICAL_CONTROL_PANEL' && sheet.processType === 'ELECTRICAL_PANELS') ||
          (activeProcessTab === 'FINAL_MANUFACTURING_FAT' && sheet.processType === 'FINAL_MANUFACTURING');
        if (!isMatch) return false;
      }
      // 4. Status match
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING' && sheet.approvalStatus !== 'PENDING') return false;
        if (statusFilter === 'PASS' && sheet.approvalStatus !== 'PASS') return false;
        if (statusFilter === 'FAIL' && sheet.approvalStatus !== 'FAIL' && sheet.approvalStatus !== 'HOLD') return false;
      }
      // 5. Search text match
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesTerm =
          sheet.sheetNumber.toLowerCase().includes(term) ||
          sheet.projectNumber.toLowerCase().includes(term) ||
          sheet.machineOrAssembly.toLowerCase().includes(term) ||
          (sheet.partName && sheet.partName.toLowerCase().includes(term)) ||
          sheet.drawingNumber.toLowerCase().includes(term) ||
          sheet.partOrSerialNo.toLowerCase().includes(term) ||
          sheet.inspector.toLowerCase().includes(term);
        if (!matchesTerm) return false;
      }
      return true;
    });
  }, [
    db.daleInspections,
    departmentFilter,
    selectedProject,
    selectedMachineSerial,
    activeProcessTab,
    statusFilter,
    searchTerm,
  ]);

  // Active sheet selection
  const activeSheet: DaleInspectionRecord | undefined = useMemo(() => {
    const list = db.daleInspections || [];
    return (
      list.find((s) => s.id === selectedSheetId) ||
      filteredSheets[0] ||
      list[0]
    );
  }, [db.daleInspections, selectedSheetId, filteredSheets]);

  // Keep selectedSheetId updated if current selection falls out of filter
  useEffect(() => {
    if (filteredSheets.length > 0 && !filteredSheets.some((s) => s.id === selectedSheetId)) {
      const sheetStillExists = (db.daleInspections || []).some((s) => s.id === selectedSheetId);
      if (!sheetStillExists) {
        setSelectedSheetId(filteredSheets[0].id);
      }
    }
  }, [filteredSheets, selectedSheetId, db.daleInspections]);

  useEffect(() => {
    setApprovalError(null);
  }, [selectedSheetId]);

  // Statistics for currently filtered pool
  const stats = useMemo(() => {
    const pool = filteredSheets;
    const passed = pool.filter((s) => s.approvalStatus === 'PASS').length;
    const pending = pool.filter((s) => s.approvalStatus === 'PENDING').length;
    const failed = pool.filter((s) => s.approvalStatus === 'FAIL' || s.approvalStatus === 'HOLD').length;
    return { total: pool.length, passed, pending, failed };
  }, [filteredSheets]);

  // Quick process pre-fill helper for new modal
  const handleProcessTypeChange = (pType: DaleProcessType) => {
    const def = getDaleProcessDefinition(pType);
    const prj = selectedProject !== 'ALL' ? selectedProject : 'T0559';
    let mach = 'BULK HOPPER — VIBRATORY INFEED SUB-ASSY (T0559-SN-001)';
    let partNo = `${prj}-01`;
    let dwg = `DWG-${prj}-01`;

    if (prj === 'PRJ-2026-104') {
      mach = 'Apex High-Speed Dough Divider Line #1 (DIV-SN-2026-001)';
      partNo = 'PART-DIV-001';
      dwg = 'DWG-DIV-101';
    } else if (prj === 'PRJ-2026-112') {
      mach = '24-Tier Twin-Drum Spiral Freezing System (SPF-SN-2026-001)';
      partNo = 'SPF-SN-2026-001-DRUM';
      dwg = 'DWG-SPF-112-01';
    } else if (prj === 'PRJ-2026-115') {
      mach = 'Automated Robotic Pan & Lid Handling Cell (ROB-SN-2026-001)';
      partNo = 'ROB-SN-2026-001-TOOL';
      dwg = 'DWG-ROB-115-01';
    }

    setNewForm((prev) => ({
      ...prev,
      processType: pType,
      partName: def.title,
      partDescription: `${def.title} inspection for ${mach}`,
      drawingNumber: dwg,
      partOrSerialNo: partNo,
    }));
  };

  // Submit New Inspection Sheet
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const defaultPoints = getDefaultDalePoints(newForm.processType);
    const def = getDaleProcessDefinition(newForm.processType);

    const res = await createDaleInspection({
      sheetNumber: '',
      processType: newForm.processType,
      processTitle: def.title,
      projectNumber: newForm.projectNumber.trim(),
      machineOrAssembly: newForm.machineOrAssembly.trim(),
      partName: newForm.partName.trim(),
      drawingNumber: newForm.drawingNumber.trim(),
      drawingRevision: newForm.drawingRevision.trim(),
      partOrSerialNo: newForm.partOrSerialNo.trim(),
      partDescription: newForm.partDescription.trim(),
      inspector: newForm.inspector.trim(),
      inspectionDate: newForm.inspectionDate,
      points: defaultPoints, // Always starts with result: null (open-ended!)
      comments: '',
      ncrReference: 'None',
      correctiveAction: '',
      approvalStatus: 'PENDING',
      approvedBy: undefined,
      approvalDate: undefined,
      signatureRole: undefined,
    });

    if (res.success && res.id) {
      setSelectedSheetId(res.id);
      setIsNewModalOpen(false);
    }
  };

  // Auto-populate Pool of Inspection Sheets for Selected Project / Machine
  const handleAutoPopulatePool = async () => {
    if (!db.machines || db.machines.length === 0) {
      alert('The database is currently clean (blank slate). Please load or create a machine and Bill of Materials (BOM) in the Machines module first before populating inspection sheets.');
      return;
    }

    const prj = selectedProject !== 'ALL' ? selectedProject : (availableProjects[0] || db.machines[0]?.projectNumber || 'PRJ-001');
    const machObj =
      (selectedMachineSerial !== 'ALL' ? db.machines.find((m) => m.serialNumber === selectedMachineSerial) : null) ||
      (db.machines || []).find((m) => m.projectNumber === prj) ||
      db.machines[0];

    if (!machObj) {
      alert('Please select or create a valid machine serial first.');
      return;
    }

    const targetSerial =
      selectedMachineSerial !== 'ALL' ? selectedMachineSerial : machObj.serialNumber;
    const targetMachName = `${machObj.projectName || machObj.machineType} (${targetSerial})`;
    const mParts = getManufacturedPartsForMachine(prj, targetSerial);

    const poolTemplates = generateProjectMachineInspectionPool({
      projectNumber: prj,
      machineOrAssembly: targetMachName,
      machineSerial: targetSerial,
      machineType: machObj.machineType,
      inspector: currentUser.name,
      manufacturedParts: mParts,
    });

    // Check existing sheets to prevent redundant duplicates
    const existingPool = db.daleInspections || [];
    const newTemplates = poolTemplates.filter((tmpl) => {
      return !existingPool.some(
        (ex) =>
          ex.projectNumber === tmpl.projectNumber &&
          (ex.machineOrAssembly.includes(targetSerial) || ex.partOrSerialNo.includes(targetSerial)) &&
          ex.processType === tmpl.processType &&
          ex.partOrSerialNo === tmpl.partOrSerialNo
      );
    });

    if (newTemplates.length === 0) {
      setPoolFeedback(
        `All ${poolTemplates.length} conducive inspection sheets for Job ${prj} (${targetSerial}) are already active in the pool!`
      );
      setTimeout(() => setPoolFeedback(null), 5000);
      return;
    }

    const res = await createDaleInspectionsBatch(newTemplates);
    if (res.success) {
      setPoolFeedback(
        `Successfully generated pool of ${res.createdCount} conducive inspection sheets for Job ${prj} (${targetSerial}) according to manufactured parts!`
      );
      setTimeout(() => setPoolFeedback(null), 5000);
    } else {
      setPoolFeedback(res.error || 'Failed to auto-populate sheets.');
    }
  };

  // Auto-populate entire workshop fleet (all 5 machines and projects manufactured in factory)
  const handleAutoPopulateEntireFleet = async () => {
    const machines = db.machines || [];
    let totalGenerated = 0;
    const existingPool = db.daleInspections || [];

    for (const mach of machines) {
      const prj = mach.projectNumber;
      const targetSerial = mach.serialNumber;
      const targetMachName = `${mach.projectName} (${targetSerial})`;
      const mParts = getManufacturedPartsForMachine(prj, targetSerial);

      const candidateTemplates = generateProjectMachineInspectionPool({
        projectNumber: prj,
        machineOrAssembly: targetMachName,
        machineSerial: targetSerial,
        machineType: mach.machineType,
        inspector: currentUser.name,
        manufacturedParts: mParts,
      });

      const newTemplates = candidateTemplates.filter((tmpl) => {
        return !existingPool.some(
          (ex) =>
            ex.projectNumber === tmpl.projectNumber &&
            (ex.machineOrAssembly.includes(targetSerial) || ex.partOrSerialNo.includes(targetSerial)) &&
            ex.processType === tmpl.processType &&
            ex.partOrSerialNo === tmpl.partOrSerialNo
        );
      });

      if (newTemplates.length > 0) {
        const res = await createDaleInspectionsBatch(newTemplates);
        if (res.success && res.createdCount) {
          totalGenerated += res.createdCount;
        }
      }
    }

    if (totalGenerated > 0) {
      setPoolFeedback(
        `Successfully generated and populated ${totalGenerated} inspection sheets across all ${machines.length} factory machines according to manufactured parts!`
      );
    } else {
      setPoolFeedback(
        `All ${machines.length} factory machines already have their complete pool of conducive inspection sheets active.`
      );
    }
    setTimeout(() => setPoolFeedback(null), 6000);
  };

  // Handle Point Result Change (supports open-ended toggling and auto-records separate NCR on non-conformance)
  const handlePointResult = async (pointId: string, result: DaleChecklistResult) => {
    if (!activeSheet) return;
    setApprovalError(null);
    const targetPt = activeSheet.points.find((p) => p.id === pointId);
    // Clicking the same result toggles it off back to null (open-ended with no value)
    const newResult = targetPt?.result === result ? null : result;
    const res = await updateDaleInspectionPoint(activeSheet.id, pointId, { result: newResult });
    if (!res.success && res.error) {
      setApprovalError(res.error);
      return;
    }
    if (newResult === 'FAIL' && res.ncrNumber) {
      if (statusFilter !== 'ALL') setStatusFilter('ALL');
      setAutoNcrAlert({
        ncrNumber: res.ncrNumber,
        pointDesc: `Item #${targetPt?.pointNumber}: "${targetPt?.description || 'Inspection finding'}"`,
        mfgRecordId: activeSheet.partOrSerialNo,
      });
    } else if (statusFilter !== 'ALL') {
      setStatusFilter('ALL');
    }
  };

  // Handle Photo Evidence Upload / Capture from Device
  const handlePhotoUploadForPoint = async (pointId: string, file: File) => {
    if (!activeSheet) return;
    setApprovalError(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const uploadRes = await uploadAttachmentFile({
          originalFilename: file.name,
          mimeType: file.type || 'image/jpeg',
          base64Data,
          category: 'EVIDENCE',
          relatedRecordId: activeSheet.id,
          drawingNumber: activeSheet.drawingNumber,
          revision: activeSheet.drawingRevision,
          caption: `Photo evidence for deviation on ${activeSheet.sheetNumber} Point`,
        });

        const targetPt = activeSheet.points.find((p) => p.id === pointId);
        const currentPhotos = targetPt?.photos || [];
        const newPhoto: FileAttachmentMetadata = uploadRes.success && uploadRes.attachment
          ? uploadRes.attachment
          : {
              fileId: `PHOTO-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              originalFilename: file.name,
              storedFilename: file.name,
              mimeType: file.type || 'image/jpeg',
              fileSize: file.size,
              uploadDate: new Date().toISOString(),
              uploadedBy: currentUser.name,
              uploadedById: currentUser.id,
              category: 'EVIDENCE',
              relatedRecordId: activeSheet.id,
              drawingNumber: activeSheet.drawingNumber,
              revision: activeSheet.drawingRevision,
              dataUrl: base64Data,
            };

        const nextPhotos = [...currentPhotos, newPhoto];
        const res = await updateDaleInspectionPoint(activeSheet.id, pointId, { photos: nextPhotos });
        if (!res.success && res.error) {
          setApprovalError(res.error);
        }
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      setApprovalError(`Photo upload error: ${e.message}`);
    }
  };

  // Remove Photo from Point
  const handleRemovePhotoFromPoint = async (pointId: string, fileId: string) => {
    if (!activeSheet) return;
    const targetPt = activeSheet.points.find((p) => p.id === pointId);
    const nextPhotos = (targetPt?.photos || []).filter((p) => p.fileId !== fileId);
    await updateDaleInspectionPoint(activeSheet.id, pointId, { photos: nextPhotos });
  };

  // Handle Point Deviation Notes Change
  const handlePointDeviationNotes = async (pointId: string, deviationNotes: string) => {
    if (!activeSheet) return;
    await updateDaleInspectionPoint(activeSheet.id, pointId, {
      deviationNotes,
      comment: deviationNotes,
    });
  };

  // Handle Explicit Submit Checklist with target status
  const handleSubmitChecklist = async (targetStatus: 'PASS' | 'FAIL' | 'PENDING') => {
    if (!activeSheet) return;
    setApprovalError(null);
    const res = await submitDaleInspection(activeSheet.id, {
      targetStatus,
      inspectorComments: activeSheet.comments,
      correctiveAction: activeSheet.correctiveAction,
    });
    if (!res.success && res.error) {
      setApprovalError(res.error);
      return;
    }
    if (res.ncrNumbers && res.ncrNumbers.length > 0) {
      setAutoNcrAlert({
        ncrNumber: res.ncrNumbers.join(', '),
        pointDesc: `Checklist submitted as ${targetStatus}. ${res.ncrNumbers.length} separate NCR(s) active with photo evidence.`,
      });
    }
  };

  // Handle Sign-off Approval
  const handleApproveInspection = async (status: 'PASS' | 'FAIL') => {
    await handleSubmitChecklist(status);
  };

  // Handle Point Measurement Change
  const handlePointMeasurement = async (pointId: string, val: string) => {
    if (!activeSheet) return;
    await updateDaleInspectionPoint(activeSheet.id, pointId, { measurementValue: val });
  };

  // Handle Point Comment Change
  const handlePointComment = async (pointId: string, val: string) => {
    if (!activeSheet) return;
    await updateDaleInspectionPoint(activeSheet.id, pointId, { comment: val });
  };

  // Handle Quick Raise NCR
  const handleOpenRaiseNcr = (pointDesc: string) => {
    setNcrPointDesc(pointDesc);
    setNcrDefectDesc(`Non-conformance detected on inspection point: "${pointDesc}"`);
    setIsRaiseNcrModalOpen(true);
  };

  const handleSubmitNcr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSheet) return;

    const linkedMfg = (db.manufacturingRecords || []).find(
      (m) =>
        m.partNumber === activeSheet.partOrSerialNo ||
        m.projectNumber === activeSheet.projectNumber
    );

    const mfgId = linkedMfg ? linkedMfg.id : 'MR-GEN-01';

    const res = await createNCR({
      manufacturingRecordId: mfgId,
      traceabilityNumber: activeSheet.partOrSerialNo,
      machineSerialNumber: activeSheet.machineOrAssembly,
      projectNumber: activeSheet.projectNumber,
      partNumber: activeSheet.partOrSerialNo,
      componentDescription: activeSheet.partDescription || activeSheet.processTitle,
      drawingNumber: activeSheet.drawingNumber,
      drawingRevision: activeSheet.drawingRevision,
      failedCharacteristics: [ncrPointDesc],
      description: ncrDefectDesc,
      requirement: `Conform to approved Dale drawing ${activeSheet.drawingNumber} Rev ${activeSheet.drawingRevision}`,
      actualCondition: ncrDefectDesc,
      immediateContainment: 'Component placed on Quality Hold in workshop quarantine bay.',
      proposedDisposition: 'REWORK',
      rootCause: 'Defect identified during Dale workshop quality checklist inspection.',
      correctiveAction: 'Rework part to specification or raise engineering concession deviation.',
      responsiblePerson: currentUser.name,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    });

    if (res.success && res.ncrNumber) {
      await updateDaleInspection(activeSheet.id, {
        ncrReference: res.ncrNumber,
        approvalStatus: 'FAIL',
        correctiveAction: `NCR ${res.ncrNumber} logged: ${ncrDefectDesc}`,
      });
      setIsRaiseNcrModalOpen(false);
    }
  };

  // Process Icon Mapping
  const getProcessIcon = (p: DaleProcessType) => {
    switch (p) {
      case 'FABRICATION_WELDING':
        return <Flame className="w-4 h-4 text-amber-600" />;
      case 'MACHINED_COMPONENTS':
      case 'MACHINED_PARTS':
        return <Cpu className="w-4 h-4 text-blue-600" />;
      case 'CONVEYOR_COMPONENTS':
        return <Boxes className="w-4 h-4 text-emerald-600" />;
      case 'SPIRAL_SYSTEMS':
        return <RotateCw className="w-4 h-4 text-purple-600" />;
      case 'MECHANICAL_ASSEMBLY':
      case 'ASSEMBLY':
        return <Layers className="w-4 h-4 text-indigo-600" />;
      case 'ELECTRICAL_CONTROL_PANEL':
      case 'ELECTRICAL_PANELS':
        return <Zap className="w-4 h-4 text-amber-500" />;
      case 'ROBOTIC_AUTOMATION_ASSEMBLY':
        return <Bot className="w-4 h-4 text-sky-600" />;
      case 'REFRIGERATION_COOLING_ASSEMBLY':
        return <Snowflake className="w-4 h-4 text-teal-600" />;
      case 'FINAL_MANUFACTURING_FAT':
      case 'FINAL_MANUFACTURING':
        return <Award className="w-4 h-4 text-rose-600" />;
      default:
        return <ClipboardCheck className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* =========================================================================
          1. TOP HEADER & MANUFACTURING SCOPE BOUNDARY
          ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-blue-400 uppercase">
                  DALE AUTOMATION QUALITY MANAGEMENT
                </span>
                <h1 className="text-xl font-black tracking-tight text-white">
                  Workshop Quality Inspection Module
                </h1>
              </div>
            </div>
            <p className="text-xs text-slate-300 mt-1.5 max-w-3xl leading-relaxed">
              Standardized, practical inspection sheets for Dale Automation’s <strong>MANUFACTURING processes</strong> and <strong>manufactured products only</strong>. Designed to catch basic manufacturing defects before parts, assemblies or machines leave the workshop.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDatabaseModalOpen(true)}
              className="px-3 py-2 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-100 border border-indigo-700/80 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              title="Show the master Quality Forms Database, machine matching matrix and process mapping"
            >
              <Database className="w-3.5 h-3.5 text-indigo-300" />
              <span>Forms Database &amp; Mapping</span>
            </button>

            <button
              type="button"
              onClick={() => setIsTemplatePoolModalOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Explore the pool of 9 reusable Dale manufacturing inspection templates"
            >
              <FolderPlus className="w-3.5 h-3.5 text-blue-400" />
              <span>9-Template Pool Library</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPrintTargetSheet(activeSheet || null);
                setIsPrintModalOpen(true);
              }}
              disabled={!activeSheet}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Print formal Dale Inspection Report"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Inspection Sheet</span>
            </button>
          </div>
        </div>

        {/* Workshop Manufacturing Scope Exclusion Banner */}
        <div className="mt-4 p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-300">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Factory Manufacturing Scope:</strong> Covers shop floor manufacturing, assembly & FAT before dispatch.
              <span className="text-slate-400 ml-1">
                Site installation, site commissioning, customer SAT, SHEQ inspections and safety risk assessments are excluded from workshop QMS.
              </span>
            </span>
          </div>
          <span className="text-amber-400 font-mono text-[10px] shrink-0 font-bold uppercase tracking-wider">
            Zero Default Pass • Open-Ended Checklist
          </span>
        </div>

        {/* Process Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs font-mono">
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
            <div className="text-[10px] text-slate-400">ACTIVE POOL SHEETS</div>
            <div className="text-lg font-bold text-white mt-0.5">{stats.total}</div>
          </div>
          <div className="bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/40">
            <div className="text-[10px] text-emerald-400">CONFORMING (PASS)</div>
            <div className="text-lg font-bold text-emerald-300 mt-0.5">{stats.passed}</div>
          </div>
          <div className="bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/40">
            <div className="text-[10px] text-amber-400">OPEN-ENDED (PENDING)</div>
            <div className="text-lg font-bold text-amber-300 mt-0.5">{stats.pending}</div>
          </div>
          <div className="bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
            <div className="text-[10px] text-rose-400">DEFECT (FAIL / HOLD)</div>
            <div className="text-lg font-bold text-rose-300 mt-0.5">{stats.failed}</div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          FACTORY DEPARTMENTS WORKFLOW PIPELINE
          (DRAWING → MANUFACTURE → INSPECT → CORRECT IF REQUIRED → PASS → RELEASE)
          ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600/30 text-blue-400 rounded-md border border-blue-500/30">
              <Workflow className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold">
                  DALE FACTORY MANUFACTURING WORKFLOW
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  All 13 Departments Included
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mt-0.5">
                DRAWING → MANUFACTURE → INSPECT → CORRECT IF REQUIRED → PASS → RELEASE
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsWorkflowPipelineExpanded(!isWorkflowPipelineExpanded)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono px-2.5 py-1 bg-slate-800/80 rounded border border-slate-700 w-fit"
          >
            <span>{isWorkflowPipelineExpanded ? 'Collapse Workflow' : 'Expand All 13 Departments'}</span>
            {isWorkflowPipelineExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isWorkflowPipelineExpanded && (
          <div className="mt-3.5 space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Every equipment and machine built at Dale Automation strictly moves through these 6 consecutive gates.
              Quality inspections cover factory manufacturing and manufactured parts only (site installation and commissioning are excluded).
            </p>

            {/* 6 Stage Flow Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-2.5">
              {WORKFLOW_STAGES.map((stage) => {
                const isCurrentStageActive = stage.departments.includes(departmentFilter as any);
                return (
                  <div
                    key={stage.key}
                    className={`p-3 rounded-lg border text-xs flex flex-col justify-between transition-all ${
                      isCurrentStageActive
                        ? 'bg-blue-950/60 border-blue-400 shadow-sm ring-1 ring-blue-400/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 mb-1">
                        <span>STAGE {stage.step}</span>
                        <span className="uppercase text-[9px] px-1 rounded bg-slate-800 text-slate-300">
                          {stage.departments.length} Dept{stage.departments.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="font-black text-xs text-white uppercase tracking-tight">
                        {stage.title}
                      </div>
                      <div className="text-[11px] font-semibold text-blue-300 mt-0.5">
                        {stage.action}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
                        {stage.summary}
                      </p>
                    </div>

                    {/* Department Badges in this Stage */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                      <div className="text-[9px] uppercase font-mono text-slate-400 mb-1">
                        Responsible Departments:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {stage.departments.map((deptId) => {
                          const deptInfo = getDepartmentById(deptId);
                          const isDeptSelected = departmentFilter === deptId;
                          return (
                            <button
                              key={deptId}
                              type="button"
                              onClick={() => {
                                const newFilter = isDeptSelected ? 'ALL' : deptId;
                                setDepartmentFilter(newFilter);
                                setActiveWorkshopDepartment(newFilter as any);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors flex items-center gap-1 ${
                                isDeptSelected
                                  ? 'bg-blue-600 text-white shadow-2xs font-bold'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80'
                              }`}
                              title={`Filter inspection pool by [${deptInfo?.code}] ${deptInfo?.name}`}
                            >
                              <span>[{deptInfo?.code}]</span>
                              <span className="truncate max-w-[85px]">{deptInfo?.name.split(' ')[0]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Department Filter Active State Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="font-mono text-slate-400 text-[10px]">CURRENT DEPT FILTER:</span>
                {departmentFilter === 'ALL' ? (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-semibold border border-slate-700">
                    All 13 Factory Departments Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold flex items-center gap-1">
                    <span>[{getDepartmentById(departmentFilter)?.code}]</span>
                    <span>{getDepartmentById(departmentFilter)?.name}</span>
                  </span>
                )}
              </div>
              {departmentFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    setDepartmentFilter('ALL');
                    setActiveWorkshopDepartment('ALL');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition-colors"
                >
                  Clear Department Filter (Show All 13)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          2. PROJECT & MACHINE CONTEXT CONTROLS ("conducive to each separate project/machine")
          ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase font-mono">
                Project &amp; Machine Inspection Context
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Quality inspection sheets are strictly segregated and tailored to each specific project and machine manufactured in our factory.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAutoPopulatePool}
              className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
              title="Automatically populate the required pool of inspection sheets for the selected project and machine according to manufactured parts"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Auto-Populate Selected Machine Pool</span>
            </button>

            <button
              type="button"
              onClick={handleAutoPopulateEntireFleet}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
              title="Auto-populate the pool of inspection sheets across all factory machines (T0559, PRJ-2026-104, 108, 112, 115) according to manufactured parts"
            >
              <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
              <span>Populate All Factory Machines ({db.machines.length})</span>
            </button>
          </div>
        </div>

        {poolFeedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900 flex items-center gap-2 shadow-2xs animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{poolFeedback}</span>
          </div>
        )}

        {/* Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Department Workflow Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 font-mono uppercase flex items-center justify-between">
              <span>1. Department:</span>
              <span className="text-[10px] text-blue-600 font-normal">All 13 Depts</span>
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => {
                const val = e.target.value as WorkshopDepartment | 'ALL';
                setDepartmentFilter(val);
                setActiveWorkshopDepartment(val as WorkshopDepartment);
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Factory Departments ({WORKSHOP_DEPARTMENTS.length})</option>
              {WORKSHOP_DEPARTMENTS.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  [{dept.code}] {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 font-mono uppercase">
              2. Project / Job No:
            </label>
            <select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                setSelectedMachineSerial('ALL');
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Projects ({availableProjects.length})</option>
              {availableProjects.map((prj) => {
                const prjObj = (db.projects || []).find((p) => p.projectNumber === prj);
                return (
                  <option key={prj} value={prj}>
                    Job {prj} {prjObj ? `— ${prjObj.projectName}` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Machine Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 font-mono uppercase">
              3. Machine / Assembly:
            </label>
            <select
              value={selectedMachineSerial}
              onChange={(e) => setSelectedMachineSerial(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Machines / Assemblies</option>
              {availableMachines.map((m) => (
                <option key={m.serialNumber} value={m.serialNumber}>
                  {m.serialNumber} — {m.projectName}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 font-mono uppercase">
              4. Inspection Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses ({stats.total})</option>
              <option value="PENDING">Open-Ended / Pending ({stats.pending})</option>
              <option value="PASS">Conforming / Passed ({stats.passed})</option>
              <option value="FAIL">Defect / Fail / Hold ({stats.failed})</option>
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 font-mono uppercase">
              5. Search Records:
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Part, drawing, serial..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Manufactured Parts Pool Breakdown for Selected Project & Machine */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
            <div className="flex items-center gap-1.5 text-xs">
              <Boxes className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-bold text-slate-800 uppercase font-mono text-[11px]">
                Manufactured Factory Parts for {selectedProject !== 'ALL' ? `Job ${selectedProject}` : 'Workshop Fleet'}:
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                ({currentContextManufacturedParts.length} components tracked)
              </span>
            </div>
            <span className="text-[10px] text-slate-500">
              Only parts manufactured in our factory are inspected prior to workshop release
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {currentContextManufacturedParts.length === 0 ? (
              <span className="text-xs text-slate-400 italic">
                Select a specific project or machine to inspect manufactured parts.
              </span>
            ) : (
              currentContextManufacturedParts.map((part) => {
                // Check if an inspection sheet in the pool covers this part
                const matchingSheet = (db.daleInspections || []).find(
                  (s) =>
                    s.partOrSerialNo === part.partNumber ||
                    s.partDescription?.includes(part.partNumber) ||
                    (s.drawingNumber === part.drawingNumber && (s.partName?.includes(part.description) || false))
                );

                return (
                  <button
                    key={part.partNumber}
                    type="button"
                    onClick={() => {
                      if (matchingSheet) setSelectedSheetId(matchingSheet.id);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono border text-left flex items-center gap-1.5 transition-colors ${
                      matchingSheet
                        ? matchingSheet.approvalStatus === 'PASS'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                          : matchingSheet.approvalStatus === 'FAIL'
                          ? 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100'
                          : 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100'
                        : 'bg-slate-50 border-slate-200 text-slate-600 opacity-75'
                    }`}
                    title={
                      matchingSheet
                        ? `Inspection Sheet: ${matchingSheet.sheetNumber} (${matchingSheet.approvalStatus}) — Click to view`
                        : `No inspection sheet in pool yet — Click "Auto-Populate" to generate`
                    }
                  >
                    <span className="font-bold text-slate-900">{part.partNumber}</span>
                    <span className="text-slate-600 truncate max-w-[140px]">{part.description}</span>
                    {matchingSheet ? (
                      <span
                        className={`text-[9px] font-bold px-1 rounded ${
                          matchingSheet.approvalStatus === 'PASS'
                            ? 'bg-emerald-200 text-emerald-900'
                            : matchingSheet.approvalStatus === 'FAIL'
                            ? 'bg-rose-200 text-rose-900'
                            : 'bg-amber-200 text-amber-900'
                        }`}
                      >
                        {matchingSheet.approvalStatus}
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-400 bg-slate-200 px-1 rounded">
                        Pool Needed
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. THE 9 MANUFACTURING PROCESS TABS
          ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 p-2.5 shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-bold text-slate-700 text-xs">
              Select Manufacturing Process (9 Standard Dale Sheets):
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {filteredSheets.length} sheet{filteredSheets.length === 1 ? '' : 's'} conducive to current selection
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveProcessTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeProcessTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All 9 Processes ({db.daleInspections?.length || 0})
          </button>

          {DALE_CANONICAL_PROCESS_KEYS.map((key) => {
            const def = DALE_PROCESS_DEFINITIONS[key];
            const count = (db.daleInspections || []).filter(
              (s) =>
                s.processType === key ||
                (key === 'MACHINED_COMPONENTS' && s.processType === 'MACHINED_PARTS') ||
                (key === 'MECHANICAL_ASSEMBLY' && s.processType === 'ASSEMBLY') ||
                (key === 'ELECTRICAL_CONTROL_PANEL' && s.processType === 'ELECTRICAL_PANELS') ||
                (key === 'FINAL_MANUFACTURING_FAT' && s.processType === 'FINAL_MANUFACTURING')
            ).length;
            const isSelected = activeProcessTab === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveProcessTab(key)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
                title={def.scopeDescription}
              >
                {getProcessIcon(key)}
                <span>{def.title}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          4. MAIN TWO-COLUMN VIEW: LEFT SHEET LIST, RIGHT ACTIVE INSPECTION SHEET
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: Sheet List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 font-mono">
                POOL: {filteredSheets.length} SHEET{filteredSheets.length === 1 ? '' : 'S'}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {selectedProject !== 'ALL' ? `Job ${selectedProject}` : 'All Projects'}
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[720px] overflow-y-auto">
              {filteredSheets.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600">No inspection sheets match this project/filter.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Click "Auto-Populate Project/Machine Pool" to generate the required sheets from the 9 templates.
                  </p>
                  <button
                    type="button"
                    onClick={handleAutoPopulatePool}
                    className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Populate Pool Now</span>
                  </button>
                </div>
              ) : (
                filteredSheets.map((sheet) => {
                  const isSelected = sheet.id === activeSheet?.id;
                  const passedPoints = sheet.points.filter((p) => p.result === 'PASS').length;
                  const failPoints = sheet.points.filter((p) => p.result === 'FAIL').length;
                  const naPoints = sheet.points.filter((p) => p.result === 'NA').length;
                  const openPoints = sheet.points.filter((p) => !p.result || p.result === 'PENDING').length;

                  return (
                    <button
                      key={sheet.id}
                      type="button"
                      onClick={() => setSelectedSheetId(sheet.id)}
                      className={`w-full text-left p-3.5 transition-colors relative ${
                        isSelected
                          ? 'bg-blue-50/90 border-l-4 border-l-blue-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {getProcessIcon(sheet.processType)}
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {sheet.sheetNumber}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                            sheet.approvalStatus === 'PASS'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : sheet.approvalStatus === 'FAIL' || sheet.approvalStatus === 'HOLD'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {sheet.approvalStatus === 'FAIL' ? 'FAIL / HOLD' : sheet.approvalStatus}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-slate-800 mt-1 line-clamp-1">
                        {sheet.partName || sheet.processTitle}
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                        Part: {sheet.partOrSerialNo}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-100 pt-1.5">
                        <span>Job: <strong>{sheet.projectNumber}</strong></span>
                        <span>
                          {passedPoints}P / <span className={failPoints > 0 ? 'text-rose-600 font-bold' : ''}>{failPoints}F</span> / {naPoints}NA / <strong className="text-amber-700">{openPoints} No Val</strong>
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Active Quality Inspection Sheet */}
        <div className="lg:col-span-8">
          {activeSheet ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
              {/* Auto NCR Alert Banner */}
              {autoNcrAlert && (
                <div className="m-4 p-3 bg-rose-50 border border-rose-300 rounded-lg flex items-center justify-between gap-3 text-xs text-rose-900 shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <span className="font-bold">Non-conformance automatically recorded as NCR:</span>{' '}
                      <span className="font-mono font-black text-rose-800 bg-rose-200/80 px-1.5 py-0.5 rounded">
                        {autoNcrAlert.ncrNumber}
                      </span>
                      <span className="ml-1.5 text-rose-700">({autoNcrAlert.pointDesc})</span>
                      <div className="text-[11px] text-rose-600 mt-0.5">
                        Component placed on Quality Hold. Traceability &amp; manufacturing records blocked from release.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewingNcrNumber(autoNcrAlert.ncrNumber.split(',')[0].trim())}
                      className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 text-rose-600" />
                      <span>View NCR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigateToCrossRef(
                          'quality-release',
                          autoNcrAlert.ncrNumber,
                          autoNcrAlert.mfgRecordId
                        );
                      }}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors"
                      title="Inspect full 18-gate barrier and quarantined component in Quality Release Gate"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Inspect in Quality Release Gate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoNcrAlert(null)}
                      className="text-rose-500 hover:text-rose-700 font-bold px-2 py-1 text-xs"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Sheet Header Card */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded font-mono font-bold text-xs">
                        {activeSheet.sheetNumber}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 font-mono">
                        Date: {activeSheet.inspectionDate}
                      </span>
                      <span className="px-2 py-0.2 bg-slate-200 text-slate-800 rounded font-mono text-[10px] font-bold">
                        Job: {activeSheet.projectNumber}
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
                      {getProcessIcon(activeSheet.processType)}
                      <span>{activeSheet.processTitle}</span>
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {getDaleProcessDefinition(activeSheet.processType)?.scopeDescription}
                    </p>
                  </div>

                  {/* Fast Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await resetDaleInspectionPointsToOpen(activeSheet.id);
                        setApprovalError(null);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Reset all inspection points on this sheet to NO value (open-ended) for active verification"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Reset to No Value</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await setAllDaleInspectionPointsNA(activeSheet.id);
                        setApprovalError(null);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Set all inspection points on this sheet to N/A (Not Applicable to this unit)"
                    >
                      <MinusCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>Set All N/A</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await setAllDaleInspectionPointsPass(activeSheet.id);
                        setApprovalError(null);
                      }}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Mark all items conforming PASS for verified production lot"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Mark All PASS</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPrintTargetSheet(activeSheet);
                        setIsPrintModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Print or export formatted inspection sheet traveler"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-600" />
                      <span>Print Sheet</span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(activeSheet.id)}
                        className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold"
                        title="Delete this inspection sheet"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Standard Metadata Grid for Every Sheet */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-200/80 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block">PROJECT / JOB NO.</span>
                    <strong className="text-slate-900 font-mono">{activeSheet.projectNumber}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block">DRAWING NO. / REV</span>
                    <strong className="text-blue-700 font-mono">
                      {activeSheet.drawingNumber} (Rev {activeSheet.drawingRevision})
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block">PART / SERIAL NO.</span>
                    <strong className="text-slate-900 font-mono truncate block" title={activeSheet.partOrSerialNo}>
                      {activeSheet.partOrSerialNo}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block">INSPECTOR</span>
                    <strong className="text-slate-900 truncate block">{activeSheet.inspector}</strong>
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block">MACHINE / ASSEMBLY</span>
                    <span className="font-semibold text-slate-900">{activeSheet.machineOrAssembly}</span>
                    {activeSheet.partDescription && (
                      <span className="text-slate-500 ml-1.5 text-[11px]">({activeSheet.partDescription})</span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-mono block">PART NAME</span>
                    <strong className="text-slate-900">{activeSheet.partName || activeSheet.processTitle}</strong>
                  </div>
                </div>
              </div>

              {/* Checklist Table */}
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-bold text-slate-800 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-blue-600" />
                    <span>Manufacturing Inspection Items &amp; Specifications</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-normal">
                    <span className="text-slate-500 hidden sm:inline">
                      Default is NO value or N/A. Every item must be evaluated as PASS or FAIL before workshop release.
                    </span>
                    <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {activeSheet.points.filter((p) => p.result === 'PASS').length} Pass /{' '}
                      <span className={activeSheet.points.some((p) => p.result === 'FAIL') ? 'text-rose-600 font-bold' : ''}>
                        {activeSheet.points.filter((p) => p.result === 'FAIL').length} Fail
                      </span>{' '}
                      /{' '}
                      {activeSheet.points.filter((p) => p.result === 'NA').length} N/A /{' '}
                      <span className="text-amber-700 font-bold">
                        {activeSheet.points.filter((p) => !p.result || p.result === 'PENDING').length} No Value
                      </span>
                    </span>
                  </div>
                </div>

                {/* Point Items List */}
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {activeSheet.points.map((point) => {
                    const isPass = point.result === 'PASS';
                    const isFail = point.result === 'FAIL';
                    const isNA = point.result === 'NA';
                    const isOpenEnded = !point.result || point.result === 'PENDING';

                    return (
                      <div
                        key={point.id}
                        className={`p-3 transition-colors ${
                          isFail
                            ? 'bg-rose-50/40'
                            : isOpenEnded
                            ? 'bg-amber-50/20'
                            : 'bg-white hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                          {/* Point Description & Requirement */}
                          <div className="flex items-start gap-2.5 flex-1">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              {point.pointNumber}
                            </span>
                            <div className="space-y-1">
                              <div className="font-bold text-slate-900 text-xs leading-snug">
                                {point.description}
                              </div>
                              {point.requirement && (
                                <div className="text-[11px] text-slate-600 font-medium">
                                  <strong className="text-slate-700">Requirement / Spec:</strong> {point.requirement}
                                </div>
                              )}
                              {point.requiresMeasurement && (
                                <div className="text-[10px] text-blue-700 font-mono mt-0.5 flex items-center gap-1">
                                  <span>Critical Measurement Required ({point.measurementUnit || 'mm'})</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Controls: Measurement field + PASS / FAIL / N/A toggle buttons */}
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {/* Inline Measurement field if needed */}
                            {point.requiresMeasurement && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  placeholder={point.measurementUnit || 'Reading...'}
                                  value={point.measurementValue || ''}
                                  onChange={(e) => handlePointMeasurement(point.id, e.target.value)}
                                  className="w-32 px-2 py-1 text-xs border border-slate-300 rounded font-mono bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                {point.measurementUnit && (
                                  <span className="text-[10px] text-slate-500 font-mono font-semibold">
                                    {point.measurementUnit}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Pass / Fail / N/A Segmented Buttons + Clear to Open */}
                            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs items-center">
                              <button
                                type="button"
                                onClick={() => handlePointResult(point.id, 'PASS')}
                                title={isPass ? 'Click to toggle back to open-ended (no value)' : 'Mark as PASS'}
                                className={`px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1 transition-all ${
                                  isPass
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-emerald-700'
                                }`}
                              >
                                <Check className="w-3 h-3" />
                                <span>PASS</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handlePointResult(point.id, 'FAIL')}
                                title={isFail ? 'Click to toggle back to open-ended (no value)' : 'Mark as Non-Conforming FAIL (Auto-records NCR)'}
                                className={`px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1 transition-all ${
                                  isFail
                                    ? 'bg-rose-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-rose-700'
                                }`}
                              >
                                <XCircle className="w-3 h-3" />
                                <span>FAIL</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handlePointResult(point.id, 'NA')}
                                title={isNA ? 'Click to toggle back to open-ended (no value)' : 'Mark as N/A'}
                                className={`px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1 transition-all ${
                                  isNA
                                    ? 'bg-slate-700 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <MinusCircle className="w-3 h-3" />
                                <span>N/A</span>
                              </button>

                              {!isOpenEnded && (
                                <button
                                  type="button"
                                  onClick={() => handlePointResult(point.id, null)}
                                  title="Clear result back to open-ended (no value)"
                                  className="px-1.5 py-1 text-[10px] text-slate-400 hover:text-slate-700 font-mono transition-colors border-l border-slate-200 ml-0.5"
                                >
                                  Clear
                                </button>
                              )}
                            </div>

                            {isOpenEnded && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                No Value (Open)
                              </span>
                            )}

                            {isNA && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
                                <MinusCircle className="w-3 h-3 text-slate-600" />
                                N/A — Not Applicable
                              </span>
                            )}

                            {isPass && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" />
                                PASS — Conforms
                              </span>
                            )}

                            {isFail && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (point.ncrReference) {
                                    setViewingNcrNumber(point.ncrReference);
                                  } else {
                                    handleOpenRaiseNcr(point.description);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-bold bg-rose-600 text-white shadow-2xs hover:bg-rose-700 transition-colors"
                                title="Click to view dedicated NCR details and deviation report"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>{point.ncrReference ? `NCR ${point.ncrReference}` : 'FAIL / Raising NCR...'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* If NOT Failed: standard inspector comments / observations */}
                        {!isFail && (
                          <div className="mt-2 pl-7.5">
                            <input
                              type="text"
                              placeholder="Inspector comments / observations (optional)..."
                              value={point.comment || ''}
                              onChange={(e) => handlePointComment(point.id, e.target.value)}
                              className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </div>
                        )}

                        {/* If FAILED: Rich Deviation Record & Photo Evidence Panel */}
                        {isFail && (
                          <div className="mt-3 ml-7.5 p-3.5 bg-rose-50/90 border-2 border-rose-300 rounded-xl space-y-3 shadow-xs">
                            {/* Deviation Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-rose-200/80">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 bg-rose-600 text-white font-mono font-bold text-[10px] rounded flex items-center gap-1 shadow-2xs">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>POINT DEVIATION RECORDED</span>
                                </span>
                                {point.ncrReference && (
                                  <span className="font-mono text-xs font-black text-rose-950 bg-white px-2 py-0.5 rounded border border-rose-300 shadow-2xs">
                                    Dedicated NCR: <strong>{point.ncrReference}</strong>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {point.ncrReference && (
                                  <button
                                    type="button"
                                    onClick={() => setViewingNcrNumber(point.ncrReference!)}
                                    className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded font-bold text-xs flex items-center gap-1 transition-colors shadow-2xs"
                                    title="View full NCR details for this specific deviation"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-rose-600" />
                                    <span>View NCR {point.ncrReference}</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Actual Deviation Recorded Textarea */}
                            <div>
                              <label className="block text-[11px] font-bold text-rose-950 mb-1">
                                Actual Deviation Recorded (Non-Conformance Finding) *:
                              </label>
                              <div className="space-y-1">
                                <textarea
                                  rows={2}
                                  value={point.deviationNotes || point.comment || ''}
                                  onChange={(e) => handlePointDeviationNotes(point.id, e.target.value)}
                                  placeholder={`Detail the specific deviation observed on "${point.description}" (e.g. Porosity along bottom weld seam, measured undersize 4.1mm vs 6.0mm required, surface scratch on seal journal)...`}
                                  className="w-full px-3 py-1.5 text-xs bg-white border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none placeholder:text-slate-400 font-sans shadow-2xs"
                                />
                                <span className="text-[10px] text-rose-700 italic block">
                                  This description is automatically synchronized with the dedicated NCR #{point.ncrReference || 'Pending'}.
                                </span>
                              </div>
                            </div>

                            {/* Photo Evidence Section (Photos can be taken directly from device or loaded from device) */}
                            <div className="pt-2 border-t border-rose-200 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                                    <Camera className="w-4 h-4 text-rose-600" />
                                    <span>Photo Evidence:</span>
                                  </span>

                                  {(!point.photos || point.photos.length === 0) ? (
                                    <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                      <span>Photo Evidence Required for Failed Point</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span>{point.photos.length} Photo Evidence Attached</span>
                                    </span>
                                  )}
                                </div>

                                {/* Device Capture / Load Action Buttons */}
                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Button 1: Take Photo Directly from Device Camera */}
                                  <label className="cursor-pointer px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors">
                                    <Camera className="w-3.5 h-3.5" />
                                    <span>Take Photo (Camera)</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handlePhotoUploadForPoint(point.id, file);
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>

                                  {/* Button 2: Choose Photo from Device Storage */}
                                  <label className="cursor-pointer px-3 py-1.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors">
                                    <Paperclip className="w-3.5 h-3.5 text-slate-600" />
                                    <span>Upload from Device</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handlePhotoUploadForPoint(point.id, file);
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>

                              {/* Photo Evidence Gallery */}
                              {point.photos && point.photos.length > 0 ? (
                                <div className="flex flex-wrap gap-3 pt-1">
                                  {point.photos.map((photo, pIdx) => (
                                    <div
                                      key={photo.fileId || pIdx}
                                      className="relative group border-2 border-rose-300 rounded-lg overflow-hidden bg-white shadow-2xs transition-transform hover:scale-[1.02]"
                                    >
                                      <img
                                        src={photo.dataUrl || photo.downloadUrl || ''}
                                        alt={photo.originalFilename}
                                        className="w-24 h-24 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() =>
                                          setPreviewPhoto({
                                            url: photo.dataUrl || photo.downloadUrl || '',
                                            title: `Item #${point.pointNumber} (${point.description}) — Evidence Photo ${pIdx + 1}`,
                                          })
                                        }
                                      />
                                      <div className="absolute top-1 right-1 flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPreviewPhoto({
                                              url: photo.dataUrl || photo.downloadUrl || '',
                                              title: `Item #${point.pointNumber} (${point.description}) — Evidence Photo ${pIdx + 1}`,
                                            })
                                          }
                                          className="w-5 h-5 bg-black/70 hover:bg-black text-white rounded flex items-center justify-center text-[10px]"
                                          title="Click to enlarge photo"
                                        >
                                          <Eye className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRemovePhotoFromPoint(point.id, photo.fileId)}
                                          className="w-5 h-5 bg-rose-600 hover:bg-rose-700 text-white rounded flex items-center justify-center text-[10px]"
                                          title="Delete photo"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <div className="p-1 bg-white text-[9px] text-slate-700 font-mono truncate max-w-[96px] border-t border-slate-100">
                                        {photo.originalFilename || `Photo ${pIdx + 1}`}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-center gap-2">
                                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                                  <span>
                                    No photo evidence attached yet. Each deviation must have photo evidence if failed. Take a photo directly using device camera or select a photo from your device.
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Overall Sheet Comments, Corrective Actions & Sign-offs */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 mt-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* General Comments */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Inspector General Findings &amp; Comments:
                      </label>
                      <textarea
                        rows={2}
                        value={activeSheet.comments || ''}
                        onChange={(e) => updateDaleInspection(activeSheet.id, { comments: e.target.value })}
                        placeholder="Enter general manufacturing notes or observations..."
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                      />
                    </div>

                    {/* Corrective Action */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Corrective Action (if non-conforming / held):
                      </label>
                      <textarea
                        rows={2}
                        value={activeSheet.correctiveAction || ''}
                        onChange={(e) => updateDaleInspection(activeSheet.id, { correctiveAction: e.target.value })}
                        placeholder="e.g. Rework journal diameter, deburr laser dross, replace seal, re-present to QC..."
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                      />
                    </div>
                  </div>

                  {/* NCR & Multiple Deviations Summary Bar */}
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Inspection Non-Conformance Records (NCRs):
                        </span>
                        <div className="text-[11px] text-slate-500">
                          {activeSheet.points.filter((p) => p.result === 'FAIL').length > 0 ? (
                            <span className="text-rose-700 font-semibold">
                              {activeSheet.points.filter((p) => p.result === 'FAIL').length} inspection point(s) failed. Each deviation has its own distinct NCR with photo evidence.
                            </span>
                          ) : (
                            <span>No failed points. Zero active non-conformances on this checklist.</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {Array.from(
                          new Set(
                            activeSheet.points
                              .filter((p) => p.result === 'FAIL' && p.ncrReference)
                              .map((p) => p.ncrReference!)
                          )
                        ).map((ncrNo) => (
                          <button
                            key={ncrNo}
                            type="button"
                            onClick={() => setViewingNcrNumber(ncrNo)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded font-mono font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors"
                            title="Click to view full NCR record and attached evidence"
                          >
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>{ncrNo}</span>
                            <ExternalLink className="w-3 h-3 text-rose-400" />
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => handleOpenRaiseNcr('General Quality Check')}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Raise Custom NCR</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Final Submission & Approval Box */}
                  <div className="p-3.5 bg-white border-2 border-slate-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl ${
                          activeSheet.approvalStatus === 'PASS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : activeSheet.approvalStatus === 'FAIL' || activeSheet.approvalStatus === 'HOLD'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>Manufacturing Checklist Status:</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-mono font-black text-xs shadow-2xs ${
                              activeSheet.approvalStatus === 'PASS'
                                ? 'bg-emerald-600 text-white'
                                : activeSheet.approvalStatus === 'FAIL' || activeSheet.approvalStatus === 'HOLD'
                                ? 'bg-rose-600 text-white'
                                : 'bg-amber-500 text-white'
                            }`}
                          >
                            {activeSheet.approvalStatus === 'FAIL' ? 'FAIL / HOLD' : activeSheet.approvalStatus}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {activeSheet.approvedBy ? (
                            <span>
                              Evaluated &amp; signed off by: <strong>{activeSheet.approvedBy}</strong> ({activeSheet.approvalDate})
                            </span>
                          ) : (
                            <span>Pending inspector evaluation &amp; submission</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Submit Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSubmitChecklist('PENDING')}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors"
                        title="Save current readings, comments, and photos in progress"
                      >
                        <span>Save In-Progress</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSubmitChecklist('PASS')}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                        title="Submit checklist and sign off as PASS"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Submit as PASS</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSubmitChecklist('FAIL')}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                        title="Submit checklist as FAIL / HOLD and confirm all separate NCRs"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Submit as FAIL / HOLD</span>
                      </button>
                    </div>
                  </div>

                  {approvalError && (
                    <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800 flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span className="font-semibold">{approvalError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setApprovalError(null)}
                        className="text-rose-600 hover:text-rose-800 font-bold ml-2 text-xs"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
              <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Select an inspection sheet from the list on the left.</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Or click "Auto-Populate Project/Machine Pool" to generate the required sheets for this machine.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          5. 9-TEMPLATE POOL LIBRARY MODAL
          ========================================================================= */}
      {isTemplatePoolModalOpen && (
        <Modal
          isOpen={isTemplatePoolModalOpen}
          onClose={() => setIsTemplatePoolModalOpen(false)}
          title="Dale Automation Reusable 9-Template Inspection Pool"
          subtitle="Standardized manufacturing templates for factory-built machinery and components"
          maxWidth="4xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs">
              <p className="font-bold">Reusable Workshop Inspection Templates Pool:</p>
              <p className="text-[11px] mt-0.5 text-blue-800">
                These 9 standard templates can be instantiated for any Dale Automation project and machine.
                Each template covers factory manufacturing quality verification. Site installation and commissioning are strictly excluded.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[580px] overflow-y-auto p-1">
              {getAllDaleProcessDefinitions().map((tpl) => (
                <div
                  key={tpl.type}
                  className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-xs transition-all space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {getProcessIcon(tpl.type)}
                      <h3 className="font-black text-slate-900 text-xs leading-tight">
                        {tpl.title}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 mt-1 inline-block">
                      {tpl.category}
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                      {tpl.scopeDescription}
                    </p>

                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-700 block font-mono">
                        {tpl.points.length} Checkpoints:
                      </span>
                      <ul className="text-[10px] text-slate-500 list-disc list-inside mt-0.5 space-y-0.5">
                        {tpl.points.slice(0, 4).map((pt) => (
                          <li key={pt.pointNumber} className="truncate">
                            {pt.description}
                          </li>
                        ))}
                        {tpl.points.length > 4 && (
                          <li className="text-slate-400">+{tpl.points.length - 4} more standard checks</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleProcessTypeChange(tpl.type);
                      setIsTemplatePoolModalOpen(false);
                      setIsNewModalOpen(true);
                    }}
                    className="w-full mt-2 py-1.5 bg-slate-900 hover:bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Sheet from Template</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsTemplatePoolModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
              >
                Close Library
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          6. NEW DALE INSPECTION SHEET MODAL
          ========================================================================= */}
      {isNewModalOpen && (
        <Modal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          title="Create Dale Quality Inspection Sheet"
          subtitle="Generate a project-specific inspection sheet from the manufacturing template pool"
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
            {/* Select Manufacturing Process */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                1. Select from 9 Dale Manufacturing Templates *
              </label>
              <select
                value={newForm.processType}
                onChange={(e) => handleProcessTypeChange(e.target.value as DaleProcessType)}
                className="w-full px-3 py-2 border border-slate-300 rounded font-bold text-xs bg-white"
              >
                {DALE_CANONICAL_PROCESS_KEYS.map((key) => {
                  const def = DALE_PROCESS_DEFINITIONS[key];
                  return (
                    <option key={key} value={key}>
                      {def.title} — {def.category}
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                {getDaleProcessDefinition(newForm.processType)?.scopeDescription}
              </p>
            </div>

            {/* Project & Machine Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Project / Job No. *
                </label>
                <input
                  type="text"
                  required
                  value={newForm.projectNumber}
                  onChange={(e) => setNewForm({ ...newForm, projectNumber: e.target.value })}
                  placeholder="e.g. T0559, PRJ-2026-104, PRJ-2026-112"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Machine / Assembly *
                </label>
                <input
                  type="text"
                  required
                  value={newForm.machineOrAssembly}
                  onChange={(e) => setNewForm({ ...newForm, machineOrAssembly: e.target.value })}
                  placeholder="e.g. Bulk Hopper Infeed (T0559-SN-001)"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded"
                />
              </div>
            </div>

            {/* Part Name & Part / Serial No */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Part Name *
                </label>
                <input
                  type="text"
                  required
                  value={newForm.partName}
                  onChange={(e) => setNewForm({ ...newForm, partName: e.target.value })}
                  placeholder="e.g. Main Drive Shaft, Stainless Frame"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Part / Serial No. *
                </label>
                <input
                  type="text"
                  required
                  value={newForm.partOrSerialNo}
                  onChange={(e) => setNewForm({ ...newForm, partOrSerialNo: e.target.value })}
                  placeholder="e.g. 719-00-02-006-01, PART-DIV-001"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>

            {/* Drawing & Revision Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Drawing No. *
                </label>
                <input
                  type="text"
                  required
                  value={newForm.drawingNumber}
                  onChange={(e) => setNewForm({ ...newForm, drawingNumber: e.target.value })}
                  placeholder="e.g. DWG-DIV-101, T0559-058-719-00-02-00"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Drawing Revision *
                </label>
                <input
                  type="text"
                  required
                  value={newForm.drawingRevision}
                  onChange={(e) => setNewForm({ ...newForm, drawingRevision: e.target.value })}
                  placeholder="e.g. 0, A, B, C"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono font-bold"
                />
              </div>
            </div>

            {/* Inspector & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Inspector *
                </label>
                <input
                  type="text"
                  required
                  value={newForm.inspector}
                  onChange={(e) => setNewForm({ ...newForm, inspector: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Inspection Date *
                </label>
                <input
                  type="date"
                  required
                  value={newForm.inspectionDate}
                  onChange={(e) => setNewForm({ ...newForm, inspectionDate: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>

            {/* Checkpoint Preview */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-700 block">
                  Included Checklist Points ({getDaleProcessDefinition(newForm.processType)?.points.length} points):
                </span>
                <span className="text-[10px] text-amber-800 font-medium bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
                  Open-Ended (No Default Value)
                </span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 max-h-36 overflow-y-auto">
                {getDaleProcessDefinition(newForm.processType)?.points.map((p) => (
                  <li key={p.pointNumber}>
                    <strong>{p.description}</strong>: {p.requirement}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Create Inspection Sheet</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          7. RAISE NCR MODAL
          ========================================================================= */}
      {isRaiseNcrModalOpen && (
        <Modal
          isOpen={isRaiseNcrModalOpen}
          onClose={() => setIsRaiseNcrModalOpen(false)}
          title="Raise Non-Conformance Record (NCR)"
          subtitle={`Link failure directly to ${activeSheet?.sheetNumber} (${activeSheet?.partOrSerialNo})`}
          maxWidth="md"
        >
          <form onSubmit={handleSubmitNcr} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Inspection Point / Characteristic:
              </label>
              <input
                type="text"
                readOnly
                value={ncrPointDesc}
                className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100 rounded text-slate-800 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Defect Details / Non-Conformance Description *
              </label>
              <textarea
                rows={3}
                required
                value={ncrDefectDesc}
                onChange={(e) => setNcrDefectDesc(e.target.value)}
                placeholder="Describe the failure, measurement out of tolerance, or defect condition..."
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsRaiseNcrModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Confirm &amp; Log NCR</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          8. FORMAL PRINTABLE TRAVELER SHEET MODAL
          ========================================================================= */}
      {isPrintModalOpen && printTargetSheet && (
        <Modal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title={`Dale Automation Quality Report — ${printTargetSheet.sheetNumber}`}
          subtitle="Printable Manufacturing Quality Inspection Sheet"
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="flex justify-end gap-2 border-b border-slate-200 pb-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow-2xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
              >
                Close
              </button>
            </div>

            {/* Document Container */}
            <div className="p-6 md:p-8 bg-white border border-slate-300 rounded-lg text-slate-900 font-sans text-xs space-y-5 print:border-none print:p-0">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-mono tracking-widest text-slate-600 font-bold uppercase">
                    DALE AUTOMATION / SPIRAL SYSTEMS — QUALITY MANAGEMENT
                  </div>
                  <h1 className="text-xl font-black text-slate-950 mt-0.5">
                    MANUFACTURING QUALITY INSPECTION SHEET
                  </h1>
                  <p className="text-xs font-semibold text-slate-700">
                    Process Inspection: {printTargetSheet.processTitle}
                  </p>
                </div>

                <div className="text-right font-mono text-xs">
                  <div className="font-bold text-slate-900">{printTargetSheet.sheetNumber}</div>
                  <div className="text-slate-500">Date: {printTargetSheet.inspectionDate}</div>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      printTargetSheet.approvalStatus === 'PASS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : printTargetSheet.approvalStatus === 'FAIL' || printTargetSheet.approvalStatus === 'HOLD'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    STATUS: {printTargetSheet.approvalStatus}
                  </span>
                </div>
              </div>

              {/* Standard Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block">PROJECT / JOB NO:</span>
                  <strong>{printTargetSheet.projectNumber}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">MACHINE / ASSEMBLY:</span>
                  <strong className="truncate block">{printTargetSheet.machineOrAssembly}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">PART / SERIAL NO:</span>
                  <strong>{printTargetSheet.partOrSerialNo}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">DRAWING NO / REV:</span>
                  <strong>
                    {printTargetSheet.drawingNumber} (Rev {printTargetSheet.drawingRevision})
                  </strong>
                </div>
              </div>

              {/* Table */}
              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-left font-mono">
                    <th className="p-2 border-r border-slate-300 w-8 text-center">#</th>
                    <th className="p-2 border-r border-slate-300">Inspection Item &amp; Specification</th>
                    <th className="p-2 border-r border-slate-300 w-36">Actual Reading</th>
                    <th className="p-2 border-r border-slate-300 w-24 text-center">Result</th>
                    <th className="p-2">Inspector Observations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {printTargetSheet.points.map((pt) => (
                    <tr key={pt.id}>
                      <td className="p-2 border-r border-slate-300 text-center font-mono font-bold">
                        {pt.pointNumber}
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <div className="font-semibold text-slate-900">{pt.description}</div>
                        {pt.requirement && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{pt.requirement}</div>
                        )}
                      </td>
                      <td className="p-2 border-r border-slate-300 font-mono">
                        {pt.measurementValue || (pt.requiresMeasurement ? '—' : 'N/A')}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center font-mono font-bold">
                        {pt.result || 'OPEN'}
                      </td>
                      <td className="p-2 text-slate-600">{pt.comment || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Sign-offs */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-slate-900 text-xs">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 block">INSPECTOR SIGN-OFF:</span>
                  <div className="mt-1 font-bold">{printTargetSheet.inspector}</div>
                  <div className="text-[11px] text-slate-600">
                    Date: {printTargetSheet.inspectionDate}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-slate-500 block">QUALITY APPROVAL:</span>
                  <div className="mt-1 font-bold">
                    {printTargetSheet.approvedBy || 'Pending Quality Sign-off'}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Status: {printTargetSheet.approvalStatus}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          8.5. MASTER QUALITY FORMS DATABASE & CONDUCIVE MACHINE MAPPING MODAL
          ========================================================================= */}
      {isDatabaseModalOpen && (
        <Modal
          isOpen={isDatabaseModalOpen}
          onClose={() => setIsDatabaseModalOpen(false)}
          title="Dale Quality Forms Database & Machine Conducive Matrix"
          subtitle="Showing the complete database of 9 quality inspection forms and how they apply directly to manufactured machines"
          maxWidth="5xl"
        >
          <div className="space-y-5 text-xs">
            {/* Core Architectural Explanation */}
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-950 space-y-2">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600 shrink-0" />
                <h3 className="font-black text-sm text-indigo-900">
                  How Quality Forms are Conducive to Specific Machines &amp; Manufacturing Processes
                </h3>
              </div>
              <p className="text-xs text-indigo-900/90 leading-relaxed">
                Sheets are <strong>not set as a generic static default</strong>. Instead, Dale Automation operates a central <strong>Quality Forms Database</strong> comprising 9 specialized manufacturing templates. Each machine build triggers the pool generation engine (<code>generateProjectMachineInspectionPool</code>), which evaluates the manufactured parts list and machine classification to auto-populate <strong>only</strong> the inspection sheets with direct functional interest in that specific machine.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 text-[11px]">
                <div className="p-2.5 bg-white border border-indigo-200 rounded-lg">
                  <strong className="text-emerald-700 block">Direct Interest Filtering Rule:</strong>
                  <span>A Rounder or Divider only gets Fabricated Frame, Machined Shafts/Rollers, Mechanical Assembly, Electrical Panel and Final FAT. Spiral Systems and Refrigeration checks are strictly excluded because they have no spiral drums or cooling circuits.</span>
                </div>
                <div className="p-2.5 bg-white border border-indigo-200 rounded-lg">
                  <strong className="text-blue-700 block">Manufacturing Scope Boundary:</strong>
                  <span>Only covers Dale Automation's factory workshop manufacturing processes. Site installation, site commissioning, and customer SAT are excluded by QMS standard.</span>
                </div>
              </div>
            </div>

            {/* Matrix of Factory Machines vs Forms Database */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase font-mono flex items-center gap-1.5">
                  <Workflow className="w-4 h-4 text-blue-600" />
                  <span>Factory Machines × Quality Forms Conducive Matrix</span>
                </h4>
                <span className="text-[10px] text-slate-500 font-mono">
                  All {db.machines.length} Factory Machines Covered
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-mono text-[10px]">
                      <th className="p-2.5 border-r border-slate-800">Machine / Serial</th>
                      <th className="p-2 border-r border-slate-800">Job No.</th>
                      <th className="p-2 border-r border-slate-800 text-center">1. Fab/Weld</th>
                      <th className="p-2 border-r border-slate-800 text-center">2. Machined</th>
                      <th className="p-2 border-r border-slate-800 text-center">3. Conveyor</th>
                      <th className="p-2 border-r border-slate-800 text-center">4. Spiral</th>
                      <th className="p-2 border-r border-slate-800 text-center">5. Assembly</th>
                      <th className="p-2 border-r border-slate-800 text-center">6. Electrical</th>
                      <th className="p-2 border-r border-slate-800 text-center">7. Robotic</th>
                      <th className="p-2 border-r border-slate-800 text-center">8. Cooling</th>
                      <th className="p-2 text-center">9. FAT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                    {/* Machine 1: Rounder */}
                    <tr className="hover:bg-slate-50 bg-amber-50/20">
                      <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">ROUNDER</span>
                          <span>RND-SN-2026-001</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans font-normal mt-0.5">Conical Rounder Unit</div>
                      </td>
                      <td className="p-2 text-slate-600 border-r border-slate-200">PRJ-2026-104</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-slate-400">N/A</td>
                      <td className="p-2 text-center border-r border-slate-200 bg-rose-50 text-rose-600 font-bold">EXCLUDED</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-slate-400">N/A</td>
                      <td className="p-2 text-center border-r border-slate-200 bg-rose-50 text-rose-600 font-bold">EXCLUDED</td>
                      <td className="p-2 text-center text-emerald-600 font-bold">YES</td>
                    </tr>

                    {/* Machine 2: Divider */}
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px]">DIVIDER</span>
                          <span>DIV-SN-2026-001</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans font-normal mt-0.5">Apex High-Speed Dough Divider Line #1</div>
                      </td>
                      <td className="p-2 text-slate-600 border-r border-slate-200">PRJ-2026-104</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-slate-400">N/A</td>
                      <td className="p-2 text-center border-r border-slate-200 text-slate-400">EXCLUDED</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-slate-400">N/A</td>
                      <td className="p-2 text-center border-r border-slate-200 text-slate-400">EXCLUDED</td>
                      <td className="p-2 text-center text-emerald-600 font-bold">YES</td>
                    </tr>

                    {/* Machine 3: Vibratory Infeed */}
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">VIB-FEED</span>
                          <span>T0559-SN-001</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans font-normal mt-0.5">Bulk Hopper Vibratory Infeed Sub-Assy</div>
                      </td>
                      <td className="p-2 text-slate-600 border-r border-slate-200">T0559</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-slate-400">EXCLUDED</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-slate-400">N/A</td>
                      <td className="p-2 text-center border-r border-slate-200 text-slate-400">EXCLUDED</td>
                      <td className="p-2 text-center text-emerald-600 font-bold">YES</td>
                    </tr>

                    {/* Machine 4: Spiral Freezer */}
                    <tr className="hover:bg-slate-50 bg-purple-50/20">
                      <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px]">SPIRAL</span>
                          <span>SPF-SN-2026-001</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans font-normal mt-0.5">24-Tier Twin-Drum Spiral Freezing System</div>
                      </td>
                      <td className="p-2 text-slate-600 border-r border-slate-200">PRJ-2026-112</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 bg-purple-100 text-purple-900 font-bold">YES (DIRECT)</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-slate-400">N/A</td>
                      <td className="p-2 text-center border-r border-slate-200 bg-teal-100 text-teal-900 font-bold">YES (DIRECT)</td>
                      <td className="p-2 text-center text-emerald-600 font-bold">YES</td>
                    </tr>

                    {/* Machine 5: Robotic Cell */}
                    <tr className="hover:bg-slate-50 bg-sky-50/20">
                      <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px]">ROBOTIC</span>
                          <span>ROB-SN-2026-001</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans font-normal mt-0.5">Automated Robotic Pan &amp; Lid Handling Cell</div>
                      </td>
                      <td className="p-2 text-slate-600 border-r border-slate-200">PRJ-2026-115</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-slate-400">N/A</td>
                      <td className="p-2 text-center border-r border-slate-200 text-slate-400">EXCLUDED</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 text-emerald-600 font-bold">YES</td>
                      <td className="p-2 text-center border-r border-slate-200 bg-sky-100 text-sky-900 font-bold">YES (DIRECT)</td>
                      <td className="p-2 text-center border-r border-slate-200 text-slate-400">EXCLUDED</td>
                      <td className="p-2 text-center text-emerald-600 font-bold">YES</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* List of 9 Master Quality Forms in the Database */}
            <div>
              <h4 className="font-bold text-slate-800 text-xs uppercase font-mono mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>The 9 Master Quality Forms in Database</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {getAllDaleProcessDefinitions().map((tpl) => (
                  <div key={tpl.type} className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                      {getProcessIcon(tpl.type)}
                      <span>{tpl.title}</span>
                    </div>
                    <div className="text-[10px] text-blue-700 font-mono font-semibold">{tpl.category}</div>
                    <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">{tpl.scopeDescription}</p>
                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>{tpl.points.length} Checkpoints</span>
                      <span className="text-amber-700 font-semibold">Zero Default Pass</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsDatabaseModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold"
              >
                Close Database View
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Photo Preview Zoom Modal */}
      {previewPhoto && (
        <Modal
          isOpen={Boolean(previewPhoto)}
          onClose={() => setPreviewPhoto(null)}
          title="Inspection Deviation Photo Evidence"
          subtitle={previewPhoto.title}
          maxWidth="2xl"
        >
          <div className="space-y-3">
            <div className="bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-2 min-h-[300px] max-h-[75vh]">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-xs text-slate-600 font-mono truncate max-w-md">{previewPhoto.title}</span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold text-xs shadow-2xs"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Dedicated NCR Details Modal */}
      {viewingNcrNumber && (() => {
        const ncrRecord = (db.ncrs || []).find((n) => n.ncrNumber === viewingNcrNumber);
        return (
          <Modal
            isOpen={Boolean(viewingNcrNumber)}
            onClose={() => setViewingNcrNumber(null)}
            title={`Non-Conformance Record — ${viewingNcrNumber}`}
            subtitle="Dedicated Deviation NCR Raised from Checklist Item"
            maxWidth="2xl"
          >
            {ncrRecord ? (
              <div className="space-y-4 text-xs font-sans">
                {/* Status & Basic Info Bar */}
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg flex flex-wrap items-center justify-between gap-2 font-mono">
                  <div>
                    <span className="text-[10px] text-rose-700 block">NCR NUMBER</span>
                    <strong className="text-sm text-rose-950 font-black">{ncrRecord.ncrNumber}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-700 block">STATUS</span>
                    <span className="px-2 py-0.5 bg-rose-600 text-white font-bold rounded text-[10px]">
                      {ncrRecord.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-700 block">DATE LOGGED</span>
                    <span className="text-slate-800 font-bold">{ncrRecord.createdAt.split('T')[0]}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-700 block">RESPONSIBLE PERSON</span>
                    <span className="text-slate-800 font-bold">{ncrRecord.responsiblePerson}</span>
                  </div>
                </div>

                {/* Traceability Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block">PROJECT / JOB NO:</span>
                    <strong className="text-slate-900">{ncrRecord.projectNumber}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">DRAWING NO / REV:</span>
                    <strong className="text-blue-700">{ncrRecord.drawingNumber} Rev {ncrRecord.drawingRevision}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">PART / SERIAL NO:</span>
                    <strong className="text-slate-900">{ncrRecord.partNumber || ncrRecord.traceabilityNumber}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">MACHINE / ASSEMBLY:</span>
                    <strong className="text-slate-900">{ncrRecord.machineSerialNumber}</strong>
                  </div>
                </div>

                {/* Actual Deviation & Non-Conformance */}
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono font-bold block uppercase">
                      Specific Deviation Recorded (Actual Condition):
                    </span>
                    <div className="p-3 bg-white border border-rose-200 rounded-lg text-rose-950 font-medium leading-relaxed">
                      {ncrRecord.actualCondition || ncrRecord.description}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-mono font-bold block uppercase">
                      Requirement / Specification:
                    </span>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                      {ncrRecord.requirement}
                    </div>
                  </div>
                </div>

                {/* Photo Evidence Attached to this NCR */}
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs mb-1.5">
                    <Camera className="w-4 h-4 text-rose-600" />
                    <span>Photo Evidence ({ncrRecord.issuePhotoEvidence?.length || 0} attached):</span>
                  </div>

                  {ncrRecord.issuePhotoEvidence && ncrRecord.issuePhotoEvidence.length > 0 ? (
                    <div className="flex flex-wrap gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      {ncrRecord.issuePhotoEvidence.map((photo, pIdx) => (
                        <div
                          key={photo.fileId || pIdx}
                          className="border border-slate-300 rounded-lg overflow-hidden bg-white cursor-pointer hover:border-blue-500 transition-colors shadow-2xs"
                          onClick={() =>
                            setPreviewPhoto({
                              url: photo.dataUrl || photo.downloadUrl || '',
                              title: `${ncrRecord.ncrNumber} — Evidence Photo ${pIdx + 1}`,
                            })
                          }
                        >
                          <img
                            src={photo.dataUrl || photo.downloadUrl || ''}
                            alt={photo.originalFilename}
                            className="w-20 h-20 object-cover"
                          />
                          <div className="p-1 text-[9px] text-slate-600 font-mono truncate max-w-[80px]">
                            {photo.originalFilename}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] italic">
                      No photo evidence attached to this NCR yet. You can attach photos directly on the checklist item.
                    </div>
                  )}
                </div>

                {/* Containment & Disposition */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200 text-[11px]">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block mb-0.5">Immediate Containment:</strong>
                    <p className="text-slate-600">{ncrRecord.immediateContainment}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block mb-0.5">Proposed Disposition:</strong>
                    <span className="font-mono font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                      {ncrRecord.proposedDisposition}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setViewingNcrNumber(null)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs shadow-2xs"
                  >
                    Close NCR Details
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-slate-500">NCR record not found.</div>
            )}
          </Modal>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <Modal
          isOpen={Boolean(confirmDeleteId)}
          onClose={() => setConfirmDeleteId(null)}
          title="Delete Dale Quality Inspection Sheet?"
          subtitle="Are you sure you want to permanently delete this inspection record?"
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              This will remove the inspection sheet from the quality register. This action is irreversible.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteDaleInspection(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
