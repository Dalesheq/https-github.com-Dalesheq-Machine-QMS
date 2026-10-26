import React, { useState, useMemo } from 'react';
import { useQMS } from '../context/QMSContext';
import {
  InspectionRecord,
  DrawingVerificationChecklist,
  NCRDisposition,
  DeviationType,
  FileAttachmentMetadata,
} from '../types';
import { DBService } from '../services/db';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { PhotoEvidenceGallery } from '../components/PhotoEvidenceGallery';
import {
  ClipboardCheck,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Lock,
  Ruler,
  FileCheck,
  GitPullRequest,
  History,
  Download,
  Trash2,
} from 'lucide-react';
import { DaleInspectionsModule } from './DaleInspectionsModule';

export const InspectionsModule: React.FC = () => {
  const {
    db,
    currentUser,
    startInspection,
    updateInspection,
    addInspectionCharacteristic,
    recordCharacteristicReading,
    signOffInspection,
    createNCR,
    createDeviation,
    uploadAttachmentFile,
    deleteInspection,
    deleteInspectionCharacteristic,
    clearCollectionList,
  } = useQMS();

  const [inspectionViewMode, setInspectionViewMode] = useState<'DALE_SHEETS' | 'DIMENSIONAL'>('DALE_SHEETS');

  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const [confirmDeleteInspId, setConfirmDeleteInspId] = useState<string | null>(null);
  const [confirmClearInspsList, setConfirmClearInspsList] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInspId, setSelectedInspId] = useState<string>(
    db.inspections[0]?.id || ''
  );

  // Start New Inspection Modal
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [selectedMfgForNew, setSelectedMfgForNew] = useState(
    db.manufacturingRecords[0]?.id || ''
  );
  const [startError, setStartError] = useState<string | null>(null);

  // Add Characteristic Modal
  const [isAddCharModalOpen, setIsAddCharModalOpen] = useState(false);
  const [newCharForm, setNewCharForm] = useState({
    feature: '',
    nominal: 50.0,
    upperTolerance: 0.02,
    lowerTolerance: -0.02,
    unit: 'mm',
    measuringInstrument: 'Mitutoyo Digital Micrometer',
    instrumentId: 'MIC-042',
  });
  const [charError, setCharError] = useState<string | null>(null);

  // Quick Raise NCR Modal
  const [isNcrModalOpen, setIsNcrModalOpen] = useState(false);
  const [ncrDisposition, setNcrDisposition] = useState<NCRDisposition>(
    'USE_AS_IS_DEVIATION_REQUIRED'
  );
  const [ncrRootCause, setNcrRootCause] = useState(
    'Thermal growth on final finishing pass.'
  );
  const [ncrCorrective, setNcrCorrective] = useState(
    'Submit engineering concession request and update CNC probe macro.'
  );
  const [ncrIssuePhotos, setNcrIssuePhotos] = useState<FileAttachmentMetadata[]>([]);
  const [ncrCorrectivePhotos, setNcrCorrectivePhotos] = useState<FileAttachmentMetadata[]>([]);

  // Quick Request Deviation Modal
  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [devType, setDevType] = useState<DeviationType>('POST_INSPECTION_CONCESSION');
  const [devConcessionDisposition, setDevConcessionDisposition] = useState<
    'USE_AS_IS' | 'CONCESSION_ACCEPTED' | 'REWORK_TO_REDLINE'
  >('USE_AS_IS');
  const [devChangeDesc, setDevChangeDesc] = useState('');
  const [devReason, setDevReason] = useState('');
  const [devRequiresRedline, setDevRequiresRedline] = useState(true);
  const [devRedlineFile, setDevRedlineFile] = useState<File | null>(null);
  const [devError, setDevError] = useState<string | null>(null);

  // Sign-off state
  const [signOffDeclaration, setSignOffDeclaration] = useState(
    'I certify that all dimensional measurements and drawing verifications have been completed in accordance with the QMS procedure.'
  );
  const [signOffFeedback, setSignOffFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const filteredInspections = useMemo(() => {
    return db.inspections.filter(
      (i) =>
        i.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.traceabilityNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.machineSerialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.drawingNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [db.inspections, searchTerm]);

  const selectedInspection: InspectionRecord | undefined = useMemo(
    () =>
      db.inspections.find((i) => i.id === selectedInspId) ||
      filteredInspections[0],
    [db.inspections, selectedInspId, filteredInspections]
  );

  const linkedMfgRecord = useMemo(
    () =>
      selectedInspection
        ? db.manufacturingRecords.find(
            (r) => r.id === selectedInspection.manufacturingRecordId
          )
        : undefined,
    [db.manufacturingRecords, selectedInspection]
  );

  const recordDeviations = useMemo(
    () =>
      selectedInspection
        ? db.deviations.filter(
            (d) =>
              d.manufacturingRecordId ===
              selectedInspection.manufacturingRecordId
          )
        : [],
    [db.deviations, selectedInspection]
  );

  const syncedCharacteristics = useMemo(() => {
    if (!selectedInspection) return [];
    return DBService.syncCharacteristicsWithDeviations(
      selectedInspection.characteristics,
      recordDeviations
    );
  }, [selectedInspection, recordDeviations]);

  const evalSummary = useMemo(() => {
    return DBService.evaluateInspection(syncedCharacteristics, recordDeviations);
  }, [syncedCharacteristics, recordDeviations]);

  const handleToggleDrawingCheck = async (
    key: keyof DrawingVerificationChecklist
  ) => {
    if (!selectedInspection) return;
    const updatedDv: DrawingVerificationChecklist = {
      ...selectedInspection.drawingVerification,
      [key]: !selectedInspection.drawingVerification[key],
    };
    await updateInspection(selectedInspection.id, {
      drawingVerification: updatedDv,
    });
  };

  const handleConfirmAllDrawingChecks = async () => {
    if (!selectedInspection) return;
    await updateInspection(selectedInspection.id, {
      drawingVerification: {
        correctDrawingNumber: true,
        correctDrawingRevision: true,
        drawingApproved: true,
        componentCorrespondsToDrawing: true,
        associationCorrect: true,
      },
    });
  };

  const handleStartNewInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    setStartError(null);
    if (!selectedMfgForNew) {
      setStartError('Please select a manufacturing record.');
      return;
    }
    const res = await startInspection(selectedMfgForNew);
    if (!res.success) {
      setStartError(res.error || 'Failed to start inspection.');
      return;
    }
    if (res.inspectionId) {
      setSelectedInspId(res.inspectionId);
    }
    setIsStartModalOpen(false);
  };

  const handleAddCharSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInspection) return;
    setCharError(null);

    const res = await addInspectionCharacteristic(selectedInspection.id, {
      feature: newCharForm.feature.trim(),
      nominal: Number(newCharForm.nominal),
      upperTolerance: Number(newCharForm.upperTolerance),
      lowerTolerance: Number(newCharForm.lowerTolerance),
      unit: newCharForm.unit.trim() || 'mm',
      measuringInstrument: newCharForm.measuringInstrument.trim(),
      instrumentId: newCharForm.instrumentId.trim(),
    });

    if (!res.success) {
      setCharError(res.error || 'Invalid tolerance parameters.');
      return;
    }

    setIsAddCharModalOpen(false);
    setNewCharForm({
      feature: '',
      nominal: 50.0,
      upperTolerance: 0.02,
      lowerTolerance: -0.02,
      unit: 'mm',
      measuringInstrument: 'Mitutoyo Digital Micrometer',
      instrumentId: 'MIC-042',
    });
  };

  const handleExecuteSignOff = async () => {
    if (!selectedInspection) return;
    setSignOffFeedback(null);

    const res = await signOffInspection(
      selectedInspection.id,
      signOffDeclaration
    );
    if (!res.success) {
      setSignOffFeedback({
        type: 'error',
        message: res.error || 'Inspector sign-off blocked.',
      });
    } else {
      setSignOffFeedback({
        type: 'success',
        message:
          evalSummary.deviationAcceptedChars.length > 0
            ? `Inspection formally signed off with ACCEPTED_BY_APPROVED_DEVIATION (${evalSummary.deviationAcceptedChars
                .map((c) => c.deviationNumber)
                .join(', ')}).`
            : 'Inspection formally signed off! Component is ready for Quality Release.',
      });
    }
  };

  const handleQuickCreateNcr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInspection) return;

    const failedList = evalSummary.uncoveredFailedChars.map(
      (c) =>
        `Char #${c.charNumber} ${c.feature}: Nominal ${c.nominal ?? 'N/A'} (${c.lowerTolerance ?? '0'}/${
          (c.upperTolerance ?? 0) >= 0 ? `+${c.upperTolerance ?? 0}` : c.upperTolerance ?? 0
        } ${c.unit}), Actual = ${c.actual} ${c.unit} [FAIL]`
    );

    const res = await createNCR({
      manufacturingRecordId: selectedInspection.manufacturingRecordId,
      inspectionRecordId: selectedInspection.id,
      traceabilityNumber: selectedInspection.traceabilityNumber,
      machineSerialNumber: selectedInspection.machineSerialNumber,
      projectNumber: selectedInspection.projectNumber,
      partNumber: selectedInspection.partNumber,
      componentDescription: selectedInspection.componentDescription,
      drawingNumber: selectedInspection.drawingNumber,
      drawingRevision: selectedInspection.drawingRevision,
      failedCharacteristics: failedList,
      description: failedList.join('; '),
      descriptionOfNonConformance: failedList.join('; '),
      requirement: `Drawing ${selectedInspection.drawingNumber} Rev ${selectedInspection.drawingRevision} dimensional tolerances`,
      actualCondition: failedList.join('; '),
      immediateContainment:
        'Automatically placed on QUALITY HOLD upon out-of-tolerance measurement. Quarantined in QA Hold Area.',
      proposedDisposition: ncrDisposition,
      rootCause: ncrRootCause,
      correctiveAction: ncrCorrective,
      issuePhotoEvidence: ncrIssuePhotos,
      correctiveActionPhotoEvidence: ncrCorrectivePhotos,
      responsiblePerson: 'Dr. Elena Rostova',
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    });

    if (res.success) {
      setIsNcrModalOpen(false);
      setNcrIssuePhotos([]);
      setNcrCorrectivePhotos([]);
    } else if (res.error) {
      alert(res.error);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleQuickCreateDeviation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInspection) return;
    setDevError(null);

    let uploadedRedline: FileAttachmentMetadata | undefined;
    if (devRedlineFile) {
      const base64Data = await fileToBase64(devRedlineFile);
      const up = await uploadAttachmentFile({
        originalFilename: devRedlineFile.name,
        mimeType: devRedlineFile.type || 'application/pdf',
        base64Data,
        category: 'REDLINE',
        relatedRecordId: selectedInspection.manufacturingRecordId,
        drawingNumber: selectedInspection.drawingNumber,
        revision: selectedInspection.drawingRevision,
      });
      if (!up.success) {
        setDevError(up.error || 'Failed to upload redline file.');
        return;
      }
      uploadedRedline = up.attachment;
    }

    const failedChars = syncedCharacteristics.filter((c) => c.result === 'FAIL');
    const res = await createDeviation({
      manufacturingRecordId: selectedInspection.manufacturingRecordId,
      inspectionRecordId: selectedInspection.id,
      traceabilityNumber: selectedInspection.traceabilityNumber,
      machineSerialNumber: selectedInspection.machineSerialNumber,
      projectNumber: selectedInspection.projectNumber,
      partNumber: selectedInspection.partNumber,
      originalDrawingNumber: selectedInspection.drawingNumber,
      originalDrawingRevision: selectedInspection.drawingRevision,
      deviationType: devType,
      affectedCharacteristicIds: failedChars.map((c) => c.id),
      affectedCharacteristicNames: failedChars.map((c) => c.feature),
      approvedConcessionDisposition: devConcessionDisposition,
      descriptionOfChange:
        devChangeDesc.trim() ||
        `Accept ${failedChars.map((c) => `${c.feature} at ${c.actual}${c.unit}`).join(', ')}`,
      reasonForDeviation:
        devReason.trim() || 'Post-machining dimensional concession evaluated for functional fit.',
      requiresRedline: devRequiresRedline,
      redlineFile: uploadedRedline,
      status: devRequiresRedline && !uploadedRedline ? 'INCOMPLETE' : 'AWAITING_APPROVAL',
    });

    if (!res.success) {
      setDevError(res.error || 'Failed to create deviation.');
      return;
    }

    setIsDevModalOpen(false);
    setDevRedlineFile(null);
  };

  const isSameUserAsMachinist =
    selectedInspection && currentUser.id === selectedInspection.machinistId;

  return (
    <div className="space-y-6">
      {/* Primary Mode Switcher: Dale Quality Inspections (7 Processes) vs Dimensional Metrology */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setInspectionViewMode('DALE_SHEETS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              inspectionViewMode === 'DALE_SHEETS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Dale Automation Manufacturing Inspections (7 Processes)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                inspectionViewMode === 'DALE_SHEETS'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-800'
              }`}
            >
              {db.daleInspections?.length || 7} Sheets
            </span>
          </button>

          <button
            type="button"
            onClick={() => setInspectionViewMode('DIMENSIONAL')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              inspectionViewMode === 'DIMENSIONAL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Ruler className="w-4 h-4" />
            <span>Dimensional Metrology Sheets (Tolerance Math)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                inspectionViewMode === 'DIMENSIONAL'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-800'
              }`}
            >
              {db.inspections.length} Records
            </span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-mono hidden md:inline-block">
          {inspectionViewMode === 'DALE_SHEETS'
            ? 'Covering fabrication, machined parts, conveyors, spirals, assembly, electrical & final release'
            : 'Detailed nominal & tolerance mathematics inspection'}
        </span>
      </div>

      {inspectionViewMode === 'DALE_SHEETS' ? (
        <DaleInspectionsModule />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            QMS Dimensional Inspection Sheets & Sign-Off
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic PASS/FAIL calculation from Nominal + Lower/Upper Tolerances, immediate Quality Hold on failure, and Approved Deviation Concession integration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSelectedMfgForNew(db.manufacturingRecords[0]?.id || '');
              setStartError(null);
              setIsStartModalOpen(true);
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Start / Open Inspection Sheet
          </button>

          {isAdmin && db.inspections.length > 0 && (
            <>
              {!confirmClearInspsList ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearInspsList(true)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                  title="Administrator: Clear entire Inspections List"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear List ({db.inspections.length})
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded text-xs">
                  <span className="font-bold text-rose-900">
                    Clear all {db.inspections.length} inspections?
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await clearCollectionList('inspections');
                      setConfirmClearInspsList(false);
                    }}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[11px]"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearInspsList(false)}
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

      {/* Main Layout: Left Sidebar Selector + Right Inspection Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Inspection Register List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Inspection ID, Traceability, Part..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs divide-y divide-slate-200 max-h-[680px] overflow-y-auto">
            {filteredInspections.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">Zero Dimensional Inspections</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Clean blank slate active. When manufacturing records are logged, metrological inspection checklists will appear here for dimensional sign-off.
                </p>
              </div>
            ) : (
              filteredInspections.map((insp) => {
              const isSelected = selectedInspection?.id === insp.id;
              return (
                <button
                  key={insp.id}
                  onClick={() => {
                    setSelectedInspId(insp.id);
                    setSignOffFeedback(null);
                  }}
                  className={`w-full text-left p-3.5 transition-colors ${
                    isSelected
                      ? 'bg-blue-50/90 border-l-4 border-l-blue-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-xs text-slate-900">
                      {insp.id}
                    </span>
                    <StatusBadge status={insp.status} />
                  </div>
                  <div className="font-mono text-xs font-bold text-blue-700 mt-1">
                    {insp.traceabilityNumber} • {insp.partNumber}
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">
                    {insp.componentDescription}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Machine: {insp.machineSerialNumber}</span>
                    <span>
                      {insp.drawingNumber} Rev {insp.drawingRevision}
                    </span>
                  </div>
                </button>
              );
            })
          )}
          </div>
        </div>

        {/* Right Column: Active Inspection Sheet */}
        <div className="lg:col-span-8 space-y-5">
          {selectedInspection ? (
            <>
              {/* REQUIREMENT 2: PROMINENT QUALITY HOLD BANNER WHEN OUT OF TOLERANCE */}
              {(evalSummary.uncoveredFailedChars.length > 0 ||
                linkedMfgRecord?.manufacturingStatus === 'HOLD' ||
                linkedMfgRecord?.manufacturingStatus === 'NCR_HOLD') &&
                evalSummary.uncoveredFailedChars.length > 0 && (
                  <div className="bg-rose-950 text-white border-2 border-rose-500 rounded-lg p-4 shadow-md space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="w-7 h-7 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-black uppercase tracking-wider font-mono text-rose-300">
                            QUALITY HOLD — ONE OR MORE MEASUREMENTS ARE OUT OF TOLERANCE
                          </div>
                          <p className="text-xs text-rose-100 mt-0.5">
                            Inspection Status = <strong>FAIL</strong> • Manufacturing Status ={' '}
                            <strong>{linkedMfgRecord?.manufacturingStatus || 'HOLD'}</strong> • Quality Release ={' '}
                            <strong>BLOCKED</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setIsNcrModalOpen(true)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold font-mono uppercase tracking-wider shadow-xs"
                        >
                          CREATE NCR
                        </button>
                        <button
                          onClick={() => {
                            const failedNames = evalSummary.uncoveredFailedChars
                              .map((c) => `${c.feature} (${c.actual} ${c.unit})`)
                              .join(', ');
                            setDevChangeDesc(`Accept out-of-tolerance reading: ${failedNames}`);
                            setDevReason(
                              'Engineering evaluation confirms functional fit with mating assembly.'
                            );
                            setDevError(null);
                            setIsDevModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded text-xs font-bold font-mono uppercase tracking-wider shadow-xs"
                        >
                          REQUEST DEVIATION
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {/* Banner when failed characteristic is covered by an APPROVED Deviation */}
              {evalSummary.deviationAcceptedChars.length > 0 &&
                evalSummary.uncoveredFailedChars.length === 0 && (
                  <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 text-amber-950 flex items-start gap-3">
                    <GitPullRequest className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <div className="font-black uppercase font-mono tracking-wider text-amber-900">
                        FAILED CHARACTERISTIC ACCEPTED BY APPROVED ENGINEERING DEVIATION
                      </div>
                      <p>
                        Original calculated result remains <strong>FAIL</strong> for full audit integrity, with Disposition ={' '}
                        <strong className="font-mono bg-amber-200/80 px-1.5 py-0.5 rounded">
                          ACCEPTED_BY_APPROVED_DEVIATION
                        </strong>{' '}
                        ({evalSummary.deviationAcceptedChars.map((c) => c.deviationNumber).join(', ')}). Inspector sign-off is now unlocked.
                      </p>
                    </div>
                  </div>
                )}

              {/* Sheet Metadata Card */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">
                      QMS FINAL MACHINING INSPECTION SHEET
                    </div>
                    <h3 className="text-lg font-black text-slate-900 font-mono">
                      {selectedInspection.id} — {selectedInspection.traceabilityNumber}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedInspection.status} size="md" />
                    {linkedMfgRecord && (
                      <StatusBadge status={linkedMfgRecord.manufacturingStatus} size="md" />
                    )}
                    {isAdmin && (
                      <>
                        {confirmDeleteInspId !== selectedInspection.id ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteInspId(selectedInspection.id)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-xs font-bold inline-flex items-center gap-1"
                            title={`Delete Inspection ${selectedInspection.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete Sheet
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded text-xs">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteInspection(selectedInspection.id);
                                setConfirmDeleteInspId(null);
                              }}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[11px]"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteInspId(null)}
                              className="px-2 py-0.5 bg-white text-slate-700 border border-slate-300 rounded font-semibold text-[11px]"
                            >
                              Cancel
                            </button>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] font-mono text-slate-500 block">PART NUMBER / QTY</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedInspection.partNumber} (Qty: {selectedInspection.quantity})
                    </span>
                    <span className="block text-[11px] text-slate-600 truncate">
                      {selectedInspection.componentDescription}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] font-mono text-slate-500 block">
                      MACHINE SERIAL & PROJECT
                    </span>
                    <span className="font-mono font-bold text-blue-700">
                      {selectedInspection.machineSerialNumber}
                    </span>
                    <span className="block text-[11px] font-mono text-slate-600">
                      Project: {selectedInspection.projectNumber}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] font-mono text-slate-500 block">
                      DRAWING & REVISION AT MFG
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedInspection.drawingNumber} Rev {selectedInspection.drawingRevision}
                    </span>
                    <span className="block text-[10px] font-mono text-emerald-700 font-semibold">
                      Snapshot: {linkedMfgRecord?.drawingSnapshot?.approvalStatusAtManufacture || 'APPROVED'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] font-mono text-slate-500 block">
                      MACHINIST vs INSPECTOR
                    </span>
                    <span className="block text-[11px] text-slate-800">
                      Mfg: <strong>{selectedInspection.machinist}</strong> ({selectedInspection.machinistId})
                    </span>
                    <span className="block text-[11px] text-slate-800">
                      Insp: <strong>{selectedInspection.inspectorName}</strong> ({selectedInspection.inspectorId})
                    </span>
                  </div>
                </div>
              </div>

              {/* 5-Point Drawing Verification Checklist */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider font-mono text-slate-900 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-blue-600" />
                    1. Mandatory 5-Point Drawing & Revision Verification Checklist
                  </h4>
                  <button
                    onClick={handleConfirmAllDrawingChecks}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-semibold"
                  >
                    Confirm All 5 Checks
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    {
                      key: 'correctDrawingNumber' as const,
                      label: `Drawing Number verified (${selectedInspection.drawingNumber})`,
                    },
                    {
                      key: 'correctDrawingRevision' as const,
                      label: `Drawing Revision verified (Rev ${selectedInspection.drawingRevision})`,
                    },
                    {
                      key: 'drawingApproved' as const,
                      label: 'Drawing status verified as APPROVED at time of manufacture',
                    },
                    {
                      key: 'componentCorrespondsToDrawing' as const,
                      label: 'Physical component geometry & material correspond to drawing',
                    },
                    {
                      key: 'associationCorrect' as const,
                      label: `Machine (${selectedInspection.machineSerialNumber}) & Project (${selectedInspection.projectNumber}) verified`,
                    },
                  ].map((item) => {
                    const checked = selectedInspection.drawingVerification[item.key];
                    return (
                      <label
                        key={item.key}
                        className={`flex items-center gap-2.5 p-2.5 rounded border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleDrawingCheck(item.key)}
                        />
                        <span>{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Dimensional Characteristics Table */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider font-mono text-slate-900 flex items-center gap-2">
                      <Ruler className="w-4 h-4 text-blue-600" />
                      2. Critical Dimensional Measurements & Automatic Tolerance Calculation
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Formula: <code className="font-mono">Actual &gt;= Nominal + LowerTol AND Actual &lt;= Nominal + UpperTol</code>. Result cannot be manually overridden.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCharError(null);
                      setIsAddCharModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Characteristic
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white uppercase font-mono text-[10px] tracking-wider">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Feature / Dimension</th>
                        <th className="py-2.5 px-3">Nominal & Tolerances</th>
                        <th className="py-2.5 px-3">Allowable Limits</th>
                        <th className="py-2.5 px-3">Actual Reading</th>
                        <th className="py-2.5 px-3">Instrument ID</th>
                        <th className="py-2.5 px-3">Calculated Result & Disposition</th>
                        {isAdmin && <th className="py-2.5 px-3 text-right">Admin</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {syncedCharacteristics.map((char) => {
                        const hasLimits =
                          char.nominal !== null &&
                          char.nominal !== undefined &&
                          char.lowerTolerance !== null &&
                          char.lowerTolerance !== undefined &&
                          char.upperTolerance !== null &&
                          char.upperTolerance !== undefined;
                        const minLim = hasLimits
                          ? Number((char.nominal! + char.lowerTolerance!).toFixed(4))
                          : null;
                        const maxLim = hasLimits
                          ? Number((char.nominal! + char.upperTolerance!).toFixed(4))
                          : null;
                        const isAcceptedByDev =
                          char.result === 'FAIL' &&
                          char.disposition === 'ACCEPTED_BY_APPROVED_DEVIATION';

                        return (
                          <tr
                            key={char.id}
                            className={
                              char.result === 'FAIL' && !isAcceptedByDev
                                ? 'bg-rose-50/70'
                                : isAcceptedByDev
                                ? 'bg-amber-50/70'
                                : 'hover:bg-slate-50'
                            }
                          >
                            <td className="py-3 px-3 font-mono font-bold text-slate-700">
                              #{char.charNumber}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{char.feature}</div>
                              {isAcceptedByDev && (
                                <div className="mt-1 text-[10px] font-mono bg-amber-100 border border-amber-300 text-amber-950 px-2 py-1 rounded">
                                  <div>
                                    <strong>Deviation Ref:</strong> {char.deviationNumber}
                                  </div>
                                  <div>
                                    <strong>Approved By:</strong> {char.deviationApprovedBy} on{' '}
                                    {char.deviationApprovalDate}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono">
                              {hasLimits ? (
                                <>
                                  <span className="font-bold text-slate-900">
                                    {char.nominal!.toFixed(3)} {char.unit}
                                  </span>
                                  <div className="text-[10px] text-slate-500">
                                    {char.upperTolerance! >= 0 ? `+${char.upperTolerance!.toFixed(3)}` : char.upperTolerance!.toFixed(3)} / {char.lowerTolerance!.toFixed(3)}
                                  </div>
                                </>
                              ) : (
                                <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  Pending drawing spec
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] font-semibold text-slate-700">
                              {minLim !== null && maxLim !== null ? (
                                `[${minLim.toFixed(3)} .. ${maxLim.toFixed(3)} ${char.unit}]`
                              ) : (
                                <span className="text-slate-400 font-normal italic">Unspecified</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="number"
                                step="0.001"
                                placeholder="Enter actual..."
                                value={char.actual === null ? '' : char.actual}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const parsed = raw === '' ? null : parseFloat(raw);
                                  recordCharacteristicReading(
                                    selectedInspection.id,
                                    char.id,
                                    parsed
                                  );
                                }}
                                className="w-28 px-2 py-1 border border-slate-300 rounded font-mono font-bold text-slate-900 bg-white"
                              />
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px]">
                              <div className="font-bold text-slate-800">{char.instrumentId}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                                {char.measuringInstrument}
                              </div>
                            </td>
                            <td className="py-3 px-3 space-y-1">
                              <div>
                                <StatusBadge status={char.result} />
                              </div>
                              {isAcceptedByDev && (
                                <div>
                                  <StatusBadge status="ACCEPTED_BY_APPROVED_DEVIATION" />
                                </div>
                              )}
                            </td>
                            {isAdmin && (
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteInspectionCharacteristic(selectedInspection.id, char.id)
                                  }
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                  title={`Delete characteristic #${char.charNumber}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Formal Inspector Electronic Sign-Off */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider font-mono text-slate-900 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-600" />
                    3. Formal Final Inspector Electronic Sign-Off
                  </h4>
                  {selectedInspection.inspectorSignOff?.confirmed && (
                    <StatusBadge status="SIGNED OFF" />
                  )}
                </div>

                {isSameUserAsMachinist && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded text-xs text-rose-900 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      SEPARATION OF DUTIES ENFORCED: Active user ({currentUser.name} / {currentUser.id}) is the Machinist who manufactured this component and is strictly blocked from signing off its inspection.
                    </span>
                  </div>
                )}

                {signOffFeedback && (
                  <div
                    className={`p-3 rounded border text-xs font-semibold ${
                      signOffFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                  >
                    {signOffFeedback.message}
                  </div>
                )}

                {selectedInspection.inspectorSignOff?.confirmed ? (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded text-xs space-y-1 text-emerald-950">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Signed Off by {selectedInspection.inspectorSignOff.inspectorName} (ID:{' '}
                      {selectedInspection.inspectorSignOff.inspectorId} • Role:{' '}
                      {selectedInspection.inspectorSignOff.inspectorRole})
                    </div>
                    <div className="text-[11px] font-mono text-emerald-800">
                      Timestamp: {selectedInspection.inspectorSignOff.signedAt}
                    </div>
                    {selectedInspection.inspectorSignOff.acceptedWithDeviation && (
                      <div className="text-[11px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-1 rounded inline-block mt-1">
                        Signed Off with Approved Engineering Deviation:{' '}
                        {selectedInspection.inspectorSignOff.deviationReferences?.join(', ')}
                      </div>
                    )}
                    <p className="italic text-slate-700 pt-1">
                      "{selectedInspection.inspectorSignOff.declaration}"
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Inspector Certification Declaration
                      </label>
                      <textarea
                        rows={2}
                        value={signOffDeclaration}
                        onChange={(e) => setSignOffDeclaration(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleExecuteSignOff}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-2 shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Execute Formal Inspector Sign-Off ({currentUser.name} / {currentUser.id})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-xs text-slate-500 space-y-2">
              <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-1" />
              <p className="font-bold text-slate-700">Dimensional Quality Inspection</p>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                Clean blank slate active. Select any component inspection record from the register on the left to evaluate tolerances and record instrument calibrations.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Start Inspection Modal */}
      <Modal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        title="Initiate QMS Inspection Sheet"
        subtitle="Select a Manufacturing Record to generate or open its dimensional inspection sheet"
        maxWidth="lg"
      >
        <form onSubmit={handleStartNewInspection} className="space-y-4 text-xs">
          {startError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded text-rose-900 font-semibold">
              {startError}
            </div>
          )}

          {db.manufacturingRecords.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 space-y-2.5">
              <div className="font-bold text-xs flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>No Manufacturing Records Found in Register</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                To inspect parts, components, or assemblies without first registering a manufacturing record, you can use the <strong>Dale Automation Manufacturing Quality Inspection Module</strong>. It covers all 7 manufacturing processes with pre-filled checklists.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsStartModalOpen(false);
                  setInspectionViewMode('DALE_SHEETS');
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs shadow-xs"
              >
                Switch to Dale Quality Inspection Checklists
              </button>
            </div>
          ) : (
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Select Manufacturing Record *
              </label>
              <select
                value={selectedMfgForNew}
                onChange={(e) => {
                  setSelectedMfgForNew(e.target.value);
                  setStartError(null);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono bg-white text-xs"
              >
                {db.manufacturingRecords.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.traceabilityNumber} — {r.partNumber} ({r.componentDescription}) [{r.manufacturingStatus}]
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Opens the dimensional tolerance calculation sheet for this manufactured component.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setIsStartModalOpen(false);
                setInspectionViewMode('DALE_SHEETS');
              }}
              className="text-blue-700 hover:text-blue-900 font-semibold text-xs inline-flex items-center gap-1"
            >
              <span>Switch to Dale Quality Inspection Checklists</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsStartModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
              >
                Cancel
              </button>
              {db.manufacturingRecords.length > 0 && (
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-xs"
                >
                  Open / Create Inspection Sheet
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* Add Characteristic Modal (with Tolerance Validation) */}
      <Modal
        isOpen={isAddCharModalOpen}
        onClose={() => setIsAddCharModalOpen(false)}
        title="Add Critical Inspection Characteristic"
        subtitle="Enforces Lower Tolerance <= 0, Upper Tolerance >= 0, and non-inverted limits"
        maxWidth="lg"
      >
        <form onSubmit={handleAddCharSubmit} className="space-y-4 text-xs">
          {charError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded text-rose-900 font-semibold">
              {charError}
            </div>
          )}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Characteristic / Feature Description *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Bearing Journal Concentricity"
              value={newCharForm.feature}
              onChange={(e) => setNewCharForm({ ...newCharForm, feature: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nominal Value *</label>
              <input
                type="number"
                step="0.001"
                required
                value={newCharForm.nominal}
                onChange={(e) =>
                  setNewCharForm({ ...newCharForm, nominal: parseFloat(e.target.value) })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Lower Tolerance (&lt;= 0) *
              </label>
              <input
                type="number"
                step="0.001"
                required
                value={newCharForm.lowerTolerance}
                onChange={(e) =>
                  setNewCharForm({ ...newCharForm, lowerTolerance: parseFloat(e.target.value) })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Upper Tolerance (&gt;= 0) *
              </label>
              <input
                type="number"
                step="0.001"
                required
                value={newCharForm.upperTolerance}
                onChange={(e) =>
                  setNewCharForm({ ...newCharForm, upperTolerance: parseFloat(e.target.value) })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Measuring Instrument *</label>
              <input
                type="text"
                required
                value={newCharForm.measuringInstrument}
                onChange={(e) =>
                  setNewCharForm({ ...newCharForm, measuringInstrument: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Calibrated Instrument ID *</label>
              <input
                type="text"
                required
                value={newCharForm.instrumentId}
                onChange={(e) =>
                  setNewCharForm({ ...newCharForm, instrumentId: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddCharModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
            >
              Validate & Add Characteristic
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Create NCR Modal */}
      <Modal
        isOpen={isNcrModalOpen}
        onClose={() => setIsNcrModalOpen(false)}
        title={`Create Non-Conformance Report (NCR) — ${selectedInspection?.traceabilityNumber}`}
        subtitle="Formalizes quarantine containment and disposition workflow for failed characteristics"
        maxWidth="lg"
      >
        <form onSubmit={handleQuickCreateNcr} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Proposed Disposition *</label>
            <select
              value={ncrDisposition}
              onChange={(e) => setNcrDisposition(e.target.value as NCRDisposition)}
              className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
            >
              <option value="USE_AS_IS_DEVIATION_REQUIRED">
                USE AS IS (Requires Approved Engineering Deviation)
              </option>
              <option value="REWORK">REWORK TO DRAWING SPECIFICATION</option>
              <option value="SCRAP">SCRAP COMPONENT</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Root Cause *</label>
            <textarea
              rows={2}
              required
              value={ncrRootCause}
              onChange={(e) => setNcrRootCause(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Corrective Action *</label>
            <textarea
              rows={2}
              required
              value={ncrCorrective}
              onChange={(e) => setNcrCorrective(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
          </div>
          <PhotoEvidenceGallery
            title="Issue Identified — Photo Evidence"
            subtitle="Attach photos of the failed dimensional measurement or physical defect"
            photos={ncrIssuePhotos}
            onChange={setNcrIssuePhotos}
            relatedRecordId={selectedInspection?.id}
            badgeColor="rose"
          />
          <PhotoEvidenceGallery
            title="Corrective Action — Photo Evidence"
            subtitle="Attach photos of corrective action / containment verification"
            photos={ncrCorrectivePhotos}
            onChange={setNcrCorrectivePhotos}
            relatedRecordId={selectedInspection?.id}
            badgeColor="emerald"
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNcrModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold"
            >
              Raise NCR
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Request Deviation Modal */}
      <Modal
        isOpen={isDevModalOpen}
        onClose={() => setIsDevModalOpen(false)}
        title={`Request Engineering Deviation — ${selectedInspection?.traceabilityNumber}`}
        subtitle="Links failing characteristic(s) to an Engineering Concession & Redline Drawing"
        maxWidth="lg"
      >
        <form onSubmit={handleQuickCreateDeviation} className="space-y-4 text-xs">
          {devError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded text-rose-900 font-semibold">
              {devError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Deviation Type *</label>
              <select
                value={devType}
                onChange={(e) => setDevType(e.target.value as DeviationType)}
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
              <label className="block font-bold text-slate-700 mb-1">Concession Disposition *</label>
              <select
                value={devConcessionDisposition}
                onChange={(e) => setDevConcessionDisposition(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
              >
                <option value="USE_AS_IS">USE AS IS (Concession)</option>
                <option value="CONCESSION_ACCEPTED">CONCESSION ACCEPTED</option>
                <option value="REWORK_TO_REDLINE">REWORK TO REDLINE</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Recorded Change / Non-Conforming Condition *
            </label>
            <textarea
              rows={2}
              required
              value={devChangeDesc}
              onChange={(e) => setDevChangeDesc(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Engineering Justification / Reason *
            </label>
            <textarea
              rows={2}
              required
              value={devReason}
              onChange={(e) => setDevReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={devRequiresRedline}
                onChange={(e) => setDevRequiresRedline(e.target.checked)}
              />
              <span className="font-bold text-slate-800">
                Requires Redlined Drawing File (No File = INCOMPLETE / Cannot Approve)
              </span>
            </label>
            {devRequiresRedline && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Upload Redlined Drawing (PDF / Image)
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setDevRedlineFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsDevModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold"
            >
              Submit Deviation Request
            </button>
          </div>
        </form>
      </Modal>
        </>
      )}
    </div>
  );
};
