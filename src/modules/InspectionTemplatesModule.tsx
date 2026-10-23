import React, { useState, useMemo } from 'react';
import { useQMS } from '../context/QMSContext';
import {
  InspectionTemplate,
  InspectionTemplateCharacteristic,
  InspectionTemplateQualityCheck,
  TemplateStatus,
  InspectionStage,
  CharacteristicType,
  RequirementSource,
} from '../types';
import { WORKSHOP_DEPARTMENTS } from '../utils/departmentsData';
import {
  ClipboardList,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Plus,
  Edit3,
  GitBranch,
  ShieldCheck,
  Printer,
  Eye,
  Sliders,
  Layers,
  Sparkles,
  Info,
  Archive,
  ArrowRight,
  ChevronRight,
  Clock,
  UserCheck,
  Check,
  X,
  FileText,
} from 'lucide-react';

export const InspectionTemplatesModule: React.FC = () => {
  const {
    db,
    currentUser,
    createInspectionTemplate,
    updateInspectionTemplate,
    approveInspectionTemplate,
    reviseInspectionTemplate,
    obsoleteInspectionTemplate,
    assignTemplateToComponent,
  } = useQMS();

  const isQualityAuthority = ['ENGINEERING', 'HSEQ', 'ADMINISTRATOR'].includes(currentUser.role);
  const isAdmin = currentUser.role === 'ADMINISTRATOR';

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [machineFilter, setMachineFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Selected Template for Detail View
  const templates = useMemo(() => {
    return db.inspectionTemplates || [];
  }, [db.inspectionTemplates]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id || ''
  );

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReviseModalOpen, setIsReviseModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Form states
  const [revisionNotes, setRevisionNotes] = useState('');
  const [selectedComponentIdForAssign, setSelectedComponentIdForAssign] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Template Form State
  const [newTemplateForm, setNewTemplateForm] = useState<{
    code: string;
    name: string;
    machineType: string;
    componentType: string;
    inspectionStage: InspectionStage;
    description: string;
    status: TemplateStatus;
  }>({
    code: '',
    name: '',
    machineType: 'All Machines',
    componentType: 'Machined Component',
    inspectionStage: 'IN_PROCESS',
    description: '',
    status: 'DRAFT',
  });

  const [newCharacteristics, setNewCharacteristics] = useState<
    Array<{
      feature: string;
      description: string;
      characteristicType: CharacteristicType;
      mandatory: boolean;
      requirementSource: RequirementSource;
      nominal: number | null;
      lowerTolerance: number | null;
      upperTolerance: number | null;
      unit: string;
      measuringInstrument: string;
      instrumentId: string;
    }>
  >([
    {
      feature: 'Overall Length / Height',
      description: 'End-to-end dimension per approved drawing',
      characteristicType: 'DIMENSIONAL',
      mandatory: true,
      requirementSource: 'APPROVED_DRAWING',
      nominal: null,
      lowerTolerance: -0.1,
      upperTolerance: 0.1,
      unit: 'mm',
      measuringInstrument: 'Vernier Caliper / Height Gauge',
      instrumentId: 'CAL-001',
    },
  ]);

  const [newQualityChecks, setNewQualityChecks] = useState<
    Array<{ description: string; mandatory: boolean }>
  >([
    { description: 'Burrs and sharp edges removed', mandatory: true },
    { description: 'No visible machining marks, chattering, or surface cracks', mandatory: true },
    { description: 'Component identification & traceability marking correct', mandatory: true },
  ]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        !term ||
        t.code.toLowerCase().includes(term) ||
        t.name.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        t.componentType.toLowerCase().includes(term) ||
        t.machineType.toLowerCase().includes(term);

      if (!matchSearch) return false;

      if (machineFilter !== 'ALL' && !t.machineType.toLowerCase().includes(machineFilter.toLowerCase())) {
        return false;
      }

      if (departmentFilter !== 'ALL') {
        const d = departmentFilter.toUpperCase();
        const matchesDept =
          t.department?.toUpperCase() === d ||
          (d === 'GRINDING_BAY' && (t.name.toLowerCase().includes('grind') || t.code.includes('GRD') || t.code.includes('SHAFT'))) ||
          (d === 'SHEET_METAL' && (t.name.toLowerCase().includes('sheet') || t.name.toLowerCase().includes('panel') || t.name.toLowerCase().includes('bracket') || t.name.toLowerCase().includes('guard') || t.code.includes('SHT') || t.code.includes('FAB'))) ||
          (d === 'ELECTRICAL' && (t.name.toLowerCase().includes('electr') || t.code.includes('ELE') || t.componentType.toLowerCase().includes('electric'))) ||
          (d === 'MACHINE_SHOP' && (t.name.toLowerCase().includes('cnc') || t.name.toLowerCase().includes('machin') || t.code.startsWith('DIM-') || t.code.includes('CNC'))) ||
          (d === 'BLASTING_BAY' && (t.name.toLowerCase().includes('blast') || t.code.includes('BLS'))) ||
          (d === 'WELDING' && (t.name.toLowerCase().includes('weld') || t.code.includes('WLD') || t.code.includes('FRAME'))) ||
          (d === 'FITTING' && (t.name.toLowerCase().includes('fit') || t.name.toLowerCase().includes('assembly') || t.code.includes('FIT') || t.code.includes('ASM'))) ||
          (d === 'GRINDING_POLISH_FINISH' && (t.name.toLowerCase().includes('polish') || t.code.includes('POL') || t.description.toLowerCase().includes('ra ')));
        if (!matchesDept) return false;
      }

      return true;
    });
  }, [templates, searchTerm, machineFilter, stageFilter, statusFilter, departmentFilter]);

  // Selected Template
  const activeTemplate = useMemo(() => {
    return (
      templates.find((t) => t.id === selectedTemplateId) ||
      filteredTemplates[0] ||
      templates[0]
    );
  }, [templates, selectedTemplateId, filteredTemplates]);

  // Metrics
  const metrics = useMemo(() => {
    const total = templates.length;
    const approved = templates.filter((t) => t.status === 'APPROVED').length;
    const underReview = templates.filter((t) => t.status === 'UNDER_REVIEW').length;
    const draft = templates.filter((t) => t.status === 'DRAFT').length;
    const superseded = templates.filter((t) => t.status === 'SUPERSEDED').length;
    const obsolete = templates.filter((t) => t.status === 'OBSOLETE').length;

    // Critical Components coverage
    const criticalComponents = db.components.filter((c) => c.criticalComponent);
    const criticalWithoutTemplate = criticalComponents.filter(
      (c) =>
        !c.primaryInspectionTemplateCode &&
        !templates.some(
          (t) =>
            t.status === 'APPROVED' &&
            (t.code === `DIM-${c.category}` ||
              t.code === `DIV-${c.category}` ||
              t.componentType.toLowerCase().includes(c.category.toLowerCase()))
        )
    );

    return {
      total,
      approved,
      underReview,
      draft,
      superseded,
      obsolete,
      criticalTotal: criticalComponents.length,
      criticalWithoutTemplate,
    };
  }, [templates, db.components]);

  // Handlers
  const handleApprove = async () => {
    if (!activeTemplate) return;
    const res = await approveInspectionTemplate(activeTemplate.id, currentUser.name);
    if (res.success) {
      setFeedback({ type: 'success', message: `Template ${activeTemplate.code} ${activeTemplate.revision} approved for production use!` });
      setIsApproveModalOpen(false);
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to approve template.' });
    }
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleRevise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate) return;
    const res = await reviseInspectionTemplate(activeTemplate.id, revisionNotes);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Template revised! New revision created while keeping historical inspection records linked to ${activeTemplate.revision}.`,
      });
      if (res.newTemplateId) {
        setSelectedTemplateId(res.newTemplateId);
      }
      setIsReviseModalOpen(false);
      setRevisionNotes('');
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to create revision.' });
    }
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleMakeObsolete = async () => {
    if (!activeTemplate) return;
    if (!confirm(`Are you sure you want to mark template ${activeTemplate.code} ${activeTemplate.revision} as OBSOLETE? It will no longer be available for new inspections.`)) {
      return;
    }
    const res = await obsoleteInspectionTemplate(activeTemplate.id, 'Decommissioned by user');
    if (res.success) {
      setFeedback({ type: 'success', message: `Template ${activeTemplate.code} marked as OBSOLETE.` });
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to obsolete template.' });
    }
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleAssignComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate || !selectedComponentIdForAssign) return;
    const res = await assignTemplateToComponent(selectedComponentIdForAssign, activeTemplate.id);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Template ${activeTemplate.code} successfully assigned as the primary inspection plan for component.`,
      });
      setIsAssignModalOpen(false);
      setSelectedComponentIdForAssign('');
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to assign template.' });
    }
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateForm.code.trim() || !newTemplateForm.name.trim()) {
      setFeedback({ type: 'error', message: 'Template Code and Name are required.' });
      return;
    }

    const characteristics: InspectionTemplateCharacteristic[] = newCharacteristics.map((c, i) => ({
      id: `CHAR-${newTemplateForm.code.replace(/[^A-Za-z0-9]/g, '')}-${i + 1}`,
      characteristicNumber: i + 1,
      feature: c.feature,
      description: c.description,
      characteristicType: c.characteristicType,
      mandatory: c.mandatory,
      requirementSource: c.requirementSource,
      nominal: c.nominal,
      lowerTolerance: c.lowerTolerance,
      upperTolerance: c.upperTolerance,
      unit: c.unit,
      measuringInstrument: c.measuringInstrument,
      instrumentId: c.instrumentId,
    }));

    const qualityChecks: InspectionTemplateQualityCheck[] = newQualityChecks.map((qc, i) => ({
      id: `QC-${newTemplateForm.code.replace(/[^A-Za-z0-9]/g, '')}-${i + 1}`,
      checkNumber: i + 1,
      description: qc.description,
      mandatory: qc.mandatory,
    }));

    const res = await createInspectionTemplate({
      code: newTemplateForm.code.trim().toUpperCase(),
      name: newTemplateForm.name.trim(),
      machineType: newTemplateForm.machineType,
      componentType: newTemplateForm.componentType,
      inspectionStage: newTemplateForm.inspectionStage,
      description: newTemplateForm.description.trim(),
      revision: 'Rev 01',
      status: newTemplateForm.status,
      effectiveDate: new Date().toISOString().split('T')[0],
      approvedBy: newTemplateForm.status === 'APPROVED' ? currentUser.name : '',
      approvalDate: newTemplateForm.status === 'APPROVED' ? new Date().toISOString().split('T')[0] : '',
      active: true,
      characteristics,
      qualityChecks,
    });

    if (res.success && res.templateId) {
      setFeedback({ type: 'success', message: `Controlled Template ${newTemplateForm.code} created successfully!` });
      setSelectedTemplateId(res.templateId);
      setIsCreateModalOpen(false);
      setNewTemplateForm({
        code: '',
        name: '',
        machineType: 'All Machines',
        componentType: 'Machined Component',
        inspectionStage: 'IN_PROCESS',
        description: '',
        status: 'DRAFT',
      });
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to create template.' });
    }
    setTimeout(() => setFeedback(null), 5000);
  };

  const getStatusBadge = (status: TemplateStatus) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            APPROVED
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-600" />
            UNDER_REVIEW
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Edit3 className="w-3 h-3 text-slate-500" />
            DRAFT
          </span>
        );
      case 'SUPERSEDED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-300">
            <Archive className="w-3 h-3 text-purple-600" />
            SUPERSEDED
          </span>
        );
      case 'OBSOLETE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <X className="w-3 h-3 text-rose-600" />
            OBSOLETE
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Controlled Dimensional Inspection Sheets &amp; Inspection Plan Library
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Standardized templates for critical components, fabricated frames, and machine assemblies. Ensures no manufacturing process is inspected using a blank or incomplete form.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              if (activeTemplate) setIsPrintModalOpen(true);
            }}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Inspection Plan</span>
          </button>

          {isQualityAuthority && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Inspection Template</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block">
            Total Templates
          </span>
          <div className="text-xl font-black text-slate-900 mt-1">{metrics.total}</div>
          <span className="text-[10px] text-slate-400">Library Total</span>
        </div>

        <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200/80 shadow-2xs">
          <span className="text-[10px] font-mono uppercase text-emerald-700 font-bold block flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Approved
          </span>
          <div className="text-xl font-black text-emerald-900 mt-1">{metrics.approved}</div>
          <span className="text-[10px] text-emerald-700 font-medium">Production Active</span>
        </div>

        <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/80 shadow-2xs">
          <span className="text-[10px] font-mono uppercase text-amber-700 font-bold block flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            Under Review
          </span>
          <div className="text-xl font-black text-amber-900 mt-1">{metrics.underReview}</div>
          <span className="text-[10px] text-amber-700 font-medium">Pending Sign-off</span>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-mono uppercase text-slate-600 font-bold block">
            Drafts
          </span>
          <div className="text-xl font-black text-slate-700 mt-1">{metrics.draft}</div>
          <span className="text-[10px] text-slate-500">Unpublished</span>
        </div>

        <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-200/80 shadow-2xs">
          <span className="text-[10px] font-mono uppercase text-purple-700 font-bold block">
            Superseded
          </span>
          <div className="text-xl font-black text-purple-900 mt-1">{metrics.superseded}</div>
          <span className="text-[10px] text-purple-700 font-medium">Historical Revisions</span>
        </div>

        <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200/80 shadow-2xs">
          <span className="text-[10px] font-mono uppercase text-rose-700 font-bold block flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-rose-600" />
            Critical Missing
          </span>
          <div className="text-xl font-black text-rose-900 mt-1">
            {metrics.criticalWithoutTemplate.length}
          </div>
          <span className="text-[10px] text-rose-700 font-medium">Without Template</span>
        </div>
      </div>

      {/* Critical Components Missing Template Alert */}
      {metrics.criticalWithoutTemplate.length > 0 && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs flex items-start gap-3 text-rose-950">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-bold text-rose-900 block">
              Governance Alert: {metrics.criticalWithoutTemplate.length} Critical Component(s) Require Approved Inspection Plans
            </strong>
            <p className="text-[11px] text-rose-800 mt-0.5">
              The following critical manufacturing parts do not yet have an assigned controlled template:
              {' '}
              <span className="font-mono font-semibold">
                {metrics.criticalWithoutTemplate.map((c) => c.partNumber).join(', ')}
              </span>
              . Critical parts must not be released without formal dimensional inspection plans.
            </p>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search templates by code (DIM-SHAFT, FAB-FRAME), component, or feature..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-slate-900 placeholder:text-slate-400 font-medium text-xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-slate-400 hover:text-slate-600 text-[10px] font-mono"
            >
              CLEAR
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Machine Filter */}
          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium text-xs"
          >
            <option value="ALL">All Machine Types</option>
            <option value="DIVIDER">Divider</option>
            <option value="PROVER">Prover</option>
            <option value="OVEN">Oven</option>
            <option value="COOLER">Cooler / Spiral</option>
            <option value="CONVEYOR">Conveyor</option>
          </select>

          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium text-xs"
          >
            <option value="ALL">All Inspection Stages</option>
            <option value="FIRST_OFF">FIRST_OFF</option>
            <option value="IN_PROCESS">IN_PROCESS</option>
            <option value="FINAL_INSPECTION">FINAL_INSPECTION</option>
            <option value="QUALITY_RELEASE">QUALITY_RELEASE</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium text-xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">APPROVED Only</option>
            <option value="UNDER_REVIEW">UNDER_REVIEW</option>
            <option value="DRAFT">DRAFT</option>
            <option value="SUPERSEDED">SUPERSEDED</option>
            <option value="OBSOLETE">OBSOLETE</option>
          </select>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium text-xs font-mono"
          >
            <option value="ALL">All Departments ({WORKSHOP_DEPARTMENTS.length})</option>
            {WORKSHOP_DEPARTMENTS.map((dept) => (
              <option key={dept.id} value={dept.id}>
                [{dept.code}] {dept.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Split Layout: Template Cards on Left, Active Template Detail on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Template Catalog List (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {filteredTemplates.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
              <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-medium">No inspection templates match your search criteria.</p>
            </div>
          ) : (
            filteredTemplates.map((tmpl) => {
              const isSelected = tmpl.id === activeTemplate?.id;
              return (
                <div
                  key={tmpl.id}
                  onClick={() => setSelectedTemplateId(tmpl.id)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/50 border-blue-400 shadow-xs ring-1 ring-blue-400/40'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-slate-900 text-white">
                        {tmpl.code}
                      </span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {tmpl.revision}
                      </span>
                      {getStatusBadge(tmpl.status)}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {tmpl.inspectionStage}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-xs mt-2 line-clamp-1">
                    {tmpl.name}
                  </h3>

                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 leading-snug">
                    {tmpl.description}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>
                      <strong className="text-slate-800">{tmpl.characteristics?.length || 0}</strong> chars ·{' '}
                      <strong className="text-slate-800">{tmpl.qualityChecks?.length || 0}</strong> checks
                    </span>
                    <span>
                      Machine: <strong className="text-slate-700">{tmpl.machineType}</strong>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Template Detail Workspace (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {activeTemplate ? (
            <div>
              {/* Top Banner */}
              <div className="p-5 border-b border-slate-200 bg-slate-50/60">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm px-2.5 py-1 rounded bg-slate-900 text-white shadow-2xs">
                      {activeTemplate.code}
                    </span>
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                      {activeTemplate.revision}
                    </span>
                    {getStatusBadge(activeTemplate.status)}
                  </div>

                  {/* Actions for quality authority */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isQualityAuthority && activeTemplate.status !== 'APPROVED' && activeTemplate.status !== 'OBSOLETE' && (
                      <button
                        type="button"
                        onClick={() => setIsApproveModalOpen(true)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors"
                        title="Approve template for production use"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Template</span>
                      </button>
                    )}

                    {isQualityAuthority && (
                      <button
                        type="button"
                        onClick={() => setIsReviseModalOpen(true)}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors"
                        title="Increment revision (keeps historical inspections intact)"
                      >
                        <GitBranch className="w-3.5 h-3.5 text-blue-600" />
                        <span>Create Revision</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsAssignModalOpen(true)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors"
                      title="Link this template to a Component Master Record"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-600" />
                      <span>Assign to Part</span>
                    </button>

                    {isAdmin && activeTemplate.status !== 'OBSOLETE' && (
                      <button
                        type="button"
                        onClick={handleMakeObsolete}
                        className="px-2 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold text-xs transition-colors"
                        title="Mark as obsolete"
                      >
                        Obsolete
                      </button>
                    )}
                  </div>
                </div>

                <h2 className="text-base font-black text-slate-900 mt-2.5">
                  {activeTemplate.name}
                </h2>
                <p className="text-xs text-slate-600 mt-1 leading-snug">
                  {activeTemplate.description}
                </p>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-200 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">MACHINE TYPE</span>
                    <strong className="text-slate-800">{activeTemplate.machineType}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">COMPONENT TYPE</span>
                    <strong className="text-slate-800">{activeTemplate.componentType}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">INSPECTION STAGE</span>
                    <strong className="text-blue-700">{activeTemplate.inspectionStage}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">EFFECTIVE DATE</span>
                    <strong className="text-slate-800">{activeTemplate.effectiveDate || '2026-01-15'}</strong>
                  </div>
                </div>

                {activeTemplate.approvedBy && (
                  <div className="mt-2 text-[11px] text-slate-600 font-mono flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Approved by: <strong className="text-slate-900">{activeTemplate.approvedBy}</strong> ({activeTemplate.approvalDate || activeTemplate.effectiveDate})</span>
                  </div>
                )}
              </div>

              {/* Characteristics Section */}
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 uppercase font-mono">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    <span>Predefined Mandatory Characteristics ({activeTemplate.characteristics?.length || 0})</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    Source: APPROVED_DRAWING
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="p-2.5 w-10 text-center">#</th>
                        <th className="p-2.5">Feature &amp; Description</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5 text-center">Source</th>
                        <th className="p-2.5 text-center">Nominal &amp; Tol</th>
                        <th className="p-2.5">Instrument</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(activeTemplate.characteristics || []).map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/70">
                          <td className="p-2.5 font-mono font-bold text-slate-600 text-center">
                            {c.characteristicNumber}
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900">{c.feature}</div>
                            {c.description && (
                              <div className="text-[11px] text-slate-500">{c.description}</div>
                            )}
                          </td>
                          <td className="p-2.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                              {c.characteristicType}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {c.requirementSource}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-mono text-[11px]">
                            {c.nominal !== null && c.nominal !== undefined ? (
                              <span>
                                {c.nominal} {c.unit} ({c.lowerTolerance}/{c.upperTolerance && c.upperTolerance >= 0 ? `+${c.upperTolerance}` : c.upperTolerance})
                              </span>
                            ) : (
                              <span className="text-amber-700 font-bold text-[10px]">
                                PER APPROVED DRAWING
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-600 text-[11px]">
                            <div>{c.measuringInstrument || 'Standard Metrology'}</div>
                            {c.instrumentId && (
                              <span className="font-mono text-[10px] text-slate-400">
                                ID: {c.instrumentId}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Quality Checks Section */}
                {activeTemplate.qualityChecks && activeTemplate.qualityChecks.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 uppercase font-mono">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Non-Dimensional Quality Checks ({activeTemplate.qualityChecks.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {activeTemplate.qualityChecks.map((qc) => (
                        <div
                          key={qc.id}
                          className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-start gap-2"
                        >
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                            {qc.checkNumber}
                          </span>
                          <div>
                            <div className="font-medium text-slate-800">{qc.description}</div>
                            {qc.mandatory && (
                              <span className="text-[10px] font-mono font-bold text-rose-600">
                                MANDATORY BEFORE SIGN-OFF
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Revision History */}
                {activeTemplate.history && activeTemplate.history.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 uppercase font-mono">
                      <GitBranch className="w-4 h-4 text-purple-600" />
                      <span>Controlled Revision Audit History</span>
                    </h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                      {activeTemplate.history.map((h, i) => (
                        <div key={i} className="p-2.5 flex items-center justify-between bg-slate-50/30">
                          <div>
                            <span className="font-mono font-bold text-slate-900 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 mr-2 text-[11px]">
                              {h.revision}
                            </span>
                            <span className="text-slate-700">{h.changeNotes}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            Approved by: <strong>{h.approvedBy}</strong> ({h.effectiveDate})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">
              Select an inspection template from the catalog on the left to inspect full characteristics and parameters.
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Create New Inspection Template */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Create Controlled Inspection Template
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase font-mono">
                    Template Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DIM-GEARBOX or FAB-CHASSIS"
                    value={newTemplateForm.code}
                    onChange={(e) => setNewTemplateForm({ ...newTemplateForm, code: e.target.value.toUpperCase() })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg font-mono font-bold uppercase focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase font-mono">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gearbox Housing Dimensional Inspection"
                    value={newTemplateForm.name}
                    onChange={(e) => setNewTemplateForm({ ...newTemplateForm, name: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase font-mono">
                    Machine Type
                  </label>
                  <select
                    value={newTemplateForm.machineType}
                    onChange={(e) => setNewTemplateForm({ ...newTemplateForm, machineType: e.target.value })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="All Machines">All Machines</option>
                    <option value="Divider">Divider</option>
                    <option value="Prover">Prover</option>
                    <option value="Oven">Oven</option>
                    <option value="Cooler">Cooler / Spiral</option>
                    <option value="Conveyor">Conveyor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase font-mono">
                    Inspection Stage
                  </label>
                  <select
                    value={newTemplateForm.inspectionStage}
                    onChange={(e) => setNewTemplateForm({ ...newTemplateForm, inspectionStage: e.target.value as InspectionStage })}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                  >
                    <option value="FIRST_OFF">FIRST_OFF</option>
                    <option value="IN_PROCESS">IN_PROCESS</option>
                    <option value="FINAL_INSPECTION">FINAL_INSPECTION</option>
                    <option value="QUALITY_RELEASE">QUALITY_RELEASE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase font-mono">
                  Description &amp; Inspection Scope
                </label>
                <textarea
                  rows={2}
                  placeholder="Detail the mandatory characteristics and quality requirements to inspect..."
                  value={newTemplateForm.description}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, description: e.target.value })}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Mandatory Characteristics Editor */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-slate-800 uppercase font-mono">
                    Mandatory Characteristics ({newCharacteristics.length})
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setNewCharacteristics([
                        ...newCharacteristics,
                        {
                          feature: 'New Critical Dimension',
                          description: 'Measured per approved drawing',
                          characteristicType: 'DIMENSIONAL',
                          mandatory: true,
                          requirementSource: 'APPROVED_DRAWING',
                          nominal: null,
                          lowerTolerance: -0.05,
                          upperTolerance: 0.05,
                          unit: 'mm',
                          measuringInstrument: 'Micrometer / Caliper',
                          instrumentId: 'MIC-001',
                        },
                      ])
                    }
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Characteristic</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {newCharacteristics.map((char, cIdx) => (
                    <div key={cIdx} className="p-2 border border-slate-200 rounded-lg bg-slate-50 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Feature name..."
                          value={char.feature}
                          onChange={(e) => {
                            const updated = [...newCharacteristics];
                            updated[cIdx].feature = e.target.value;
                            setNewCharacteristics(updated);
                          }}
                          className="w-full p-1 border border-slate-300 rounded bg-white text-xs font-medium"
                        />
                      </div>
                      <div className="col-span-3">
                        <select
                          value={char.characteristicType}
                          onChange={(e) => {
                            const updated = [...newCharacteristics];
                            updated[cIdx].characteristicType = e.target.value as CharacteristicType;
                            setNewCharacteristics(updated);
                          }}
                          className="w-full p-1 border border-slate-300 rounded bg-white text-[10px]"
                        >
                          <option value="DIMENSIONAL">DIMENSIONAL</option>
                          <option value="VISUAL">VISUAL</option>
                          <option value="FUNCTIONAL">FUNCTIONAL</option>
                          <option value="FIT">FIT</option>
                          <option value="ALIGNMENT">ALIGNMENT</option>
                          <option value="WORKMANSHIP">WORKMANSHIP</option>
                        </select>
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Instrument..."
                          value={char.measuringInstrument}
                          onChange={(e) => {
                            const updated = [...newCharacteristics];
                            updated[cIdx].measuringInstrument = e.target.value;
                            setNewCharacteristics(updated);
                          }}
                          className="w-full p-1 border border-slate-300 rounded bg-white text-xs"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        {newCharacteristics.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewCharacteristics(newCharacteristics.filter((_, i) => i !== cIdx))}
                            className="text-rose-600 hover:text-rose-800 text-xs font-bold"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs"
                >
                  Save Controlled Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Revise Template Modal */}
      {isReviseModalOpen && activeTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Create New Revision for {activeTemplate.code}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReviseModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-snug">
              Creating a new revision will increment the revision number (e.g. from {activeTemplate.revision} to Rev 02).
              <strong className="text-slate-900 block mt-1">
                Historical inspection records retain the exact revision ({activeTemplate.revision}) used at the time of inspection and are NOT modified.
              </strong>
            </p>

            <form onSubmit={handleRevise} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase font-mono">
                  Revision Change Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail engineering reasons or drawing update triggering this new inspection revision..."
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviseModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-xs"
                >
                  Confirm &amp; Issue Next Revision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Approve Template Modal */}
      {isApproveModalOpen && activeTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Approve Inspection Template
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to approve <strong className="text-slate-900">{activeTemplate.code} ({activeTemplate.name}) {activeTemplate.revision}</strong> for shop floor production inspections?
            </p>

            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs">
              <span className="font-bold block">Approval Authority:</span>
              <span>{currentUser.name} ({currentUser.role})</span>
              <span className="block text-[10px] text-emerald-700 mt-0.5">
                Effective Date: {new Date().toISOString().split('T')[0]}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs"
              >
                Formally Approve Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Assign Template to Component */}
      {isAssignModalOpen && activeTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Assign Template to Component Master
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Link <strong className="text-slate-900">{activeTemplate.code} ({activeTemplate.name})</strong> to an authorized Component Master record.
            </p>

            <form onSubmit={handleAssignComponent} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase font-mono">
                  Select Component / Part Number *
                </label>
                <select
                  required
                  value={selectedComponentIdForAssign}
                  onChange={(e) => setSelectedComponentIdForAssign(e.target.value)}
                  className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">-- Choose Component --</option>
                  {db.components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.partNumber} — {c.description} ({c.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedComponentIdForAssign}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-xs disabled:opacity-50"
                >
                  Save Component Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Printable Inspection Plan Traveler */}
      {isPrintModalOpen && activeTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl p-8 space-y-6 my-8 print:border-none print:shadow-none print:m-0 print:p-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase">
                Inspection Plan Document Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form Header */}
            <div className="border border-slate-900 p-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div>
                  <h1 className="text-lg font-black tracking-tight uppercase text-slate-900">
                    Spiral Systems Mechanical Manufacturing
                  </h1>
                  <h2 className="text-sm font-bold text-slate-800">
                    QMS CONTROLLED DIMENSIONAL INSPECTION PLAN
                  </h2>
                </div>
                <div className="text-right font-mono text-xs">
                  <div>DOC CODE: <strong>{activeTemplate.code}</strong></div>
                  <div>REVISION: <strong>{activeTemplate.revision}</strong></div>
                  <div>STATUS: <strong>{activeTemplate.status}</strong></div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 text-xs font-mono">
                <div>TEMPLATE NAME: <strong>{activeTemplate.name}</strong></div>
                <div>MACHINE TYPE: <strong>{activeTemplate.machineType}</strong></div>
                <div>STAGE: <strong>{activeTemplate.inspectionStage}</strong></div>
                <div>APPROVED BY: <strong>{activeTemplate.approvedBy || 'Pending'}</strong></div>
                <div>EFFECTIVE DATE: <strong>{activeTemplate.effectiveDate}</strong></div>
                <div>APPROVAL DATE: <strong>{activeTemplate.approvalDate || 'Pending'}</strong></div>
              </div>
            </div>

            {/* Characteristics Table */}
            <div>
              <h3 className="font-bold text-xs uppercase font-mono mb-2 text-slate-900">
                Mandatory Characteristics Schedule
              </h3>
              <table className="w-full text-left text-xs border border-slate-900 divide-y divide-slate-900">
                <thead className="bg-slate-100 font-mono text-[10px] font-bold text-slate-900">
                  <tr>
                    <th className="p-2 border-r border-slate-900 text-center w-8">#</th>
                    <th className="p-2 border-r border-slate-900">Inspection Feature</th>
                    <th className="p-2 border-r border-slate-900 text-center">Type</th>
                    <th className="p-2 border-r border-slate-900 text-center">Source</th>
                    <th className="p-2 border-r border-slate-900 text-center">Nominal / Tol</th>
                    <th className="p-2 border-r border-slate-900">Measuring Instrument</th>
                    <th className="p-2 text-center w-20">Actual</th>
                    <th className="p-2 text-center w-16">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-mono">
                  {(activeTemplate.characteristics || []).map((c) => (
                    <tr key={c.id}>
                      <td className="p-2 border-r border-slate-300 text-center font-bold">
                        {c.characteristicNumber}
                      </td>
                      <td className="p-2 border-r border-slate-300 font-sans font-medium">
                        {c.feature}
                        {c.description && <div className="text-[10px] text-slate-500 font-mono">{c.description}</div>}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center text-[10px]">
                        {c.characteristicType}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center text-[10px]">
                        {c.requirementSource}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center text-[10px]">
                        {c.nominal !== null ? `${c.nominal} ${c.unit}` : 'FROM APPROVED DRAWING'}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-[10px]">
                        {c.measuringInstrument}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center">____</td>
                      <td className="p-2 text-center">P / F</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quality Checks */}
            {activeTemplate.qualityChecks && activeTemplate.qualityChecks.length > 0 && (
              <div>
                <h3 className="font-bold text-xs uppercase font-mono mb-2 text-slate-900">
                  Non-Dimensional Workmanship &amp; Fit Quality Checks
                </h3>
                <div className="border border-slate-900 p-2 space-y-1 text-xs">
                  {activeTemplate.qualityChecks.map((qc) => (
                    <div key={qc.id} className="flex items-center justify-between py-1 border-b border-slate-200 last:border-none">
                      <span>[{qc.checkNumber}] {qc.description}</span>
                      <span className="font-mono font-bold">[ &nbsp; ] PASS &nbsp; [ &nbsp; ] FAIL &nbsp; [ &nbsp; ] N/A</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signatures Footer */}
            <div className="grid grid-cols-2 gap-4 border border-slate-900 p-4 text-xs font-mono">
              <div>
                <span className="block font-bold">MACHINIST DECLARATION:</span>
                <span className="text-[10px] text-slate-500 block">Manufactured per approved drawing and traveler:</span>
                <div className="mt-4 pt-4 border-t border-slate-400">Signature / Date: _______________________</div>
              </div>
              <div>
                <span className="block font-bold">INSPECTOR FORMAL SIGN-OFF:</span>
                <span className="text-[10px] text-slate-500 block">Separation of duties verified (Inspector !== Machinist):</span>
                <div className="mt-4 pt-4 border-t border-slate-400">Inspector ID &amp; Stamp: ___________________</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
