import React, { useState, useMemo, useEffect } from 'react';
import { useQMS } from '../context/QMSContext';
import { StatusBadge } from '../components/StatusBadge';
import { NCR } from '../types';
import { DBService } from '../services/db';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Lock,
  Award,
  AlertTriangle,
  History,
  Trash2,
  ExternalLink,
  Eye,
  Camera,
  ClipboardCheck,
  Calendar,
  User,
  X,
  FileText,
  Clock,
  Filter,
} from 'lucide-react';

const getPhotoUrl = (photo: any): string => {
  if (!photo) return '';
  if (typeof photo === 'string') return photo;
  return photo.dataUrl || photo.downloadUrl || DBService.resolveAttachmentPreviewUrl(photo);
};

export const QualityReleaseModule: React.FC = () => {
  const {
    db,
    currentUser,
    evaluateQualityRelease,
    executeQualityRelease,
    deleteRelease,
    clearCollectionList,
    crossNavTarget,
    clearCrossNavTarget,
  } = useQMS();

  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const [confirmDeleteRelId, setConfirmDeleteRelId] = useState<string | null>(null);
  const [confirmClearRelsList, setConfirmClearRelsList] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'NCR_HOLD' | 'READY'>('ALL');
  const [selectedMfgId, setSelectedMfgId] = useState<string>('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Modal to inspect full NCR details with photos right from Quality Release
  const [viewingNcr, setViewingNcr] = useState<NCR | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // All active/open NCRs across the entire workshop
  const openNcrsAcrossWorkshop = useMemo(() => {
    return (db.ncrs || []).filter((n) => n.status !== 'CLOSED');
  }, [db.ncrs]);

  // Listen for cross-navigation from Dale Inspections, NCRs module, or Dashboard
  useEffect(() => {
    if (crossNavTarget?.tab === 'quality-release' && crossNavTarget.recordId) {
      const matchRec = db.manufacturingRecords.find(
        (r) =>
          r.id === crossNavTarget.recordId ||
          r.traceabilityNumber === crossNavTarget.recordId ||
          r.partNumber === crossNavTarget.recordId ||
          (db.ncrs || []).some(
            (n) =>
              (n.ncrNumber === crossNavTarget.recordId || n.id === crossNavTarget.recordId) &&
              (n.manufacturingRecordId === r.id ||
                n.traceabilityNumber === r.traceabilityNumber ||
                n.partNumber === r.partNumber)
          )
      );
      if (matchRec) {
        setSelectedMfgId(matchRec.id);
        if (filterType === 'READY') setFilterType('ALL');
      }
      clearCrossNavTarget();
    }
  }, [crossNavTarget, db.manufacturingRecords, db.ncrs, clearCrossNavTarget, filterType]);

  // Priority default selection on mount: prioritize any record in NCR_HOLD or with open NCRs
  useEffect(() => {
    if (!selectedMfgId || !db.manufacturingRecords.some((r) => r.id === selectedMfgId)) {
      const holdRec = db.manufacturingRecords.find(
        (r) =>
          r.manufacturingStatus === 'NCR_HOLD' ||
          (db.ncrs || []).some(
            (n) =>
              n.status !== 'CLOSED' &&
              (n.manufacturingRecordId === r.id ||
                n.traceabilityNumber === r.traceabilityNumber ||
                n.partNumber === r.partNumber)
          )
      );
      if (holdRec) {
        setSelectedMfgId(holdRec.id);
      } else if (db.manufacturingRecords.length > 0) {
        setSelectedMfgId(db.manufacturingRecords[0].id);
      }
    }
  }, [db.manufacturingRecords, db.ncrs, selectedMfgId]);

  const filteredRecords = useMemo(() => {
    return db.manufacturingRecords.filter((r) => {
      const matchSearch =
        !searchTerm.trim() ||
        r.traceabilityNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.machineSerialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.projectNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.componentDescription && r.componentDescription.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;

      if (filterType === 'NCR_HOLD') {
        const evalRes = evaluateQualityRelease(r.id);
        return (evalRes.openNcrs && evalRes.openNcrs.length > 0) || r.manufacturingStatus === 'NCR_HOLD';
      }
      if (filterType === 'READY') {
        const evalRes = evaluateQualityRelease(r.id);
        return evalRes.canRelease;
      }
      return true;
    });
  }, [db.manufacturingRecords, searchTerm, filterType, evaluateQualityRelease]);

  // When filter changes, ensure selected record is within the filtered set
  useEffect(() => {
    if (filteredRecords.length > 0 && !filteredRecords.some((r) => r.id === selectedMfgId)) {
      setSelectedMfgId(filteredRecords[0].id);
    }
  }, [filteredRecords, selectedMfgId]);

  const selectedRecord = useMemo(
    () =>
      db.manufacturingRecords.find((r) => r.id === selectedMfgId) ||
      filteredRecords[0] ||
      db.manufacturingRecords[0],
    [db.manufacturingRecords, selectedMfgId, filteredRecords]
  );

  const evaluation = useMemo(() => {
    if (!selectedRecord) return null;
    return evaluateQualityRelease(selectedRecord.id);
  }, [selectedRecord, evaluateQualityRelease, db, currentUser]);

  const handleRelease = async () => {
    if (!selectedRecord) return;
    setFeedback(null);

    const res = await executeQualityRelease(selectedRecord.id, releaseNotes);
    if (!res.success) {
      setFeedback({
        type: 'error',
        message: res.error || 'Quality Release blocked by 18-point gate.',
      });
    } else {
      setFeedback({
        type: 'success',
        message: `Quality Release Certificate ${res.releaseId} issued for ${selectedRecord.traceabilityNumber} (${selectedRecord.partNumber}). Component status is now RELEASED.`,
      });
      setReleaseNotes('');
    }
  };

  const passedCount = evaluation ? evaluation.checks.filter((c) => c.passed).length : 0;
  const totalGates = evaluation ? evaluation.checks.length : 18;

  // Aggregate stats across all records for filter pills
  const stats = useMemo(() => {
    let ncrHolds = 0;
    let ready = 0;
    (db.manufacturingRecords || []).forEach((r) => {
      const evalRes = evaluateQualityRelease(r.id);
      if ((evalRes.openNcrs && evalRes.openNcrs.length > 0) || r.manufacturingStatus === 'NCR_HOLD') {
        ncrHolds++;
      } else if (evalRes.canRelease) {
        ready++;
      }
    });
    return {
      total: db.manufacturingRecords.length,
      ncrHolds,
      ready,
    };
  }, [db.manufacturingRecords, evaluateQualityRelease]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            18-Point Quality Release Gate (QG-01 through QG-18)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mandatory shop-floor quality barrier enforcing Non-Conformance closures, Dale checklists, Approved Drawing Snapshots, and Separation of Duties.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && db.releases.length > 0 && (
            confirmClearRelsList ? (
              <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1.5 rounded">
                <span className="text-[11px] font-bold text-rose-900">
                  Delete all {db.releases.length} Release Certificates?
                </span>
                <button
                  onClick={async () => {
                    await clearCollectionList('releases');
                    setConfirmClearRelsList(false);
                  }}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
                >
                  Confirm Clear
                </button>
                <button
                  onClick={() => setConfirmClearRelsList(false)}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClearRelsList(true)}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Releases ({db.releases.length})
              </button>
            )
          )}
          <div className="text-xs font-mono bg-slate-900 text-white px-3 py-1.5 rounded">
            Releasing Session: <strong>{currentUser.name}</strong> ({currentUser.id} / {currentUser.role})
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* WORKSHOP-WIDE ACTIVE NCRs & QUALITY QUARANTINE HOLD CENTER */}
      {/* ========================================================================= */}
      {openNcrsAcrossWorkshop.length > 0 ? (
        <div className="bg-rose-50/90 border-2 border-rose-400 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-200 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <h3 className="text-sm font-black text-rose-950 uppercase font-mono tracking-tight flex items-center gap-2">
                  <span>Active Shop-Floor Non-Conformances Blocking Quality Release</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-mono font-black">
                    {openNcrsAcrossWorkshop.length} OPEN NCR{openNcrsAcrossWorkshop.length === 1 ? '' : 'S'}
                  </span>
                </h3>
                <p className="text-[11px] text-rose-800 mt-0.5">
                  Affected equipment &amp; manufactured parts are quarantined on shop-floor Bay Hold. Release Gate QG-12 and QG-18 are strictly locked.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold text-rose-800 bg-rose-100 border border-rose-300 px-2.5 py-1 rounded-md self-start sm:self-auto shadow-2xs">
              Gate QG-12 Locked
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {openNcrsAcrossWorkshop.map((ncr) => {
              const matchingMfg = db.manufacturingRecords.find(
                (r) =>
                  r.id === ncr.manufacturingRecordId ||
                  r.traceabilityNumber === ncr.traceabilityNumber ||
                  r.partNumber === ncr.partNumber
              );
              const isSelected =
                selectedRecord &&
                (selectedRecord.id === ncr.manufacturingRecordId ||
                  selectedRecord.traceabilityNumber === ncr.traceabilityNumber ||
                  selectedRecord.partNumber === ncr.partNumber);

              return (
                <div
                  key={ncr.id || ncr.ncrNumber}
                  className={`p-3 rounded-lg border transition-all text-xs flex flex-col justify-between ${
                    isSelected
                      ? 'bg-rose-100/90 border-rose-500 ring-2 ring-rose-500 shadow-sm'
                      : 'bg-white border-rose-300 hover:border-rose-400'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300 text-[11px]">
                        {ncr.ncrNumber}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {ncr.createdAt ? new Date(ncr.createdAt).toLocaleDateString() : 'Active'}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 line-clamp-1">
                      {ncr.partNumber || ncr.traceabilityNumber}
                      {ncr.componentDescription ? ` — ${ncr.componentDescription}` : ''}
                    </div>

                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug">
                      {ncr.descriptionOfNonConformance || ncr.description || ncr.actualCondition}
                    </p>
                  </div>

                  <div className="pt-2.5 mt-2 border-t border-rose-200/80 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold text-rose-800">
                      Bay Hold: Quarantined
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (matchingMfg) {
                          setSelectedMfgId(matchingMfg.id);
                        } else {
                          setViewingNcr(ncr);
                        }
                      }}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors shrink-0"
                    >
                      <Lock className="w-3 h-3" />
                      <span>{isSelected ? 'Viewing 18 Gates' : 'Inspect 18 Gates'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/80 border border-emerald-300 rounded-lg p-3 text-xs text-emerald-900 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">Zero Open Non-Conformances across Workshop.</span>
            <span className="text-emerald-700">All shop-floor manufactured components conform without active NCR quarantine holds.</span>
          </div>
          <span className="font-mono text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
            Gate QG-12 Conforming
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Selector */}
        <div className="lg:col-span-4 space-y-3">
          {/* Search & Quick Filters */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Traceability, Part, Machine..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  filterType === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('NCR_HOLD')}
                className={`px-2 py-0.5 rounded font-semibold flex items-center gap-1 transition-colors ${
                  filterType === 'NCR_HOLD'
                    ? 'bg-rose-600 text-white'
                    : stats.ncrHolds > 0
                    ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>NCR Hold ({stats.ncrHolds})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType('READY')}
                className={`px-2 py-0.5 rounded font-semibold flex items-center gap-1 transition-colors ${
                  filterType === 'READY'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Ready ({stats.ready})</span>
              </button>
            </div>
          </div>

          {/* Record Selector List */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs divide-y divide-slate-200 max-h-[680px] overflow-y-auto">
            {filteredRecords.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No manufacturing records found matching current criteria.
              </div>
            ) : (
              filteredRecords.map((rec) => {
                const isSelected = selectedRecord?.id === rec.id;
                const gateEval = evaluateQualityRelease(rec.id);
                const hasOpenNcrs = gateEval.openNcrs && gateEval.openNcrs.length > 0;

                return (
                  <button
                    key={rec.id}
                    onClick={() => {
                      setSelectedMfgId(rec.id);
                      setFeedback(null);
                    }}
                    className={`w-full text-left p-3.5 transition-colors ${
                      isSelected
                        ? hasOpenNcrs
                          ? 'bg-rose-50/80 border-l-4 border-l-rose-600'
                          : 'bg-blue-50/90 border-l-4 border-l-blue-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-black text-xs text-slate-900">
                        {rec.traceabilityNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {hasOpenNcrs && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-mono font-black flex items-center gap-0.5 shadow-2xs animate-pulse">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>{gateEval.openNcrs.length} NCR HOLD</span>
                          </span>
                        )}
                        <StatusBadge status={rec.manufacturingStatus} />
                      </div>
                    </div>

                    <div className="font-mono text-xs font-bold text-blue-700 mt-1 line-clamp-1">
                      {rec.partNumber} — {rec.componentDescription}
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span className="truncate max-w-[160px]">Machine: {rec.machineSerialNumber}</span>
                      <span
                        className={
                          gateEval.canRelease
                            ? 'text-emerald-700 font-bold'
                            : 'text-rose-700 font-bold'
                        }
                      >
                        Gates: {gateEval.checks.filter((c) => c.passed).length}/18
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right 18-Gate Matrix & Associated NCRs */}
        <div className="lg:col-span-8 space-y-5">
          {selectedRecord && evaluation ? (
            <>
              {/* Summary Banner */}
              <div
                className={`rounded-lg p-5 border-2 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  selectedRecord.manufacturingStatus === 'RELEASED'
                    ? 'bg-emerald-950 text-white border-emerald-500'
                    : evaluation.canRelease
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-400'
                    : 'bg-rose-50 text-rose-950 border-rose-400'
                }`}
              >
                <div className="space-y-1">
                  <div className="text-xs font-mono uppercase font-black tracking-wider flex items-center gap-2">
                    {selectedRecord.manufacturingStatus === 'RELEASED' ? (
                      <>
                        <Award className="w-5 h-5 text-emerald-400" />
                        COMPONENT FORMALLY RELEASED FOR MACHINE ASSEMBLY
                      </>
                    ) : evaluation.canRelease ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ALL 18 QUALITY RELEASE GATES PASSED ({passedCount}/{totalGates})
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5 text-rose-600" />
                        QUALITY RELEASE BLOCKED ({passedCount}/{totalGates} GATES PASSED)
                      </>
                    )}
                  </div>
                  <div className="text-sm font-bold font-mono">
                    {selectedRecord.traceabilityNumber} • {selectedRecord.partNumber} (
                    {selectedRecord.componentDescription})
                  </div>
                  <div className="text-xs opacity-90 font-mono">
                    Machine: {selectedRecord.machineSerialNumber} | Project:{' '}
                    {selectedRecord.projectNumber} | Drawing: {selectedRecord.drawingNumber} Rev{' '}
                    {selectedRecord.drawingRevision}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <StatusBadge status={selectedRecord.manufacturingStatus} size="md" />
                  {isAdmin &&
                    (() => {
                      const matchingRel = db.releases.find(
                        (qr) => qr.manufacturingRecordId === selectedRecord.id
                      );
                      if (!matchingRel) return null;
                      return confirmDeleteRelId === matchingRel.id ? (
                        <div className="inline-flex items-center gap-1 bg-rose-900 border border-rose-400 px-2 py-1 rounded text-white">
                          <span className="text-[11px] font-bold">Revoke & Delete Release?</span>
                          <button
                            onClick={async () => {
                              await deleteRelease(matchingRel.id);
                              setConfirmDeleteRelId(null);
                            }}
                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDeleteRelId(null)}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteRelId(matchingRel.id)}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold inline-flex items-center gap-1"
                          title="Admin: Delete Quality Release Certificate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Release
                        </button>
                      );
                    })()}
                </div>
              </div>

              {/* Superseded Notice */}
              {evaluation.supersededNotice && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-950 flex items-start gap-2.5">
                  <History className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-mono uppercase">Historical Drawing Snapshot Valid:</strong>{' '}
                    {evaluation.supersededNotice}
                  </div>
                </div>
              )}

              {feedback && (
                <div
                  className={`p-3.5 rounded-lg border text-xs font-semibold ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              {/* ========================================================================= */}
              {/* ASSOCIATED NON-CONFORMANCE REPORTS (NCRs) & QUALITY BAY HOLDS PANEL */}
              {/* ========================================================================= */}
              <div className="bg-white rounded-lg border-2 border-slate-200 shadow-xs overflow-hidden">
                <div
                  className={`p-3.5 flex items-center justify-between text-xs font-mono font-bold ${
                    evaluation.openNcrs && evaluation.openNcrs.length > 0
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-900 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="uppercase tracking-wider">
                      Associated Non-Conformance Reports (NCRs) &amp; Quality Holds
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/20 text-white font-mono text-[11px]">
                      {evaluation.allNcrs?.length || 0} Total
                    </span>
                  </div>

                  {evaluation.openNcrs && evaluation.openNcrs.length > 0 ? (
                    <span className="bg-white text-rose-700 px-2.5 py-0.5 rounded font-black text-[11px] shadow-2xs flex items-center gap-1 animate-pulse">
                      <Lock className="w-3 h-3" />
                      <span>{evaluation.openNcrs.length} OPEN — RELEASE STRICTLY BLOCKED</span>
                    </span>
                  ) : (
                    <span className="bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded font-semibold text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>GATE QG-12 CONFORMING</span>
                    </span>
                  )}
                </div>

                {/* Critical Blocking Warning when Open NCRs exist */}
                {evaluation.openNcrs && evaluation.openNcrs.length > 0 && (
                  <div className="p-3.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-rose-950">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>CRITICAL QUALITY GATE BLOCK: COMPONENT QUARANTINED ON SHOP-FLOOR BAY HOLD</span>
                    </div>
                    <p className="text-[11px] text-rose-800 leading-relaxed pl-5.5">
                      This component cannot receive final Quality Release sign-off because <strong>{evaluation.openNcrs.length} active NCR(s)</strong> have not been formally dispositioned and closed. Component must remain physically quarantined in inspection hold.
                    </p>
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {/* Open NCRs List */}
                  {evaluation.openNcrs && evaluation.openNcrs.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-black uppercase font-mono tracking-wider text-rose-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                        <span>Active Blocking Non-Conformances ({evaluation.openNcrs.length})</span>
                      </h4>

                      <div className="divide-y divide-rose-200 border border-rose-300 rounded-lg overflow-hidden bg-rose-50/40">
                        {evaluation.openNcrs.map((ncr) => (
                          <div key={ncr.id || ncr.ncrNumber} className="p-3.5 space-y-2.5">
                            {/* NCR Header Bar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-rose-600 text-white shadow-2xs">
                                  {ncr.ncrNumber}
                                </span>
                                <span className="font-mono font-bold text-xs text-slate-800">
                                  {ncr.componentDescription || `${ncr.partNumber} (${ncr.drawingNumber})`}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-rose-200 text-rose-900 border border-rose-300">
                                  STATUS: {ncr.status}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => setViewingNcr(ncr)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-bold text-xs flex items-center gap-1 self-start sm:self-auto shadow-2xs transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-600" />
                                <span>Inspect Full Record</span>
                              </button>
                            </div>

                            {/* Deviation Description */}
                            <div className="bg-white p-2.5 rounded border border-rose-200 text-xs text-slate-800 space-y-1">
                              <div className="font-bold text-rose-950 flex items-center gap-1">
                                <span>Recorded Defect / Finding:</span>
                              </div>
                              <p className="text-[11px] text-slate-700 leading-snug">
                                {ncr.descriptionOfNonConformance || ncr.description || ncr.actualCondition}
                              </p>
                              {ncr.requirement && (
                                <div className="text-[10px] text-slate-600 font-mono mt-1 pt-1 border-t border-slate-100">
                                  <strong className="text-slate-800">Requirement / Spec:</strong> {ncr.requirement}
                                </div>
                              )}
                            </div>

                            {/* Containment & Disposition Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                              <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
                                <span className="text-[9px] uppercase font-bold text-amber-700 block">Immediate Containment</span>
                                <span className="font-medium text-xs">{ncr.immediateContainment || 'Quarantined on Quality Hold'}</span>
                              </div>
                              <div className="p-2 rounded bg-blue-50 border border-blue-200 text-blue-900">
                                <span className="text-[9px] uppercase font-bold text-blue-700 block">Proposed Disposition</span>
                                <span className="font-bold text-xs">{ncr.proposedDisposition || 'REWORK'}</span>
                              </div>
                              <div className="p-2 rounded bg-slate-100 border border-slate-200 text-slate-800">
                                <span className="text-[9px] uppercase font-bold text-slate-500 block">Responsible Person</span>
                                <span className="font-medium text-xs">{ncr.responsiblePerson || 'Shop Floor Quality'}</span>
                              </div>
                            </div>

                            {/* Photo Evidence Thumbnails */}
                            {ncr.issuePhotoEvidence && ncr.issuePhotoEvidence.length > 0 && (
                              <div className="pt-1.5 flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1 font-mono">
                                  <Camera className="w-3 h-3 text-rose-600" />
                                  <span>Photo Evidence ({ncr.issuePhotoEvidence.length}):</span>
                                </span>
                                {ncr.issuePhotoEvidence.map((photo, pIdx) => {
                                  const url = getPhotoUrl(photo);
                                  return (
                                    <button
                                      key={pIdx}
                                      type="button"
                                      onClick={() => setPreviewPhoto(url)}
                                      className="w-10 h-10 rounded border border-rose-300 overflow-hidden hover:opacity-80 transition-opacity bg-white shrink-0 shadow-2xs"
                                      title="Click to view full photo evidence"
                                    >
                                      <img
                                        src={url}
                                        alt={`Evidence ${pIdx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Closed / Resolved NCRs */}
                  {evaluation.closedNcrs && evaluation.closedNcrs.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <h4 className="text-[11px] font-bold uppercase font-mono text-slate-600 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Formally Closed / Resolved NCRs ({evaluation.closedNcrs.length})</span>
                      </h4>
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
                        {evaluation.closedNcrs.map((ncr) => (
                          <div key={ncr.id || ncr.ncrNumber} className="p-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {ncr.ncrNumber}
                              </span>
                              <span className="text-slate-600 truncate max-w-[280px]">
                                {ncr.description || ncr.descriptionOfNonConformance}
                              </span>
                              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                                CLOSED ({ncr.closedAt?.split('T')[0] || 'Resolved'})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setViewingNcr(ncr)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                            >
                              Details
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Zero NCRs State */}
                  {(!evaluation.allNcrs || evaluation.allNcrs.length === 0) && (
                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center gap-3 text-xs text-emerald-950">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-bold">Zero Non-Conformance Reports recorded against this component</div>
                        <div className="text-[11px] text-emerald-800 mt-0.5">
                          Part conforms to Dale Automation drawing specifications without active quality holds. Gate QG-12 passed.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 18-Gate Checklist Table */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider">
                    18-Point Technical Release Verification Matrix (QG-01 to QG-18)
                  </span>
                  <span className="text-xs font-mono text-blue-300 font-bold">
                    {passedCount} / {totalGates} Passed
                  </span>
                </div>

                <div className="divide-y divide-slate-200">
                  {evaluation.checks.map((gate) => (
                    <div
                      key={gate.id}
                      className={`p-3 flex items-start justify-between gap-3 text-xs ${
                        gate.passed ? 'bg-white' : 'bg-rose-50/60'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {gate.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-bold text-slate-900">
                            <span className="font-mono text-blue-700 mr-1.5">{gate.id}</span>
                            {gate.requirement}
                          </div>
                          <div
                            className={`text-[11px] font-mono mt-0.5 ${
                              gate.passed ? 'text-slate-600' : 'text-rose-800 font-semibold'
                            }`}
                          >
                            {gate.details}
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={gate.passed ? 'PASS' : 'BLOCKED'} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Execute Release Action Box */}
              {selectedRecord.manufacturingStatus !== 'RELEASED' && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Quality Release Notes / Certificate Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional release certificate remarks..."
                    value={releaseNotes}
                    onChange={(e) => setReleaseNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleRelease}
                      className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 shadow-xs transition-colors ${
                        evaluation.canRelease
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                    >
                      <Award className="w-4 h-4" />
                      {evaluation.canRelease
                        ? `Execute Final Quality Release (${currentUser.name})`
                        : 'Attempt Quality Release (Will Log Blocked Attempt)'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
              <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-base text-slate-800">18-Point Quality Release Barrier</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Clean blank slate active. Once components are created or imported, select any component from the list on the left to evaluate all 18 quality gates before authorizing workshop release.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: FULL NCR DETAILS & DISPOSITION REPORT */}
      {/* ========================================================================= */}
      {viewingNcr && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-300 shadow-2xl overflow-hidden my-8">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <div>
                  <h3 className="font-mono font-bold text-sm">
                    Non-Conformance Report {viewingNcr.ncrNumber}
                  </h3>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Created {viewingNcr.createdAt ? new Date(viewingNcr.createdAt).toLocaleString() : 'N/A'} by {viewingNcr.createdBy}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingNcr(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Status Header */}
              <div className="flex items-center justify-between gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <div>
                  <span className="text-[10px] font-mono uppercase text-rose-700 block font-bold">STATUS &amp; DISPOSITION</span>
                  <span className="font-black font-mono text-sm text-rose-950">{viewingNcr.status}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase text-rose-700 block font-bold">PROPOSED ACTION</span>
                  <span className="font-bold text-xs text-rose-900">{viewingNcr.proposedDisposition || 'REWORK'}</span>
                </div>
              </div>

              {/* Linked Engineering References */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px]">TRACEABILITY / SERIAL</span>
                  <strong className="text-slate-900">{viewingNcr.traceabilityNumber || viewingNcr.partNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">PROJECT / JOB</span>
                  <strong className="text-slate-900">{viewingNcr.projectNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">DRAWING NUMBER &amp; REV</span>
                  <strong className="text-blue-700">{viewingNcr.drawingNumber} Rev {viewingNcr.drawingRevision}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">MACHINE / ASSEMBLY</span>
                  <strong className="text-slate-900 truncate block">{viewingNcr.machineSerialNumber}</strong>
                </div>
              </div>

              {/* Full Description */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Description of Non-Conformance:</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 leading-relaxed">
                  {viewingNcr.descriptionOfNonConformance || viewingNcr.description || viewingNcr.actualCondition}
                </div>
              </div>

              {/* Requirement & Spec */}
              {viewingNcr.requirement && (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Engineering Requirement:</label>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono text-[11px]">
                    {viewingNcr.requirement}
                  </div>
                </div>
              )}

              {/* Containment & Root Cause */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Immediate Containment:</label>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-950 text-[11px]">
                    {viewingNcr.immediateContainment || 'Quarantined in Quality Bay Hold.'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Corrective Action:</label>
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-950 text-[11px]">
                    {viewingNcr.correctiveAction || 'Rework component to drawing specifications.'}
                  </div>
                </div>
              </div>

              {/* Photo Evidence in Modal */}
              {viewingNcr.issuePhotoEvidence && viewingNcr.issuePhotoEvidence.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-200">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-blue-600" />
                    <span>Attached Defect Photo Evidence ({viewingNcr.issuePhotoEvidence.length}):</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    {viewingNcr.issuePhotoEvidence.map((photo, pIdx) => {
                      const photoUrl =
                        typeof photo === 'string'
                          ? photo
                          : (photo as any)?.storageUrl || (photo as any)?.thumbnailUrl || '';
                      return (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => setPreviewPhoto(photoUrl)}
                          className="aspect-square rounded-lg border border-slate-300 overflow-hidden bg-slate-100 hover:opacity-90 shadow-2xs"
                        >
                          <img
                            src={photoUrl}
                            alt={`Evidence ${pIdx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingNcr(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Photo Preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="max-w-3xl max-h-[85vh] relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewPhoto}
              alt="Defect Evidence"
              className="max-h-[80vh] w-auto rounded-lg shadow-2xl object-contain border-2 border-white"
            />
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-3 -right-3 p-1.5 bg-slate-900 text-white rounded-full hover:bg-slate-800 border-2 border-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
