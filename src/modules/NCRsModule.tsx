import React, { useState } from 'react';
import { useQMS } from '../context/QMSContext';
import { NCR, NCRStatus, NCRDisposition, ManufacturingRecord, FileAttachmentMetadata } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { PhotoEvidenceGallery } from '../components/PhotoEvidenceGallery';
import {
  AlertTriangle,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Wrench,
  Trash2,
  FileSpreadsheet,
  ShieldAlert,
  ArrowRight,
  Filter,
  Camera,
  ShieldCheck,
} from 'lucide-react';

export const NCRsModule: React.FC = () => {
  const { db, currentUser, createNCR, updateNCR, deleteNCR, clearCollectionList } = useQMS();

  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const [confirmDeleteNCRId, setConfirmDeleteNCRId] = useState<string | null>(null);
  const [confirmClearNCRsList, setConfirmClearNCRsList] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedNCR, setSelectedNCR] = useState<NCR | null>(null);

  // New NCR Form state
  const [selectedMfgRecordId, setSelectedMfgRecordId] = useState('');
  const [ncrDescription, setNcrDescription] = useState('');
  const [ncrRequirement, setNcrRequirement] = useState('');
  const [ncrActual, setNcrActual] = useState('');
  const [immediateContainment, setImmediateContainment] = useState(
    'Quarantined in Red Hold Box QA-HOLD. Yellow NCR tag affixed.'
  );
  const [proposedDisposition, setProposedDisposition] = useState<NCRDisposition>('REWORK');
  const [rootCause, setRootCause] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('Dave Vance');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  const [newIssuePhotos, setNewIssuePhotos] = useState<FileAttachmentMetadata[]>([]);
  const [newCorrectivePhotos, setNewCorrectivePhotos] = useState<FileAttachmentMetadata[]>([]);

  // Resolution State for selected NCR
  const [resolveDisposition, setResolveDisposition] = useState<NCRDisposition>('REWORK');
  const [resolveRootCause, setResolveRootCause] = useState('');
  const [resolveCorrectiveAction, setResolveCorrectiveAction] = useState('');
  const [resolveIssuePhotos, setResolveIssuePhotos] = useState<FileAttachmentMetadata[]>([]);
  const [resolveCorrectivePhotos, setResolveCorrectivePhotos] = useState<FileAttachmentMetadata[]>([]);

  // Filtered NCRs
  const filteredNCRs = db.ncrs.filter((ncr) => {
    const matchesSearch =
      ncr.ncrNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ncr.traceabilityNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ncr.machineSerialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ncr.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ncr.description.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'OPEN') return ncr.status !== 'CLOSED';
    if (statusFilter === 'CLOSED') return ncr.status === 'CLOSED';
    return true;
  });

  const openNCRs = db.ncrs.filter((n) => n.status !== 'CLOSED');
  const affectedMachines = Array.from(new Set(openNCRs.map((n) => n.machineSerialNumber)));

  // Handle Create Standalone NCR
  const handleCreateNCR = async (e: React.FormEvent) => {
    e.preventDefault();
    const mfgRecord = db.manufacturingRecords.find((r) => r.id === selectedMfgRecordId);
    if (!mfgRecord) {
      setBannerMessage({ type: 'error', text: 'Please select an active manufacturing record.' });
      return;
    }

    const res = await createNCR({
      manufacturingRecordId: mfgRecord.id,
      traceabilityNumber: mfgRecord.traceabilityNumber,
      machineSerialNumber: mfgRecord.machineSerialNumber,
      projectNumber: mfgRecord.projectNumber,
      partNumber: mfgRecord.partNumber,
      drawingNumber: mfgRecord.drawingNumber,
      drawingRevision: mfgRecord.drawingRevision,
      failedCharacteristics: ['Manual NCR Entry: Dimensional / Visual Non-Conformance'],
      description: ncrDescription,
      requirement: ncrRequirement || `Drawing ${mfgRecord.drawingNumber} Rev ${mfgRecord.drawingRevision}`,
      actualCondition: ncrActual || ncrDescription,
      immediateContainment,
      proposedDisposition,
      rootCause,
      correctiveAction,
      issuePhotoEvidence: newIssuePhotos,
      correctiveActionPhotoEvidence: newCorrectivePhotos,
      responsiblePerson,
      dueDate,
    });

    if (res.success) {
      setBannerMessage({
        type: 'success',
        text: `NCR ${res.ncrNumber} created. Component ${mfgRecord.traceabilityNumber} placed in NCR / HOLD.`,
      });
      setIsCreateModalOpen(false);
      // Reset form
      setNcrDescription('');
      setNcrRequirement('');
      setNcrActual('');
      setSelectedMfgRecordId('');
      setNewIssuePhotos([]);
      setNewCorrectivePhotos([]);
    } else {
      setBannerMessage({ type: 'error', text: `Error creating NCR: ${res.error}` });
    }
  };

  // Close NCR
  const handleCloseNCR = async (ncr: NCR) => {
    const canClose = ['INSPECTOR', 'HSEQ', 'ADMINISTRATOR', 'MACHINE_MANAGER'].includes(currentUser.role);
    if (!canClose) {
      setBannerMessage({
        type: 'error',
        text: `Only Quality Inspectors, HSEQ, or Managers can close an NCR. (Your role: ${currentUser.role})`,
      });
      return;
    }

    if (!resolveRootCause || !resolveCorrectiveAction) {
      setBannerMessage({
        type: 'error',
        text: 'Root Cause and Corrective Action must be recorded before closing an NCR.',
      });
      return;
    }

    const ok = await updateNCR(ncr.id, {
      status: 'CLOSED',
      closureDate: new Date().toISOString().split('T')[0],
      approvedBy: currentUser.name,
      proposedDisposition: resolveDisposition,
      rootCause: resolveRootCause,
      correctiveAction: resolveCorrectiveAction,
      issuePhotoEvidence: resolveIssuePhotos,
      correctiveActionPhotoEvidence: resolveCorrectivePhotos,
    });

    if (ok) {
      setBannerMessage({
        type: 'success',
        text: `NCR ${ncr.ncrNumber} is now CLOSED. Disposition: ${resolveDisposition}. Component status updated in Manufacturing Register.`,
      });
      setSelectedNCR(null);
    }
  };

  const handleSaveNCRProgress = async (ncr: NCR) => {
    const ok = await updateNCR(ncr.id, {
      proposedDisposition: resolveDisposition,
      rootCause: resolveRootCause,
      correctiveAction: resolveCorrectiveAction,
      issuePhotoEvidence: resolveIssuePhotos,
      correctiveActionPhotoEvidence: resolveCorrectivePhotos,
    });
    if (ok) {
      setSelectedNCR({
        ...ncr,
        proposedDisposition: resolveDisposition,
        rootCause: resolveRootCause,
        correctiveAction: resolveCorrectiveAction,
        issuePhotoEvidence: resolveIssuePhotos,
        correctiveActionPhotoEvidence: resolveCorrectivePhotos,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 text-white shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
              <h1 className="text-xl font-bold tracking-tight">Non-Conformance (NCR) Management</h1>
              <span className="px-2 py-0.5 text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800 rounded">
                Strict Quality Hold System
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Quarantine containment, disposition authorization (Rework, Scrap, Deviation), root cause tracking, and machine-level hold enforcement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && db.ncrs.length > 0 && (
              confirmClearNCRsList ? (
                <div className="inline-flex items-center gap-1.5 bg-rose-950 border border-rose-700 px-2.5 py-1.5 rounded">
                  <span className="text-[11px] font-bold text-rose-200">
                    Delete all {db.ncrs.length} NCRs?
                  </span>
                  <button
                    onClick={async () => {
                      await clearCollectionList('ncrs');
                      setConfirmClearNCRsList(false);
                      setSelectedNCR(null);
                    }}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
                  >
                    Confirm Clear
                  </button>
                  <button
                    onClick={() => setConfirmClearNCRsList(false)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClearNCRsList(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded-md text-xs font-bold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear NCR List ({db.ncrs.length})
                </button>
              )
            )}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Raise Formal NCR</span>
            </button>
          </div>
        </div>

        {/* Affected Machines Summary Banner */}
        {affectedMachines.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-rose-400 font-bold flex items-center gap-1">
              <ShieldAlert className="w-4 h-4" />
              MACHINES AFFECTED BY OPEN NCR ({affectedMachines.length}):
            </span>
            {affectedMachines.map((serial) => (
              <span
                key={serial}
                className="px-2.5 py-0.5 text-xs font-mono font-bold bg-rose-950/80 text-rose-200 border border-rose-800 rounded"
              >
                {serial}
              </span>
            ))}
          </div>
        )}
      </div>

      {bannerMessage && (
        <div
          className={`p-3.5 rounded-lg border text-xs font-semibold flex items-center justify-between ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <span>{bannerMessage.text}</span>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-[11px] underline ml-4 opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* NCRs Register Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800 text-sm">Non-Conformance Reports</span>
            <span className="text-xs text-slate-500">({filteredNCRs.length} records)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search NCR, serial, part..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-hidden focus:ring-1 focus:ring-rose-500 w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open / Active ({openNCRs.length})</option>
              <option value="CLOSED">Closed / Resolved</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider font-mono">
              <tr>
                <th className="p-3">NCR #</th>
                <th className="p-3">Traceability #</th>
                <th className="p-3">Machine Serial</th>
                <th className="p-3">Part Description</th>
                <th className="p-3">Issue Summary</th>
                <th className="p-3">Proposed Disposition</th>
                <th className="p-3">Raised By</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredNCRs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                    <div className="max-w-md mx-auto space-y-2">
                      <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                      <p className="font-bold text-slate-700">Zero Non-Conformance Reports (NCRs)</p>
                      <p className="text-xs text-slate-500">
                        The quality register is clean (blank slate). Any non-conformances identified during shop-floor machining, assembly or inspection will be recorded here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredNCRs.map((ncr) => {
                  return (
                    <tr
                      key={ncr.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        ncr.status !== 'CLOSED' ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="p-3 font-mono font-bold text-rose-700">
                        <div>{ncr.ncrNumber}</div>
                        {ncr.deviationId ? (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            Dev: {ncr.deviationId}
                          </span>
                        ) : ncr.daleInspectionId || ncr.inspectionRecordId ? (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Inspection Finding
                          </span>
                        ) : (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono text-slate-500 bg-slate-100">
                            Direct Report
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-semibold text-slate-900">{ncr.traceabilityNumber}</td>
                      <td className="p-3 font-mono font-bold text-slate-700">{ncr.machineSerialNumber}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{ncr.partNumber}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          DWG: {ncr.drawingNumber} Rev {ncr.drawingRevision}
                        </div>
                      </td>
                      <td className="p-3 max-w-xs" title={ncr.description}>
                        <div className="font-sans text-slate-800 truncate">{ncr.description}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-50 text-rose-700 border border-rose-200">
                            <Camera className="w-2.5 h-2.5" />
                            Issue: {(ncr.issuePhotoEvidence || []).length}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Camera className="w-2.5 h-2.5" />
                            Corrective: {(ncr.correctiveActionPhotoEvidence || []).length}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {ncr.proposedDisposition}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="text-slate-800 font-medium">{ncr.createdBy}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{ncr.createdAt.split('T')[0]}</div>
                      </td>
                      <td className="p-3">
                        <StatusBadge status={ncr.status} />
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedNCR(ncr);
                              setResolveDisposition(ncr.proposedDisposition);
                              setResolveRootCause(ncr.rootCause || '');
                              setResolveCorrectiveAction(ncr.correctiveAction || '');
                              setResolveIssuePhotos(ncr.issuePhotoEvidence || []);
                              setResolveCorrectivePhotos(ncr.correctiveActionPhotoEvidence || []);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded transition-colors inline-flex items-center gap-1"
                          >
                            <span>Review</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          {isAdmin && (
                            confirmDeleteNCRId === ncr.id ? (
                              <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 px-1.5 py-0.5 rounded">
                                <button
                                  onClick={async () => {
                                    await deleteNCR(ncr.id);
                                    setConfirmDeleteNCRId(null);
                                    if (selectedNCR?.id === ncr.id) setSelectedNCR(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteNCRId(null)}
                                  className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[10px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteNCRId(ncr.id)}
                                title="Admin: Delete NCR Record"
                                className="p-1.5 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
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

      {/* CREATE STANDALONE NCR MODAL */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Raise Non-Conformance Report (NCR)"
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateNCR} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Component to Quarantine *</label>
              <select
                required
                value={selectedMfgRecordId}
                onChange={(e) => setSelectedMfgRecordId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded bg-white text-xs font-mono"
              >
                <option value="">-- Choose Manufacturing Record --</option>
                {db.manufacturingRecords.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.traceabilityNumber} | {r.partNumber} ({r.componentDescription}) | Machine: {r.machineSerialNumber}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description of Non-Conformance *</label>
              <textarea
                required
                rows={3}
                value={ncrDescription}
                onChange={(e) => setNcrDescription(e.target.value)}
                placeholder="Explain the defect, dimension failure, surface imperfection, or machining discrepancy..."
                className="w-full p-2 border border-slate-300 rounded font-sans focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Drawing Requirement</label>
                <input
                  type="text"
                  value={ncrRequirement}
                  onChange={(e) => setNcrRequirement(e.target.value)}
                  placeholder="e.g. Bore Ø 120.000 ±0.020mm"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Actual Measured Condition</label>
                <input
                  type="text"
                  value={ncrActual}
                  onChange={(e) => setNcrActual(e.target.value)}
                  placeholder="e.g. Bore measured 120.038mm (+0.018mm oversize)"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Immediate Containment Action *</label>
              <input
                type="text"
                required
                value={immediateContainment}
                onChange={(e) => setImmediateContainment(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Proposed Disposition *</label>
                <select
                  value={proposedDisposition}
                  onChange={(e: any) => setProposedDisposition(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-mono text-[11px]"
                >
                  <option value="REWORK">REWORK</option>
                  <option value="SCRAP">SCRAP</option>
                  <option value="USE_AS_IS_DEVIATION_REQUIRED">USE AS IS (DEVIATION)</option>
                  <option value="ENGINEERING_REVIEW">ENGINEERING REVIEW</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Responsible Person</label>
                <input
                  type="text"
                  value={responsiblePerson}
                  onChange={(e) => setResponsiblePerson(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>

            <PhotoEvidenceGallery
              title="Issue Identified — Photo Evidence"
              subtitle="Attach photos of the non-conforming defect, out-of-tolerance reading, or quarantine tag"
              photos={newIssuePhotos}
              onChange={setNewIssuePhotos}
              relatedRecordId={selectedMfgRecordId || 'NEW_NCR_ISSUE'}
              badgeColor="rose"
            />

            <PhotoEvidenceGallery
              title="Initial Corrective Action — Photo Evidence (Optional)"
              subtitle="Attach photos of any immediate rework or corrective action already completed"
              photos={newCorrectivePhotos}
              onChange={setNewCorrectivePhotos}
              relatedRecordId={selectedMfgRecordId || 'NEW_NCR_CORRECTIVE'}
              badgeColor="emerald"
            />

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 text-white rounded hover:bg-rose-700 shadow-xs"
              >
                Issue NCR & Place On Hold
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* VIEW & RESOLVE NCR MODAL */}
      {selectedNCR && (
        <Modal
          isOpen={Boolean(selectedNCR)}
          onClose={() => setSelectedNCR(null)}
          title={`NON-CONFORMANCE REPORT: ${selectedNCR.ncrNumber}`}
          maxWidth="3xl"
        >
          <div className="space-y-5 text-xs">
            {/* Header info banner */}
            <div className="bg-slate-900 text-slate-200 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                <span className="font-mono font-bold text-rose-400 text-sm">{selectedNCR.ncrNumber}</span>
                <StatusBadge status={selectedNCR.status} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">TRACEABILITY #</span>
                  <span className="font-bold text-white">{selectedNCR.traceabilityNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">MACHINE SERIAL</span>
                  <span className="font-bold text-amber-300">{selectedNCR.machineSerialNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">PART NUMBER</span>
                  <span className="font-bold text-white">{selectedNCR.partNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">DRAWING & REV</span>
                  <span className="font-bold text-white">
                    {selectedNCR.drawingNumber} Rev {selectedNCR.drawingRevision}
                  </span>
                </div>
              </div>
            </div>

            {/* Description & Containment */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <span className="font-bold text-slate-700 block mb-0.5">Description of Non-Conformance:</span>
                <p className="p-2.5 bg-white border border-slate-200 rounded font-mono text-slate-900">
                  {selectedNCR.description}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-0.5">Immediate Containment Action:</span>
                <p className="p-2 bg-white border border-slate-200 rounded font-sans text-slate-800">
                  {selectedNCR.immediateContainment}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="font-bold text-slate-700 block mb-0.5">Specification Requirement:</span>
                  <p className="p-2 bg-white border border-slate-200 rounded font-mono text-slate-800">
                    {selectedNCR.requirement}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block mb-0.5">Actual Measured Condition:</span>
                  <p className="p-2 bg-white border border-slate-200 rounded font-mono text-slate-800">
                    {selectedNCR.actualCondition}
                  </p>
                </div>
              </div>

              <PhotoEvidenceGallery
                title="Issue Identified — Photo Evidence"
                subtitle="Photographic evidence of the identified defect, dimensional discrepancy, or quarantine containment"
                photos={resolveIssuePhotos}
                onChange={selectedNCR.status !== 'CLOSED' ? setResolveIssuePhotos : undefined}
                relatedRecordId={selectedNCR.ncrNumber}
                readOnly={selectedNCR.status === 'CLOSED'}
                badgeColor="rose"
              />
            </div>

            {/* Resolution & Disposition Section */}
            {selectedNCR.status === 'CLOSED' ? (
              <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-lg text-emerald-900 font-mono space-y-3">
                <div className="font-bold text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  NCR Closed & Disposition Authorized
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-emerald-700 block text-[10px]">AUTHORIZED DISPOSITION</span>
                    <span className="font-bold">{selectedNCR.proposedDisposition}</span>
                  </div>
                  <div>
                    <span className="text-emerald-700 block text-[10px]">CLOSED BY & DATE</span>
                    <span>
                      {selectedNCR.approvedBy} on {selectedNCR.closureDate}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-emerald-700 block text-[10px]">ROOT CAUSE</span>
                    <span>{selectedNCR.rootCause}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-emerald-700 block text-[10px]">CORRECTIVE ACTION</span>
                    <span>{selectedNCR.correctiveAction}</span>
                  </div>
                </div>

                <div className="font-sans">
                  <PhotoEvidenceGallery
                    title="Corrective Action — Photo Evidence"
                    subtitle="Photographic verification of completed rework, corrective action, or disposition"
                    photos={selectedNCR.correctiveActionPhotoEvidence || []}
                    relatedRecordId={selectedNCR.ncrNumber}
                    readOnly={true}
                    badgeColor="emerald"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 p-4 rounded-lg space-y-3">
                <h4 className="font-bold text-slate-800 text-sm">NCR Investigation & Disposition Closure</h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Final Agreed Disposition *</label>
                    <select
                      value={resolveDisposition}
                      onChange={(e: any) => setResolveDisposition(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded bg-white font-mono"
                    >
                      <option value="REWORK">REWORK (Skim pass / adjustment and re-inspect)</option>
                      <option value="SCRAP">SCRAP (Part condemned)</option>
                      <option value="USE_AS_IS_DEVIATION_REQUIRED">USE AS IS (Requires formal approved deviation)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Responsible Person</label>
                    <input
                      type="text"
                      readOnly
                      value={selectedNCR.responsiblePerson}
                      className="w-full p-2 border border-slate-200 bg-slate-100 rounded text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Root Cause Analysis *</label>
                  <textarea
                    rows={2}
                    value={resolveRootCause}
                    onChange={(e) => setResolveRootCause(e.target.value)}
                    placeholder="Identify root cause: tool deflection, operator error, material hardness, programming..."
                    className="w-full p-2 border border-slate-300 rounded font-sans"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Corrective Action Taken *</label>
                  <textarea
                    rows={2}
                    value={resolveCorrectiveAction}
                    onChange={(e) => setResolveCorrectiveAction(e.target.value)}
                    placeholder="Specific corrective action implemented to resolve part and prevent recurrence..."
                    className="w-full p-2 border border-slate-300 rounded font-sans"
                  />
                </div>

                <PhotoEvidenceGallery
                  title="Corrective Action — Photo Evidence"
                  subtitle="Attach photographic evidence of completed rework, re-inspection verification, or corrective action implementation"
                  photos={resolveCorrectivePhotos}
                  onChange={setResolveCorrectivePhotos}
                  relatedRecordId={selectedNCR.ncrNumber}
                  badgeColor="emerald"
                />

                <div className="pt-2 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedNCR(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                  >
                    Close Dialog
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveNCRProgress(selectedNCR)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-xs shadow-xs"
                  >
                    Save Progress &amp; Photos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCloseNCR(selectedNCR)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shadow-xs"
                  >
                    Authorize Disposition &amp; Close NCR
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
