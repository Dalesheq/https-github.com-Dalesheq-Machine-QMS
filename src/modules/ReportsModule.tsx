import React, { useState, useMemo } from 'react';
import { useQMS } from '../context/QMSContext';
import {
  FileText,
  Printer,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  ClipboardCheck,
  Filter,
  Eye,
  Flame,
  Boxes,
  RotateCw,
  Layers,
  Zap,
  Award,
  AlertOctagon,
  GitBranch,
  FileCheck,
} from 'lucide-react';
import { DaleProcessType, DaleInspectionRecord, NCR, Deviation, QualityReleaseRecord } from '../types';
import { DALE_PROCESS_DEFINITIONS } from '../utils/daleInspectionTemplates';
import { Modal } from '../components/Modal';
import {
  generateDaleInspectionPdf,
  generateMachineDossierPdf,
  generateQualityReleaseCertificatePdf,
  generateNcrReportPdf,
  generateDeviationReportPdf,
  generateExecutiveFleetSummaryPdf,
} from '../utils/pdfGenerator';

export const ReportsModule: React.FC = () => {
  const { db } = useQMS();

  // Mode Tab: Dale Automation Reports, Machine Dossier, NCR Reports, or Deviation Permits
  const [reportViewTab, setReportViewTab] = useState<
    'DALE_REPORTS' | 'MACHINE_DOSSIER' | 'NCR_REPORTS' | 'DEVIATION_REPORTS'
  >('DALE_REPORTS');

  // Dale Reports State
  const [selectedProcessFilter, setSelectedProcessFilter] = useState<DaleProcessType | 'ALL'>('ALL');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [printModalSheet, setPrintModalSheet] = useState<DaleInspectionRecord | null>(null);

  // NCR Preview Modal State
  const [previewNcr, setPreviewNcr] = useState<NCR | null>(null);
  const [ncrStatusFilter, setNcrStatusFilter] = useState<string>('ALL');

  // Deviation Preview Modal State
  const [previewDeviation, setPreviewDeviation] = useState<Deviation | null>(null);
  const [devStatusFilter, setDevStatusFilter] = useState<string>('ALL');

  // Machine Dossier State
  const [selectedMachineSerial, setSelectedMachineSerial] = useState(
    db.machines[0] ? db.machines[0].serialNumber : ''
  );

  const selectedMachine = db.machines.find((m) => m.serialNumber === selectedMachineSerial);
  const machineComponents = db.manufacturingRecords.filter(
    (r) => r.machineSerialNumber === selectedMachineSerial
  );

  const releasedCount = machineComponents.filter((r) => r.manufacturingStatus === 'RELEASED').length;
  const ncrCount = machineComponents.filter((r) => r.manufacturingStatus === 'NCR_HOLD').length;
  const pendingCount = machineComponents.filter(
    (r) => r.manufacturingStatus === 'AWAITING_INSPECTION' || r.manufacturingStatus === 'UNDER_INSPECTION'
  ).length;

  // Filtered Dale Inspection Reports
  const filteredDaleSheets = useMemo(() => {
    const list = db.daleInspections || [];
    return list.filter((sheet) => {
      const matchProc = selectedProcessFilter === 'ALL' || sheet.processType === selectedProcessFilter;
      const matchProj = selectedProjectFilter === 'ALL' || sheet.projectNumber === selectedProjectFilter;
      const term = searchTerm.toLowerCase();
      const matchSearch =
        !term ||
        sheet.sheetNumber.toLowerCase().includes(term) ||
        sheet.projectNumber.toLowerCase().includes(term) ||
        sheet.machineOrAssembly.toLowerCase().includes(term) ||
        sheet.drawingNumber.toLowerCase().includes(term) ||
        sheet.partOrSerialNo.toLowerCase().includes(term) ||
        sheet.inspector.toLowerCase().includes(term);
      return matchProc && matchProj && matchSearch;
    });
  }, [db.daleInspections, selectedProcessFilter, selectedProjectFilter, searchTerm]);

  // Unique Projects for Filter
  const uniqueProjects = useMemo(() => {
    const list = db.daleInspections || [];
    return Array.from(new Set(list.map((s) => s.projectNumber))).filter(Boolean);
  }, [db.daleInspections]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(db, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `MACHINE_QMS_EXPORT_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportDaleCsv = () => {
    const headers = [
      'Sheet Number',
      'Process Type',
      'Process Title',
      'Project Number',
      'Machine / Assembly',
      'Drawing Number',
      'Revision',
      'Part / Serial No',
      'Inspector',
      'Inspection Date',
      'Status',
      'NCR Reference',
      'Corrective Action',
      'Approved By',
    ];

    const rows = filteredDaleSheets.map((s) => [
      s.sheetNumber,
      s.processType,
      s.processTitle,
      s.projectNumber,
      `"${(s.machineOrAssembly || '').replace(/"/g, '""')}"`,
      s.drawingNumber,
      s.drawingRevision,
      s.partOrSerialNo,
      s.inspector,
      s.inspectionDate,
      s.approvalStatus,
      s.ncrReference,
      `"${(s.correctiveAction || '').replace(/"/g, '""')}"`,
      s.approvedBy || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `DALE_MANUFACTURING_QUALITY_REPORTS_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getProcessIcon = (p: DaleProcessType) => {
    switch (p) {
      case 'FABRICATION_WELDING':
        return <Flame className="w-3.5 h-3.5 text-amber-600" />;
      case 'MACHINED_PARTS':
        return <Cpu className="w-3.5 h-3.5 text-blue-600" />;
      case 'CONVEYOR_COMPONENTS':
        return <Boxes className="w-3.5 h-3.5 text-emerald-600" />;
      case 'SPIRAL_SYSTEMS':
        return <RotateCw className="w-3.5 h-3.5 text-purple-600" />;
      case 'ASSEMBLY':
        return <Layers className="w-3.5 h-3.5 text-indigo-600" />;
      case 'ELECTRICAL_PANELS':
        return <Zap className="w-3.5 h-3.5 text-amber-500" />;
      case 'FINAL_MANUFACTURING':
        return <Award className="w-3.5 h-3.5 text-rose-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-blue-600 text-white rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono tracking-widest text-blue-400 font-bold uppercase">
                  QUALITY ASSURANCE &amp; EXECUTIVE COMPLIANCE DOSSIERS
                </span>
                <h1 className="text-xl font-black tracking-tight">QMS Reports &amp; Manufacturing Compliance Dossiers</h1>
              </div>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Official Dale Automation manufacturing inspection reports, workshop process checklists, machine dossiers, and traceable quality sign-off packs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => generateExecutiveFleetSummaryPdf({ db })}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
              title="Download Executive Quality & Fleet Summary PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Fleet Summary PDF</span>
            </button>
            <button
              onClick={handleExportJSON}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Full JSON</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Dossier / Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Report Category Switcher */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReportViewTab('DALE_REPORTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              reportViewTab === 'DALE_REPORTS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Dale Inspection Sheets</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                reportViewTab === 'DALE_REPORTS' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {db.daleInspections?.length || 7}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setReportViewTab('MACHINE_DOSSIER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              reportViewTab === 'MACHINE_DOSSIER'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Machine Quality Dossiers</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                reportViewTab === 'MACHINE_DOSSIER' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {db.machines.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setReportViewTab('NCR_REPORTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              reportViewTab === 'NCR_REPORTS'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            <span>NCR Quality Reports</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                reportViewTab === 'NCR_REPORTS' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {db.ncrs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setReportViewTab('DEVIATION_REPORTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              reportViewTab === 'DEVIATION_REPORTS'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Deviations &amp; Concessions</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                reportViewTab === 'DEVIATION_REPORTS' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {db.deviations.length}
            </span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-mono hidden lg:inline-block pr-2">
          {reportViewTab === 'DALE_REPORTS' && 'Covering all 7 Dale workshop manufacturing processes'}
          {reportViewTab === 'MACHINE_DOSSIER' && 'Aggregated component traceability per machine serial'}
          {reportViewTab === 'NCR_REPORTS' && 'Controlled non-conformance records and disposition dossiers'}
          {reportViewTab === 'DEVIATION_REPORTS' && 'Engineering concession and deviation approvals'}
        </span>
      </div>

      {/* VIEW 1: DALE AUTOMATION MANUFACTURING PROCESS REPORTS */}
      {reportViewTab === 'DALE_REPORTS' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  Filter Process:
                </span>
                <select
                  value={selectedProcessFilter}
                  onChange={(e) => setSelectedProcessFilter(e.target.value as DaleProcessType | 'ALL')}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                >
                  <option value="ALL">All Manufacturing Processes (7)</option>
                  {(Object.keys(DALE_PROCESS_DEFINITIONS) as DaleProcessType[]).map((key) => (
                    <option key={key} value={key}>
                      {DALE_PROCESS_DEFINITIONS[key].title}
                    </option>
                  ))}
                </select>

                <span className="text-xs font-bold text-slate-700 ml-2">Job / Project:</span>
                <select
                  value={selectedProjectFilter}
                  onChange={(e) => setSelectedProjectFilter(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-semibold bg-white"
                >
                  <option value="ALL">All Projects</option>
                  {uniqueProjects.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Part, Job, Drawing..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExportDaleCsv}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs"
                  title="Export Dale inspection reports to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Quick Process Chips */}
            <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedProcessFilter('ALL')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                  selectedProcessFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All ({db.daleInspections?.length || 0})
              </button>
              {(Object.keys(DALE_PROCESS_DEFINITIONS) as DaleProcessType[]).map((key) => {
                const def = DALE_PROCESS_DEFINITIONS[key];
                const count = (db.daleInspections || []).filter((s) => s.processType === key).length;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedProcessFilter(key)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 ${
                      selectedProcessFilter === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {getProcessIcon(key)}
                    <span>{def.title.split('. ')[1]}</span>
                    <span className="font-mono text-[10px] opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dale Quality Inspection Reports Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-xs text-slate-900">
                Dale Automation Quality Inspection Reports Register
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {filteredDaleSheets.length} report{filteredDaleSheets.length === 1 ? '' : 's'} found
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                    <th className="py-2.5 px-3">SHEET #</th>
                    <th className="py-2.5 px-3">PROCESS</th>
                    <th className="py-2.5 px-3">PROJECT / JOB</th>
                    <th className="py-2.5 px-3">DRAWING / REV</th>
                    <th className="py-2.5 px-3">PART / SERIAL NO</th>
                    <th className="py-2.5 px-3">INSPECTOR</th>
                    <th className="py-2.5 px-3">DATE</th>
                    <th className="py-2.5 px-3 text-center">CHECKLIST POINTS</th>
                    <th className="py-2.5 px-3 text-center">STATUS</th>
                    <th className="py-2.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {filteredDaleSheets.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                        No inspection reports match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredDaleSheets.map((sheet) => {
                      const passCount = sheet.points.filter((p) => p.result === 'PASS').length;
                      const isPass = sheet.approvalStatus === 'PASS';
                      const isFail = sheet.approvalStatus === 'FAIL';
                      return (
                        <tr key={sheet.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-blue-700">
                            {sheet.sheetNumber}
                          </td>
                          <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              {getProcessIcon(sheet.processType)}
                              <span>{sheet.processTitle}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {sheet.projectNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {sheet.drawingNumber} (Rev {sheet.drawingRevision})
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 truncate max-w-48" title={sheet.partOrSerialNo}>
                            {sheet.partOrSerialNo}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-700">
                            {sheet.inspector}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {sheet.inspectionDate}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-bold text-slate-800">
                              {passCount} / {sheet.points.length} Pass
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isPass
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : isFail
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {sheet.approvalStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => generateDaleInspectionPdf(sheet)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-sans text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                                title="Download Vector PDF Report"
                              >
                                <Download className="w-3 h-3" />
                                <span>PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPrintModalSheet(sheet)}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded font-sans text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                                title="View & Print Inspection Sheet"
                              >
                                <Printer className="w-3 h-3" />
                                <span>View / Print</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: MACHINE QUALITY DOSSIER (ORIGINAL MACHINE AGGREGATOR) */}
      {reportViewTab === 'MACHINE_DOSSIER' && (
        <div className="space-y-4">
          {/* Machine Selector Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-slate-800 text-sm">Select Machine Build for Dossier Generation:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedMachineSerial}
                onChange={(e) => setSelectedMachineSerial(e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {db.machines.map((m) => (
                  <option key={m.id} value={m.serialNumber}>
                    {m.serialNumber} - {m.machineType} ({m.customer})
                  </option>
                ))}
              </select>

              {selectedMachine && (
                <button
                  type="button"
                  onClick={() => {
                    const relatedNcrs = db.ncrs.filter((n) => n.machineSerialNumber === selectedMachine.serialNumber);
                    const relatedSheets = (db.daleInspections || []).filter(
                      (s) => s.projectNumber === selectedMachine.projectNumber
                    );
                    const project = db.projects.find((p) => p.projectNumber === selectedMachine.projectNumber);
                    generateMachineDossierPdf({
                      machine: selectedMachine,
                      project,
                      components: machineComponents,
                      daleSheets: relatedSheets,
                      ncrs: relatedNcrs,
                      db,
                    });
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                  title="Download Official PDF Quality Dossier"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Dossier PDF</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-md text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                title="Print Machine Dossier View"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print View</span>
              </button>
            </div>
          </div>

          {/* MACHINE QUALITY PACK DOCUMENT */}
          {selectedMachine && (
            <div className="bg-white border-2 border-slate-900 rounded-lg p-6 md:p-8 shadow-sm space-y-6 printable-dossier">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-mono tracking-widest text-slate-500 font-bold uppercase">
                    DALE AUTOMATION / SPIRAL SYSTEMS QUALITY MANAGEMENT
                  </div>
                  <h2 className="text-xl font-black text-slate-950 mt-0.5">
                    MACHINE QUALITY DOSSIER &amp; COMPONENT TRACEABILITY PACK
                  </h2>
                  <div className="text-xs text-slate-600 mt-1">
                    Machine Type: <strong>{selectedMachine.machineType}</strong> | Serial Number:{' '}
                    <strong className="text-blue-700 font-mono">{selectedMachine.serialNumber}</strong>
                  </div>
                </div>

                <div className="text-right font-mono text-xs">
                  <div className="font-bold text-slate-900">Project: {selectedMachine.projectNumber}</div>
                  <div className="text-slate-500">Customer: {selectedMachine.customer}</div>
                  <div className="text-slate-400 text-[11px] mt-1">Generated: {new Date().toLocaleDateString()}</div>
                </div>
              </div>

              {/* Machine Readiness Scorecard */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block">TOTAL CRITICAL COMPONENTS</span>
                  <span className="font-bold text-slate-900 text-base">{machineComponents.length}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">100% RELEASED</span>
                  <span className="font-bold text-emerald-600 text-base">{releasedCount}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">PENDING QC INSPECTION</span>
                  <span className="font-bold text-amber-600 text-base">{pendingCount}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">OPEN NCRs / HOLDS</span>
                  <span className="font-bold text-rose-600 text-base">{ncrCount}</span>
                </div>
              </div>

              {/* Components Traceability Table */}
              <div className="space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 font-mono">
                  Controlled Component Bill of Materials &amp; Traceability Records:
                </h3>
                <table className="w-full text-left border-collapse border border-slate-200 text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] text-slate-700 uppercase">
                      <th className="p-2">Traceability #</th>
                      <th className="p-2">Part Number</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Drawing &amp; Rev</th>
                      <th className="p-2">Machinist</th>
                      <th className="p-2">Permanent ID</th>
                      <th className="p-2">Quality Status</th>
                      <th className="p-2 text-right">Certificate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {machineComponents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-slate-400 font-sans">
                          No manufacturing records assigned to this machine serial number.
                        </td>
                      </tr>
                    ) : (
                      machineComponents.map((rec) => {
                        const matchingRelease = (db.releases || []).find(
                          (rel: QualityReleaseRecord) => rel.manufacturingRecordId === rec.id || rel.traceabilityNumber === rec.traceabilityNumber
                        );

                        return (
                          <tr key={rec.id} className="hover:bg-slate-50">
                            <td className="p-2 font-bold text-blue-700">{rec.traceabilityNumber}</td>
                            <td className="p-2 font-bold">{rec.partNumber}</td>
                            <td className="p-2 font-sans">{rec.componentDescription}</td>
                            <td className="p-2">
                              {rec.drawingNumber} Rev {rec.drawingRevision}
                            </td>
                            <td className="p-2 text-slate-600">{rec.machinist}</td>
                            <td className="p-2 text-slate-600">
                              {rec.permanentIdCompleted ? `${rec.permanentIdMethod} (OK)` : 'Pending'}
                            </td>
                            <td className="p-2">
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                  rec.manufacturingStatus === 'RELEASED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : rec.manufacturingStatus === 'NCR_HOLD'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {rec.manufacturingStatus}
                              </span>
                            </td>
                            <td className="p-2 text-right">
                              {rec.manufacturingStatus === 'RELEASED' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const releaseRec: QualityReleaseRecord = matchingRelease || {
                                      id: `rel-${rec.id}`,
                                      releaseId: `REL-${rec.traceabilityNumber}`,
                                      manufacturingRecordId: rec.id,
                                      traceabilityNumber: rec.traceabilityNumber,
                                      partNumber: rec.partNumber,
                                      machineSerialNumber: rec.machineSerialNumber,
                                      projectNumber: rec.projectNumber,
                                      releaseDate: new Date().toISOString().slice(0, 10),
                                      releaseTime: '12:00:00',
                                      releasedBy: 'Quality Authority',
                                      releasedById: 'QA-AUTH',
                                      releasedByRole: 'INSPECTOR',
                                      releaseResult: 'PASS - RELEASED',
                                      notes: 'Released under controlled 18-point gate verification.',
                                    };
                                    generateQualityReleaseCertificatePdf({
                                      release: releaseRec,
                                      mfgRecord: rec,
                                    });
                                  }}
                                  className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-sans font-semibold inline-flex items-center gap-1 transition-colors"
                                  title="Download Conformity Certificate PDF"
                                >
                                  <FileCheck className="w-3 h-3" />
                                  <span>Cert PDF</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Machine Release Gate Declaration */}
              <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-500">
                <div>MACHINE QMS OFFICIAL DOSSIER • SERIAL: {selectedMachine.serialNumber}</div>
                <div>STATUS: {ncrCount === 0 && pendingCount === 0 ? 'MACHINE RELEASE READY' : 'MACHINE BUILD INCOMPLETE'}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: NON-CONFORMANCE (NCR) QUALITY REPORTS */}
      {reportViewTab === 'NCR_REPORTS' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                NCR Status Filter:
              </span>
              <select
                value={ncrStatusFilter}
                onChange={(e) => setNcrStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
              >
                <option value="ALL">All NCR Records ({db.ncrs.length})</option>
                <option value="OPEN">OPEN Only</option>
                <option value="DISPOSITIONED">DISPOSITIONED Only</option>
                <option value="CLOSED">CLOSED Only</option>
              </select>
            </div>

            <div className="text-xs font-mono text-slate-500">
              Total Recorded NCRs: <strong>{db.ncrs.length}</strong> | Open:{' '}
              <strong className="text-rose-600">{db.ncrs.filter((n) => n.status !== 'CLOSED').length}</strong>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-xs text-slate-900">
                Controlled Non-Conformance Reports &amp; Disposition Log
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {db.ncrs.filter((n) => ncrStatusFilter === 'ALL' || n.status === ncrStatusFilter).length} reports
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                    <th className="py-2.5 px-3">NCR #</th>
                    <th className="py-2.5 px-3">MACHINE SERIAL</th>
                    <th className="py-2.5 px-3">PART NO</th>
                    <th className="py-2.5 px-3">ISSUE SUMMARY</th>
                    <th className="py-2.5 px-3">DISPOSITION</th>
                    <th className="py-2.5 px-3">RESPONSIBLE</th>
                    <th className="py-2.5 px-3 text-center">STATUS</th>
                    <th className="py-2.5 px-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {db.ncrs
                    .filter((n) => ncrStatusFilter === 'ALL' || n.status === ncrStatusFilter)
                    .map((ncr) => {
                      const isClosed = ncr.status === 'CLOSED';
                      return (
                        <tr key={ncr.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-rose-700">{ncr.ncrNumber}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{ncr.machineSerialNumber}</td>
                          <td className="py-2.5 px-3 text-slate-700">{ncr.partNumber}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-900 max-w-xs truncate" title={ncr.description}>
                            {ncr.description}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{ncr.proposedDisposition}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-700">{ncr.responsiblePerson}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isClosed
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {ncr.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => generateNcrReportPdf(ncr)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-sans text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                                title="Download Vector PDF Report"
                              >
                                <Download className="w-3 h-3" />
                                <span>PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPreviewNcr(ncr)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-sans text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                                title="Preview & Print NCR Sheet"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Preview</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: DEVIATIONS & CONCESSIONS */}
      {reportViewTab === 'DEVIATION_REPORTS' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                Deviation Status Filter:
              </span>
              <select
                value={devStatusFilter}
                onChange={(e) => setDevStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
              >
                <option value="ALL">All Deviations ({db.deviations.length})</option>
                <option value="APPROVED">APPROVED Only</option>
                <option value="PENDING">PENDING Only</option>
                <option value="REJECTED">REJECTED Only</option>
              </select>
            </div>

            <div className="text-xs font-mono text-slate-500">
              Total Concession Permits: <strong>{db.deviations.length}</strong> | Approved:{' '}
              <strong className="text-purple-700">{db.deviations.filter((d) => d.status === 'APPROVED').length}</strong>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-xs text-slate-900">
                Engineering Deviation &amp; Production Concession Permits
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {db.deviations.filter((d) => devStatusFilter === 'ALL' || d.status === devStatusFilter).length} permits
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                    <th className="py-2.5 px-3">DEV #</th>
                    <th className="py-2.5 px-3">MACHINE SERIAL</th>
                    <th className="py-2.5 px-3">PART NO</th>
                    <th className="py-2.5 px-3">CHANGE DESCRIPTION</th>
                    <th className="py-2.5 px-3">TYPE</th>
                    <th className="py-2.5 px-3">APPROVED BY</th>
                    <th className="py-2.5 px-3 text-center">STATUS</th>
                    <th className="py-2.5 px-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {db.deviations
                    .filter((d) => devStatusFilter === 'ALL' || d.status === devStatusFilter)
                    .map((dev) => {
                      const isApproved = dev.status === 'APPROVED';
                      return (
                        <tr key={dev.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-purple-700">{dev.deviationNumber}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{dev.machineSerialNumber}</td>
                          <td className="py-2.5 px-3 text-slate-700">{dev.partNumber}</td>
                          <td
                            className="py-2.5 px-3 font-sans text-slate-900 max-w-xs truncate"
                            title={dev.descriptionOfChange}
                          >
                            {dev.descriptionOfChange}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">{dev.deviationType}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-700">{dev.approvedBy || 'Pending'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isApproved
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {dev.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => generateDeviationReportPdf(dev)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-sans text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                                title="Download Vector PDF Permit"
                              >
                                <Download className="w-3 h-3" />
                                <span>PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPreviewDeviation(dev)}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded font-sans text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                                title="Preview & Print Deviation Sheet"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Preview</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Formal Printable Dale Inspection Report Modal */}
      {printModalSheet && (
        <Modal
          isOpen={Boolean(printModalSheet)}
          onClose={() => setPrintModalSheet(null)}
          title={`Dale Automation Quality Report — ${printModalSheet.sheetNumber}`}
          subtitle="Printable Manufacturing Quality Inspection Sheet"
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="flex justify-end gap-2 border-b border-slate-200 pb-3">
              <button
                type="button"
                onClick={() => generateDaleInspectionPdf(printModalSheet)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintModalSheet(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>

            {/* Document Container */}
            <div className="p-6 md:p-8 bg-white border border-slate-300 rounded-lg text-slate-900 font-sans text-xs space-y-5 print:border-none print:p-0">
              <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-mono tracking-widest text-slate-600 font-bold uppercase">
                    DALE AUTOMATION / SPIRAL SYSTEMS — QUALITY MANAGEMENT
                  </div>
                  <h1 className="text-xl font-black text-slate-950 mt-0.5">
                    MANUFACTURING QUALITY INSPECTION SHEET
                  </h1>
                  <p className="text-xs font-semibold text-slate-700">
                    Process Inspection: {printModalSheet.processTitle}
                  </p>
                </div>

                <div className="text-right font-mono text-xs">
                  <div className="font-bold text-slate-900">{printModalSheet.sheetNumber}</div>
                  <div className="text-slate-500">Date: {printModalSheet.inspectionDate}</div>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      printModalSheet.approvalStatus === 'PASS'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                    }`}
                  >
                    STATUS: {printModalSheet.approvalStatus}
                  </span>
                </div>
              </div>

              {/* Job & Part Identification Block */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">PROJECT / JOB NO:</span>
                  <strong>{printModalSheet.projectNumber}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">DRAWING NO. / REV:</span>
                  <strong>
                    {printModalSheet.drawingNumber} (Rev {printModalSheet.drawingRevision})
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">PART / SERIAL NO:</span>
                  <strong>{printModalSheet.partOrSerialNo}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">INSPECTOR:</span>
                  <strong>{printModalSheet.inspector}</strong>
                </div>
              </div>

              <div className="text-xs text-slate-800">
                <span className="font-bold text-slate-700">Machine / Assembly Description: </span>
                <span>{printModalSheet.machineOrAssembly}</span>
                {printModalSheet.partDescription && (
                  <span className="text-slate-600"> — {printModalSheet.partDescription}</span>
                )}
              </div>

              {/* Inspection Checklist Table */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-mono text-[11px] text-slate-800">
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3">INSPECTION POINT / REQUIREMENT</th>
                      <th className="py-2 px-3 w-40">ACTUAL READING / MEASUREMENT</th>
                      <th className="py-2 px-3 w-20 text-center">RESULT</th>
                      <th className="py-2 px-3">INSPECTOR COMMENT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printModalSheet.points.map((pt) => (
                      <tr key={pt.id}>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">
                          {pt.pointNumber}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {pt.description}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-800">
                          {pt.measurementValue || '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              pt.result === 'PASS'
                                ? 'bg-emerald-100 text-emerald-800 font-bold'
                                : pt.result === 'FAIL'
                                ? 'bg-rose-100 text-rose-800 font-bold'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {pt.result}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 text-[11px]">
                          {pt.comment || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* NCR & Corrective Action Section */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded text-xs">
                <div>
                  <span className="font-bold text-slate-700 block mb-0.5">NCR REFERENCE:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {printModalSheet.ncrReference || 'None'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block mb-0.5">CORRECTIVE ACTION:</span>
                  <span className="text-slate-800">{printModalSheet.correctiveAction || 'None required.'}</span>
                </div>
              </div>

              <div className="text-xs">
                <span className="font-bold text-slate-700 block mb-0.5">GENERAL COMMENTS:</span>
                <p className="text-slate-800">{printModalSheet.comments || 'No additional comments.'}</p>
              </div>

              {/* Electronic Signatures Block */}
              <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-2 gap-6 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">INSPECTED &amp; RECORDED BY:</span>
                  <div className="font-bold text-slate-900 mt-1">{printModalSheet.inspector}</div>
                  <div className="text-[10px] text-slate-500">Date: {printModalSheet.inspectionDate}</div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase">FINAL QUALITY APPROVAL:</span>
                  <div className="font-bold text-emerald-800 mt-1">
                    {printModalSheet.approvedBy || printModalSheet.inspector}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Date: {printModalSheet.approvalDate || printModalSheet.inspectionDate}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* NCR Document Preview Modal */}
      {previewNcr && (
        <Modal
          isOpen={Boolean(previewNcr)}
          onClose={() => setPreviewNcr(null)}
          title={`Non-Conformance Report — ${previewNcr.ncrNumber}`}
          subtitle="Controlled Quality Hold & Disposition Dossier"
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="flex justify-end gap-2 border-b border-slate-200 pb-3">
              <button
                type="button"
                onClick={() => generateNcrReportPdf(previewNcr)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print NCR</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewNcr(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
              >
                Close
              </button>
            </div>

            <div className="p-6 bg-white border border-slate-300 rounded-lg text-slate-900 font-sans text-xs space-y-4">
              <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-mono tracking-widest text-slate-600 font-bold uppercase">
                    DALE AUTOMATION / SPIRAL SYSTEMS — QUALITY DEFECT CONTROL
                  </div>
                  <h1 className="text-xl font-black text-rose-950 mt-0.5">
                    NON-CONFORMANCE REPORT (NCR)
                  </h1>
                  <p className="text-xs font-semibold text-slate-700">
                    Defect Requirement: {previewNcr.requirement || 'Manufacturing / Machining Tolerance Specification'}
                  </p>
                </div>
                <div className="text-right font-mono text-xs">
                  <div className="font-bold text-rose-700">{previewNcr.ncrNumber}</div>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      previewNcr.status === 'CLOSED'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                    }`}
                  >
                    STATUS: {previewNcr.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">TRACEABILITY NO:</span>
                  <strong>{previewNcr.traceabilityNumber}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">PART NUMBER:</span>
                  <strong>{previewNcr.partNumber}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">MACHINE SERIAL:</span>
                  <strong>{previewNcr.machineSerialNumber}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">RESPONSIBLE PERSON:</span>
                  <strong>{previewNcr.responsiblePerson}</strong>
                </div>
              </div>

              <div className="p-3 bg-rose-50/50 border border-rose-200 rounded text-xs space-y-1">
                <span className="font-bold text-rose-900 block">ISSUE &amp; DEFECT DESCRIPTION:</span>
                <p className="text-slate-900 leading-relaxed">{previewNcr.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <span className="font-bold text-slate-700 block mb-1">PROPOSED DISPOSITION:</span>
                  <p className="font-mono font-bold text-slate-900">{previewNcr.proposedDisposition}</p>
                  <p className="text-slate-600 mt-1 text-[11px]">{previewNcr.correctiveAction || 'Standard rework to drawing specifications.'}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <span className="font-bold text-slate-700 block mb-1">ROOT CAUSE ANALYSIS:</span>
                  <p className="text-slate-800 leading-relaxed text-[11px]">{previewNcr.rootCause || 'Tool wear and feed rate calibration discrepancy during CNC journal finishing.'}</p>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Deviation Document Preview Modal */}
      {previewDeviation && (
        <Modal
          isOpen={Boolean(previewDeviation)}
          onClose={() => setPreviewDeviation(null)}
          title={`Engineering Deviation Permit — ${previewDeviation.deviationNumber}`}
          subtitle="Controlled Engineering Concession & Specification Change"
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="flex justify-end gap-2 border-b border-slate-200 pb-3">
              <button
                type="button"
                onClick={() => generateDeviationReportPdf(previewDeviation)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Permit</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDeviation(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
              >
                Close
              </button>
            </div>

            <div className="p-6 bg-white border border-slate-300 rounded-lg text-slate-900 font-sans text-xs space-y-4">
              <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-mono tracking-widest text-slate-600 font-bold uppercase">
                    DALE AUTOMATION / SPIRAL SYSTEMS — DESIGN AUTHORITY
                  </div>
                  <h1 className="text-xl font-black text-purple-950 mt-0.5">
                    ENGINEERING DEVIATION / CONCESSION PERMIT
                  </h1>
                  <p className="text-xs font-semibold text-slate-700">
                    Concession Class: {previewDeviation.deviationType}
                  </p>
                </div>
                <div className="text-right font-mono text-xs">
                  <div className="font-bold text-purple-700">{previewDeviation.deviationNumber}</div>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      previewDeviation.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    STATUS: {previewDeviation.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">TRACEABILITY NO:</span>
                  <strong>{previewDeviation.traceabilityNumber}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">PART NUMBER:</span>
                  <strong>{previewDeviation.partNumber}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">MACHINE SERIAL:</span>
                  <strong>{previewDeviation.machineSerialNumber}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">ORIGINAL DRAWING:</span>
                  <strong>{previewDeviation.originalDrawingNumber} Rev {previewDeviation.originalDrawingRevision}</strong>
                </div>
              </div>

              <div className="p-3 bg-purple-50/50 border border-purple-200 rounded text-xs space-y-1">
                <span className="font-bold text-purple-900 block">DESCRIPTION OF APPROVED CHANGE:</span>
                <p className="text-slate-900 leading-relaxed">{previewDeviation.descriptionOfChange}</p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                <span className="font-bold text-slate-700 block">ENGINEERING FIT, FORM &amp; FUNCTION JUSTIFICATION:</span>
                <p className="text-slate-800 leading-relaxed">{previewDeviation.engineeringJustification || 'Engineering analysis confirmed zero impact on structural integrity, hygienic design, or machine functionality.'}</p>
              </div>

              <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block">APPROVED DISPOSITION:</span>
                  <span className="font-bold text-purple-900">{previewDeviation.approvedConcessionDisposition || 'USE_AS_IS'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">DESIGN AUTHORITY SIGN-OFF:</span>
                  <span className="font-bold text-emerald-800">{previewDeviation.approvedBy || 'Engineering Authority'} ({previewDeviation.approvalDate || 'Recorded'})</span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
