import React, { useState, useMemo, useEffect } from 'react';
import { useQMS } from '../context/QMSContext';
import { ManufacturingRecord, PermanentIdMethod } from '../types';
import { getDrawingCrossReferences } from '../utils/crossReference';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import {
  Hammer,
  Plus,
  Search,
  Tag,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  History,
  FileSpreadsheet,
  FolderKanban,
  Cpu,
  Boxes,
  ExternalLink,
  Eye,
  Trash2,
  Layers,
} from 'lucide-react';

interface ManufacturingModuleProps {
  onViewTraceabilityTag: (traceabilityNumber: string) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
}

export const ManufacturingModule: React.FC<ManufacturingModuleProps> = ({
  onViewTraceabilityTag,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) => {
  const {
    db,
    currentUser,
    addManufacturingRecord,
    completePermanentIdentification,
    deleteManufacturingRecord,
    clearCollectionList,
    crossNavTarget,
    navigateToCrossRef,
    clearCrossNavTarget,
  } = useQMS();

  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const [confirmDeleteMfgId, setConfirmDeleteMfgId] = useState<string | null>(null);
  const [confirmClearMfgList, setConfirmClearMfgList] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedRecordDossier, setSelectedRecordDossier] = useState<ManufacturingRecord | null>(null);

  // Handle cross-module navigation into ManufacturingModule
  useEffect(() => {
    if (crossNavTarget && crossNavTarget.tab === 'manufacturing') {
      if (crossNavTarget.searchQuery) {
        setSearchTerm(crossNavTarget.searchQuery);
        setStatusFilter('ALL');
        const matched = db.manufacturingRecords.find(
          (r) =>
            r.traceabilityNumber.toUpperCase() === crossNavTarget.searchQuery!.toUpperCase() ||
            r.id === crossNavTarget.recordId
        );
        if (matched) {
          setSelectedRecordDossier(matched);
        }
      }
      clearCrossNavTarget();
    }
  }, [crossNavTarget, db.manufacturingRecords, clearCrossNavTarget]);

  const activeComponents = useMemo(
    () => db.components.filter((c) => c.active),
    [db.components]
  );

  const approvedDrawings = useMemo(
    () => db.drawings.filter((d) => d.drawingStatus === 'APPROVED'),
    [db.drawings]
  );

  const [formData, setFormData] = useState({
    machineSerialNumber: db.machines[0]?.serialNumber || 'DIV-SN-2026-001',
    projectNumber: db.machines[0]?.projectNumber || 'PRJ-2026-104',
    partNumber: activeComponents[0]?.partNumber || 'PART-DIV-001',
    drawingNumber: activeComponents[0]?.defaultDrawingNumber || 'DWG-DIV-101',
    drawingRevision: activeComponents[0]?.currentDrawingRevision || 'C',
    quantity: 1,
    manufacturingDate: new Date().toISOString().split('T')[0],
    machinistId: currentUser.role === 'MACHINIST' ? currentUser.id : 'USR-001',
    workstation: 'CNC Turning Center #2',
    batchMaterialRef: 'HEAT-EN24T-9012',
    permanentIdCompletedNow: true,
    permanentIdMethod: 'LASER MARKED' as PermanentIdMethod,
    permanentIdReference: '',
    notes: '',
  });

  // Complete Permanent Identification Modal State
  const [permIdModalRecord, setPermIdModalRecord] = useState<ManufacturingRecord | null>(null);
  const [permMethod, setPermMethod] = useState<PermanentIdMethod>('LASER MARKED');
  const [permRef, setPermRef] = useState('');
  const [permDate, setPermDate] = useState(new Date().toISOString().split('T')[0]);
  const [permError, setPermError] = useState<string | null>(null);

  const selectedComponent = useMemo(
    () => db.components.find((c) => c.partNumber === formData.partNumber),
    [db.components, formData.partNumber]
  );

  const selectedDrawingObj = useMemo(
    () =>
      db.drawings.find(
        (d) =>
          d.drawingNumber.toUpperCase() === formData.drawingNumber.trim().toUpperCase() &&
          d.revision.toUpperCase() === formData.drawingRevision.trim().toUpperCase()
      ) ||
      db.drawings.find(
        (d) => d.drawingNumber.toUpperCase() === formData.drawingNumber.trim().toUpperCase()
      ),
    [db.drawings, formData.drawingNumber, formData.drawingRevision]
  );

  const filteredRecords = useMemo(() => {
    return db.manufacturingRecords.filter((r) => {
      const matchesSearch =
        r.traceabilityNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.componentDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.machineSerialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.projectNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.drawingNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || r.manufacturingStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [db.manufacturingRecords, searchTerm, statusFilter]);

  // Cross-populate when selecting a Part Number
  const handleSelectPartNumber = (partNumber: string) => {
    const comp = db.components.find((c) => c.partNumber === partNumber);
    if (comp) {
      const nextProject =
        comp.projectNumbers && comp.projectNumbers.length > 0
          ? comp.projectNumbers[0]
          : formData.projectNumber;
      const nextMachine =
        comp.machineSerialNumbers && comp.machineSerialNumbers.length > 0
          ? comp.machineSerialNumbers[0]
          : db.machines.find((m) => m.projectNumber === nextProject)?.serialNumber ||
            formData.machineSerialNumber;

      setFormData({
        ...formData,
        partNumber: comp.partNumber,
        drawingNumber: comp.defaultDrawingNumber,
        drawingRevision: comp.currentDrawingRevision,
        projectNumber: nextProject,
        machineSerialNumber: nextMachine,
      });
    } else {
      setFormData({ ...formData, partNumber });
    }
  };

  // Cross-populate when selecting a Machine Serial Number
  const handleSelectMachine = (serialNumber: string) => {
    const mch = db.machines.find((m) => m.serialNumber === serialNumber);
    const nextProject = mch ? mch.projectNumber : formData.projectNumber;
    const nextDwgNum =
      mch?.allocatedDrawingNumbers && mch.allocatedDrawingNumbers.length > 0
        ? mch.allocatedDrawingNumbers[0]
        : formData.drawingNumber;
    const matchedDwg = db.drawings.find(
      (d) => d.drawingNumber.toUpperCase() === nextDwgNum.toUpperCase() && d.drawingStatus === 'APPROVED'
    );
    const nextPartNum =
      mch?.allocatedPartNumbers && mch.allocatedPartNumbers.length > 0
        ? mch.allocatedPartNumbers[0]
        : formData.partNumber;

    setFormData({
      ...formData,
      machineSerialNumber: serialNumber,
      projectNumber: nextProject,
      drawingNumber: matchedDwg ? matchedDwg.drawingNumber : formData.drawingNumber,
      drawingRevision: matchedDwg ? matchedDwg.revision : formData.drawingRevision,
      partNumber: nextPartNum,
    });
  };

  // Cross-populate when selecting a Project Number
  const handleSelectProject = (projectNumber: string) => {
    const prj = db.projects.find((p) => p.projectNumber === projectNumber);
    const mch = db.machines.find((m) => m.projectNumber === projectNumber);
    const nextDwgNum =
      prj?.allocatedDrawingNumbers && prj.allocatedDrawingNumbers.length > 0
        ? prj.allocatedDrawingNumbers[0]
        : formData.drawingNumber;
    const matchedDwg = db.drawings.find(
      (d) => d.drawingNumber.toUpperCase() === nextDwgNum.toUpperCase() && d.drawingStatus === 'APPROVED'
    );
    const nextPartNum =
      prj?.allocatedPartNumbers && prj.allocatedPartNumbers.length > 0
        ? prj.allocatedPartNumbers[0]
        : formData.partNumber;

    setFormData({
      ...formData,
      projectNumber,
      machineSerialNumber: mch ? mch.serialNumber : formData.machineSerialNumber,
      drawingNumber: matchedDwg ? matchedDwg.drawingNumber : formData.drawingNumber,
      drawingRevision: matchedDwg ? matchedDwg.revision : formData.drawingRevision,
      partNumber: nextPartNum,
    });
  };

  // Cross-populate when selecting a Controlled Drawing
  const handleSelectDrawing = (drawingId: string) => {
    const dwg = db.drawings.find((d) => d.id === drawingId);
    if (!dwg) return;
    const xref = getDrawingCrossReferences(db, dwg);
    const firstPart = xref.partsList[0]?.partNumber || dwg.partNumber || formData.partNumber;
    const firstPrj = xref.projects[0]?.projectNumber || formData.projectNumber;
    const firstMch = xref.machines[0]?.serialNumber || formData.machineSerialNumber;

    setFormData({
      ...formData,
      drawingNumber: dwg.drawingNumber,
      drawingRevision: dwg.revision,
      partNumber: firstPart,
      projectNumber: firstPrj,
      machineSerialNumber: firstMch,
    });
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const machinistUser =
      db.users.find((u) => u.id === formData.machinistId) || currentUser;

    const res = await addManufacturingRecord({
      machineSerialNumber: formData.machineSerialNumber,
      projectNumber: formData.projectNumber,
      partNumber: formData.partNumber,
      componentDescription: selectedComponent?.description || '',
      drawingNumber: formData.drawingNumber.trim().toUpperCase(),
      drawingRevision: formData.drawingRevision.trim().toUpperCase(),
      quantity: Number(formData.quantity),
      manufacturingDate: formData.manufacturingDate,
      machinist: machinistUser.name,
      machinistId: machinistUser.id,
      workstation: formData.workstation.trim(),
      batchMaterialRef: formData.batchMaterialRef.trim(),
      permanentIdMethod: formData.permanentIdCompletedNow
        ? formData.permanentIdMethod
        : 'NONE',
      permanentIdReference: formData.permanentIdCompletedNow
        ? formData.permanentIdReference.trim() || `${formData.partNumber}-${Date.now().toString().slice(-4)}`
        : '',
      permanentIdCompleted: formData.permanentIdCompletedNow,
      permanentIdDate: formData.permanentIdCompletedNow ? formData.manufacturingDate : undefined,
      permanentIdBy: formData.permanentIdCompletedNow ? machinistUser.name : undefined,
      permanentIdById: formData.permanentIdCompletedNow ? machinistUser.id : undefined,
      notes: formData.notes.trim(),
    });

    if (!res.success) {
      setFormError(res.error || 'Failed to create manufacturing record.');
      return;
    }

    setIsCreateModalOpen(false);
    setFormError(null);
  };

  const handleCompletePermId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permIdModalRecord) return;
    setPermError(null);

    const res = await completePermanentIdentification(permIdModalRecord.id, {
      method: permMethod,
      reference: permRef,
      date: permDate,
      completedBy: currentUser.name,
    });

    if (!res.success) {
      setPermError(res.error || 'Failed to complete permanent identification.');
      return;
    }

    setPermIdModalRecord(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Hammer className="w-5 h-5 text-blue-600" />
            Manufacturing & Component Traceability Records
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-populated across Projects, Machine Register, Component Master (Parts), and Controlled Engineering Drawings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFormError(null);
              setIsCreateModalOpen(true);
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Manufacturing Record
          </button>

          {isAdmin && db.manufacturingRecords.length > 0 && (
            <>
              {!confirmClearMfgList ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearMfgList(true)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                  title="Administrator: Clear entire Manufacturing Records List"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear List ({db.manufacturingRecords.length})
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded text-xs">
                  <span className="font-bold text-rose-900">
                    Clear all {db.manufacturingRecords.length} records?
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await clearCollectionList('manufacturingRecords');
                      setConfirmClearMfgList(false);
                    }}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[11px]"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearMfgList(false)}
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
            placeholder="Search by Traceability Number (e.g. DIV-2026-0001), Part Number, Machine Serial, Project, Drawing..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 py-1.5 px-3"
        >
          <option value="ALL">All Manufacturing Statuses</option>
          <option value="AWAITING_IDENTIFICATION">AWAITING IDENTIFICATION</option>
          <option value="AWAITING_INSPECTION">AWAITING INSPECTION</option>
          <option value="UNDER_INSPECTION">UNDER INSPECTION</option>
          <option value="INSPECTION_PASSED">INSPECTION PASSED</option>
          <option value="HOLD">QUALITY HOLD</option>
          <option value="NCR_HOLD">NCR HOLD</option>
          <option value="RELEASED">RELEASED</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white uppercase font-mono text-[10px] tracking-wider">
                <th className="py-3 px-4">Traceability Ref</th>
                <th className="py-3 px-4">Part Number & Description</th>
                <th className="py-3 px-4">Machine Serial & Project</th>
                <th className="py-3 px-4">Drawing Snapshot at Mfg</th>
                <th className="py-3 px-4">Qty / Machinist</th>
                <th className="py-3 px-4">Permanent Identification</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                    <div className="max-w-md mx-auto space-y-2">
                      <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-700">No Manufacturing Records in System</p>
                      <p className="text-xs text-slate-500">
                        The manufacturing register is clean (blank slate). Click "+ New Manufacturing Record" to create unique traceability records linked to your drawings and machines.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                const currentDwg = db.drawings.find(
                  (d) =>
                    d.drawingNumber.toUpperCase() === rec.drawingNumber.toUpperCase() &&
                    d.revision.toUpperCase() === rec.drawingRevision.toUpperCase()
                );
                const isSuperseded =
                  currentDwg?.drawingStatus === 'SUPERSEDED' &&
                  rec.drawingSnapshot?.approvalStatusAtManufacture === 'APPROVED';

                return (
                  <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-black text-blue-700">
                      <button
                        onClick={() => setSelectedRecordDossier(rec)}
                        className="hover:underline flex items-center gap-1 text-left"
                        title="Open Cross-Reference Traceability Dossier"
                      >
                        {rec.traceabilityNumber}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => navigateToCrossRef('components', rec.partNumber)}
                        className="font-bold text-emerald-800 hover:text-emerald-950 font-mono inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition-colors"
                        title="View Part in Component Master"
                      >
                        <Boxes className="w-3 h-3 text-emerald-600" />
                        {rec.partNumber}
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </button>
                      <div className="text-[11px] text-slate-600 mt-0.5">{rec.componentDescription}</div>
                    </td>
                    <td className="py-3 px-4 font-mono space-y-1">
                      <div>
                        <button
                          onClick={() => navigateToCrossRef('machines', rec.machineSerialNumber)}
                          className="font-bold text-slate-900 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1 transition-colors"
                          title="View Machine in Machine Register"
                        >
                          <Cpu className="w-3 h-3 text-slate-600" />
                          {rec.machineSerialNumber}
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </button>
                      </div>
                      <div>
                        <button
                          onClick={() => navigateToCrossRef('projects', rec.projectNumber)}
                          className="text-[10px] font-bold text-blue-800 hover:text-blue-950 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1 transition-colors"
                          title="View Project in Project Register"
                        >
                          <FolderKanban className="w-2.5 h-2.5 text-blue-600" />
                          Project: {rec.projectNumber}
                          <ExternalLink className="w-2 h-2 opacity-60" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <button
                        onClick={() => navigateToCrossRef('drawings', rec.drawingNumber)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded font-bold text-indigo-900 transition-colors"
                        title="Open Drawing in Controlled Engineering Drawings"
                      >
                        <FileSpreadsheet className="w-3 h-3 text-indigo-600" />
                        {rec.drawingNumber} Rev {rec.drawingRevision}
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </button>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                        At Mfg: {rec.drawingSnapshot?.approvalStatusAtManufacture || 'APPROVED'} (
                        {rec.drawingSnapshot?.drawingApprovalDate || 'Verified'})
                      </div>
                      {isSuperseded && (
                        <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-1 flex items-center gap-1">
                          <History className="w-3 h-3 shrink-0" />
                          Later Superseded — Historical Snapshot Valid
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900">Qty: {rec.quantity}</div>
                      <div className="text-[11px] text-slate-600">
                        {rec.machinist} <span className="font-mono text-[10px]">({rec.machinistId})</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{rec.manufacturingDate}</div>
                    </td>
                    <td className="py-3 px-4">
                      {rec.permanentIdCompleted ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3" /> {rec.permanentIdMethod}
                          </span>
                          <div className="text-[11px] font-mono text-slate-700 mt-0.5">
                            Ref: {rec.permanentIdReference}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3" /> AWAITING PERMANENT ID
                          </span>
                          <div>
                            <button
                              onClick={() => {
                                setPermIdModalRecord(rec);
                                setPermMethod('LASER MARKED');
                                setPermRef(`${rec.traceabilityNumber} / ${rec.partNumber}`);
                                setPermDate(new Date().toISOString().split('T')[0]);
                                setPermError(null);
                              }}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold inline-flex items-center gap-1"
                            >
                              <Tag className="w-3 h-3" /> Complete Permanent ID
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={rec.manufacturingStatus} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedRecordDossier(rec)}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-[11px] font-semibold inline-flex items-center gap-1"
                          title="View Cross-Reference Allocation Dossier"
                        >
                          <Eye className="w-3 h-3" /> Links
                        </button>
                        <button
                          onClick={() => onViewTraceabilityTag(rec.traceabilityNumber)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <QrCode className="w-3 h-3" /> Tag / QR
                        </button>
                        {isAdmin && (
                          <>
                            {confirmDeleteMfgId !== rec.id ? (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteMfgId(rec.id)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-[11px] font-bold inline-flex items-center gap-1"
                                title={`Delete Manufacturing Record ${rec.traceabilityNumber}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded text-[10px]">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteManufacturingRecord(rec.id);
                                    setConfirmDeleteMfgId(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteMfgId(null)}
                                  className="px-1.5 py-0.5 bg-white text-slate-700 border border-slate-300 rounded font-semibold"
                                >
                                  Cancel
                                </button>
                              </span>
                            )}
                          </>
                        )}
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

      {/* Create Manufacturing Record Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Manufacturing & Traceability Record"
        subtitle="Selecting any Project, Machine, Drawing, or Part automatically cross-populates linked allocations"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateRecord} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded text-rose-900 font-semibold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Cross-Population Selector Row: Project & Machine */}
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
              1. Project & Machine Allocation (Cross-Populates Linked Drawings & Parts)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Allocated Project Number *
                </label>
                <select
                  value={formData.projectNumber}
                  onChange={(e) => handleSelectProject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono bg-white"
                >
                  {db.projects.map((p) => (
                    <option key={p.id} value={p.projectNumber}>
                      {p.projectNumber} — {p.projectName} ({p.customer})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Allocated Machine Serial Number *
                </label>
                <select
                  value={formData.machineSerialNumber}
                  onChange={(e) => handleSelectMachine(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono bg-white"
                >
                  {db.machines.map((m) => (
                    <option key={m.id} value={m.serialNumber}>
                      {m.serialNumber} ({m.projectNumber} — {m.customer})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Cross-Population Selector Row: Controlled Drawing & Part */}
          <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-lg space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
              2. Controlled Engineering Drawing & Component Master Part Selection
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Quick-Select Approved Drawing (Auto-Fills Revision & BOM Parts)
                </label>
                <select
                  value={selectedDrawingObj?.id || ''}
                  onChange={(e) => handleSelectDrawing(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono bg-white"
                >
                  <option value="">-- Select Approved Drawing --</option>
                  {approvedDrawings.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.drawingNumber} (Rev {d.revision}) — {d.drawingTitle}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select Part from Active Component Master *
                </label>
                <select
                  value={formData.partNumber}
                  onChange={(e) => handleSelectPartNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono bg-white"
                >
                  {activeComponents.map((c) => (
                    <option key={c.id} value={c.partNumber}>
                      {c.partNumber} — {c.description} (Dwg: {c.defaultDrawingNumber} Rev {c.currentDrawingRevision})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* If selected drawing has multiple BOM parts, show 1-click chips */}
            {selectedDrawingObj &&
              Array.isArray(selectedDrawingObj.partsList) &&
              selectedDrawingObj.partsList.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] font-bold text-indigo-800 mb-1">
                    BOM Parts on Drawing {selectedDrawingObj.drawingNumber} (Click to select part):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDrawingObj.partsList.map((pt, idx) => (
                      <button
                        key={`${pt.partNumber}-${idx}`}
                        type="button"
                        onClick={() => handleSelectPartNumber(pt.partNumber)}
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border transition-colors ${
                          formData.partNumber === pt.partNumber
                            ? 'bg-indigo-700 text-white border-indigo-800'
                            : 'bg-white text-indigo-900 border-indigo-300 hover:bg-indigo-100'
                        }`}
                      >
                        Item {pt.itemNumber}: {pt.partNumber} — {pt.description} (Qty {pt.quantity})
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Controlled Drawing Number *</label>
              <input
                type="text"
                required
                value={formData.drawingNumber}
                onChange={(e) => setFormData({ ...formData, drawingNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Drawing Revision *</label>
              <input
                type="text"
                required
                value={formData.drawingRevision}
                onChange={(e) => setFormData({ ...formData, drawingRevision: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Quantity (&gt; 0) *</label>
              <input
                type="number"
                min={1}
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Machinist (Immutable ID) *</label>
              {currentUser.role === 'MACHINIST' ? (
                <input
                  type="text"
                  disabled
                  value={`${currentUser.name} (${currentUser.id} — ${currentUser.role})`}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-slate-100 font-mono text-slate-700"
                />
              ) : (
                <select
                  value={formData.machinistId}
                  onChange={(e) => setFormData({ ...formData, machinistId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                >
                  {db.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.id} — {u.role})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Workstation / CNC Machine *</label>
              <input
                type="text"
                required
                value={formData.workstation}
                onChange={(e) => setFormData({ ...formData, workstation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Material Batch / Heat Ref *</label>
              <input
                type="text"
                required
                value={formData.batchMaterialRef}
                onChange={(e) => setFormData({ ...formData, batchMaterialRef: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
              />
            </div>
          </div>

          {/* Permanent Identification Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.permanentIdCompletedNow}
                onChange={(e) =>
                  setFormData({ ...formData, permanentIdCompletedNow: e.target.checked })
                }
              />
              <span className="font-bold text-slate-800">
                Permanent Physical Identification Completed Now (Uncheck to place in AWAITING_IDENTIFICATION)
              </span>
            </label>

            {formData.permanentIdCompletedNow && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Marking Method *</label>
                  <select
                    value={formData.permanentIdMethod}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        permanentIdMethod: e.target.value as PermanentIdMethod,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="LASER MARKED">LASER MARKED</option>
                    <option value="ENGRAVED">ENGRAVED</option>
                    <option value="STAMPED">STAMPED</option>
                    <option value="SERIAL NUMBER">SERIAL NUMBER</option>
                    <option value="PART NUMBER">PART NUMBER</option>
                    <option value="QR CODE">QR CODE</option>
                    <option value="LABEL">LABEL</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Permanent Marking Reference
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-fills with Traceability Ref if blank"
                    value={formData.permanentIdReference}
                    onChange={(e) =>
                      setFormData({ ...formData, permanentIdReference: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>
            )}
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
              Create Manufacturing Record
            </button>
          </div>
        </form>
      </Modal>

      {/* Cross-Reference Traceability Dossier Modal */}
      {selectedRecordDossier && (
        <Modal
          isOpen={Boolean(selectedRecordDossier)}
          onClose={() => setSelectedRecordDossier(null)}
          title={`Manufacturing Cross-Reference Dossier — ${selectedRecordDossier.traceabilityNumber}`}
          subtitle={`${selectedRecordDossier.partNumber} (${selectedRecordDossier.componentDescription})`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Allocated Project */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase text-blue-700 font-bold">
                    Allocated Project Register
                  </div>
                  <div className="font-mono font-black text-blue-950 text-sm mt-0.5">
                    {selectedRecordDossier.projectNumber}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {db.projects.find((p) => p.projectNumber === selectedRecordDossier.projectNumber)?.projectName || 'Linked Project'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const prj = selectedRecordDossier.projectNumber;
                    setSelectedRecordDossier(null);
                    navigateToCrossRef('projects', prj);
                  }}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold inline-flex items-center gap-1"
                >
                  <FolderKanban className="w-3.5 h-3.5" /> Open Project
                </button>
              </div>

              {/* Allocated Machine */}
              <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-600 font-bold">
                    Allocated Machine Serial
                  </div>
                  <div className="font-mono font-black text-slate-900 text-sm mt-0.5">
                    {selectedRecordDossier.machineSerialNumber}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {db.machines.find((m) => m.serialNumber === selectedRecordDossier.machineSerialNumber)?.machineType || 'Registered Machine'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const sn = selectedRecordDossier.machineSerialNumber;
                    setSelectedRecordDossier(null);
                    navigateToCrossRef('machines', sn);
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold inline-flex items-center gap-1"
                >
                  <Cpu className="w-3.5 h-3.5" /> Open Machine
                </button>
              </div>

              {/* Component Master Part */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase text-emerald-700 font-bold">
                    Component Master (Part)
                  </div>
                  <div className="font-mono font-black text-emerald-950 text-sm mt-0.5">
                    {selectedRecordDossier.partNumber}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {selectedRecordDossier.componentDescription}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const pn = selectedRecordDossier.partNumber;
                    setSelectedRecordDossier(null);
                    navigateToCrossRef('components', pn);
                  }}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold inline-flex items-center gap-1"
                >
                  <Boxes className="w-3.5 h-3.5" /> Open Part
                </button>
              </div>

              {/* Controlled Drawing */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase text-indigo-700 font-bold">
                    Controlled Engineering Drawing
                  </div>
                  <div className="font-mono font-black text-indigo-950 text-sm mt-0.5">
                    {selectedRecordDossier.drawingNumber} Rev {selectedRecordDossier.drawingRevision}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {db.drawings.find(
                      (d) =>
                        d.drawingNumber.toUpperCase() ===
                        selectedRecordDossier.drawingNumber.toUpperCase()
                    )?.drawingTitle || 'Approved Drawing Snapshot'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const dn = selectedRecordDossier.drawingNumber;
                    setSelectedRecordDossier(null);
                    navigateToCrossRef('drawings', dn);
                  }}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold inline-flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Open Drawing
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Quantity</div>
                <div className="font-mono font-bold text-slate-900">{selectedRecordDossier.quantity}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Machinist</div>
                <div className="font-bold text-slate-900">{selectedRecordDossier.machinist}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Material Batch</div>
                <div className="font-mono font-bold text-slate-900">{selectedRecordDossier.batchMaterialRef}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Status</div>
                <StatusBadge status={selectedRecordDossier.manufacturingStatus} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => {
                  const tn = selectedRecordDossier.traceabilityNumber;
                  setSelectedRecordDossier(null);
                  onViewTraceabilityTag(tn);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold inline-flex items-center gap-1"
              >
                <QrCode className="w-3.5 h-3.5" /> View Traceability Tag / QR
              </button>
              <button
                onClick={() => setSelectedRecordDossier(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Complete Permanent Identification Modal */}
      <Modal
        isOpen={Boolean(permIdModalRecord)}
        onClose={() => setPermIdModalRecord(null)}
        title={`Complete Permanent Identification — ${permIdModalRecord?.traceabilityNumber}`}
        subtitle={`Part: ${permIdModalRecord?.partNumber} (${permIdModalRecord?.componentDescription})`}
        maxWidth="md"
      >
        <form onSubmit={handleCompletePermId} className="space-y-4 text-xs">
          {permError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded text-rose-900 font-semibold">
              {permError}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Identification Method *</label>
            <select
              value={permMethod}
              onChange={(e) => setPermMethod(e.target.value as PermanentIdMethod)}
              className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
            >
              <option value="LASER MARKED">LASER MARKED</option>
              <option value="ENGRAVED">ENGRAVED</option>
              <option value="STAMPED">STAMPED</option>
              <option value="SERIAL NUMBER">SERIAL NUMBER</option>
              <option value="PART NUMBER">PART NUMBER</option>
              <option value="QR CODE">QR CODE</option>
              <option value="LABEL">LABEL</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Permanent Identification Reference Marked on Component *
            </label>
            <input
              type="text"
              required
              value={permRef}
              onChange={(e) => setPermRef(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded font-mono font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Completion Date *</label>
            <input
              type="date"
              required
              value={permDate}
              onChange={(e) => setPermDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPermIdModalRecord(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold"
            >
              Confirm Permanent Identification
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
