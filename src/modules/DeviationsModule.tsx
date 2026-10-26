import React, { useState, useMemo } from 'react';
import { useQMS } from '../context/QMSContext';
import { Deviation, DeviationType, FileAttachmentMetadata } from '../types';
import { DBService } from '../services/db';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import {
  GitPullRequest,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  ShieldAlert,
  FileCheck,
  Trash2,
  AlertTriangle,
  GitBranch,
} from 'lucide-react';

export const DeviationsModule: React.FC = () => {
  const {
    db,
    currentUser,
    createDeviation,
    updateDeviation,
    uploadAttachmentFile,
    deleteDeviation,
    clearCollectionList,
  } = useQMS();

  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const [confirmDeleteDevId, setConfirmDeleteDevId] = useState<string | null>(null);
  const [confirmClearDevsList, setConfirmClearDevsList] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedDevId, setSelectedDevId] = useState<string>(db.deviations[0]?.id || '');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMfgId, setSelectedMfgId] = useState(db.manufacturingRecords[0]?.id || '');
  const [devForm, setDevForm] = useState({
    deviationType: 'POST_INSPECTION_CONCESSION' as DeviationType,
    approvedConcessionDisposition: 'USE_AS_IS' as
      | 'USE_AS_IS'
      | 'CONCESSION_ACCEPTED'
      | 'REWORK_TO_REDLINE',
    affectedCharacteristicIds: [] as string[],
    descriptionOfChange: '',
    reasonForDeviation: '',
    requiresRedline: true,
    redlineNotes: '',
  });
  const [redlineFile, setRedlineFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [attachFileForExisting, setAttachFileForExisting] = useState<File | null>(null);

  const canApprove = ['ENGINEERING', 'HSEQ', 'ADMINISTRATOR'].includes(currentUser.role);

  const filteredDeviations = useMemo(() => {
    return db.deviations.filter((d) => {
      const matchesSearch =
        d.deviationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.traceabilityNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.machineSerialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.descriptionOfChange.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [db.deviations, searchTerm, statusFilter]);

  const selectedDev: Deviation | undefined = useMemo(
    () => db.deviations.find((d) => d.id === selectedDevId) || filteredDeviations[0],
    [db.deviations, selectedDevId, filteredDeviations]
  );

  const linkedInspectionForCreate = useMemo(
    () => db.inspections.find((i) => i.manufacturingRecordId === selectedMfgId),
    [db.inspections, selectedMfgId]
  );

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleCreateDeviation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const mfg = db.manufacturingRecords.find((r) => r.id === selectedMfgId);
    if (!mfg) {
      setFormError('Please select a manufacturing record.');
      return;
    }

    let uploadedRedline: FileAttachmentMetadata | undefined;
    if (redlineFile) {
      const base64Data = await fileToBase64(redlineFile);
      const up = await uploadAttachmentFile({
        originalFilename: redlineFile.name,
        mimeType: redlineFile.type || 'application/pdf',
        base64Data,
        category: 'REDLINE',
        relatedRecordId: mfg.id,
        drawingNumber: mfg.drawingNumber,
        revision: mfg.drawingRevision,
      });
      if (!up.success) {
        setFormError(up.error || 'Failed uploading redline drawing file.');
        return;
      }
      uploadedRedline = up.attachment;
    }

    const matchedChars =
      linkedInspectionForCreate?.characteristics.filter((c) =>
        devForm.affectedCharacteristicIds.includes(c.id)
      ) || [];

    const res = await createDeviation({
      manufacturingRecordId: mfg.id,
      inspectionRecordId: linkedInspectionForCreate?.id,
      traceabilityNumber: mfg.traceabilityNumber,
      machineSerialNumber: mfg.machineSerialNumber,
      projectNumber: mfg.projectNumber,
      partNumber: mfg.partNumber,
      originalDrawingNumber: mfg.drawingNumber,
      originalDrawingRevision: mfg.drawingRevision,
      deviationType: devForm.deviationType,
      affectedCharacteristicIds: devForm.affectedCharacteristicIds,
      affectedCharacteristicNames: matchedChars.map((c) => c.feature),
      approvedConcessionDisposition: devForm.approvedConcessionDisposition,
      descriptionOfChange: devForm.descriptionOfChange.trim(),
      reasonForDeviation: devForm.reasonForDeviation.trim(),
      requiresRedline: devForm.requiresRedline,
      redlineFile: uploadedRedline,
      redlineNotes: devForm.redlineNotes.trim(),
      status: devForm.requiresRedline && !uploadedRedline ? 'INCOMPLETE' : 'AWAITING_APPROVAL',
    });

    if (!res.success) {
      setFormError(res.error || 'Failed to create deviation.');
      return;
    }

    setIsCreateModalOpen(false);
    setRedlineFile(null);
    if (res.deviationNumber) {
      setSelectedDevId(res.deviationNumber);
      setSuccessBanner(
        `Deviation ${res.deviationNumber} created and automatically recorded as ${res.ncrNumber || 'NCR'} (component placed on Quality Hold).`
      );
    }
  };

  const handleUploadRedlineToExisting = async () => {
    if (!selectedDev || !attachFileForExisting) return;
    setActionError(null);

    const base64Data = await fileToBase64(attachFileForExisting);
    const up = await uploadAttachmentFile({
      originalFilename: attachFileForExisting.name,
      mimeType: attachFileForExisting.type || 'application/pdf',
      base64Data,
      category: 'REDLINE',
      relatedRecordId: selectedDev.id,
      drawingNumber: selectedDev.originalDrawingNumber,
      revision: selectedDev.originalDrawingRevision,
    });
    if (!up.success || !up.attachment) {
      setActionError(up.error || 'Failed to upload redline attachment.');
      return;
    }

    const upd = await updateDeviation(selectedDev.id, {
      redlineFile: up.attachment,
      status: selectedDev.status === 'INCOMPLETE' ? 'AWAITING_APPROVAL' : selectedDev.status,
    });
    if (!upd.success) {
      setActionError(upd.error || 'Failed updating deviation.');
    } else {
      setAttachFileForExisting(null);
    }
  };

  const handleApproveDeviation = async () => {
    if (!selectedDev) return;
    setActionError(null);

    const res = await updateDeviation(selectedDev.id, {
      status: 'APPROVED',
      engineeringApproved: true,
    });
    if (!res.success) {
      setActionError(res.error || 'Engineering approval blocked.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-blue-600" />
            Engineering Deviations, Concessions & Redline Drawings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enforces real Redline Drawing file uploads (No File = INCOMPLETE / Cannot Approve) and links approved concessions to failing inspection characteristics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && db.deviations.length > 0 && (
            confirmClearDevsList ? (
              <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1.5 rounded">
                <span className="text-[11px] font-bold text-rose-900">
                  Delete all {db.deviations.length} Deviations?
                </span>
                <button
                  onClick={async () => {
                    await clearCollectionList('deviations');
                    setConfirmClearDevsList(false);
                    setSelectedDevId('');
                  }}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
                >
                  Confirm Clear
                </button>
                <button
                  onClick={() => setConfirmClearDevsList(false)}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClearDevsList(true)}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Deviations List ({db.deviations.length})
              </button>
            )
          )}
          <button
            onClick={() => {
              setFormError(null);
              setIsCreateModalOpen(true);
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Engineering Deviation
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successBanner && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between gap-3 text-xs text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Deviation #, Traceability, Part..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded text-xs py-1.5 px-2.5"
            >
              <option value="ALL">All Statuses</option>
              <option value="INCOMPLETE">INCOMPLETE (Missing Redline File)</option>
              <option value="AWAITING_APPROVAL">AWAITING APPROVAL</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs divide-y divide-slate-200 max-h-[620px] overflow-y-auto">
            {filteredDeviations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <GitBranch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">Zero Engineering Deviations</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Clean blank slate active. Any concession requests or redline drawing revisions will appear here.
                </p>
              </div>
            ) : (
              filteredDeviations.map((dev) => {
              const isSelected = selectedDev?.id === dev.id;
              return (
                <button
                  key={dev.id}
                  onClick={() => {
                    setSelectedDevId(dev.id);
                    setActionError(null);
                  }}
                  className={`w-full text-left p-3.5 transition-colors ${
                    isSelected
                      ? 'bg-blue-50/90 border-l-4 border-l-blue-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-xs text-slate-900">
                      {dev.deviationNumber}
                    </span>
                    <StatusBadge status={dev.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="font-mono text-xs font-bold text-blue-700">
                      {dev.traceabilityNumber} • {dev.partNumber}
                    </span>
                    {dev.ncrId && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        NCR: {dev.ncrId}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                    {dev.descriptionOfChange}
                  </p>
                </button>
              );
            })
          )}
          </div>
        </div>

        {/* Right Detail */}
        <div className="lg:col-span-8">
          {selectedDev ? (
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">
                    ENGINEERING DEVIATION & CONCESSION RECORD
                  </div>
                  <h3 className="text-lg font-black text-slate-900 font-mono">
                    {selectedDev.deviationNumber} — {selectedDev.traceabilityNumber}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedDev.status} size="md" />
                  {isAdmin && (
                    confirmDeleteDevId === selectedDev.id ? (
                      <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 px-2 py-1 rounded">
                        <span className="text-[11px] font-bold text-rose-900">Delete Deviation?</span>
                        <button
                          onClick={async () => {
                            await deleteDeviation(selectedDev.id);
                            setConfirmDeleteDevId(null);
                            setSelectedDevId('');
                          }}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteDevId(null)}
                          className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteDevId(selectedDev.id)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Record
                      </button>
                    )
                  )}
                </div>
              </div>

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded text-rose-900 font-semibold flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Automatically Recorded NCR Box */}
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-rose-950">
                      Automatically Recorded Non-Conformance:
                    </span>{' '}
                    <span className="font-mono font-black text-rose-800 bg-rose-200/80 px-2 py-0.5 rounded border border-rose-300">
                      {selectedDev.ncrId || `NCR-${selectedDev.deviationNumber.replace('DEV-', '')}`}
                    </span>
                    <div className="text-[11px] text-rose-700 mt-0.5">
                      Component placed on Quality Hold. Engineering departure requires authorized redline drawing approval before Quality Release.
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[10px] font-mono text-slate-500 block">PART & MACHINE</span>
                  <span className="font-mono font-bold text-slate-900">{selectedDev.partNumber}</span>
                  <span className="block text-[11px] font-mono text-blue-700">
                    {selectedDev.machineSerialNumber}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[10px] font-mono text-slate-500 block">
                    ORIGINAL DRAWING / REV
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedDev.originalDrawingNumber} Rev {selectedDev.originalDrawingRevision}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[10px] font-mono text-slate-500 block">
                    CONCESSION DISPOSITION
                  </span>
                  <StatusBadge status={selectedDev.approvedConcessionDisposition || 'USE_AS_IS'} />
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[10px] font-mono text-slate-500 block">
                    AFFECTED CHARACTERISTICS
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedDev.affectedCharacteristicNames?.join(', ') || 'General'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] font-mono uppercase font-bold text-slate-500">
                    Recorded Change / Non-Conforming Condition
                  </div>
                  <p className="text-slate-900 font-medium mt-1">
                    {selectedDev.descriptionOfChange}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] font-mono uppercase font-bold text-slate-500">
                    Engineering Reason & Justification
                  </div>
                  <p className="text-slate-900 font-medium mt-1">
                    {selectedDev.reasonForDeviation}
                  </p>
                </div>
              </div>

              {/* Mandatory Redlined Drawing File Section */}
              <div className="p-4 rounded-lg border-2 border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-mono font-black uppercase text-slate-900 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-blue-600" />
                    Controlled Redlined Drawing File Attachment
                  </div>
                  {selectedDev.redlineFile?.fileId ? (
                    <StatusBadge status="REDLINE ATTACHED" />
                  ) : (
                    <StatusBadge status="INCOMPLETE" />
                  )}
                </div>

                {selectedDev.redlineFile?.fileId ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200">
                    <div>
                      <div className="font-mono font-bold text-blue-700">
                        {selectedDev.redlineFile.originalFilename}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        File ID: {selectedDev.redlineFile.fileId} • Size:{' '}
                        {selectedDev.redlineFile.fileSize} bytes • Uploaded by{' '}
                        {selectedDev.redlineFile.uploadedBy}
                      </div>
                    </div>
                    <a
                      href={DBService.getAttachmentDownloadUrl(selectedDev.redlineFile)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> View / Download Redline PDF
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-2.5 bg-rose-50 border border-rose-300 rounded text-rose-900 font-semibold">
                      NO REDLINE FILE ATTACHED: This deviation is marked INCOMPLETE and cannot be approved until a real redlined drawing file is uploaded.
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => setAttachFileForExisting(e.target.files?.[0] || null)}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                      />
                      <button
                        onClick={handleUploadRedlineToExisting}
                        disabled={!attachFileForExisting}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded font-bold inline-flex items-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5" /> Upload Redline
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Engineering Approval Section */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                {selectedDev.engineeringApproved ? (
                  <div className="text-emerald-800 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Approved by {selectedDev.approvedBy} ({selectedDev.approvedById}) on{' '}
                    {selectedDev.approvalDate}
                  </div>
                ) : (
                  <div className="text-slate-500">
                    Awaiting Engineering / HSEQ approval signature.
                  </div>
                )}

                {!selectedDev.engineeringApproved && canApprove && (
                  <button
                    onClick={handleApproveDeviation}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Deviation & Sync Inspection Concession
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-xs text-slate-500 space-y-2">
              <GitBranch className="w-8 h-8 text-slate-300 mx-auto mb-1" />
              <p className="font-bold text-slate-700">Engineering Deviation &amp; Concession System</p>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                Clean blank slate active. When deviations or concessions are raised, select any record from the left to view engineering redlines and authorization sign-offs.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Deviation Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Engineering Deviation / Concession Request"
        subtitle="Select affected characteristics and upload real Redline Drawing file"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateDeviation} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded text-rose-900 font-semibold">
              {formError}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Manufacturing Record *
            </label>
            <select
              value={selectedMfgId}
              onChange={(e) => {
                setSelectedMfgId(e.target.value);
                setDevForm({ ...devForm, affectedCharacteristicIds: [] });
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded font-mono bg-white"
            >
              {db.manufacturingRecords.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.traceabilityNumber} — {r.partNumber} ({r.drawingNumber} Rev {r.drawingRevision})
                </option>
              ))}
            </select>
          </div>

          {linkedInspectionForCreate && linkedInspectionForCreate.characteristics.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
              <div className="font-bold text-slate-800">
                Select Affected Inspection Characteristic(s):
              </div>
              {linkedInspectionForCreate.characteristics.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={devForm.affectedCharacteristicIds.includes(c.id)}
                    onChange={(e) => {
                      const ids = e.target.checked
                        ? [...devForm.affectedCharacteristicIds, c.id]
                        : devForm.affectedCharacteristicIds.filter((id) => id !== c.id);
                      setDevForm({ ...devForm, affectedCharacteristicIds: ids });
                    }}
                  />
                  <span className="font-mono">
                    Char #{c.charNumber}: {c.feature} (Actual: {c.actual ?? 'N/A'} {c.unit} •{' '}
                    {c.result})
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Deviation Type *</label>
              <select
                value={devForm.deviationType}
                onChange={(e) =>
                  setDevForm({ ...devForm, deviationType: e.target.value as DeviationType })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
              >
                <option value="POST_INSPECTION_CONCESSION">POST-INSPECTION CONCESSION</option>
                <option value="INTENTIONAL_MANUFACTURING_CHANGE">
                  INTENTIONAL MANUFACTURING CHANGE
                </option>
                <option value="MATERIAL_SUBSTITUTION">MATERIAL SUBSTITUTION</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Approved Concession Disposition *
              </label>
              <select
                value={devForm.approvedConcessionDisposition}
                onChange={(e) =>
                  setDevForm({
                    ...devForm,
                    approvedConcessionDisposition: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
              >
                <option value="USE_AS_IS">USE AS IS</option>
                <option value="CONCESSION_ACCEPTED">CONCESSION ACCEPTED</option>
                <option value="REWORK_TO_REDLINE">REWORK TO REDLINE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Description of Change / Non-Conforming Dimension *
            </label>
            <textarea
              rows={2}
              required
              value={devForm.descriptionOfChange}
              onChange={(e) =>
                setDevForm({ ...devForm, descriptionOfChange: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Reason / Engineering Justification *
            </label>
            <textarea
              rows={2}
              required
              value={devForm.reasonForDeviation}
              onChange={(e) =>
                setDevForm({ ...devForm, reasonForDeviation: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={devForm.requiresRedline}
                onChange={(e) =>
                  setDevForm({ ...devForm, requiresRedline: e.target.checked })
                }
              />
              <span className="font-bold text-slate-800">
                Redlined Drawing Required (Mandatory for Intentional Changes & Dimensional Concessions)
              </span>
            </label>
            {devForm.requiresRedline && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Upload Redlined Drawing File (PDF / Image)
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setRedlineFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                />
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
              Create Deviation Record
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
