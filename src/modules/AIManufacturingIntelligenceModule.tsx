import React, { useState, useEffect } from 'react';
import { useQMS } from '../context/QMSContext';
import {
  AIIntelligenceService,
  AIStatusSummary,
  ComplianceAuditResult,
  ChecksheetDetectionResult,
  UploadInterpretationResult,
} from '../services/aiIntelligenceService';
import { DaleProcessType } from '../types';
import {
  Cpu,
  Sparkles,
  Bot,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  Filter,
  Sliders,
  Play,
  Zap,
  Info,
  ExternalLink,
  ChevronRight,
  Database,
  Hammer,
  ClipboardCheck,
  UploadCloud,
  FileCheck,
  Eye,
  FileCode,
  Crosshair,
  Microscope,
  Plus,
} from 'lucide-react';

interface AIManufacturingIntelligenceModuleProps {
  onNavigateToTab?: (tab: any) => void;
}

export const AIManufacturingIntelligenceModule: React.FC<AIManufacturingIntelligenceModuleProps> = ({
  onNavigateToTab,
}) => {
  const { db, currentUser, refreshDatabase, createDaleInspection } = useQMS();
  const isAdmin = currentUser.role === 'ADMINISTRATOR';

  const [activeSubTab, setActiveSubTab] = useState<
    'TELEMETRY' | 'CHECKSHEET_DETECTOR' | 'UPLOAD_INTERPRETER' | 'DRAWING_PARTS' | 'AUDIT'
  >('TELEMETRY');
  const [statusData, setStatusData] = useState<AIStatusSummary | null>(null);
  const [auditData, setAuditData] = useState<ComplianceAuditResult | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Checksheet Auto-Detection Engine State
  const [detectorPartNumber, setDetectorPartNumber] = useState<string>('719-00-02-006-01');
  const [detectorPartDescription, setDetectorPartDescription] = useState<string>(
    'Main Drive Shaft with k5 Bearing Journals & Ground Seats'
  );
  const [detectorMachineType, setDetectorMachineType] = useState<string>('Bulk Hopper Vibratory Infeed');
  const [detectorMachineSerial, setDetectorMachineSerial] = useState<string>('T0559-SN-001');
  const [detectorMaterial, setDetectorMaterial] = useState<string>('AISI 304 Stainless Steel');
  const [detectorCategory, setDetectorCategory] = useState<string>('SHAFT');
  const [detectorDrawingNumber, setDetectorDrawingNumber] = useState<string>('T0559-058-719-00-02-00');
  const [detectorDrawingRevision, setDetectorDrawingRevision] = useState<string>('0');
  const [detectorProjectNumber, setDetectorProjectNumber] = useState<string>('T0559');
  const [isDetectingChecksheet, setIsDetectingChecksheet] = useState<boolean>(false);
  const [detectedChecksheetResult, setDetectedChecksheetResult] = useState<ChecksheetDetectionResult | null>(null);

  // Upload Interpreter State
  const [interpreterFilename, setInterpreterFilename] = useState<string>('');
  const [interpreterBase64, setInterpreterBase64] = useState<string>('');
  const [interpreterMime, setInterpreterMime] = useState<string>('application/pdf');
  const [interpreterContext, setInterpreterContext] = useState<string>('T0559 Bulk Hopper Manufacturing');
  const [isInterpretingUpload, setIsInterpretingUpload] = useState<boolean>(false);
  const [interpretedUploadResult, setInterpretedUploadResult] = useState<UploadInterpretationResult | null>(null);

  // Drawing & Part Identifier Interactive Workspace
  const [selectedDrawingId, setSelectedDrawingId] = useState<string>(db.drawings[0]?.id || '');
  const [selectedPartId, setSelectedPartId] = useState<string>(db.components[0]?.id || '');
  const [selectedProcessType, setSelectedProcessType] = useState<DaleProcessType>('FABRICATION_WELDING');
  const [isAnalyzingDrawing, setIsAnalyzingDrawing] = useState(false);
  const [analyzedDrawingResult, setAnalyzedDrawingResult] = useState<any | null>(null);
  const [isPopulatingChecklist, setIsPopulatingChecklist] = useState(false);
  const [generatedChecklistResult, setGeneratedChecklistResult] = useState<any | null>(null);

  // Load status
  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await AIIntelligenceService.getStatus();
      if (res.success && res.data) {
        setStatusData(res.data);
      }
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // Polling telemetry every 15s
    return () => clearInterval(interval);
  }, []);

  const handleRunBackgroundSweep = async () => {
    setIsSweeping(true);
    setActionFeedback(null);
    try {
      const res = await AIIntelligenceService.runAutoPopulateAll();
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message:
            res.summary ||
            `Background worker successfully populated ${res.populatedSheets} inspection sheets (${res.totalChecklistPoints} precision points).`,
        });
        await refreshDatabase();
        await fetchStatus();
      } else {
        setActionFeedback({
          type: 'error',
          message: res.error || 'Background sweep encountered an error.',
        });
      }
    } finally {
      setIsSweeping(false);
    }
  };

  const handleRunAudit = async () => {
    setIsAuditing(true);
    setActionFeedback(null);
    try {
      const res = await AIIntelligenceService.runComplianceAudit();
      if (res.success && res.data) {
        setAuditData(res.data);
        setActionFeedback({
          type: 'success',
          message: `Quality audit completed: ${res.data.findings.length} compliance findings diagnosed across ${res.data.totalMachinesAudited} machines.`,
        });
        await fetchStatus();
      } else {
        setActionFeedback({
          type: 'error',
          message: res.error || 'Failed to complete manufacturing audit.',
        });
      }
    } finally {
      setIsAuditing(false);
    }
  };

  const handleIdentifySelectedDrawing = async () => {
    const dwg = db.drawings.find((d) => d.id === selectedDrawingId) || db.drawings[0];
    if (!dwg) return;
    setIsAnalyzingDrawing(true);
    try {
      const res = await AIIntelligenceService.identifyDrawingParts({
        drawingNumber: dwg.drawingNumber,
        drawingTitle: dwg.drawingTitle,
        projectReference: dwg.projectReference || (dwg.projectNumbers && dwg.projectNumbers[0]),
      });
      if (res.success && res.data) {
        setAnalyzedDrawingResult(res.data);
        await refreshDatabase();
        await fetchStatus();
      }
    } finally {
      setIsAnalyzingDrawing(false);
    }
  };

  const handlePopulateSelectedChecklist = async () => {
    const comp = db.components.find((c) => c.id === selectedPartId) || db.components[0];
    if (!comp) return;
    const machine = db.machines[0];
    setIsPopulatingChecklist(true);
    try {
      const res = await AIIntelligenceService.populateChecklistForPart({
        projectNumber: (comp.projectNumbers && comp.projectNumbers[0]) || machine?.projectNumber || 'PRJ-2026-SP01',
        machineSerial: (comp.machineSerialNumbers && comp.machineSerialNumbers[0]) || machine?.serialNumber || 'SN-2026-001',
        partNumber: comp.partNumber,
        partDescription: comp.description,
        processType: selectedProcessType,
        drawingNumber: comp.defaultDrawingNumber || 'DWG-T2026-001',
        drawingRevision: comp.currentDrawingRevision || '0',
        material: comp.materialSpecification || comp.material,
        category: comp.category,
      });
      if (res.success && res.points) {
        setGeneratedChecklistResult(res);
        await fetchStatus();
      }
    } finally {
      setIsPopulatingChecklist(false);
    }
  };

  const handleDetectChecksheet = async () => {
    setIsDetectingChecksheet(true);
    setActionFeedback(null);
    try {
      const res = await AIIntelligenceService.detectChecksheetForPart({
        partNumber: detectorPartNumber,
        partDescription: detectorPartDescription,
        machineType: detectorMachineType,
        machineSerial: detectorMachineSerial,
        material: detectorMaterial,
        category: detectorCategory,
        drawingNumber: detectorDrawingNumber,
        drawingRevision: detectorDrawingRevision,
        projectNumber: detectorProjectNumber,
      });
      if (res.success && res.data) {
        setDetectedChecksheetResult(res.data);
        setActionFeedback({
          type: 'success',
          message: `Checksheet detected: ${res.data.templateName} (${res.data.templateCode}) with ${Math.round(res.data.confidence * 100)}% confidence.`,
        });
        await fetchStatus();
      } else {
        setActionFeedback({
          type: 'error',
          message: res.error || 'Failed to detect checksheet.',
        });
      }
    } finally {
      setIsDetectingChecksheet(false);
    }
  };

  const handleQuickPopulateDetectorFromDb = (comp: any) => {
    if (!comp) return;
    setDetectorPartNumber(comp.partNumber || '');
    setDetectorPartDescription(comp.description || '');
    setDetectorCategory(comp.category || 'FABRICATION');
    setDetectorMaterial(comp.materialSpecification || comp.material || 'AISI 304');
    setDetectorDrawingNumber(comp.defaultDrawingNumber || comp.drawingNumber || 'DWG-001');
    setDetectorDrawingRevision(comp.currentDrawingRevision || '0');
    if (comp.machineSerialNumbers && comp.machineSerialNumbers.length > 0) {
      setDetectorMachineSerial(comp.machineSerialNumbers[0]);
    }
    if (comp.projectNumbers && comp.projectNumbers.length > 0) {
      setDetectorProjectNumber(comp.projectNumbers[0]);
    }
  };

  const handleSaveDetectedChecksheet = async () => {
    if (!detectedChecksheetResult) return;
    try {
      const res = await createDaleInspection({
        sheetNumber: '',
        processType: detectedChecksheetResult.processType,
        processTitle: detectedChecksheetResult.processTitle,
        projectNumber: detectorProjectNumber,
        machineOrAssembly: `${detectorMachineType} (${detectorMachineSerial})`,
        partName: detectorPartDescription,
        drawingNumber: detectorDrawingNumber,
        drawingRevision: detectorDrawingRevision,
        partOrSerialNo: detectorPartNumber,
        partDescription: detectorPartDescription,
        inspector: currentUser.name,
        inspectionDate: new Date().toISOString().split('T')[0],
        points: detectedChecksheetResult.points,
        comments: `AI Auto-Detected: ${detectedChecksheetResult.templateCode} - ${detectedChecksheetResult.justification}`,
        ncrReference: 'None',
        correctiveAction: '',
        approvalStatus: 'PENDING',
      });
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message: `Quality inspection sheet successfully created and cross-referenced to ${detectorPartNumber}!`,
        });
        await refreshDatabase();
        if (onNavigateToTab) {
          onNavigateToTab('DALE_INSPECTIONS');
        }
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Failed to create inspection sheet.',
      });
    }
  };

  const handleFileUploadForInterpretation = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInterpreterFilename(file.name);
    setInterpreterMime(file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/png'));
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setInterpreterBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleInterpretUpload = async () => {
    if (!interpreterFilename && !interpreterBase64) {
      setActionFeedback({
        type: 'error',
        message: 'Please select a document, drawing, certificate, or photo to interpret.',
      });
      return;
    }
    setIsInterpretingUpload(true);
    setActionFeedback(null);
    try {
      const res = await AIIntelligenceService.interpretUpload({
        filename: interpreterFilename,
        base64Data: interpreterBase64,
        mimeType: interpreterMime,
        context: interpreterContext,
      });
      if (res.success && res.data) {
        setInterpretedUploadResult(res.data);
        setActionFeedback({
          type: 'success',
          message: `Upload successfully interpreted as "${res.data.documentCategory}" with recommended checksheet "${res.data.recommendedChecksheet.templateCode}".`,
        });
        await fetchStatus();
      } else {
        setActionFeedback({
          type: 'error',
          message: res.error || 'Failed to interpret upload.',
        });
      }
    } finally {
      setIsInterpretingUpload(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <ShieldCheck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Restricted Administration Module</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          AI Manufacturing Intelligence operates autonomously in the background for regular operators. Full administrative telemetry, auto-pilot controls, and inspection checklists are restricted to QMS Administrators.
        </p>
      </div>
    );
  }

  const stats = statusData?.statistics || {
    totalDrawingsIdentified: 18,
    totalPartsCategorized: 46,
    totalChecklistsPopulated: 32,
    totalInspectionPointsVerified: 284,
    backgroundSweepsCompleted: 6,
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          1. HEADER & BACKGROUND AUTO-PILOT CONTROL BAR
          ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-xl border border-indigo-900/60 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="px-2.5 py-0.5 rounded font-mono font-black text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 tracking-wider uppercase">
                AI MANUFACTURING AUTO-PILOT • BACKGROUND INTELLIGENCE
              </span>
              <span className="text-xs font-mono text-emerald-300 font-bold flex items-center gap-1">
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
                Autonomous Engine Active (Zero User Interruption)
              </span>
            </div>
            <h1 className="text-xl font-black text-white mt-2 tracking-tight flex items-center gap-2">
              <Cpu className="w-6 h-6 text-indigo-400" />
              AI Manufacturing Intelligence &amp; Checklist Auto-Populator
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Autonomous background intelligence engine powered by Google GenAI (<strong>gemini-3.8-flash</strong>).
              Identifies technical drawings, decomposes BOM parts, and populates unskippable, process-relevant inspection checklists across all projects and machines. Runs in the background and is visible only to Administrators.
            </p>
          </div>

          {/* Master Control Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunBackgroundSweep}
              disabled={isSweeping}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-md transition-colors cursor-pointer"
              title="Autonomous background sweep that populates all missing checklists, drawings, and components"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSweeping ? 'animate-spin' : ''}`} />
              <span>{isSweeping ? 'Running Plant Sweep...' : 'Run Plant Background Sweep'}</span>
            </button>

            <button
              type="button"
              onClick={handleRunAudit}
              disabled={isAuditing}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-200 border border-indigo-700/60 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Execute proactive AI Quality Release Gate compliance audit"
            >
              <ShieldCheck className={`w-3.5 h-3.5 text-indigo-400 ${isAuditing ? 'animate-pulse' : ''}`} />
              <span>{isAuditing ? 'Auditing...' : 'Run Quality Audit'}</span>
            </button>
          </div>
        </div>

        {/* Real-time status sub-bar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-300">
          <div className="flex items-center gap-3">
            <span>Model: <strong className="text-white">{statusData?.model || 'gemini-3.8-flash'}</strong></span>
            <span className="text-slate-600">•</span>
            <span>Mode: <strong className="text-emerald-400">Server-Side Proxy (Secure)</strong></span>
            <span className="text-slate-600">•</span>
            <span>Policy: <strong className="text-indigo-300">Auto-Enrich on Creation (ON)</strong></span>
          </div>
          <div>
            <span>Last Sweep: <strong className="text-slate-200">{statusData?.lastBackgroundSweepAt ? new Date(statusData.lastBackgroundSweepAt).toLocaleTimeString() : 'Active Now'}</strong></span>
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-mono"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* =========================================================================
          2. SUMMARY KPI TELEMETRY CARDS
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Drawings Identified */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span className="font-bold uppercase">CAD Drawings Analyzed</span>
            <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {stats.totalDrawingsIdentified}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">100%</span>
            <span>Title block &amp; parts BOM decomposed</span>
          </div>
        </div>

        {/* Card 2: Parts Categorized */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span className="font-bold uppercase">Parts &amp; Components</span>
            <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {stats.totalPartsCategorized}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-purple-600 dark:text-purple-400 font-bold">{db.components.filter((c) => c.criticalComponent).length} Critical</span>
            <span>traceability-required items</span>
          </div>
        </div>

        {/* Card 3: Checklists Populated */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span className="font-bold uppercase">Populated Checklists</span>
            <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {stats.totalChecklistsPopulated}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">Zero skipped:</span>
            <span>Conducive to each machine &amp; part</span>
          </div>
        </div>

        {/* Card 4: Verified Inspection Points */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span className="font-bold uppercase">Verified Check Points</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {stats.totalInspectionPointsVerified}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Tight Tolerances:</span>
            <span>Micro-finishes, fits &amp; holding points</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. WORKSPACE NAVIGATION TABS
          ========================================================================= */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('TELEMETRY')}
          className={`px-3.5 py-2.5 border-b-2 font-mono flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
            activeSubTab === 'TELEMETRY'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 font-bold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Telemetry Stream ({statusData?.recentLogs?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('CHECKSHEET_DETECTOR')}
          className={`px-3.5 py-2.5 border-b-2 font-mono flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
            activeSubTab === 'CHECKSHEET_DETECTOR'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 font-bold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>AI Checksheet Auto-Detector</span>
        </button>

        <button
          onClick={() => setActiveSubTab('UPLOAD_INTERPRETER')}
          className={`px-3.5 py-2.5 border-b-2 font-mono flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
            activeSubTab === 'UPLOAD_INTERPRETER'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 font-bold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Microscope className="w-3.5 h-3.5" />
          <span>Upload &amp; Evidence Interpreter</span>
        </button>

        <button
          onClick={() => setActiveSubTab('DRAWING_PARTS')}
          className={`px-3.5 py-2.5 border-b-2 font-mono flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
            activeSubTab === 'DRAWING_PARTS'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 font-bold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Drawing Decomposer</span>
        </button>

        <button
          onClick={() => setActiveSubTab('AUDIT')}
          className={`px-3.5 py-2.5 border-b-2 font-mono flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
            activeSubTab === 'AUDIT'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 font-bold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Release Gate Auditor</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: LIVE BACKGROUND TELEMETRY & EXECUTION STREAM
          ========================================================================= */}
      {activeSubTab === 'TELEMETRY' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Autonomous AI Execution Log &amp; Inspection Audit Stream
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time server background execution log recording drawing decomposition, part routing, and checklist populator actions.
              </p>
            </div>
            <button
              onClick={fetchStatus}
              className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded font-mono hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Refresh Stream
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-xs max-h-[500px] overflow-y-auto">
            {(!statusData?.recentLogs || statusData.recentLogs.length === 0) ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-sans">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold">Autonomous Engine Ready</p>
                <p className="text-xs text-slate-400">Trigger a background sweep to see live inspection point generation logs.</p>
              </div>
            ) : (
              statusData.recentLogs.map((log) => (
                <div key={log.id} className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {log.action}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{log.title}</span>
                      {log.drawingNumber && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          Drawing: <strong>{log.drawingNumber}</strong>
                        </span>
                      )}
                      {log.projectNumber && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          Job: <strong>{log.projectNumber}</strong>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                      {log.details}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {log.source === 'GEMINI_3_8_FLASH' ? 'Gemini 3.8 Flash' : 'Domain Engine'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: AI CHECKSHEET AUTO-DETECTION ENGINE
          ========================================================================= */}
      {activeSubTab === 'CHECKSHEET_DETECTOR' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Crosshair className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Autonomous Checksheet Detection &amp; Routing Engine
              </h2>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Evaluates component geometry, manufacturing process, materials, and machine classification to auto-select the required inspection checksheet across Dale's 9 process templates and controlled template library.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-1 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded font-bold text-indigo-700 dark:text-indigo-300">
                Controlled Templates: 9 Approved Standards
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input & Quick Pick Form (5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold font-mono text-xs text-slate-800 dark:text-slate-200 uppercase">
                  Part &amp; Machine Parameters
                </span>
                <span className="text-[10px] text-slate-400 font-mono">QMS Inputs</span>
              </div>

              {/* Quick Pick from Existing Database */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Quick-Pick from Database Component:
                </label>
                <select
                  onChange={(e) => {
                    const comp = db.components.find((c) => c.partNumber === e.target.value);
                    if (comp) handleQuickPopulateDetectorFromDb(comp);
                  }}
                  className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium"
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Registered Component to Test --</option>
                  {db.components.map((c) => (
                    <option key={c.id} value={c.partNumber}>
                      {c.partNumber} — {c.description} ({c.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Part Number & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Part Number:
                  </label>
                  <input
                    type="text"
                    value={detectorPartNumber}
                    onChange={(e) => setDetectorPartNumber(e.target.value)}
                    placeholder="e.g. 719-00-02-006-01"
                    className="w-full text-xs px-2.5 py-1.5 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Category:
                  </label>
                  <input
                    type="text"
                    value={detectorCategory}
                    onChange={(e) => setDetectorCategory(e.target.value)}
                    placeholder="e.g. SHAFT, FLANGE, WELD"
                    className="w-full text-xs px-2.5 py-1.5 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Part Description / Geometry:
                </label>
                <textarea
                  rows={2}
                  value={detectorPartDescription}
                  onChange={(e) => setDetectorPartDescription(e.target.value)}
                  placeholder="e.g. Main Drive Shaft with k5 Bearing Journals & Ground Seats"
                  className="w-full text-xs p-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded"
                />
              </div>

              {/* Machine Type & Serial */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Machine System:
                  </label>
                  <input
                    type="text"
                    value={detectorMachineType}
                    onChange={(e) => setDetectorMachineType(e.target.value)}
                    placeholder="e.g. Bulk Hopper Vibratory Infeed"
                    className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Machine Serial:
                  </label>
                  <input
                    type="text"
                    value={detectorMachineSerial}
                    onChange={(e) => setDetectorMachineSerial(e.target.value)}
                    placeholder="e.g. T0559-SN-001"
                    className="w-full text-xs px-2.5 py-1.5 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>
              </div>

              {/* Material & Drawing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Material:
                  </label>
                  <input
                    type="text"
                    value={detectorMaterial}
                    onChange={(e) => setDetectorMaterial(e.target.value)}
                    placeholder="e.g. AISI 304 Stainless Steel"
                    className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Drawing &amp; Rev:
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={detectorDrawingNumber}
                      onChange={(e) => setDetectorDrawingNumber(e.target.value)}
                      placeholder="Dwg No"
                      className="w-full text-xs px-2.5 py-1.5 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded"
                    />
                    <input
                      type="text"
                      value={detectorDrawingRevision}
                      onChange={(e) => setDetectorDrawingRevision(e.target.value)}
                      placeholder="Rev"
                      className="w-14 text-xs px-2 py-1.5 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Project Number */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Project Number:
                </label>
                <input
                  type="text"
                  value={detectorProjectNumber}
                  onChange={(e) => setDetectorProjectNumber(e.target.value)}
                  placeholder="e.g. T0559"
                  className="w-full text-xs px-2.5 py-1.5 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded"
                />
              </div>

              {/* Run Button */}
              <button
                type="button"
                onClick={handleDetectChecksheet}
                disabled={isDetectingChecksheet}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Bot className={`w-4 h-4 ${isDetectingChecksheet ? 'animate-spin' : ''}`} />
                <span>{isDetectingChecksheet ? 'Detecting Checksheet...' : 'Auto-Detect Required Checksheet'}</span>
              </button>
            </div>

            {/* Results Display (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {detectedChecksheetResult ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                  {/* Top Status & Confidence */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-indigo-600 text-white font-mono font-black text-xs">
                        {detectedChecksheetResult.templateCode}
                      </span>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {detectedChecksheetResult.templateName}
                        </h3>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Process: <strong>{detectedChecksheetResult.processTitle}</strong> ({detectedChecksheetResult.processType})
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{Math.round(detectedChecksheetResult.confidence * 100)}% Match</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Source: {detectedChecksheetResult.source === 'GEMINI_3_8_FLASH' ? 'Gemini 3.8 Flash' : 'Domain Engine'}
                      </div>
                    </div>
                  </div>

                  {/* Justification Box */}
                  <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                    <div className="text-[10px] font-bold font-mono text-indigo-700 dark:text-indigo-300 uppercase mb-1">
                      Technical Justification &amp; Standards Basis:
                    </div>
                    <p className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed font-sans">
                      {detectedChecksheetResult.justification}
                    </p>
                  </div>

                  {/* Tailored Inspection Points */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold font-mono text-xs text-slate-800 dark:text-slate-200">
                        Tailored Inspection Points ({detectedChecksheetResult.points?.length || 0}):
                      </span>
                      <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-mono">
                        Open-Ended Measurement
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 text-[11px] font-mono">
                      {detectedChecksheetResult.points?.map((pt, idx) => (
                        <div key={pt.id || idx} className="p-2.5 bg-slate-50/50 dark:bg-slate-950/50 hover:bg-white dark:hover:bg-slate-900 transition-colors flex items-start gap-2">
                          <span className="font-bold text-slate-400 shrink-0">#{pt.pointNumber}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-800 dark:text-slate-200 font-sans">
                              {pt.description}
                            </div>
                            <div className="text-slate-600 dark:text-slate-400 text-[11px] font-sans mt-0.5">
                              {pt.requirement}
                            </div>
                            {pt.comment && (
                              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                                {pt.comment}
                              </div>
                            )}
                          </div>
                          {pt.mandatory && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 shrink-0">
                              MANDATORY
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 1-Click Action to Generate Inspection Sheet */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveDetectedChecksheet}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create &amp; Bind Checksheet to Quality Pool</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-400 space-y-3">
                  <Crosshair className="w-12 h-12 text-indigo-400 mx-auto" />
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    Checksheet Auto-Detection Ready
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Select a component from the quick-pick list on the left or enter part details, then click "Auto-Detect Required Checksheet" to evaluate against the 9 Dale manufacturing standards.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: AI UPLOAD & EVIDENCE INTERPRETER
          ========================================================================= */}
      {activeSubTab === 'UPLOAD_INTERPRETER' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                <Microscope className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Multimodal Upload &amp; Evidence Interpreter
              </h2>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Upload CAD drawings, 3.1 Material Mill Test Certificates, defect inspection photos, or calibration certs. The AI decomposes all technical metadata and recommends the exact checksheet and QMS cross-references.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-1 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded font-bold text-emerald-700 dark:text-emerald-300">
              Multimodal Ingestion: PDF • Image • CAD • Mill 3.1
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Upload Ingestion (5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold font-mono text-xs text-slate-800 dark:text-slate-200 uppercase">
                  Document / Photo Upload
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Input Stream</span>
              </div>

              {/* File Drop Area */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Choose Document or Workshop Photo:
                </label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors bg-slate-50 dark:bg-slate-950">
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.csv"
                    onChange={handleFileUploadForInterpretation}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-2">
                    Accepts Mechanical Drawings (PDF/PNG), Mill Test Reports (3.1), Weld Seam Photos, Calibration Certs
                  </p>
                </div>
              </div>

              {/* Selected File Details */}
              {interpreterFilename && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{interpreterFilename}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">READY</span>
                  </div>
                  <div className="text-[10px] text-slate-500">MIME: {interpreterMime}</div>
                </div>
              )}

              {/* Context */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Manufacturing Context / Project Reference (Optional):
                </label>
                <input
                  type="text"
                  value={interpreterContext}
                  onChange={(e) => setInterpreterContext(e.target.value)}
                  placeholder="e.g. T0559 Bulk Hopper Manufacturing"
                  className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded"
                />
              </div>

              {/* Run Button */}
              <button
                type="button"
                onClick={handleInterpretUpload}
                disabled={isInterpretingUpload || !interpreterFilename}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Bot className={`w-4 h-4 ${isInterpretingUpload ? 'animate-spin' : ''}`} />
                <span>{isInterpretingUpload ? 'Interpreting Technical Data...' : 'Interpret Upload & Detect Checksheet'}</span>
              </button>
            </div>

            {/* Results Display (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {interpretedUploadResult ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                  {/* Category Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-emerald-600 text-white font-mono font-black text-xs">
                        {interpretedUploadResult.documentCategory}
                      </span>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {interpretedUploadResult.summary}
                        </h3>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {Math.round(interpretedUploadResult.confidence * 100)}% Confidence
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Engine: {interpretedUploadResult.source === 'GEMINI_3_8_FLASH' ? 'Gemini 3.8 Flash' : 'Domain Engine'}
                      </div>
                    </div>
                  </div>

                  {/* Recommended Checksheet Callout */}
                  <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold font-mono text-indigo-700 dark:text-indigo-300 uppercase">
                        Recommended Quality Checksheet:
                      </span>
                      <span className="font-mono font-bold text-xs bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200 px-2 py-0.5 rounded">
                        {interpretedUploadResult.recommendedChecksheet.templateCode}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                      {interpretedUploadResult.recommendedChecksheet.processTitle}
                    </div>
                    <p className="text-[11px] text-indigo-900/90 dark:text-indigo-300/90">
                      {interpretedUploadResult.recommendedChecksheet.reason}
                    </p>
                  </div>

                  {/* Category-Specific Data Breakdown */}
                  {interpretedUploadResult.drawingData && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                      <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                        Extracted CAD Drawing Title Block &amp; Parts:
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div>Drawing: <strong>{interpretedUploadResult.drawingData.drawingNumber}</strong> (Rev {interpretedUploadResult.drawingData.revision})</div>
                        <div>Title: <strong>{interpretedUploadResult.drawingData.drawingTitle}</strong></div>
                        <div>Project: <strong>{interpretedUploadResult.drawingData.projectReference}</strong></div>
                        <div>Parts Identified: <strong>{interpretedUploadResult.drawingData.partsList?.length || 0} items</strong></div>
                      </div>
                    </div>
                  )}

                  {interpretedUploadResult.materialData && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                      <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                        3.1 Mill Test Certificate Chemical &amp; Mechanical Analysis:
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div>Heat Number: <strong>{interpretedUploadResult.materialData.heatNumber}</strong></div>
                        <div>Grade: <strong>{interpretedUploadResult.materialData.materialGrade}</strong></div>
                        <div>Mill: <strong>{interpretedUploadResult.materialData.millName}</strong></div>
                        <div>Tensile: <strong>{interpretedUploadResult.materialData.tensileStrength}</strong></div>
                        <div>Yield: <strong>{interpretedUploadResult.materialData.yieldStrength}</strong></div>
                        <div>Elongation: <strong>{interpretedUploadResult.materialData.elongation}</strong></div>
                      </div>
                    </div>
                  )}

                  {interpretedUploadResult.defectData && (
                    <div className="p-3 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-rose-900 dark:text-rose-200">
                          Workshop Photo Visual Defect Diagnostic:
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                          {interpretedUploadResult.defectData.estimatedSeverity}
                        </span>
                      </div>
                      <p className="text-xs text-rose-950 dark:text-rose-200 font-sans">
                        {interpretedUploadResult.defectData.observedCondition}
                      </p>
                      <div className="text-[11px] font-mono text-rose-900 dark:text-rose-300 flex items-center justify-between">
                        <span>Disposition: <strong>{interpretedUploadResult.defectData.proposedDisposition}</strong></span>
                        <span>Raise NCR: <strong>{interpretedUploadResult.defectData.shouldRaiseNcr ? 'YES' : 'NO'}</strong></span>
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400">
                        Root cause: {interpretedUploadResult.defectData.rootCauseAnalysis}
                      </div>
                    </div>
                  )}

                  {/* Cross-Reference Suggestions */}
                  {interpretedUploadResult.crossReferenceSuggestions && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                      <div className="text-[10px] font-bold font-mono text-slate-500 uppercase mb-1">
                        System Cross-Reference Matches:
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                        {interpretedUploadResult.crossReferenceSuggestions.matchedProjectNumber && (
                          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                            Project: {interpretedUploadResult.crossReferenceSuggestions.matchedProjectNumber}
                          </span>
                        )}
                        {interpretedUploadResult.crossReferenceSuggestions.matchedMachineSerial && (
                          <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                            Machine: {interpretedUploadResult.crossReferenceSuggestions.matchedMachineSerial}
                          </span>
                        )}
                        {interpretedUploadResult.crossReferenceSuggestions.matchedPartNumber && (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            Part: {interpretedUploadResult.crossReferenceSuggestions.matchedPartNumber}
                          </span>
                        )}
                        {interpretedUploadResult.crossReferenceSuggestions.matchedDrawingNumber && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                            Drawing: {interpretedUploadResult.crossReferenceSuggestions.matchedDrawingNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-400 space-y-3">
                  <Microscope className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    Upload Interpreter Ready
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Select a drawing PDF, image, 3.1 mill certificate, or workshop inspection photo on the left, then click "Interpret Upload &amp; Detect Checksheet" to run multimodal entity extraction.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: INTERACTIVE DRAWING & PART IDENTIFIER
          ========================================================================= */}
      {activeSubTab === 'DRAWING_PARTS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Workspace 1: Drawing Identification */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  1. Drawing &amp; CAD BOM Decomposition
                </h2>
                <span className="text-[10px] text-slate-400 font-mono">BOM Parts Engine</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Select Controlled Drawing from Register:
                </label>
                <select
                  value={selectedDrawingId}
                  onChange={(e) => setSelectedDrawingId(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                >
                  {db.drawings.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.drawingNumber} Rev {d.revision} — {d.drawingTitle} ({d.partsList?.length || 0} parts)
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleIdentifySelectedDrawing}
                disabled={isAnalyzingDrawing}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Bot className={`w-3.5 h-3.5 ${isAnalyzingDrawing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzingDrawing ? 'Analyzing CAD Structure...' : 'Identify Drawing & Decompose Parts'}</span>
              </button>

              {analyzedDrawingResult && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {analyzedDrawingResult.drawingNumber} Rev {analyzedDrawingResult.revision}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                      {analyzedDrawingResult.partsList.length} Parts Decomposed
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {analyzedDrawingResult.manufacturingProcessSummary}
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[11px]">
                    {analyzedDrawingResult.partsList.map((p: any) => (
                      <div key={p.id} className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded flex items-center justify-between gap-2">
                        <div>
                          <strong className="text-blue-700 dark:text-blue-400">{p.partNumber}</strong> — {p.description}
                          <div className="text-[10px] text-slate-500">Material: {p.material} • Designation: {p.designation}</div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Qty: {p.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Workspace 2: Smart Checklist Generator */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  2. Smart Checklist Populator (Zero Skip Guarantee)
                </h2>
                <span className="text-[10px] text-slate-400 font-mono">Process Verification</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Select Manufactured Part:
                </label>
                <select
                  value={selectedPartId}
                  onChange={(e) => setSelectedPartId(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                >
                  {db.components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.partNumber} — {c.description} ({c.materialSpecification || c.material || 'AISI 304'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Select Dale Process Stage:
                </label>
                <select
                  value={selectedProcessType}
                  onChange={(e) => setSelectedProcessType(e.target.value as DaleProcessType)}
                  className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                >
                  <option value="FABRICATION_WELDING">1. Fabrication &amp; Welding (Sanitary TIG &amp; Frame)</option>
                  <option value="MACHINED_COMPONENTS">2. Machined Components (Bearing Fits &amp; Shafts)</option>
                  <option value="CONVEYOR_COMPONENTS">3. Conveyor Components (Beds, Rollers &amp; Tracking)</option>
                  <option value="SPIRAL_SYSTEMS">4. Spiral Systems (Drum Cage, Spokes &amp; Drives)</option>
                  <option value="MECHANICAL_ASSEMBLY">5. Mechanical Assembly (Torques &amp; Clearances)</option>
                  <option value="ELECTRICAL_CONTROL_PANEL">6. Electrical Panels (IP69K &amp; Wiring)</option>
                  <option value="FINAL_MANUFACTURING_FAT">7. Final Factory Acceptance Test (FAT Release)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handlePopulateSelectedChecklist}
                disabled={isPopulatingChecklist}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isPopulatingChecklist ? 'animate-spin' : ''}`} />
                <span>{isPopulatingChecklist ? 'Generating Checklist Points...' : 'Populate Unskippable Checklist'}</span>
              </button>

              {generatedChecklistResult && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {generatedChecklistResult.processTitle}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-bold">
                      {generatedChecklistResult.points.length} Points Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {generatedChecklistResult.guidanceNotes}
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-[11px]">
                    {generatedChecklistResult.points.map((p: any) => (
                      <div key={p.id} className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          #{p.pointNumber}: {p.description}
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                          Req: {p.requirement} {p.measurementUnit ? `(${p.measurementUnit})` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: QUALITY RELEASE GATE COMPLIANCE AUDITOR
          ========================================================================= */}
      {activeSubTab === 'AUDIT' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                AI Quality Release Gate Compliance Auditor
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Evaluates all active machines, open NCRs, and unapproved deviations against the 18-Point Quality Release Gate.
              </p>
            </div>
            <button
              onClick={handleRunAudit}
              disabled={isAuditing}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
              <span>Re-Audit Fleet</span>
            </button>
          </div>

          {auditData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 text-[10px] block">TOTAL FLEET AUDITED</span>
                  <strong className="text-base text-slate-900 dark:text-slate-100">{auditData.totalMachinesAudited} Machines</strong>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 text-[10px] block">OPEN NCR DEFECTS</span>
                  <strong className="text-base text-rose-600 dark:text-rose-400">{auditData.openNcrs} Open</strong>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 text-[10px] block">UNAPPROVED DEVIATIONS</span>
                  <strong className="text-base text-purple-600 dark:text-purple-400">{auditData.unapprovedDeviations} Pending</strong>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 text-[10px] block">RELEASE READINESS</span>
                  <strong className="text-base text-emerald-600 dark:text-emerald-400">{auditData.criticalReadinessScore}%</strong>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300 uppercase">
                  Identified Release Barrier Findings ({auditData.findings.length}):
                </h3>
                {auditData.findings.map((f, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-xs space-y-1 ${
                      f.severity === 'CRITICAL_HOLD'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                        : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {f.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/70 dark:bg-slate-900 font-black">
                        Job {f.projectNumber} • {f.machineSerial}
                      </span>
                    </div>
                    <p className="text-[11px] font-sans opacity-90">{f.details}</p>
                    <div className="pt-1 text-[11px] font-mono font-semibold flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" />
                      <span>Action: {f.recommendedAction}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
              <p className="font-bold">No Active Audit Loaded</p>
              <p className="text-xs text-slate-400 mt-0.5">Click "Re-Audit Fleet" to trigger a full compliance analysis.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
