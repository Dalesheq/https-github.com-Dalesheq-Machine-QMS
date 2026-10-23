import React, { useState } from 'react';
import { useQMS } from '../context/QMSContext';
import { StatusBadge } from '../components/StatusBadge';
import { ActiveTab } from '../components/Sidebar';
import { DashboardLimeLine } from '../components/DashboardLimeLine';
import { WORKSHOP_DEPARTMENTS, getDepartmentById } from '../utils/departmentsData';
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
} from 'lucide-react';

interface DashboardModuleProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenCreateRecordModal: () => void;
  onOpenCreateMachineModal: () => void;
  onViewTraceabilityTag: (traceabilityNumber: string) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  setActiveTab,
  onOpenCreateRecordModal,
  onOpenCreateMachineModal,
  onViewTraceabilityTag,
}) => {
  const { db, currentUser } = useQMS();
  const isManagement = currentUser?.role === 'MANAGEMENT';

  // Executive filter state
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>('ALL');

  const totalMachines = db.machines.length;
  const machinesInProduction = db.machines.filter((m) => m.manufacturingStatus === 'IN_PRODUCTION').length;
  const criticalComponents = db.components.filter((c) => c.criticalComponent).length;
  const totalManufacturingRecords = db.manufacturingRecords.length;

  const awaitingInspection = db.manufacturingRecords.filter(
    (r) => r.manufacturingStatus === 'AWAITING_INSPECTION'
  );
  const inProductionRecords = db.manufacturingRecords.filter(
    (r) => r.manufacturingStatus === 'IN_PRODUCTION'
  );
  const onHoldRecords = db.manufacturingRecords.filter(
    (r) => r.manufacturingStatus === 'HOLD' || r.manufacturingStatus === 'FAIL' || r.manufacturingStatus === 'NCR_HOLD'
  );

  const releasedRecords = db.manufacturingRecords.filter((r) => r.manufacturingStatus === 'RELEASED');
  const activeNcrs = db.ncrs.filter((n) => n.status !== 'CLOSED');
  const approvedDeviations = db.deviations.filter((d) => d.status === 'APPROVED');
  const totalInspectionSheets = db.daleInspections?.length || 0;

  if (isManagement) {
    const filteredMachines = selectedMachineFilter === 'ALL'
      ? db.machines
      : db.machines.filter((m) => m.serialNumber === selectedMachineFilter);

    return (
      <div className="space-y-6">
        {/* Top Executive Welcome & Governance Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-xl p-6 border border-indigo-900/50 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              EXECUTIVE MANAGEMENT OVERSIGHT — LEAST PRIVILEGE READ-ONLY
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-1">
              Executive Quality &amp; Fleet Operations Dashboard
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Factory-wide quality release compliance, 18-Point Gate barrier audits, active quarantine burndown,
              and machine release dossier verification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setActiveTab('reports')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Official Reports &amp; Dossiers</span>
            </button>
            <button
              onClick={() => generateExecutiveFleetSummaryPdf({ db })}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
              title="Download Executive Fleet Quality Summary PDF"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export Executive PDF</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Print View</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Fleet Production Status */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-blue-600" />
                Fleet Production
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px]">
                {machinesInProduction} in build
              </span>
            </div>
            <div className="text-3xl font-black text-slate-950 mt-2 font-mono">
              {totalMachines} <span className="text-sm font-semibold text-slate-500">Machines</span>
            </div>
            <div className="mt-3 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>In Production:</span>
                <strong className="text-slate-900">{machinesInProduction}</strong>
              </div>
              <div className="flex justify-between">
                <span>Planned / Staged:</span>
                <strong className="text-slate-900">{totalMachines - machinesInProduction}</strong>
              </div>
            </div>
          </div>

          {/* KPI 2: 18-Point Quality Gate Release Conformance */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Release Gate Health
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                {Math.round((releasedRecords.length / (totalManufacturingRecords || 1)) * 100)}% Pass
              </span>
            </div>
            <div className="text-3xl font-black text-slate-950 mt-2 font-mono">
              {releasedRecords.length} <span className="text-sm font-semibold text-slate-500">Released</span>
            </div>
            <div className="mt-3 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Awaiting Inspection:</span>
                <strong className="text-amber-700">{awaitingInspection.length}</strong>
              </div>
              <div className="flex justify-between">
                <span>Total Traceable:</span>
                <strong className="text-slate-900">{totalManufacturingRecords}</strong>
              </div>
            </div>
          </div>

          {/* KPI 3: Active Quarantine & NCRs */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Quarantine &amp; NCRs
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] ${activeNcrs.length === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800 font-bold'}`}>
                {activeNcrs.length === 0 ? 'Clear' : `${activeNcrs.length} Active`}
              </span>
            </div>
            <div className="text-3xl font-black text-slate-950 mt-2 font-mono">
              {activeNcrs.length} <span className="text-sm font-semibold text-slate-500">Open Holds</span>
            </div>
            <div className="mt-3 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Total Quarantined:</span>
                <strong className="text-rose-700">{onHoldRecords.length} parts</strong>
              </div>
              <div className="flex justify-between">
                <span>Closed / Resolved:</span>
                <strong className="text-emerald-700">{db.ncrs.filter((n) => n.status === 'CLOSED').length} NCRs</strong>
              </div>
            </div>
          </div>

          {/* KPI 4: Engineering Concessions & Inspection Throughput */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              <span className="flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-indigo-600" />
                Process Audits
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px]">
                {totalInspectionSheets} Sheets
              </span>
            </div>
            <div className="text-3xl font-black text-slate-950 mt-2 font-mono">
              {approvedDeviations.length} <span className="text-sm font-semibold text-slate-500">Concessions</span>
            </div>
            <div className="mt-3 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Redlines Attached:</span>
                <strong className="text-slate-900">{approvedDeviations.filter((d) => d.requiresRedline).length}</strong>
              </div>
              <div className="flex justify-between">
                <span>Approved Drawings:</span>
                <strong className="text-slate-900">{db.drawings.filter((d) => d.drawingStatus === 'APPROVED').length}</strong>
              </div>
            </div>
          </div>
        </div>

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
                {filteredMachines.map((m) => {
                  const mfgRecords = db.manufacturingRecords.filter((r) => r.machineSerialNumber === m.serialNumber);
                  const released = mfgRecords.filter((r) => r.manufacturingStatus === 'RELEASED').length;
                  const mNcrs = db.ncrs.filter((n) => n.machineSerialNumber === m.serialNumber && n.status !== 'CLOSED');
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-blue-700">
                        {m.serialNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {m.projectNumber}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-900 font-medium">
                        {m.customer}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {m.machineType}
                      </td>
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
                            style={{ width: `${Math.round((released / (mfgRecords.length || 1)) * 100)}%` }}
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
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 7 Dale Processes Quality Conformance Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider font-mono">
                Dale Automation — 7 Manufacturing Processes Quality Throughput
              </h2>
              <p className="text-xs text-slate-500">
                Independent process inspection sheets covering all factory workshops.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('reports')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 font-mono"
            >
              Inspect All Sheets &rarr;
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {[
              { title: 'Fabrication & Welding', count: (db.daleInspections || []).filter((s) => s.processType === 'FABRICATION_WELDING').length },
              { title: 'Machined Components', count: (db.daleInspections || []).filter((s) => s.processType === 'MACHINED_PARTS').length },
              { title: 'Conveyor Components', count: (db.daleInspections || []).filter((s) => s.processType === 'CONVEYOR_COMPONENTS').length },
              { title: 'Spiral Systems', count: (db.daleInspections || []).filter((s) => s.processType === 'SPIRAL_SYSTEMS').length },
              { title: 'Mechanical Assembly', count: (db.daleInspections || []).filter((s) => s.processType === 'ASSEMBLY').length },
              { title: 'Electrical Control Panels', count: (db.daleInspections || []).filter((s) => s.processType === 'ELECTRICAL_PANELS').length },
              { title: 'Final Manufacturing FAT', count: (db.daleInspections || []).filter((s) => s.processType === 'FINAL_MANUFACTURING').length },
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
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quality Release Rule Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white rounded-lg p-5 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-blue-300 font-semibold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Machine Department Quality Management System
          </div>
          <h2 className="text-xl font-black tracking-tight text-white mt-1">
            Manufacturing Quality & Traceability Dashboard
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            All critical components require drawing revision verification, unique traceability marking,
            and complete metrological inspection sign-off prior to machine assembly or client release.
          </p>
        </div>

        {/* Quick Launch Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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

      {/* LIME LINE: Interactive Holding Points & Deviations Timeline (Talks to Quality Release Gate) */}
      <DashboardLimeLine setActiveTab={setActiveTab} />

      {/* Warning Indicators (Section 21 & Phase 2 Quality Gates) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Awaiting Inspection Warning */}
        <div
          onClick={() => setActiveTab('dale-inspections')}
          className="cursor-pointer p-4 bg-amber-50 border border-amber-200 rounded-lg hover:border-amber-300 transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
              <Clock className="w-4 h-4 text-amber-600" />
              Awaiting Inspection
            </div>
            <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-mono font-bold text-xs">
              {awaitingInspection.length}
            </span>
          </div>
          <div className="text-2xl font-black text-amber-950 mt-2">
            {awaitingInspection.length} Component{awaitingInspection.length !== 1 ? 's' : ''}
          </div>
          <p className="text-xs text-amber-800 mt-1">
            Manufactured and waiting for QA quality inspection & drawing sign-off.
          </p>
        </div>

        {/* Quality Hold / NCRs Warning */}
        <div
          onClick={() => setActiveTab('ncr')}
          className="cursor-pointer p-4 bg-rose-50 border border-rose-200 rounded-lg hover:border-rose-300 transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-800 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              NCRs & Quality Hold
            </div>
            <span className="px-2 py-0.5 bg-rose-200 text-rose-900 rounded font-mono font-bold text-xs">
              {db.ncrs.filter((n) => n.status !== 'CLOSED').length}
            </span>
          </div>
          <div className="text-2xl font-black text-rose-950 mt-2">
            {db.ncrs.filter((n) => n.status !== 'CLOSED').length} Active NCR{db.ncrs.filter((n) => n.status !== 'CLOSED').length !== 1 ? 's' : ''}
          </div>
          <p className="text-xs text-rose-800 mt-1">
            Components quarantined due to tolerance non-conformance or defect containment.
          </p>
        </div>

        {/* Quality Release Gate Ready */}
        <div
          onClick={() => setActiveTab('quality-release')}
          className="cursor-pointer p-4 bg-emerald-50 border border-emerald-200 rounded-lg hover:border-emerald-300 transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Quality Release Gate
            </div>
            <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded font-mono font-bold text-xs">
              {db.manufacturingRecords.filter((r) => r.manufacturingStatus === 'INSPECTION_PASSED').length} Ready
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-2">
            {db.manufacturingRecords.filter((r) => r.manufacturingStatus === 'INSPECTION_PASSED').length} Ready
          </div>
          <p className="text-xs text-emerald-800 mt-1">
            Inspection passed. Ready for 15-point Quality Release evaluation & certificate.
          </p>
        </div>

        {/* Active Machine Line Indicator */}
        <div
          onClick={() => setActiveTab('machines')}
          className="cursor-pointer p-4 bg-sky-50 border border-sky-200 rounded-lg hover:border-sky-300 transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-800 text-xs font-bold uppercase tracking-wider">
              <Cpu className="w-4 h-4 text-sky-600" />
              Divider Build Status
            </div>
            <span className="px-2 py-0.5 bg-sky-200 text-sky-900 rounded font-mono font-bold text-xs">
              {machinesInProduction} in shop
            </span>
          </div>
          <div className="text-2xl font-black text-sky-950 mt-2">{totalMachines} Machines</div>
          <p className="text-xs text-sky-800 mt-1">
            Active Divider serial numbers linked with project numbers and critical parts.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Machines In Production</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{machinesInProduction}</div>
          <div className="text-[11px] text-slate-400 mt-1">Divider line assemblies</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Critical Components</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{criticalComponents}</div>
          <div className="text-[11px] text-slate-400 mt-1">Mandatory QMS release</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Manufacturing Records</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalManufacturingRecords}</div>
          <div className="text-[11px] text-slate-400 mt-1">Unique traceability assigned</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Approved Drawings</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {db.drawings.filter((d) => d.drawingStatus === 'APPROVED').length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Valid for shop production</div>
        </div>
      </div>

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
              {db.manufacturingRecords.slice(0, 5).map((rec) => (
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
              ))}
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
  );
};
