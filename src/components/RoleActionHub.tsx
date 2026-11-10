import React from 'react';
import { useQMS } from '../context/QMSContext';
import { ActiveTab } from './Sidebar';
import { getRoleConfig } from '../utils/rbac';
import { generateExecutiveFleetSummaryPdf } from '../utils/pdfGenerator';
import {
  Hammer,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  FolderKanban,
  Cpu,
  FileSpreadsheet,
  GitPullRequest,
  ShieldCheck,
  FileText,
  ArrowRight,
  Clock,
  AlertCircle,
  Plus,
  Tag,
  Boxes,
  History,
  Building2,
  Users,
} from 'lucide-react';

interface RoleActionHubProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenCreateRecordModal: () => void;
  onOpenCreateMachineModal: () => void;
}

export const RoleActionHub: React.FC<RoleActionHubProps> = ({
  setActiveTab,
  onOpenCreateRecordModal,
  onOpenCreateMachineModal,
}) => {
  const { db, currentUser } = useQMS();
  const roleConfig = getRoleConfig(currentUser?.role);

  // --------------------------------------------------------------------------
  // ROLE-SPECIFIC ACTION DATA DERIVATIONS
  // --------------------------------------------------------------------------

  // 1. MACHINIST metrics & actions
  const myDeptMfgRecords = (db.manufacturingRecords || []).filter((r) => {
    if (currentUser.role !== 'MACHINIST') return true;
    return (
      r.machinistId === currentUser.id ||
      r.machinist.toLowerCase().includes(currentUser.name.toLowerCase()) ||
      r.workstation.toLowerCase().includes(currentUser.department.toLowerCase()) ||
      true // fallback to workshop records if none specifically assigned
    );
  });

  const inProgressRuns = (db.manufacturingRecords || []).filter(
    (r) =>
      r.manufacturingStatus === 'IN_PRODUCTION' ||
      r.manufacturingStatus === 'AWAITING_IDENTIFICATION' ||
      r.manufacturingStatus === 'MANUFACTURED'
  );

  const awaitingInspectionRuns = (db.manufacturingRecords || []).filter(
    (r) => r.manufacturingStatus === 'AWAITING_INSPECTION'
  );

  const unIdentifiedParts = (db.manufacturingRecords || []).filter(
    (r) => !r.permanentIdCompleted
  );

  // 2. INSPECTOR metrics & actions
  const pendingDaleSheets = (db.daleInspections || []).filter(
    (s) => s.approvalStatus === 'PENDING' || s.approvalStatus === 'HOLD' || !s.inspectorSignOff
  );

  const activeNcrs = (db.ncrs || []).filter((n) => n.status !== 'CLOSED');
  const openNcrs = (db.ncrs || []).filter((n) => n.status === 'OPEN');

  // 3. MACHINE_MANAGER metrics & actions
  const activeMachines = (db.machines || []).filter(
    (m) => m.manufacturingStatus === 'IN_PRODUCTION' || m.assemblyStatus === 'SUB_ASSEMBLY'
  );

  const runsOnHold = (db.manufacturingRecords || []).filter(
    (r) => r.manufacturingStatus === 'HOLD' || r.manufacturingStatus === 'FAIL' || r.manufacturingStatus === 'NCR_HOLD'
  );

  const openProjects = (db.projects || []).filter((p) => p.projectStatus !== 'COMPLETED');

  // 4. ENGINEERING metrics & actions
  const draftDrawings = (db.drawings || []).filter(
    (d) => d.drawingStatus === 'DRAFT' || d.drawingStatus === 'UNDER_REVIEW'
  );

  const pendingDeviations = (db.deviations || []).filter(
    (d) => d.status === 'DRAFT' || d.status === 'UNDER_REVIEW' || d.status === 'AWAITING_APPROVAL'
  );

  const criticalComponentsWithoutDwg = (db.components || []).filter(
    (c) => c.criticalComponent && (!c.defaultDrawingNumber || c.defaultDrawingNumber.trim() === '')
  );

  // 5. HSEQ metrics & actions
  const passedReadyForRelease = (db.manufacturingRecords || []).filter(
    (r) => r.manufacturingStatus === 'INSPECTION_PASSED'
  );

  const uncontainedNcrs = (db.ncrs || []).filter((n) => n.status === 'OPEN');

  // 6. MANAGEMENT metrics & actions
  const completedProjects = (db.projects || []).filter((p) => p.projectStatus === 'COMPLETED');

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-blue-500/30 dark:border-blue-500/40 p-5 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-600 text-white shadow-xs">
            {currentUser.role === 'MACHINIST' && <Hammer className="w-5 h-5" />}
            {currentUser.role === 'INSPECTOR' && <ClipboardCheck className="w-5 h-5" />}
            {currentUser.role === 'MACHINE_MANAGER' && <Cpu className="w-5 h-5" />}
            {currentUser.role === 'ENGINEERING' && <FileSpreadsheet className="w-5 h-5" />}
            {currentUser.role === 'HSEQ' && <ShieldCheck className="w-5 h-5" />}
            {currentUser.role === 'MANAGEMENT' && <FolderKanban className="w-5 h-5" />}
            {currentUser.role === 'ADMINISTRATOR' && <Building2 className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-slate-950 dark:text-white uppercase font-mono">
                {currentUser.name}’s Action Items
              </h2>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${roleConfig.badgeClass}`}>
                {roleConfig.badgeLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {roleConfig.departmentScope} • Showing records and action items pertaining to your authority
            </p>
          </div>
        </div>

        {/* Quick Shortcut Buttons tailored to role */}
        <div className="flex items-center gap-2 shrink-0">
          {roleConfig.canCreateManufacturingRecord && (
            <button
              onClick={onOpenCreateRecordModal}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Log Production Run</span>
            </button>
          )}
          {roleConfig.canCreateMachine && (
            <button
              onClick={onOpenCreateMachineModal}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New Machine</span>
            </button>
          )}
          {currentUser.role === 'MANAGEMENT' && (
            <button
              onClick={() => generateExecutiveFleetSummaryPdf({ db })}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export Executive PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. MACHINIST ACTION VIEW                                                  */}
      {/* ========================================================================= */}
      {currentUser.role === 'MACHINIST' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: Active Production Runs */}
            <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 font-mono flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  In-Progress Workshop Runs
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                  {inProgressRuns.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                Manufacture components according to approved drawings. Once machined, send for First-Off dimensional check.
              </p>
              <button
                onClick={() => setActiveTab('manufacturing')}
                className="mt-3 text-xs font-bold text-amber-800 dark:text-amber-300 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
              >
                <span>View &amp; Complete Runs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 2: Awaiting Inspection (Handed off to QA) */}
            <div className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-300 font-mono flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Awaiting QA First-Off Check
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-blue-200 text-blue-900">
                  {awaitingInspectionRuns.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                Quality holding points active. Parts currently with Metrology for caliper, micrometer, or CMM verification.
              </p>
              <button
                onClick={() => setActiveTab('manufacturing')}
                className="mt-3 text-xs font-bold text-blue-800 dark:text-blue-300 hover:text-blue-950 flex items-center gap-1 cursor-pointer"
              >
                <span>Check Inspection Status</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 3: Permanent ID Marking */}
            <div className="p-3.5 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-300 font-mono flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Permanent ID (Traceability Tag)
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-purple-200 text-purple-900">
                  {unIdentifiedParts.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                Mandatory dot-peen, laser, or vibro-etching to be stamped prior to painting, coating, or sub-assembly.
              </p>
              <button
                onClick={() => setActiveTab('manufacturing')}
                className="mt-3 text-xs font-bold text-purple-800 dark:text-purple-300 hover:text-purple-950 flex items-center gap-1 cursor-pointer"
              >
                <span>Record Identification</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick List of Active Runs */}
          {inProgressRuns.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-50 dark:bg-slate-950/40">
              <div className="text-xs font-bold font-mono uppercase text-slate-700 dark:text-slate-300 mb-2">
                Workstation Runs In Progress ({inProgressRuns.length})
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {inProgressRuns.slice(0, 3).map((r) => (
                  <div key={r.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {r.traceabilityNumber}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold ml-2">
                        {r.partNumber} — {r.componentDescription}
                      </span>
                      <span className="text-slate-500 text-[11px] ml-2 font-mono">
                        Drawing {r.drawingNumber} Rev {r.drawingRevision} · Qty {r.quantity}
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('manufacturing')}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                    >
                      Action Run →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. INSPECTOR ACTION VIEW                                                  */}
      {/* ========================================================================= */}
      {currentUser.role === 'INSPECTOR' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: Manufacturing Records Awaiting First-Off */}
            <div className="p-3.5 rounded-lg border-2 border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 dark:text-amber-200 font-mono flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Runs Awaiting First-Off / In-Process
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-amber-500 text-white animate-pulse">
                  {awaitingInspectionRuns.length} PENDING
                </span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-2">
                Workshop parts waiting at quality holding point. Measure tolerances, verify drawing revision, and record dimensional pass/fail.
              </p>
              <button
                onClick={() => setActiveTab('manufacturing')}
                className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>Inspect Manufacturing Runs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 2: Dale Process Checksheets Needing Sign-Off */}
            <div className="p-3.5 rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-950/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200 font-mono flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-blue-600" />
                  Dale Quality Checksheets
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-blue-600 text-white">
                  {pendingDaleSheets.length} ACTION
                </span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-2">
                Process inspection holding points (welding, machining, electrical, conveyor). Verify checklist points and sign off certificate.
              </p>
              <button
                onClick={() => setActiveTab('dale-inspections')}
                className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>Open Dale Checksheets</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 3: Open NCRs / Quarantine Verification */}
            <div className="p-3.5 rounded-lg border-2 border-rose-300 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-950/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-950 dark:text-rose-200 font-mono flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Active Non-Conformances
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-rose-600 text-white">
                  {activeNcrs.length} ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-2">
                {openNcrs.length} NCRs require immediate physical quarantine tagging and containment verification before rework commences.
              </p>
              <button
                onClick={() => setActiveTab('ncr')}
                className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>Verify NCR Quarantine</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MACHINE_MANAGER ACTION VIEW                                            */}
      {/* ========================================================================= */}
      {currentUser.role === 'MACHINE_MANAGER' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: Machine Fleet Assembly Progress */}
            <div className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-300 font-mono flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Machines In Build / Assembly
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-blue-200 text-blue-900">
                  {activeMachines.length} In Build
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                Monitor machine divider and conveyor builds, assembly milestones, and BOM component allocations.
              </p>
              <button
                onClick={() => setActiveTab('machines')}
                className="mt-3 text-xs font-bold text-blue-800 dark:text-blue-300 hover:text-blue-950 flex items-center gap-1 cursor-pointer"
              >
                <span>Manage Machine Fleet</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 2: Shopfloor Production Runs on Hold */}
            <div className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900 dark:text-rose-300 font-mono flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  Shopfloor Blocks / Runs on Hold
                </span>
                <span className={`text-xs font-black font-mono px-2 py-0.5 rounded ${runsOnHold.length > 0 ? 'bg-rose-600 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                  {runsOnHold.length} {runsOnHold.length === 1 ? 'BLOCK' : 'BLOCKS'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                {runsOnHold.length > 0
                  ? 'Components currently on HOLD or flagged FAIL. Review rework allocation to prevent line stoppage.'
                  : 'Zero workshop runs currently blocked. Production flow is nominal.'}
              </p>
              <button
                onClick={() => setActiveTab('manufacturing')}
                className="mt-3 text-xs font-bold text-rose-800 dark:text-rose-300 hover:text-rose-950 flex items-center gap-1 cursor-pointer"
              >
                <span>Review Production Holds</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 3: Open Project Contracts */}
            <div className="p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 font-mono flex items-center gap-1.5">
                  <FolderKanban className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Active Project Contracts
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-indigo-200 text-indigo-900">
                  {openProjects.length} Open
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                Customer delivery deadlines and BOM allocations for Dale Automation equipment.
              </p>
              <button
                onClick={() => setActiveTab('projects')}
                className="mt-3 text-xs font-bold text-indigo-800 dark:text-indigo-300 hover:text-indigo-950 flex items-center gap-1 cursor-pointer"
              >
                <span>View Projects &amp; BOMs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ENGINEERING ACTION VIEW                                                */}
      {/* ========================================================================= */}
      {currentUser.role === 'ENGINEERING' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: Drawings in Draft or Under Review */}
            <div className="p-3.5 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-300 font-mono flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Drawings Needing Approval
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-purple-200 text-purple-900">
                  {draftDrawings.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                Engineering prints awaiting sign-off, CAD tolerance verification, or revision bump.
              </p>
              <button
                onClick={() => setActiveTab('drawings')}
                className="mt-3 text-xs font-bold text-purple-800 dark:text-purple-300 hover:text-purple-950 flex items-center gap-1 cursor-pointer"
              >
                <span>Review &amp; Approve Prints</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 2: Engineering Concessions & Redlines */}
            <div className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-300 font-mono flex items-center gap-1.5">
                  <GitPullRequest className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Deviations / Redlines Awaiting Sign-Off
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-blue-200 text-blue-900">
                  {pendingDeviations.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                Concession requests submitted from the workshop. Sign off technical acceptability or reject rework requests.
              </p>
              <button
                onClick={() => setActiveTab('deviations')}
                className="mt-3 text-xs font-bold text-blue-800 dark:text-blue-300 hover:text-blue-950 flex items-center gap-1 cursor-pointer"
              >
                <span>Sign Off Concessions</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 3: Machine BOM Imports */}
            <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 font-mono flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  CAD BOM &amp; Part Specs
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                  {criticalComponentsWithoutDwg.length} Gaps
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                Import CAD Excel/CSV BOM structures directly into machine assemblies with automated component mapping.
              </p>
              <button
                onClick={() => setActiveTab('machines')}
                className="mt-3 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
              >
                <span>Import Machine BOM</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. HSEQ ACTION VIEW                                                       */}
      {/* ========================================================================= */}
      {currentUser.role === 'HSEQ' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: 15-Point Quality Release Gate */}
            <div className="p-3.5 rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 font-mono flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Quality Release Gate Authority
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-emerald-600 text-white">
                  {passedReadyForRelease.length} READY
                </span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-2">
                Sole compliance authority to sign off the 15-Barrier Quality Release Gate. Verify zero blocking NCRs before authorizing dispatch.
              </p>
              <button
                onClick={() => setActiveTab('quality-release')}
                className="mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>Execute Release Gate</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 2: NCR Quarantine & CAPA Dispositions */}
            <div className="p-3.5 rounded-lg border-2 border-rose-300 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-950/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-950 dark:text-rose-200 font-mono flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  NCR CAPA Dispositions
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-rose-600 text-white">
                  {activeNcrs.length} ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-2">
                Formal NCR disposition authority (Scrap, Rework, Return to Vendor). Conduct 5-Why root cause and close out CAPAs.
              </p>
              <button
                onClick={() => setActiveTab('ncr')}
                className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>Disposition Open NCRs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 3: Quality Dossiers & Compliance Packs */}
            <div className="p-3.5 rounded-lg border-2 border-teal-300 dark:border-teal-700 bg-teal-50/60 dark:bg-teal-950/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-950 dark:text-teal-200 font-mono flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-teal-600" />
                  Release Dossiers &amp; Reports
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-teal-600 text-white">
                  AUDIT PACK
                </span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-2">
                Generate and export formal manufacturing quality dossiers, customer certificates of conformance, and audit trails.
              </p>
              <button
                onClick={() => setActiveTab('reports')}
                className="mt-3 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>Export Quality Dossier</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MANAGEMENT ACTION VIEW                                                 */}
      {/* ========================================================================= */}
      {currentUser.role === 'MANAGEMENT' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: Delivery Contracts & Milestones */}
            <div className="p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 font-mono flex items-center gap-1.5">
                  <FolderKanban className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Active Customer Contracts
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-indigo-200 text-indigo-900">
                  {openProjects.length} Open
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                Track customer delivery targets, machine divider builds, and contractual FAT milestones.
              </p>
              <button
                onClick={() => setActiveTab('projects')}
                className="mt-3 text-xs font-bold text-indigo-800 dark:text-indigo-300 hover:text-indigo-950 flex items-center gap-1 cursor-pointer"
              >
                <span>Review Projects</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 2: Non-Conformance Risk Exposure */}
            <div className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900 dark:text-rose-300 font-mono flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  Factory Conformance &amp; NCR Risk
                </span>
                <span className={`text-xs font-black font-mono px-2 py-0.5 rounded ${activeNcrs.length > 0 ? 'bg-rose-600 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                  {activeNcrs.length} Active Holds
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                {activeNcrs.length === 0
                  ? 'Zero active non-conformances across the factory. Full ISO 9001 quality conformance achieved.'
                  : `${activeNcrs.length} open NCRs currently active. Review containment and delivery risk.`}
              </p>
              <button
                onClick={() => setActiveTab('ncr')}
                className="mt-3 text-xs font-bold text-rose-800 dark:text-rose-300 hover:text-rose-950 flex items-center gap-1 cursor-pointer"
              >
                <span>Review NCR Status</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 3: Executive Summary & PDF Dossier */}
            <div className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-300 font-mono flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Executive Reporting &amp; Exports
                </span>
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-blue-200 text-blue-900">
                  PRINT READY
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                Download formal printable quality summary packs, fleet progress reports, and customer acceptance dossiers.
              </p>
              <button
                onClick={() => setActiveTab('reports')}
                className="mt-3 text-xs font-bold text-blue-800 dark:text-blue-300 hover:text-blue-950 flex items-center gap-1 cursor-pointer"
              >
                <span>Browse Dossiers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. ADMINISTRATOR ACTION VIEW                                               */}
      {/* ========================================================================= */}
      {currentUser.role === 'ADMINISTRATOR' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Quick Tile 1: Quality Holds */}
            <div
              onClick={() => setActiveTab('ncr')}
              className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 hover:border-rose-400 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900 dark:text-rose-300 font-mono">Active NCR Holds</span>
                <span className="text-xs font-black font-mono px-1.5 py-0.2 rounded bg-rose-600 text-white">
                  {activeNcrs.length}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Review factory non-conformances</p>
            </div>

            {/* Quick Tile 2: Pending Inspections */}
            <div
              onClick={() => setActiveTab('dale-inspections')}
              className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-400 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 font-mono">Pending Inspections</span>
                <span className="text-xs font-black font-mono px-1.5 py-0.2 rounded bg-amber-500 text-white">
                  {awaitingInspectionRuns.length + pendingDaleSheets.length}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">First-off &amp; process checksheets</p>
            </div>

            {/* Quick Tile 3: User Governance */}
            <div
              onClick={() => setActiveTab('users')}
              className="p-3 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 hover:border-blue-400 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-300 font-mono">Users &amp; Roles</span>
                <span className="text-xs font-black font-mono px-1.5 py-0.2 rounded bg-blue-600 text-white">
                  {db.users.length}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Operator credentials &amp; permissions</p>
            </div>

            {/* Quick Tile 4: System Audit Trail */}
            <div
              onClick={() => setActiveTab('audit-trail')}
              className="p-3 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 hover:border-purple-400 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-300 font-mono">Audit Logs</span>
                <span className="text-xs font-black font-mono px-1.5 py-0.2 rounded bg-purple-600 text-white">
                  {db.auditLogs.length}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Immutable QMS transaction logs</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
