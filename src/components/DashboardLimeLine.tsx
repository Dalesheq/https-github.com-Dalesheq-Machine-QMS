import React, { useState, useMemo } from 'react';
import { useQMS } from '../context/QMSContext';
import { ActiveTab } from './Sidebar';
import { UserRole } from '../types';
import { QualityReleaseCheck } from '../services/db';
import { Modal } from './Modal';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  Filter,
  Lock,
  Unlock,
  Eye,
  AlertCircle,
  Sparkles,
  Zap,
  RotateCcw,
  UserCog,
  LogIn,
  Check,
  XCircle,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';

export type LimeLineItemType =
  | 'HOLDING_POINT_NCR'
  | 'HOLDING_POINT_QUARANTINE'
  | 'HOLDING_POINT_INSPECTION'
  | 'HOLDING_POINT_DALE_CHECKLIST'
  | 'DEVIATION_MISSING_REDLINE'
  | 'DEVIATION_AWAITING_APPROVAL'
  | 'DEVIATION_CORRECTIVE_ACTION'
  | 'RELEASE_GATE_READY';

export interface LimeLineItem {
  id: string;
  type: LimeLineItemType;
  title: string;
  category: 'HOLDING_POINT' | 'DEVIATION_TO_CORRECT' | 'GATE_READY';
  partNumber: string;
  partDescription: string;
  machineSerial: string;
  projectNumber: string;
  drawingInfo: string;
  // Connection to 18-Point Quality Release Gate
  blockedGateNumber: number;
  blockedGateName: string;
  blockedGateCategory: string;
  gateImpactSummary: string;
  // Who must action
  responsiblePerson: string;
  responsibleRole: UserRole;
  department: string;
  actionRequired: string;
  urgency: 'CRITICAL_HOLD' | 'HIGH_PRIORITY' | 'MEDIUM' | 'CLEARANCE_READY';
  dueDate: string;
  navigationTab: ActiveTab;
  relatedRecordId?: string;
  deviationNumber?: string;
  ncrNumber?: string;
  sheetNumber?: string;
}

interface DashboardLimeLineProps {
  setActiveTab: (tab: ActiveTab) => void;
}

// Available standard operators for quick role testing / switching
const TEST_OPERATORS: {
  username: string;
  name: string;
  role: UserRole;
  department: string;
  responsibilitySummary: string;
}[] = [
  {
    username: 'sarah.connor',
    name: 'Sarah Connor',
    role: 'INSPECTOR',
    department: 'Quality Metrology & Inspection',
    responsibilitySummary: 'Inspect open checklist points, quarantine inspection, dimensional verifications',
  },
  {
    username: 'elena.rostova',
    name: 'Dr. Elena Rostova',
    role: 'ENGINEERING',
    department: 'Mechanical Design & Engineering',
    responsibilitySummary: 'Correct deviations, upload stamped redline drawings, sign off engineering concessions',
  },
  {
    username: 'dave.vance',
    name: 'Dave Vance',
    role: 'MACHINIST',
    department: 'CNC Machining & Turning',
    responsibilitySummary: 'Machine rework on quarantined parts, tolerances, CNC corrections',
  },
  {
    username: 'peter.ndlovu',
    name: 'Peter Ndlovu',
    role: 'MACHINE_MANAGER',
    department: 'Machine Shop Management',
    responsibilitySummary: 'Final 18-point release gate audit, machine shop clearances',
  },
  {
    username: 'sheq',
    name: 'Basil De Swardt',
    role: 'ADMINISTRATOR',
    department: 'QMS Systems & Governance',
    responsibilitySummary: 'Full master plant-wide access: all holding points, deviations, and gates across all personnel',
  },
];

export const DashboardLimeLine: React.FC<DashboardLimeLineProps> = ({ setActiveTab }) => {
  const { db, currentUser, login, evaluateQualityRelease } = useQMS();
  const isAdmin = currentUser.role === 'ADMINISTRATOR';

  // Admin filter states
  const [adminPersonFilter, setAdminPersonFilter] = useState<string>('ALL');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState<'ALL' | 'HOLDING_POINTS' | 'DEVIATIONS' | 'GATES'>('ALL');
  const [adminGateFilter, setAdminGateFilter] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected item for Interactive Release Gate Communication Modal
  const [gateModalItem, setGateModalItem] = useState<LimeLineItem | null>(null);

  // Quick Operator Switcher state
  const [isSwitchingUser, setIsSwitchingUser] = useState(false);
  const [switchFeedback, setSwitchFeedback] = useState<string | null>(null);

  // 1. Build all raw items from database
  const allItems: LimeLineItem[] = useMemo(() => {
    const items: LimeLineItem[] = [];

    // --- A. Deviations to be Corrected ---
    (db.deviations || []).forEach((dev) => {
      const isMissingRedline =
        dev.status === 'INCOMPLETE' ||
        (dev.requiresRedline && (!dev.redlineFile || !dev.redlineFile.fileId));
      const isAwaitingApproval =
        dev.status === 'AWAITING_APPROVAL' ||
        (!dev.engineeringApproved && dev.status !== 'APPROVED');

      if (isMissingRedline) {
        items.push({
          id: `DEV-MISSING-${dev.id}`,
          type: 'DEVIATION_MISSING_REDLINE',
          category: 'DEVIATION_TO_CORRECT',
          title: `Deviation ${dev.deviationNumber}: Missing Redline Drawing Attachment`,
          partNumber: dev.partNumber,
          partDescription: dev.descriptionOfChange,
          machineSerial: dev.machineSerialNumber,
          projectNumber: dev.projectNumber,
          drawingInfo: `${dev.originalDrawingNumber} Rev ${dev.originalDrawingRevision}`,
          blockedGateNumber: 13,
          blockedGateName: 'QG-13: Deviation Control & Redline File Verification',
          blockedGateCategory: 'Engineering Governance',
          gateImpactSummary: `Mandatory QMS Rule 13: Quality release certificate permanently blocked until stamped redline PDF with engineer markup is uploaded.`,
          responsiblePerson: 'Dr. Elena Rostova',
          responsibleRole: 'ENGINEERING',
          department: 'Mechanical Design & Engineering',
          actionRequired:
            'Upload stamped redline drawing PDF with cloud markup, complete safety risk justification, and clear Gate QG-13.',
          urgency: 'HIGH_PRIORITY',
          dueDate: '2026-03-08',
          navigationTab: 'deviations',
          deviationNumber: dev.deviationNumber,
        });
      } else if (isAwaitingApproval) {
        items.push({
          id: `DEV-APP-${dev.id}`,
          type: 'DEVIATION_AWAITING_APPROVAL',
          category: 'DEVIATION_TO_CORRECT',
          title: `Deviation ${dev.deviationNumber}: Awaiting Engineering Concession Sign-Off`,
          partNumber: dev.partNumber,
          partDescription: dev.descriptionOfChange,
          machineSerial: dev.machineSerialNumber,
          projectNumber: dev.projectNumber,
          drawingInfo: `${dev.originalDrawingNumber} Rev ${dev.originalDrawingRevision}`,
          blockedGateNumber: 13,
          blockedGateName: 'QG-13: Formal Engineering Deviation Approval',
          blockedGateCategory: 'Engineering Governance',
          gateImpactSummary: `Blocks Gate QG-13: Component concession must be formally approved by Design Engineering before machine assembly.`,
          responsiblePerson: 'Dr. Elena Rostova',
          responsibleRole: 'ENGINEERING',
          department: 'Mechanical Design & Engineering',
          actionRequired:
            'Review concession risk analysis, verify engineering safety factor, and sign digital engineering concession approval.',
          urgency: 'HIGH_PRIORITY',
          dueDate: '2026-03-09',
          navigationTab: 'deviations',
          deviationNumber: dev.deviationNumber,
        });
      } else if (dev.status === 'APPROVED' && dev.approvedConcessionDisposition === 'REWORK_TO_REDLINE') {
        items.push({
          id: `DEV-REW-${dev.id}`,
          type: 'DEVIATION_CORRECTIVE_ACTION',
          category: 'DEVIATION_TO_CORRECT',
          title: `Deviation ${dev.deviationNumber}: Corrective Machining Rework Required`,
          partNumber: dev.partNumber,
          partDescription: dev.descriptionOfChange,
          machineSerial: dev.machineSerialNumber,
          projectNumber: dev.projectNumber,
          drawingInfo: `${dev.originalDrawingNumber} Rev ${dev.originalDrawingRevision}`,
          blockedGateNumber: 11,
          blockedGateName: 'QG-11: Dimensional Tolerance & Metrology Conformance',
          blockedGateCategory: 'Metrology Validation',
          gateImpactSummary: `Blocks Gate QG-11: Component requires physical rework to drawing tolerances before QC re-inspection.`,
          responsiblePerson: 'Dave Vance',
          responsibleRole: 'MACHINIST',
          department: 'CNC Machining & Turning',
          actionRequired:
            'Execute precision rework on lathe/mill to bring dimensions within drawing tolerance, then submit for QA clearance.',
          urgency: 'HIGH_PRIORITY',
          dueDate: '2026-03-10',
          navigationTab: 'deviations',
          deviationNumber: dev.deviationNumber,
        });
      }
    });

    // --- B. Active NCR Holding Points ---
    (db.ncrs || [])
      .filter((n) => n.status !== 'CLOSED')
      .forEach((ncr) => {
        const isRework = ncr.proposedDisposition === 'REWORK';
        const isConcession = ncr.proposedDisposition === 'USE_AS_IS_DEVIATION_REQUIRED';

        let respPerson = ncr.responsiblePerson || 'Sarah Connor';
        let respRole: UserRole = 'INSPECTOR';
        let dept = 'Quality Metrology & Inspection';
        let action =
          'Quarantine defective component, complete root cause containment, and resolve NCR.';

        if (isRework) {
          respPerson = 'Dave Vance';
          respRole = 'MACHINIST';
          dept = 'CNC Machining & Turning';
          action = `Execute machine rework to drawing specification and re-present to QC for clearance (Gate QG-12).`;
        } else if (isConcession) {
          respPerson = 'Dr. Elena Rostova';
          respRole = 'ENGINEERING';
          dept = 'Mechanical Design & Engineering';
          action = `Prepare and approve formal deviation concession package to resolve NCR and satisfy Gate QG-12.`;
        } else {
          respPerson = 'Sarah Connor';
          respRole = 'INSPECTOR';
          dept = 'Quality Metrology & Inspection';
          action = `Complete containment audit, verify defect isolation in inspection bay, and perform re-inspection to close NCR.`;
        }

        items.push({
          id: `NCR-HOLD-${ncr.id}`,
          type: 'HOLDING_POINT_NCR',
          category: 'HOLDING_POINT',
          title: `NCR ${ncr.ncrNumber}: ${ncr.partNumber} Active Quality Hold`,
          partNumber: ncr.partNumber,
          partDescription: ncr.descriptionOfNonConformance || ncr.description,
          machineSerial: ncr.machineSerialNumber,
          projectNumber: ncr.projectNumber,
          drawingInfo: `${ncr.drawingNumber} Rev ${ncr.drawingRevision}`,
          blockedGateNumber: 12,
          blockedGateName: 'QG-12: Zero Open NCRs (Non-Conformance Clearance)',
          blockedGateCategory: 'Defect Containment',
          gateImpactSummary: `Blocks Gate QG-12: Component held in quarantine. ISO 9001 requires zero open NCRs to permit release.`,
          responsiblePerson: respPerson,
          responsibleRole: respRole,
          department: dept,
          actionRequired: action,
          urgency: 'CRITICAL_HOLD',
          dueDate: ncr.dueDate || '2026-03-10',
          navigationTab: 'ncr',
          ncrNumber: ncr.ncrNumber,
          relatedRecordId: ncr.manufacturingRecordId,
        });
      });

    // --- C. Manufacturing Records on Workshop Quality Hold ---
    const existingNcrPartNos = new Set(
      (db.ncrs || []).filter((n) => n.status !== 'CLOSED').map((n) => n.partNumber)
    );
    (db.manufacturingRecords || [])
      .filter(
        (r) =>
          (r.manufacturingStatus === 'HOLD' ||
            r.manufacturingStatus === 'FAIL' ||
            r.manufacturingStatus === 'NCR_HOLD') &&
          !existingNcrPartNos.has(r.partNumber)
      )
      .forEach((mfg) => {
        items.push({
          id: `MFG-HOLD-${mfg.id}`,
          type: 'HOLDING_POINT_QUARANTINE',
          category: 'HOLDING_POINT',
          title: `Holding Point: ${mfg.traceabilityNumber} (${mfg.partNumber}) in Quarantine Bay`,
          partNumber: mfg.partNumber,
          partDescription: mfg.componentDescription,
          machineSerial: mfg.machineSerialNumber,
          projectNumber: mfg.projectNumber,
          drawingInfo: `${mfg.drawingNumber} Rev ${mfg.drawingRevision}`,
          blockedGateNumber: 11,
          blockedGateName: 'QG-11: Dimensional Tolerance & Metrology Conformance',
          blockedGateCategory: 'Metrology Validation',
          gateImpactSummary: `Blocks Gate QG-11: Component is quarantined on Quality Hold. Dimensional verification required.`,
          responsiblePerson: 'Sarah Connor',
          responsibleRole: 'INSPECTOR',
          department: 'Quality Metrology & Inspection',
          actionRequired:
            'Conduct physical quarantine audit, inspect drawing critical dimensions with calibrated instruments, and determine disposition.',
          urgency: 'CRITICAL_HOLD',
          dueDate: '2026-03-07',
          navigationTab: 'manufacturing',
          relatedRecordId: mfg.id,
        });
      });

    // --- D. Manufacturing Records Awaiting QC Inspection ---
    (db.manufacturingRecords || [])
      .filter((r) => r.manufacturingStatus === 'AWAITING_INSPECTION')
      .forEach((mfg) => {
        items.push({
          id: `AWAIT-INSP-${mfg.id}`,
          type: 'HOLDING_POINT_INSPECTION',
          category: 'HOLDING_POINT',
          title: `QC Holding Point: ${mfg.traceabilityNumber} Awaiting Inspection Sign-Off`,
          partNumber: mfg.partNumber,
          partDescription: mfg.componentDescription,
          machineSerial: mfg.machineSerialNumber,
          projectNumber: mfg.projectNumber,
          drawingInfo: `${mfg.drawingNumber} Rev ${mfg.drawingRevision}`,
          blockedGateNumber: 9,
          blockedGateName: 'QG-09: Inspector Metrological Sign-Off',
          blockedGateCategory: 'Inspection Gate',
          gateImpactSummary: `Blocks Gate QG-09: Component cannot move to assembly without inspector physical verification.`,
          responsiblePerson: 'Sarah Connor',
          responsibleRole: 'INSPECTOR',
          department: 'Quality Metrology & Inspection',
          actionRequired:
            'Conduct manufacturing quality inspection checklist, record critical measurements, and sign off conformity.',
          urgency: 'HIGH_PRIORITY',
          dueDate: '2026-03-07',
          navigationTab: 'dale-inspections',
          relatedRecordId: mfg.id,
        });
      });

    // --- E. Dale Manufacturing Inspection Checklists in PENDING state ---
    (db.daleInspections || [])
      .filter((d) => d.approvalStatus === 'PENDING')
      .forEach((sheet) => {
        const openPoints = sheet.points.filter((p) => !p.result || p.result === 'PENDING').length;
        items.push({
          id: `DALE-PENDING-${sheet.id}`,
          type: 'HOLDING_POINT_DALE_CHECKLIST',
          category: 'HOLDING_POINT',
          title: `Checklist Holding Point: ${sheet.sheetNumber} (${sheet.processTitle})`,
          partNumber: sheet.partOrSerialNo,
          partDescription: sheet.partDescription || sheet.processTitle,
          machineSerial: sheet.machineOrAssembly,
          projectNumber: sheet.projectNumber,
          drawingInfo: `${sheet.drawingNumber} Rev ${sheet.drawingRevision}`,
          blockedGateNumber: 9,
          blockedGateName: 'QG-09: Checklist Verification & Conformity Sign-Off',
          blockedGateCategory: 'Process Verification',
          gateImpactSummary: `Blocks Gate QG-09: ${openPoints} open-ended checklist points must be evaluated by inspector. Default pass is prohibited.`,
          responsiblePerson: sheet.inspector || 'Sarah Connor',
          responsibleRole: 'INSPECTOR',
          department: 'Quality Metrology & Inspection',
          actionRequired: `Inspect ${openPoints} open-ended checklist points on shop floor, record findings (PASS, FAIL, or N/A), and sign off sheet.`,
          urgency: 'MEDIUM',
          dueDate: sheet.inspectionDate || '2026-03-08',
          navigationTab: 'dale-inspections',
          relatedRecordId: sheet.id,
          sheetNumber: sheet.sheetNumber,
        });
      });

    // --- F. Components Ready for Final Quality Release Gate ---
    (db.manufacturingRecords || [])
      .filter((r) => r.manufacturingStatus === 'INSPECTION_PASSED')
      .forEach((mfg) => {
        items.push({
          id: `REL-READY-${mfg.id}`,
          type: 'RELEASE_GATE_READY',
          category: 'GATE_READY',
          title: `Release Milestone: ${mfg.traceabilityNumber} Ready for 18-Point Release Gate`,
          partNumber: mfg.partNumber,
          partDescription: mfg.componentDescription,
          machineSerial: mfg.machineSerialNumber,
          projectNumber: mfg.projectNumber,
          drawingInfo: `${mfg.drawingNumber} Rev ${mfg.drawingRevision}`,
          blockedGateNumber: 18,
          blockedGateName: 'QG-18: 18-Point Digital Quality Release Certificate',
          blockedGateCategory: 'Final Factory Release',
          gateImpactSummary: `All physical inspections passed. Final release gate audit required to verify 18 compliance criteria and generate certificate.`,
          responsiblePerson: 'Peter Ndlovu',
          responsibleRole: 'MACHINE_MANAGER',
          department: 'Machine Shop Management',
          actionRequired:
            'Conduct 18-point Quality Release Gate audit and execute digital Quality Release sign-off.',
          urgency: 'CLEARANCE_READY',
          dueDate: '2026-03-12',
          navigationTab: 'quality-release',
          relatedRecordId: mfg.id,
        });
      });

    return items;
  }, [db]);

  // 2. Strict RBAC Filtering:
  // "Make sure that the users can only see what their responsibilities are, Only admin can and will have full access."
  const visibleItems = useMemo(() => {
    let filtered = allItems;

    if (!isAdmin) {
      // Non-admin user can ONLY see items matching their responsibility:
      const curName = (currentUser.name || '').toLowerCase().trim();
      const curRole = currentUser.role;

      filtered = filtered.filter((item) => {
        const itemRespName = item.responsiblePerson.toLowerCase().trim();
        const matchesName =
          itemRespName.includes(curName) ||
          curName.includes(itemRespName) ||
          (curRole === 'INSPECTOR' && itemRespName.includes('sarah')) ||
          (curRole === 'ENGINEERING' && itemRespName.includes('elena')) ||
          (curRole === 'MACHINIST' && itemRespName.includes('dave')) ||
          (curRole === 'MACHINE_MANAGER' && itemRespName.includes('peter'));
        const matchesRole = item.responsibleRole === curRole;
        return matchesName || matchesRole;
      });
    } else {
      // Admin has full access and can apply optional master filters:
      if (adminPersonFilter !== 'ALL') {
        filtered = filtered.filter(
          (item) => item.responsiblePerson.toLowerCase() === adminPersonFilter.toLowerCase()
        );
      }
      if (adminCategoryFilter === 'HOLDING_POINTS') {
        filtered = filtered.filter((item) => item.category === 'HOLDING_POINT');
      } else if (adminCategoryFilter === 'DEVIATIONS') {
        filtered = filtered.filter((item) => item.category === 'DEVIATION_TO_CORRECT');
      } else if (adminCategoryFilter === 'GATES') {
        filtered = filtered.filter((item) => item.category === 'GATE_READY');
      }
      if (adminGateFilter !== 'ALL') {
        filtered = filtered.filter((item) => item.blockedGateNumber === adminGateFilter);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.partNumber.toLowerCase().includes(q) ||
          item.machineSerial.toLowerCase().includes(q) ||
          item.responsiblePerson.toLowerCase().includes(q) ||
          item.blockedGateName.toLowerCase().includes(q) ||
          item.actionRequired.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [
    allItems,
    isAdmin,
    currentUser,
    adminPersonFilter,
    adminCategoryFilter,
    adminGateFilter,
    searchQuery,
  ]);

  // Gate breakdown across the pipeline (Talks to the Quality Release Gate)
  const gateBreakdown = useMemo(() => {
    const qg9Count = allItems.filter((i) => i.blockedGateNumber === 9).length;
    const qg11Count = allItems.filter((i) => i.blockedGateNumber === 11).length;
    const qg12Count = allItems.filter((i) => i.blockedGateNumber === 12).length;
    const qg13Count = allItems.filter((i) => i.blockedGateNumber === 13).length;
    const qg18Count = allItems.filter((i) => i.blockedGateNumber === 18).length;

    return {
      qg9Count,
      qg11Count,
      qg12Count,
      qg13Count,
      qg18Count,
      totalBlocked: qg9Count + qg11Count + qg12Count + qg13Count,
    };
  }, [allItems]);

  // Category counts
  const totalHoldingPoints = allItems.filter((i) => i.category === 'HOLDING_POINT').length;
  const totalDeviations = allItems.filter((i) => i.category === 'DEVIATION_TO_CORRECT').length;
  const totalGateReady = allItems.filter((i) => i.category === 'GATE_READY').length;

  // Unique person list for Admin filter
  const uniquePersons = useMemo(() => {
    return Array.from(new Set(allItems.map((i) => i.responsiblePerson)));
  }, [allItems]);

  // Handler for previewing operator responsibilities
  const handleQuickSwitchOperator = (op: (typeof TEST_OPERATORS)[0]) => {
    setAdminPersonFilter(op.name);
    setSwitchFeedback(`Filtered Lime Line perspective for ${op.name} (${op.role})`);
    setTimeout(() => setSwitchFeedback(null), 3500);
  };

  // Helper for status badge styling
  const getBadgeStyle = (item: LimeLineItem) => {
    if (item.category === 'DEVIATION_TO_CORRECT') {
      return {
        pill: 'bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-800',
        node: 'bg-purple-600 border-purple-200 dark:border-purple-700 text-white',
        border: 'border-purple-300/80 dark:border-purple-800/80 bg-purple-50/20 dark:bg-purple-950/20',
        gatePill: 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700',
        lineAccent: 'border-l-purple-500',
      };
    }
    if (item.category === 'GATE_READY') {
      return {
        pill: 'bg-lime-100 dark:bg-lime-950/70 text-lime-900 dark:text-lime-300 border-lime-300 dark:border-lime-700',
        node: 'bg-lime-500 border-lime-200 dark:border-lime-700 text-slate-950 font-black',
        border: 'border-lime-300/80 dark:border-lime-800/80 bg-lime-50/30 dark:bg-lime-950/20',
        gatePill: 'bg-lime-100 dark:bg-lime-950/80 text-lime-900 dark:text-lime-300 border-lime-300 dark:border-lime-700',
        lineAccent: 'border-l-lime-500',
      };
    }
    if (item.urgency === 'CRITICAL_HOLD') {
      return {
        pill: 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-800',
        node: 'bg-rose-600 border-rose-200 dark:border-rose-700 text-white',
        border: 'border-rose-300/80 dark:border-rose-800/80 bg-rose-50/30 dark:bg-rose-950/20',
        gatePill: 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-700',
        lineAccent: 'border-l-rose-500',
      };
    }
    return {
      pill: 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      node: 'bg-amber-500 border-amber-200 dark:border-amber-700 text-white',
      border: 'border-amber-300/80 dark:border-amber-800/80 bg-amber-50/30 dark:bg-amber-950/20',
      gatePill: 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700',
      lineAccent: 'border-l-amber-500',
    };
  };

  // Live evaluation of 18 Quality Release Gates for the active modal item
  const modalEvaluation = useMemo(() => {
    if (!gateModalItem) return null;
    const mfgRec = db.manufacturingRecords.find(
      (m) =>
        m.id === gateModalItem.relatedRecordId ||
        m.partNumber === gateModalItem.partNumber ||
        m.projectNumber === gateModalItem.projectNumber
    );
    if (!mfgRec) return null;
    return evaluateQualityRelease(mfgRec.id);
  }, [gateModalItem, db.manufacturingRecords, evaluateQualityRelease]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* =========================================================================
          1. LIME LINE TOP HEADER & RELEASE GATE SYNCHRONIZATION BAR
          ========================================================================= */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-lime-950 text-white border-b-2 border-lime-500">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-lime-500" />
              </span>
              <span className="px-2.5 py-0.5 rounded font-mono font-black text-xs bg-lime-400 text-slate-950 border border-lime-300 tracking-wider uppercase shadow-xs">
                LIME LINE • HOLDING POINTS &amp; DEVIATIONS TIMELINE
              </span>
              <span className="text-xs font-mono text-lime-300 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-lime-400" />
                Talks Directly to 18-Point Quality Release Gate
              </span>
            </div>
            <h2 className="text-lg font-black text-white mt-1.5 tracking-tight">
              Interactive Holding Points &amp; Deviations to be Corrected
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 max-w-3xl leading-relaxed">
              Real-time holding point pipeline enforcing ISO 9001 zero-defect containment. Shows
              which Quality Release Gates are held, required deviation corrections, and explicitly
              who must action each item.
            </p>
          </div>

          {/* Quick Stats Rail & Release Gate Shortcut */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-amber-500/50 text-center">
              <div className="text-[10px] text-amber-300 font-mono font-bold">HOLDING POINTS</div>
              <div className="text-sm font-black text-amber-400">{totalHoldingPoints}</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-purple-500/50 text-center">
              <div className="text-[10px] text-purple-300 font-mono font-bold">DEVIATIONS TO CORRECT</div>
              <div className="text-sm font-black text-purple-300">{totalDeviations}</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-lime-500/50 text-center">
              <div className="text-[10px] text-lime-300 font-mono font-bold">GATE READY</div>
              <div className="text-sm font-black text-lime-400">{totalGateReady}</div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('quality-release')}
              className="px-3.5 py-2 bg-lime-500 hover:bg-lime-400 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 shadow-md transition-all"
              title="Open the 18-Point Quality Release Gate to evaluate machine release readiness"
            >
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              <span>Open Quality Release Gate</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            2. TALKS TO THE QUALITY RELEASE GATE: LIVE GATES COMMUNICATION BAR
            ========================================================================= */}
        <div className="mt-4 pt-3 border-t border-slate-800 text-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-lime-300 font-mono font-bold text-[11px]">
              <Zap className="w-3.5 h-3.5 text-lime-400" />
              <span>QUALITY RELEASE GATE COMMUNICATOR:</span>
              <span className="text-slate-300 font-normal">
                {gateBreakdown.totalBlocked > 0
                  ? `Active holding points are holding ${gateBreakdown.totalBlocked} gate milestone${
                      gateBreakdown.totalBlocked === 1 ? '' : 's'
                    }. Click any gate to filter:`
                  : 'All prior holding points cleared.'}
              </span>
            </div>

            <span className="text-[10px] font-mono text-slate-400">
              Release Gate Rule: 18/18 Gates Must Pass for Factory Release
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => {
                if (isAdmin) setAdminGateFilter(adminGateFilter === 9 ? 'ALL' : 9);
              }}
              className={`p-2 rounded-lg border text-left transition-all ${
                gateBreakdown.qg9Count > 0
                  ? 'bg-amber-950/40 border-amber-600/70 text-amber-200 hover:bg-amber-900/50'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold">GATE QG-09</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-amber-400/20 text-amber-300">
                  {gateBreakdown.qg9Count} HELD
                </span>
              </div>
              <div className="text-[11px] font-semibold truncate mt-0.5">Checklist Verification</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">Open Inspection Points</div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isAdmin) setAdminGateFilter(adminGateFilter === 11 ? 'ALL' : 11);
              }}
              className={`p-2 rounded-lg border text-left transition-all ${
                gateBreakdown.qg11Count > 0
                  ? 'bg-rose-950/40 border-rose-600/70 text-rose-200 hover:bg-rose-900/50'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold">GATE QG-11</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-rose-400/20 text-rose-300">
                  {gateBreakdown.qg11Count} HELD
                </span>
              </div>
              <div className="text-[11px] font-semibold truncate mt-0.5">Metrology Conformance</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">Quarantine Holds</div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isAdmin) setAdminGateFilter(adminGateFilter === 12 ? 'ALL' : 12);
              }}
              className={`p-2 rounded-lg border text-left transition-all ${
                gateBreakdown.qg12Count > 0
                  ? 'bg-rose-950/40 border-rose-600/70 text-rose-200 hover:bg-rose-900/50'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold">GATE QG-12</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-rose-400/20 text-rose-300">
                  {gateBreakdown.qg12Count} HELD
                </span>
              </div>
              <div className="text-[11px] font-semibold truncate mt-0.5">Zero Open NCRs</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">Active Defect Reports</div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isAdmin) setAdminGateFilter(adminGateFilter === 13 ? 'ALL' : 13);
              }}
              className={`p-2 rounded-lg border text-left transition-all ${
                gateBreakdown.qg13Count > 0
                  ? 'bg-purple-950/40 border-purple-600/70 text-purple-200 hover:bg-purple-900/50'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold">GATE QG-13</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-purple-400/20 text-purple-300">
                  {gateBreakdown.qg13Count} HELD
                </span>
              </div>
              <div className="text-[11px] font-semibold truncate mt-0.5">Deviation Redlines</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">Stamped PDF Required</div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isAdmin) setAdminGateFilter(adminGateFilter === 18 ? 'ALL' : 18);
              }}
              className={`p-2 rounded-lg border text-left transition-all ${
                gateBreakdown.qg18Count > 0
                  ? 'bg-lime-950/40 border-lime-600/70 text-lime-200 hover:bg-lime-900/50'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold">GATE QG-18</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-lime-400/20 text-lime-300">
                  {gateBreakdown.qg18Count} READY
                </span>
              </div>
              <div className="text-[11px] font-semibold truncate mt-0.5">Final Release Gate</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">Digital Sign-Off</div>
            </button>
          </div>
        </div>

        {/* =========================================================================
            3. RBAC NOTICE & OPERATOR RESPONSIBILITY BANNER
            "Make sure that the users can only see what their responsibilities are, Only admin can and will have full access."
            ========================================================================= */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {isAdmin ? (
            <div className="flex items-center gap-2 text-lime-300 font-mono">
              <Unlock className="w-4 h-4 text-lime-400 shrink-0" />
              <span className="font-bold">ADMINISTRATOR FULL MASTER ACCESS:</span>
              <span className="text-slate-300 font-normal">
                You have unrestricted plant-wide access to all holding points, deviations, and release gates across all personnel.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-300 font-mono">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold">ROLE-RESTRICTED RESPONSIBILITY VIEW:</span>
              <span className="text-slate-300 font-normal">
                Showing your assigned responsibilities only (<strong>{visibleItems.length}</strong> active item{visibleItems.length === 1 ? '' : 's'} for <strong>{currentUser.name}</strong> • {currentUser.role}). All other department holding points are locked. Only Administrator can and will have full access.
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400 font-mono">
              Current Operator: <strong className="text-white">{currentUser.name}</strong> ({currentUser.role})
            </span>
            <button
              type="button"
              onClick={() => {
                const target = isAdmin
                  ? TEST_OPERATORS[0] // Sarah Connor
                  : TEST_OPERATORS[4]; // Basil De Swardt
                handleQuickSwitchOperator(target);
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-lime-300 border border-slate-700 rounded text-[11px] font-mono flex items-center gap-1 transition-colors"
              title={isAdmin ? 'Filter by Inspector responsibilities' : 'Reset to Full Plant Admin Access'}
            >
              <UserCog className="w-3 h-3 text-lime-400" />
              <span>{isAdmin ? 'View Inspector Scope' : 'Reset to All Plant'}</span>
            </button>
          </div>
        </div>

        {/* Quick Role Responsibility Filter Drawer */}
        <div className="mt-3 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-slate-400" />
            Filter by Department Responsibility:
          </span>
          {TEST_OPERATORS.map((op) => {
            const isCurrent = currentUser.username?.toLowerCase() === op.username.toLowerCase();
            return (
              <button
                key={op.username}
                type="button"
                onClick={() => handleQuickSwitchOperator(op)}
                disabled={isSwitchingUser || isCurrent}
                className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                  isCurrent
                    ? 'bg-lime-400 text-slate-950 font-black ring-1 ring-lime-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
                title={`${op.name} (${op.role}) - ${op.responsibilitySummary}`}
              >
                <span>{op.name.split(' ')[0]}</span>
                <span className="text-[9px] opacity-75">({op.role.slice(0, 4)})</span>
              </button>
            );
          })}
          {switchFeedback && (
            <span className="ml-2 text-lime-400 font-semibold animate-pulse">{switchFeedback}</span>
          )}
        </div>
      </div>

      {/* =========================================================================
          4. ADMIN MASTER FILTERS TOOLBAR (VISIBLE ONLY TO ADMINISTRATOR)
          "Only admin can and will have full access."
          ========================================================================= */}
      {isAdmin && (
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              Admin Master Controls:
            </span>

            {/* Filter by Category */}
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setAdminCategoryFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  adminCategoryFilter === 'ALL'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Pipeline ({allItems.length})
              </button>
              <button
                type="button"
                onClick={() => setAdminCategoryFilter('HOLDING_POINTS')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  adminCategoryFilter === 'HOLDING_POINTS'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-amber-800 dark:hover:text-amber-300'
                }`}
              >
                Holding Points ({totalHoldingPoints})
              </button>
              <button
                type="button"
                onClick={() => setAdminCategoryFilter('DEVIATIONS')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  adminCategoryFilter === 'DEVIATIONS'
                    ? 'bg-purple-700 text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-purple-800 dark:hover:text-purple-300'
                }`}
              >
                Deviations to Correct ({totalDeviations})
              </button>
              <button
                type="button"
                onClick={() => setAdminCategoryFilter('GATES')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  adminCategoryFilter === 'GATES'
                    ? 'bg-lime-600 text-slate-950 font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-lime-800 dark:hover:text-lime-300'
                }`}
              >
                Release Ready ({totalGateReady})
              </button>
            </div>

            {/* Filter by Responsible Person */}
            <select
              value={adminPersonFilter}
              onChange={(e) => setAdminPersonFilter(e.target.value)}
              className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-[11px] font-semibold focus:outline-none focus:ring-1 focus:ring-lime-500"
            >
              <option value="ALL">All Action Owners ({uniquePersons.length})</option>
              {uniquePersons.map((p) => (
                <option key={p} value={p}>
                  Action Owner: {p}
                </option>
              ))}
            </select>

            {/* Filter by Quality Release Gate */}
            <select
              value={adminGateFilter}
              onChange={(e) =>
                setAdminGateFilter(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))
              }
              className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-[11px] font-semibold focus:outline-none focus:ring-1 focus:ring-lime-500"
            >
              <option value="ALL">All Blocked Quality Release Gates</option>
              <option value={9}>Gate QG-09 (Checklist Verification)</option>
              <option value={11}>Gate QG-11 (Tolerance & Metrology)</option>
              <option value={12}>Gate QG-12 (Zero Open NCRs)</option>
              <option value={13}>Gate QG-13 (Deviation Redline PDF)</option>
              <option value={18}>Gate QG-18 (Final 18-Point Release)</option>
            </select>

            {(adminPersonFilter !== 'ALL' ||
              adminCategoryFilter !== 'ALL' ||
              adminGateFilter !== 'ALL' ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setAdminPersonFilter('ALL');
                  setAdminCategoryFilter('ALL');
                  setAdminGateFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search holding points..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-48 focus:outline-none focus:ring-1 focus:ring-lime-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          5. THE LIME LINE TIMELINE STREAM
          ========================================================================= */}
      <div className="p-4 sm:p-6">
        {visibleItems.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-lime-100 dark:bg-lime-950 text-lime-700 dark:text-lime-300 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase font-mono">
              Lime Line Clear — No Pending Responsibilities Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              {!isAdmin
                ? `You have zero pending holding points or deviations assigned to your responsibility (${currentUser.name} • ${currentUser.role}). All release gates under your supervision are conforming. Only Administrator has full master plant access.`
                : 'Zero holding points or deviations match the active master filters.'}
            </p>
            {!isAdmin && (
              <button
                type="button"
                onClick={() => handleQuickSwitchOperator(TEST_OPERATORS[4])}
                className="mt-4 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white rounded text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
              >
                <Unlock className="w-3.5 h-3.5 text-lime-400 dark:text-lime-600" />
                <span>Switch to Administrator for Full Master Access</span>
              </button>
            )}
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8">
            {/* The Continuous Vivid Lime Rail Spine */}
            <div className="absolute left-2.5 sm:left-3.5 top-3 bottom-3 w-1 bg-gradient-to-b from-lime-500 via-amber-400 to-purple-500 rounded-full shadow-xs" />

            <div className="space-y-4">
              {visibleItems.map((item) => {
                const styles = getBadgeStyle(item);
                const isMine =
                  item.responsiblePerson.toLowerCase().includes(currentUser.name.toLowerCase()) ||
                  currentUser.name.toLowerCase().includes(item.responsiblePerson.toLowerCase()) ||
                  item.responsibleRole === currentUser.role;

                return (
                  <div
                    key={item.id}
                    className={`relative rounded-xl border p-4 transition-all hover:shadow-md ${styles.border} ${styles.lineAccent} border-l-4`}
                  >
                    {/* Pulsing Node Circle anchored directly onto the continuous Lime Rail */}
                    <div
                      className={`absolute -left-6 sm:-left-8 top-5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black font-mono shadow-xs ${styles.node}`}
                      title={`Quality Release Gate ${item.blockedGateNumber}`}
                    >
                      {item.blockedGateNumber}
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* Left Side: Holding Point Details & Gate Communication */}
                      <div className="flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border uppercase tracking-wider ${styles.pill}`}
                          >
                            {item.category === 'DEVIATION_TO_CORRECT'
                              ? 'DEVIATION TO BE CORRECTED'
                              : item.category === 'GATE_READY'
                              ? 'RELEASE GATE MILESTONE'
                              : 'HOLDING POINT'}
                          </span>

                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {item.partNumber}
                          </span>

                          <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                            Drawing: <strong className="text-slate-900 dark:text-slate-100">{item.drawingInfo}</strong>
                          </span>

                          <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                            Machine: <strong className="text-slate-900 dark:text-slate-100">{item.machineSerial}</strong> (Job {item.projectNumber})
                          </span>

                          {isMine && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono bg-lime-100 dark:bg-lime-950/80 text-lime-900 dark:text-lime-300 border border-lime-300 dark:border-lime-700 flex items-center gap-1 shadow-2xs">
                              <Sparkles className="w-2.5 h-2.5 text-lime-600 dark:text-lime-400" />
                              YOUR DIRECT RESPONSIBILITY
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-snug">
                          {item.title}
                        </h3>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {item.partDescription}
                        </p>

                        {/* Connection to Quality Release Gate */}
                        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
                          <div
                            className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border flex items-center gap-1.5 ${styles.gatePill}`}
                          >
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              BLOCKS QUALITY RELEASE GATE {item.blockedGateNumber}: {item.blockedGateName}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                            {item.gateImpactSummary}
                          </span>
                        </div>
                      </div>

                      {/* Right Side: Explicit WHO MUST ACTION Card */}
                      <div className="lg:w-84 p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs space-y-2.5 shrink-0">
                        {/* Header: Who Must Action + Due Date */}
                        <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100 dark:border-slate-800">
                          <span className="font-mono font-black text-slate-700 dark:text-slate-300 uppercase text-[10px] flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            WHO MUST ACTION:
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            Due: {item.dueDate}
                          </span>
                        </div>

                        {/* Person Profile Details */}
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold font-mono text-xs flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800">
                            {item.responsiblePerson
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <span className="truncate">{item.responsiblePerson}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                                {item.responsibleRole}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                              Dept: {item.department}
                            </div>
                          </div>
                        </div>

                        {/* Required Action Instructions */}
                        <div className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[11px] text-slate-800 dark:text-slate-200 leading-snug">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block mb-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            Required Action:
                          </span>
                          {item.actionRequired}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setActiveTab(item.navigationTab)}
                            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs flex items-center justify-center gap-1 shadow-2xs transition-colors"
                          >
                            <span>Action Now</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setGateModalItem(item)}
                            title="Audit how this holding point talks to the 18 Quality Release Gates"
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded font-semibold text-xs flex items-center gap-1 transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-lime-600 dark:text-lime-400" />
                            <span>Gate Audit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          6. LIME LINE SUMMARY FOOTER
          ========================================================================= */}
      <div className="p-3 bg-slate-900 text-slate-300 border-t border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-lime-400" />
          <span>
            Quality Release Gate Synchronized: All holding points enforce strict zero-defect containment.
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span>
            Active View:{' '}
            <strong>
              {isAdmin
                ? 'ADMINISTRATOR (Full Master Access)'
                : `${currentUser.role} (Restricted Responsibilities)`}
            </strong>
          </span>
          <span>
            Showing <strong>{visibleItems.length}</strong> of <strong>{allItems.length}</strong> pipeline milestones
          </span>
        </div>
      </div>

      {/* =========================================================================
          7. INTERACTIVE QUALITY RELEASE GATE AUDIT MODAL
          (Talks to the 18-Point Quality Release Gate in real time)
          ========================================================================= */}
      {gateModalItem && (
        <Modal
          isOpen={true}
          onClose={() => setGateModalItem(null)}
          title={`Quality Release Gate Communicator — ${gateModalItem.partNumber}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs text-slate-800 dark:text-slate-200">
            {/* Component Summary Card */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">PART NUMBER</span>
                  <strong className="font-mono text-slate-900 dark:text-slate-100">{gateModalItem.partNumber}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">DRAWING INFO</span>
                  <strong className="font-mono text-blue-700 dark:text-blue-400">{gateModalItem.drawingInfo}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">MACHINE SERIAL</span>
                  <strong className="font-mono text-slate-900 dark:text-slate-100">{gateModalItem.machineSerial}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">RESPONSIBLE PERSON</span>
                  <strong className="text-slate-900 dark:text-slate-100">{gateModalItem.responsiblePerson}</strong>
                </div>
              </div>
            </div>

            {/* Blocked Gate Direct Communication */}
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 rounded-lg">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-black text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2">
                    <span>Direct Release Block on Gate {gateModalItem.blockedGateNumber}:</span>
                    <span className="font-mono">{gateModalItem.blockedGateName}</span>
                  </div>
                  <p className="text-rose-800 dark:text-rose-300 text-xs mt-1 leading-relaxed">
                    {gateModalItem.gateImpactSummary}
                  </p>
                  <div className="mt-2 text-[11px] font-mono text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-900/30 p-2 rounded">
                    <strong>Mandatory Clearance Action:</strong> {gateModalItem.actionRequired}
                  </div>
                </div>
              </div>
            </div>

            {/* 18-Point Gate Evaluation Status for this component */}
            {modalEvaluation && (
              <div>
                <div className="flex items-center justify-between pb-1 mb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Live 18-Point Quality Release Gate Checklist:
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                      modalEvaluation.canRelease
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                        : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                    }`}
                  >
                    {modalEvaluation.checks.filter((c) => c.passed).length} of 18 Gates Passed
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50 dark:bg-slate-950">
                  {modalEvaluation.checks.map((check) => {
                    const isTargetGate = check.gateNumber === gateModalItem.blockedGateNumber;
                    return (
                      <div
                        key={check.gateNumber}
                        className={`pt-1.5 pb-1 px-1 flex items-start justify-between gap-2 ${
                          isTargetGate ? 'bg-amber-100/70 dark:bg-amber-950/50 rounded p-1.5 font-semibold' : ''
                        }`}
                      >
                        <div className="flex items-start gap-1.5">
                          {check.passed ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className="font-mono font-bold text-[11px] text-slate-900 dark:text-slate-100">
                              QG-{String(check.gateNumber).padStart(2, '0')}: {check.requirement}
                            </span>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">{check.details}</div>
                          </div>
                        </div>

                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold shrink-0 ${
                            check.passed
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {check.passed ? 'PASSED' : 'BLOCKED'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setGateModalItem(null)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded font-semibold text-xs transition-colors"
              >
                Close Audit
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const targetTab = gateModalItem.navigationTab;
                    setGateModalItem(null);
                    setActiveTab(targetTab);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs flex items-center gap-1"
                >
                  <span>Action This Holding Point</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGateModalItem(null);
                    setActiveTab('quality-release');
                  }}
                  className="px-3 py-1.5 bg-lime-500 hover:bg-lime-400 text-slate-950 rounded font-black text-xs flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-950" />
                  <span>Open Full Release Gate</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
