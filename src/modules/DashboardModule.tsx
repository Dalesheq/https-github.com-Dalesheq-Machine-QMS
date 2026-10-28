import React, { useState, useMemo } from 'react';
import { useQMS } from '../context/QMSContext';
import { StatusBadge } from '../components/StatusBadge';
import { ActiveTab } from '../components/Sidebar';
import { DashboardLimeLine } from '../components/DashboardLimeLine';
import { Modal } from '../components/Modal';
import { generateExecutiveFleetSummaryPdf } from '../utils/pdfGenerator';
import {
  Cpu,
  Boxes,
  Hammer,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Search,
  PlusCircle,
  FileCheck,
  CheckCircle2,
  ExternalLink,
  QrCode,
  FileText,
  Printer,
  Download,
  ShieldCheck,
  TrendingUp,
  Activity,
  Layers,
  FolderGit2,
  FolderKanban,
  ChevronRight,
  ArrowRight,
  Eye,
  X,
  Filter,
  BarChart3,
  AlertCircle,
} from 'lucide-react';

interface DashboardModuleProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenCreateRecordModal: () => void;
  onOpenCreateMachineModal: () => void;
  onViewTraceabilityTag: (traceabilityNumber: string) => void;
}

type KpiModalType = 'NCRS' | 'INSPECTIONS' | 'PROJECTS' | 'FLEET' | null;

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  setActiveTab,
  onOpenCreateRecordModal,
  onOpenCreateMachineModal,
  onViewTraceabilityTag,
}) => {
  const { db, currentUser } = useQMS();
  const isManagement = currentUser?.role === 'MANAGEMENT';

  // State
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>('ALL');
  const [activeKpiModal, setActiveKpiModal] = useState<KpiModalType>(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [activeViewMode, setActiveViewMode] = useState<'EXECUTIVE' | 'OPERATIONS'>(
    isManagement ? 'EXECUTIVE' : 'OPERATIONS'
  );

  // ----------------------------------------------------
  // METRICS COMPUTATION (Domain & Audit Compliant)
  // ----------------------------------------------------

  // 1. Active NCRs Metrics
  const activeNcrs = useMemo(() => (db.ncrs || []).filter((n) => n.status !== 'CLOSED'), [db.ncrs]);
  const openNcrsCount = useMemo(() => activeNcrs.filter((n) => n.status === 'OPEN').length, [activeNcrs]);
  const containedNcrsCount = useMemo(() => activeNcrs.filter((n) => n.status === 'CONTAINED').length, [activeNcrs]);
  const dispositionedNcrsCount = useMemo(() => activeNcrs.filter((n) => n.status === 'DISPOSITIONED').length, [activeNcrs]);
  const closedNcrsCount = useMemo(() => (db.ncrs || []).filter((n) => n.status === 'CLOSED').length, [db.ncrs]);
  const onHoldRecords = useMemo(
    () =>
      (db.manufacturingRecords || []).filter(
        (r) => r.manufacturingStatus === 'HOLD' || r.manufacturingStatus === 'FAIL' || r.manufacturingStatus === 'NCR_HOLD'
      ),
    [db.manufacturingRecords]
  );

  // 2. Pending Inspections Metrics
  const awaitingInspectionRecords = useMemo(
    () => (db.manufacturingRecords || []).filter((r) => r.manufacturingStatus === 'AWAITING_INSPECTION'),
    [db.manufacturingRecords]
  );
  const pendingDaleSheets = useMemo(
    () =>
      (db.daleInspections || []).filter(
        (s) => s.approvalStatus === 'PENDING' || s.approvalStatus === 'HOLD' || !s.inspectorSignOff
      ),
    [db.daleInspections]
  );
  const totalPendingInspections = awaitingInspectionRecords.length + pendingDaleSheets.length;
  const readyForReleaseCount = useMemo(
    () => (db.manufacturingRecords || []).filter((r) => r.manufacturingStatus === 'INSPECTION_PASSED').length,
    [db.manufacturingRecords]
  );

  // 3. Open Projects Metrics
  const openProjects = useMemo(
    () => (db.projects || []).filter((p) => p.projectStatus !== 'COMPLETED'),
    [db.projects]
  );
  const activeProjectsCount = useMemo(
    () => (db.projects || []).filter((p) => p.projectStatus === 'ACTIVE').length,
    [db.projects]
  );
  const planningProjectsCount = useMemo(
    () => (db.projects || []).filter((p) => p.projectStatus === 'PLANNING').length,
    [db.projects]
  );
  const onHoldProjectsCount = useMemo(
    () => (db.projects || []).filter((p) => p.projectStatus === 'ON_HOLD').length,
    [db.projects]
  );
  const completedProjectsCount = useMemo(
    () => (db.projects || []).filter((p) => p.projectStatus === 'COMPLETED').length,
    [db.projects]
  );
  const totalLinkedMachines = useMemo(
    () =>
      openProjects.reduce(
        (acc, p) => acc + (p.machineSerialNumbers?.length || p.associatedSerialNumbers?.length || 0),
        0
      ),
    [openProjects]
  );

  // 4. Fleet & Operations Metrics
  const totalMachines = db.machines.length;
  const machinesInProduction = useMemo(
    () => db.machines.filter((m) => m.manufacturingStatus === 'IN_PRODUCTION').length,
    [db.machines]
  );
  const machinesInAssembly = useMemo(
    () =>
      db.machines.filter(
        (m) => m.assemblyStatus === 'SUB_ASSEMBLY' || m.assemblyStatus === 'FINAL_ASSEMBLY' || m.assemblyStatus === 'TESTING'
      ).length,
    [db.machines]
  );
  const releasedMachines = useMemo(
    () =>
      db.machines.filter(
        (m) => m.assemblyStatus === 'RELEASED' || m.manufacturingStatus === 'COMPLETED' || m.manufacturingStatus === 'DELIVERED'
      ).length,
    [db.machines]
  );

  // 5. Quality Release & Conformance Metrics
  const totalManufacturingRecords = db.manufacturingRecords.length;
  const releasedRecords = useMemo(
    () => db.manufacturingRecords.filter((r) => r.manufacturingStatus === 'RELEASED'),
    [db.manufacturingRecords]
  );
  const releaseConformanceRate =
    totalManufacturingRecords > 0
      ? Math.round((releasedRecords.length / totalManufacturingRecords) * 100)
      : 100;
  const approvedDeviations = useMemo(
    () => (db.deviations || []).filter((d) => d.status === 'APPROVED'),
    [db.deviations]
  );
  const criticalComponents = useMemo(
    () => db.components.filter((c) => c.criticalComponent).length,
    [db.components]
  );
  const approvedDrawingsCount = useMemo(
    () => db.drawings.filter((d) => d.drawingStatus === 'APPROVED').length,
    [db.drawings]
  );
  const totalInspectionSheets = db.daleInspections?.length || 0;

  // Filtered machines for executive table
  const filteredMachines = useMemo(() => {
    if (selectedMachineFilter === 'ALL') return db.machines;
    return db.machines.filter((m) => m.serialNumber === selectedMachineFilter);
  }, [db.machines, selectedMachineFilter]);

  // Quick Modal Filtered Data
  const modalFilteredData = useMemo(() => {
    const q = modalSearchTerm.trim().toLowerCase();
    if (activeKpiModal === 'NCRS') {
      if (!q) return activeNcrs;
      return activeNcrs.filter(
        (n) =>
          n.ncrNumber.toLowerCase().includes(q) ||
          n.partNumber.toLowerCase().includes(q) ||
          (n.componentDescription && n.componentDescription.toLowerCase().includes(q)) ||
          n.machineSerialNumber.toLowerCase().includes(q) ||
          n.responsiblePerson.toLowerCase().includes(q)
      );
    }
    if (activeKpiModal === 'INSPECTIONS') {
      const parts = awaitingInspectionRecords.map((r) => ({
        type: 'PART_AWAITING_QA' as const,
        id: r.id,
        ref: r.traceabilityNumber,
        part: r.partNumber,
        desc: r.componentDescription,
        machine: r.machineSerialNumber,
        drawing: `${r.drawingNumber} Rev ${r.drawingRevision}`,
        status: r.manufacturingStatus,
        subtext: `Machinist: ${r.machinist} · Date: ${r.manufacturingDate}`,
      }));
      const sheets = pendingDaleSheets.map((s) => ({
        type: 'DALE_PROCESS_SHEET' as const,
        id: s.id,
        ref: s.sheetNumber,
        part: s.partOrSerialNo || s.partName || 'Assembly Check',
        desc: s.processTitle,
        machine: s.machineOrAssembly,
        drawing: `${s.drawingNumber} Rev ${s.drawingRevision}`,
        status: s.approvalStatus,
        subtext: `Inspector: ${s.inspector || 'Pending QA'} · Job #${s.projectNumber}`,
      }));
      const combined = [...parts, ...sheets];
      if (!q) return combined;
      return combined.filter(
        (item) =>
          item.ref.toLowerCase().includes(q) ||
          item.part.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q) ||
          item.machine.toLowerCase().includes(q)
      );
    }
    if (activeKpiModal === 'PROJECTS') {
      if (!q) return openProjects;
      return openProjects.filter(
        (p) =>
          p.projectNumber.toLowerCase().includes(q) ||
          p.projectName.toLowerCase().includes(q) ||
          p.customer.toLowerCase().includes(q) ||
          p.machineType.toLowerCase().includes(q)
      );
    }
    if (activeKpiModal === 'FLEET') {
      if (!q) return db.machines;
      return db.machines.filter(
        (m) =>
          m.serialNumber.toLowerCase().includes(q) ||
          m.customer.toLowerCase().includes(q) ||
          m.machineType.toLowerCase().includes(q) ||
          m.projectNumber.toLowerCase().includes(q)
      );
    }
    return [];
  }, [activeKpiModal, modalSearchTerm, activeNcrs, awaitingInspectionRecords, pendingDaleSheets, openProjects, db.machines]);

  // ----------------------------------------------------
  // REUSABLE SUMMARY KPI CARDS COMPONENT
  // ----------------------------------------------------
  const renderKpiCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
      {/* KPI 1: Active NCRs */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setModalSearchTerm('');
          setActiveKpiModal('NCRS');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setModalSearchTerm('');
            setActiveKpiModal('NCRS');
          }
        }}
        className={`group text-left p-5 rounded-xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          activeNcrs.length === 0
            ? 'bg-white border-slate-200 hover:border-emerald-300'
            : 'bg-rose-50/40 border-rose-200 hover:border-rose-400'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
            <ShieldAlert
              className={`w-4 h-4 ${activeNcrs.length === 0 ? 'text-emerald-600' : 'text-rose-600'}`}
            />
            Active NCRs
          </span>
          <span
            className={`text-xs font-medium ${
              activeNcrs.length === 0 ? 'text-emerald-700' : 'text-rose-700 font-semibold'
            }`}
          >
            {activeNcrs.length === 0 ? 'Zero Holds' : `${activeNcrs.length} Active`}
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black font-mono tabular-nums text-slate-950">
            {activeNcrs.length}
          </span>
          <span className="text-xs font-semibold text-slate-500">Non-Conformances</span>
        </div>

        <div className="mt-3.5 pt-3 border-t border-slate-200/80 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span>Status Breakdown:</span>
            <span className="font-mono tabular-nums text-slate-900 font-medium">
              {openNcrsCount} Open · {containedNcrsCount} Contained · {dispositionedNcrsCount} Disp.
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Quarantined Parts:</span>
            <span className="font-mono tabular-nums font-semibold text-rose-700">
              {onHoldRecords.length} component{onHoldRecords.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-indigo-600 group-hover:text-indigo-800 transition-colors">
          <span>Click to review active holds</span>
          <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* KPI 2: Pending Inspections */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setModalSearchTerm('');
          setActiveKpiModal('INSPECTIONS');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setModalSearchTerm('');
            setActiveKpiModal('INSPECTIONS');
          }
        }}
        className={`group text-left p-5 rounded-xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          totalPendingInspections === 0
            ? 'bg-white border-slate-200 hover:border-emerald-300'
            : 'bg-amber-50/40 border-amber-200 hover:border-amber-400'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
            <Clock
              className={`w-4 h-4 ${
                totalPendingInspections === 0 ? 'text-emerald-600' : 'text-amber-600'
              }`}
            />
            Pending Inspections
          </span>
          <span
            className={`text-xs font-medium ${
              totalPendingInspections === 0 ? 'text-emerald-700' : 'text-amber-700 font-semibold'
            }`}
          >
            {totalPendingInspections === 0 ? 'Queue Clear' : `${totalPendingInspections} In Queue`}
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black font-mono tabular-nums text-slate-950">
            {totalPendingInspections}
          </span>
          <span className="text-xs font-semibold text-slate-500">Sign-Offs Pending</span>
        </div>

        <div className="mt-3.5 pt-3 border-t border-slate-200/80 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span>Parts Awaiting QA:</span>
            <span className="font-mono tabular-nums font-semibold text-amber-800">
              {awaitingInspectionRecords.length} component{awaitingInspectionRecords.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Dale Process Sheets:</span>
            <span className="font-mono tabular-nums font-medium text-slate-900">
              {pendingDaleSheets.length} sheet{pendingDaleSheets.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-indigo-600 group-hover:text-indigo-800 transition-colors">
          <span>Click to inspect sign-off queue</span>
          <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* KPI 3: Open Projects */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setModalSearchTerm('');
          setActiveKpiModal('PROJECTS');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setModalSearchTerm('');
            setActiveKpiModal('PROJECTS');
          }
        }}
        className="group text-left p-5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all cursor-pointer shadow-2xs hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
            <FolderKanban className="w-4 h-4 text-blue-600" />
            Open Projects
          </span>
          <span className="text-xs font-medium text-blue-700">
            {activeProjectsCount} in build · {planningProjectsCount} staged
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black font-mono tabular-nums text-slate-950">
            {openProjects.length}
          </span>
          <span className="text-xs font-semibold text-slate-500">Active Contracts</span>
        </div>

        <div className="mt-3.5 pt-3 border-t border-slate-200/80 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span>Active vs Staged:</span>
            <span className="font-mono tabular-nums font-medium text-slate-900">
              {activeProjectsCount} Active · {planningProjectsCount} Planning · {onHoldProjectsCount} Hold
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Linked Machines:</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {totalLinkedMachines} serial{totalLinkedMachines !== 1 ? 's' : ''} assigned
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-blue-600 group-hover:text-blue-800 transition-colors">
          <span>Click to review project contracts</span>
          <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* KPI 4: Machines in Production */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setModalSearchTerm('');
          setActiveKpiModal('FLEET');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setModalSearchTerm('');
            setActiveKpiModal('FLEET');
          }
        }}
        className="group text-left p-5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-all cursor-pointer shadow-2xs hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
            <Cpu className="w-4 h-4 text-indigo-600" />
            Fleet Production
          </span>
          <span className="text-xs font-medium text-indigo-700">
            {machinesInProduction} in build
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black font-mono tabular-nums text-slate-950">
            {machinesInProduction}
            <span className="text-lg font-semibold text-slate-400">/{totalMachines}</span>
          </span>
          <span className="text-xs font-semibold text-slate-500">Machines Active</span>
        </div>

        <div className="mt-3.5 pt-3 border-t border-slate-200/80 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span>Assembly &amp; Testing:</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {machinesInAssembly} machine{machinesInAssembly !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Planned / Staged:</span>
            <span className="font-mono tabular-nums font-medium text-slate-700">
              {totalMachines - machinesInProduction} machine{totalMachines - machinesInProduction !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-indigo-600 group-hover:text-indigo-800 transition-colors">
          <span>Click to review fleet build status</span>
          <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* KPI 5: Quality Gate Conformance */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setActiveTab('quality-release')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setActiveTab('quality-release');
        }}
        className="group text-left p-5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-all cursor-pointer shadow-2xs hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Quality Gate Release
          </span>
          <span className="text-xs font-medium text-emerald-700 font-mono tabular-nums font-bold">
            {releaseConformanceRate}% Conformance
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black font-mono tabular-nums text-slate-950">
            {releasedRecords.length}
          </span>
          <span className="text-xs font-semibold text-slate-500">Released Components</span>
        </div>

        <div className="mt-3.5 pt-3 border-t border-slate-200/80 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span>Gate Ready for Evaluation:</span>
            <span className="font-mono tabular-nums font-semibold text-emerald-800">
              {readyForReleaseCount} part{readyForReleaseCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Approved Concessions:</span>
            <span className="font-mono tabular-nums font-medium text-slate-900">
              {approvedDeviations.length} deviation{approvedDeviations.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-emerald-600 group-hover:text-emerald-800 transition-colors">
          <span>Navigate to 18-Point Gate</span>
          <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* KPI 6: Critical Components & Drawings */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setActiveTab('components')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setActiveTab('components');
        }}
        className="group text-left p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 transition-all cursor-pointer shadow-2xs hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
            <Boxes className="w-4 h-4 text-slate-700" />
            Critical Components
          </span>
          <span className="text-xs font-medium text-slate-600">
            {criticalComponents} Controlled
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black font-mono tabular-nums text-slate-950">
            {criticalComponents}
          </span>
          <span className="text-xs font-semibold text-slate-500">BOM Parts</span>
        </div>

        <div className="mt-3.5 pt-3 border-t border-slate-200/80 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span>Approved Drawings:</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {approvedDrawingsCount} current drawing{approvedDrawingsCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Serialized Records:</span>
            <span className="font-mono tabular-nums font-medium text-slate-900">
              {totalManufacturingRecords} traceable
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
          <span>Inspect Critical Components register</span>
          <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- */}
      {/* TOP HEADER & GOVERNANCE BAR                         */}
      {/* ---------------------------------------------------- */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-xl p-5 border border-indigo-900/50 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            {isManagement
              ? 'EXECUTIVE MANAGEMENT OVERSIGHT — LEAST PRIVILEGE READ-ONLY'
              : 'MACHINE QUALITY MANAGEMENT SYSTEM — CONTROLLED WORKSHOP DASHBOARD'}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-1">
            Manufacturing Quality &amp; Fleet Operations Dashboard
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Immediate visibility across active non-conformances, pending dimensional inspections, open machine project
            BOMs, and 18-Point Quality Gate release barrier compliance.
          </p>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Segmented Perspective Switcher */}
          <div className="flex items-center p-1 bg-slate-900/90 border border-slate-700 rounded-lg">
            <button
              onClick={() => setActiveViewMode('EXECUTIVE')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeViewMode === 'EXECUTIVE'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Executive Fleet View
            </button>
            <button
              onClick={() => setActiveViewMode('OPERATIONS')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeViewMode === 'OPERATIONS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Workshop Operations
            </button>
          </div>

          <button
            onClick={() => setActiveTab('reports')}
            className="px-3.5 py-2 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Reports &amp; Dossiers</span>
          </button>
          <button
            onClick={() => generateExecutiveFleetSummaryPdf({ db })}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
            title="Download Executive Fleet Quality Summary PDF"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* SUMMARY KPI CARDS (Immediate Management Visibility)  */}
      {/* ---------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
            Executive Summary Key Performance Indicators
          </h2>
          <span className="text-xs text-slate-500">
            Click any KPI card for immediate record breakdown
          </span>
        </div>
        {renderKpiCards()}
      </div>

      {/* ---------------------------------------------------- */}
      {/* PERSPECTIVE 1: EXECUTIVE FLEET MANAGEMENT VIEW       */}
      {/* ---------------------------------------------------- */}
      {activeViewMode === 'EXECUTIVE' && (
        <div className="space-y-6">
          {/* Machine Fleet Build & Release Status Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider font-mono">
                  Factory Fleet Release Gate Status &amp; Dossiers
                </h2>
                <p className="text-xs text-slate-500">
                  Official machine builds with linked project numbers, component release counts, and dossier access.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Filter Machine:</span>
                <select
                  value={selectedMachineFilter}
                  onChange={(e) => setSelectedMachineFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-semibold bg-white"
                >
                  <option value="ALL">All Machines ({db.machines.length})</option>
                  {db.machines.map((m) => (
                    <option key={m.id} value={m.serialNumber}>
                      {m.serialNumber} — {m.machineType}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                    <th className="py-2.5 px-4">SERIAL NUMBER</th>
                    <th className="py-2.5 px-4">PROJECT #</th>
                    <th className="py-2.5 px-4">CUSTOMER</th>
                    <th className="py-2.5 px-4">MACHINE TYPE</th>
                    <th className="py-2.5 px-4">MFG STATUS</th>
                    <th className="py-2.5 px-4">ASSEMBLY</th>
                    <th className="py-2.5 px-4">PARTS RELEASED</th>
                    <th className="py-2.5 px-4 text-center">OPEN NCRs</th>
                    <th className="py-2.5 px-4 text-right">DOSSIER ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {filteredMachines.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-500 font-sans">
                        <div className="max-w-md mx-auto space-y-1.5">
                          <Cpu className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="font-bold text-slate-700">No Machines in Quality Register</p>
                          <p className="text-xs text-slate-400">
                            Blank slate active. When new projects and machine serials are created, fleet production
                            status will appear here.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMachines.map((m) => {
                      const mfgRecords = db.manufacturingRecords.filter(
                        (r) => r.machineSerialNumber === m.serialNumber
                      );
                      const released = mfgRecords.filter((r) => r.manufacturingStatus === 'RELEASED').length;
                      const mNcrs = db.ncrs.filter(
                        (n) => n.machineSerialNumber === m.serialNumber && n.status !== 'CLOSED'
                      );
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-blue-700">{m.serialNumber}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{m.projectNumber}</td>
                          <td className="py-3 px-4 font-sans text-slate-900 font-medium">{m.customer}</td>
                          <td className="py-3 px-4 text-slate-700">{m.machineType}</td>
                          <td className="py-3 px-4">
                            <StatusBadge status={m.manufacturingStatus} />
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {m.assemblyStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">
                              {released} / {mfgRecords.length}
                            </div>
                            <div className="w-24 bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full"
                                style={{
                                  width: `${Math.round((released / (mfgRecords.length || 1)) * 100)}%`,
                                }}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {mNcrs.length === 0 ? (
                              <span className="text-emerald-700 font-bold">0</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded font-bold">
                                {mNcrs.length} NCR
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setActiveTab('reports')}
                              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-sans text-xs font-bold inline-flex items-center gap-1 shadow-2xs"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View Dossier</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dale Automation Manufacturing Quality Throughput */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider font-mono">
                  Dale Automation — Quality Process Inspection Throughput
                </h2>
                <p className="text-xs text-slate-500">
                  Independent process inspection sheets covering all factory workshops.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('dale-inspections')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 font-mono"
              >
                Inspect All Sheets &rarr;
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {[
                {
                  title: 'Fabrication & Welding',
                  count: (db.daleInspections || []).filter((s) => s.processType === 'FABRICATION_WELDING').length,
                },
                {
                  title: 'Machined Components',
                  count: (db.daleInspections || []).filter((s) => s.processType === 'MACHINED_PARTS' || s.processType === 'MACHINED_COMPONENTS').length,
                },
                {
                  title: 'Conveyor Components',
                  count: (db.daleInspections || []).filter((s) => s.processType === 'CONVEYOR_COMPONENTS').length,
                },
                {
                  title: 'Spiral Systems',
                  count: (db.daleInspections || []).filter((s) => s.processType === 'SPIRAL_SYSTEMS').length,
                },
                {
                  title: 'Mechanical Assembly',
                  count: (db.daleInspections || []).filter((s) => s.processType === 'ASSEMBLY' || s.processType === 'MECHANICAL_ASSEMBLY').length,
                },
                {
                  title: 'Electrical Control Panels',
                  count: (db.daleInspections || []).filter((s) => s.processType === 'ELECTRICAL_PANELS' || s.processType === 'ELECTRICAL_CONTROL_PANEL').length,
                },
                {
                  title: 'Final Manufacturing FAT',
                  count: (db.daleInspections || []).filter((s) => s.processType === 'FINAL_MANUFACTURING' || s.processType === 'FINAL_MANUFACTURING_FAT').length,
                },
              ].map((proc, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{proc.title}</div>
                    <div className="text-[10px] text-slate-500">Controlled QA Sheets</div>
                  </div>
                  <span className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-800 text-xs">
                    {proc.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* PERSPECTIVE 2: WORKSHOP OPERATIONS VIEW              */}
      {/* ---------------------------------------------------- */}
      {activeViewMode === 'OPERATIONS' && (
        <div className="space-y-6">
          {/* Quick Launch Buttons for Operations */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                Workshop Operations Quick Actions
              </h3>
              <p className="text-xs text-slate-500">
                Direct access to project creation, Excel BOM import, and unique permanent serialization.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setActiveTab('projects')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
              >
                <FileCheck className="w-4 h-4" />
                Projects &amp; Excel Import
              </button>
              <button
                onClick={onOpenCreateRecordModal}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                New Manufacturing Record
              </button>
              <button
                onClick={() => setActiveTab('traceability-search')}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Search className="w-4 h-4 text-blue-400" />
                Traceability Search
              </button>
            </div>
          </div>

          {/* LIME LINE: Interactive Holding Points & Deviations Timeline */}
          <DashboardLimeLine setActiveTab={setActiveTab} />

          {/* Recent Manufacturing Records Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
                  Recent Critical Component Manufacturing Records
                </h3>
                <p className="text-xs text-slate-500">
                  Every critical component is assigned a unique permanent traceability number on creation.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('manufacturing')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View All ({db.manufacturingRecords.length}) <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 text-slate-600 border-b border-slate-200 uppercase font-mono text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Traceability No</th>
                    <th className="py-2.5 px-4">Machine Serial</th>
                    <th className="py-2.5 px-4">Part / Description</th>
                    <th className="py-2.5 px-4">Approved Drawing</th>
                    <th className="py-2.5 px-4">Qty</th>
                    <th className="py-2.5 px-4">Machinist</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Tag / QR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {db.manufacturingRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No manufacturing records logged yet. Use &ldquo;New Manufacturing Record&rdquo; or import BOMs to begin.
                      </td>
                    </tr>
                  ) : (
                    db.manufacturingRecords.slice(0, 5).map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-950">
                          {rec.traceabilityNumber}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-blue-700">
                          {rec.machineSerialNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{rec.partNumber}</div>
                          <div className="text-[11px] text-slate-500">{rec.componentDescription}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {rec.drawingNumber}{' '}
                          <span className="font-bold bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-[10px]">
                            REV {rec.drawingRevision}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{rec.quantity}</td>
                        <td className="py-3 px-4 text-slate-700">
                          <div>{rec.machinist}</div>
                          <div className="text-[10px] text-slate-400">{rec.manufacturingDate}</div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={rec.manufacturingStatus} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onViewTraceabilityTag(rec.traceabilityNumber)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                            title="View Component Traceability Tag & QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mandatory Release Rule Box */}
          <div className="border border-slate-300 rounded-lg p-4 bg-slate-50 flex items-start gap-3">
            <FileCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-slate-900 uppercase tracking-wider font-mono">
                CRITICAL WORKSHOP STANDARD (ISO / QMS MANDATE)
              </div>
              <p className="text-slate-600 leading-relaxed">
                Per QMS Directive Section 27: Components cannot be released through direct status modification.
                Release is locked behind dimensional tolerance verification, verified drawing revision, and
                independent inspector electronic sign-off.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* QUICK-INSPECT KPI MODAL                              */}
      {/* ---------------------------------------------------- */}
      {activeKpiModal && (
        <Modal
          isOpen={Boolean(activeKpiModal)}
          onClose={() => setActiveKpiModal(null)}
          title={
            activeKpiModal === 'NCRS'
              ? 'Active Non-Conformance Reports (NCRs)'
              : activeKpiModal === 'INSPECTIONS'
              ? 'Pending Quality Inspections Queue'
              : activeKpiModal === 'PROJECTS'
              ? 'Open Machine Projects Register'
              : 'Machine Fleet Production Overview'
          }
          subtitle={
            activeKpiModal === 'NCRS'
              ? 'Immediate executive review of all active quarantines, containment holds, and responsible parties.'
              : activeKpiModal === 'INSPECTIONS'
              ? 'Manufactured parts awaiting dimensional QA verification and Dale workshop inspection sheets.'
              : activeKpiModal === 'PROJECTS'
              ? 'Current customer project orders, build statuses, and assigned machine serial numbers.'
              : 'Divider lines and equipment in shop fabrication, assembly, and testing.'
          }
          maxWidth="4xl"
        >
          <div className="p-6 space-y-4">
            {/* Modal Search Bar */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter records..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action Button to Full Register */}
              <button
                onClick={() => {
                  const targetTab: ActiveTab =
                    activeKpiModal === 'NCRS'
                      ? 'ncr'
                      : activeKpiModal === 'INSPECTIONS'
                      ? 'dale-inspections'
                      : activeKpiModal === 'PROJECTS'
                      ? 'projects'
                      : 'machines';
                  setActiveKpiModal(null);
                  setActiveTab(targetTab);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
              >
                <span>Open Full Register</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content List Based on Active Modal */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[55vh]">
              {/* 1. NCRs Table */}
              {activeKpiModal === 'NCRS' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">NCR #</th>
                      <th className="py-2.5 px-3">Traceability / Part</th>
                      <th className="py-2.5 px-3">Machine Serial</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Disposition</th>
                      <th className="py-2.5 px-3">Responsible</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {modalFilteredData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-500 font-sans">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                          <p className="font-bold text-slate-800">No Active Non-Conformances</p>
                          <p className="text-xs text-slate-400">
                            Zero open defect holds. All components meet factory quality conformance standards.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      (modalFilteredData as typeof activeNcrs).map((n) => (
                        <tr key={n.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-rose-700">{n.ncrNumber}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{n.partNumber}</div>
                            <div className="text-[10px] text-slate-500">{n.traceabilityNumber}</div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {n.machineSerialNumber}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-700 max-w-xs truncate" title={n.description}>
                            {n.description}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                              {n.proposedDisposition}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-700">
                            <div>{n.responsiblePerson}</div>
                            <div className="text-[10px] text-slate-400">Due: {n.dueDate}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <StatusBadge status={n.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* 2. Pending Inspections Table */}
              {activeKpiModal === 'INSPECTIONS' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Item Ref</th>
                      <th className="py-2.5 px-3">Part / Sheet Title</th>
                      <th className="py-2.5 px-3">Machine / Project</th>
                      <th className="py-2.5 px-3">Drawing Info</th>
                      <th className="py-2.5 px-3">Details</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {modalFilteredData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-500 font-sans">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                          <p className="font-bold text-slate-800">Quality Inspection Queue Clear</p>
                          <p className="text-xs text-slate-400">
                            No parts or Dale process sheets are currently waiting for QA sign-off.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      (modalFilteredData as Array<{
                        type: string;
                        id: string;
                        ref: string;
                        part: string;
                        desc: string;
                        machine: string;
                        drawing: string;
                        status: string;
                        subtext: string;
                      }>).map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-blue-700">{item.ref}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{item.part}</div>
                            <div className="text-[10px] text-slate-500">{item.desc}</div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{item.machine}</td>
                          <td className="py-2.5 px-3 text-slate-700">{item.drawing}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-500 text-[11px]">{item.subtext}</td>
                          <td className="py-2.5 px-3 text-right">
                            <StatusBadge status={item.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* 3. Open Projects Table */}
              {activeKpiModal === 'PROJECTS' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Project #</th>
                      <th className="py-2.5 px-3">Project Name</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Machine Type</th>
                      <th className="py-2.5 px-3">Target Completion</th>
                      <th className="py-2.5 px-3">Machines Linked</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {modalFilteredData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-500 font-sans">
                          <FolderKanban className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                          <p className="font-bold text-slate-800">No Open Projects Found</p>
                          <p className="text-xs text-slate-400">
                            Create a project or import an Excel BOM in the Projects register to track machine deliverables.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      (modalFilteredData as typeof openProjects).map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-blue-700">{p.projectNumber}</td>
                          <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">{p.projectName}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-800">{p.customer}</td>
                          <td className="py-2.5 px-3 text-slate-700">{p.machineType}</td>
                          <td className="py-2.5 px-3 text-slate-600">{p.targetCompletionDate || 'Not specified'}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-900">
                              {(p.machineSerialNumbers || p.associatedSerialNumbers || []).join(', ') || 'None'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <StatusBadge status={p.projectStatus} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* 4. Fleet Machines Table */}
              {activeKpiModal === 'FLEET' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Serial Number</th>
                      <th className="py-2.5 px-3">Project #</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Machine Type</th>
                      <th className="py-2.5 px-3">Assembly Stage</th>
                      <th className="py-2.5 px-3 text-right">Mfg Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {modalFilteredData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-500 font-sans">
                          <Cpu className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                          <p className="font-bold text-slate-800">No Machines in Register</p>
                          <p className="text-xs text-slate-400">
                            Create machines in the Machines register to track factory build progress.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      (modalFilteredData as typeof db.machines).map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-blue-700">{m.serialNumber}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{m.projectNumber}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-900">{m.customer}</td>
                          <td className="py-2.5 px-3 text-slate-700">{m.machineType}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                              {m.assemblyStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <StatusBadge status={m.manufacturingStatus} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Showing {modalFilteredData.length} record{modalFilteredData.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setActiveKpiModal(null)}
                className="px-4 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
