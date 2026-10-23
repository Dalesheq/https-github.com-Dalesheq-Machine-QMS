import React from 'react';
import { useQMS } from '../context/QMSContext';
import { ActiveTab } from '../components/Sidebar';
import {
  ClipboardCheck,
  AlertTriangle,
  GitPullRequest,
  ShieldCheck,
  FileText,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface PhaseTwoPreviewModuleProps {
  moduleType: 'inspections' | 'ncr' | 'deviations' | 'quality-release' | 'reports';
  setActiveTab: (tab: ActiveTab) => void;
}

export const PhaseTwoPreviewModule: React.FC<PhaseTwoPreviewModuleProps> = ({
  moduleType,
  setActiveTab,
}) => {
  const { db } = useQMS();

  const configs = {
    inspections: {
      title: '7. QMS Inspection Sheet & Tolerance Recording',
      icon: ClipboardCheck,
      color: 'text-blue-600',
      description:
        'Formal inspection recording for critical dimensions, upper/lower tolerances, actual measurements, and automated Pass/Fail calculation.',
      rules: [
        'Inspector confirms correct drawing number & approved revision',
        'Multi-characteristic dimensional recording with nominal, +tol, -tol, and actual reading',
        'Automatic mathematical calculation: PASS if Lower ≤ Actual ≤ Upper, else FAIL',
        'Failed characteristic automatically sets manufacturing record to HOLD',
        'Electronic inspector sign-off with timestamp and role credential preservation',
      ],
      nextStep: 'Ready for implementation in Phase 2 once foundational registers are validated.',
      actionTab: 'manufacturing' as ActiveTab,
      actionLabel: 'View Components Awaiting Inspection',
    },
    ncr: {
      title: '8. Non-Conformance Reports (NCR Module)',
      icon: AlertTriangle,
      color: 'text-rose-600',
      description:
        'Formal deviation tracking triggered automatically when inspection measurements fail or manufacturing departs from approved drawing.',
      rules: [
        'Automatic HOLD placed on component and linked machine',
        'Record immediate containment, root cause analysis, and corrective actions',
        'Formal disposition options: REWORK, RE-MANUFACTURE, SCRAP, RETURN TO ENG, USE AS IS (DEVIATION REQUIRED)',
        'Release completely blocked while open NCR exists',
      ],
      nextStep: 'Enforces Rule 16 & Rule P: Non-conforming components cannot be released through normal workflow.',
      actionTab: 'manufacturing' as ActiveTab,
      actionLabel: 'Review Manufacturing Statuses',
    },
    deviations: {
      title: '9. Engineering Deviations & Redline Control',
      icon: GitPullRequest,
      color: 'text-amber-600',
      description:
        'Required whenever a component is intentionally manufactured differently from the issued drawing.',
      rules: [
        'Records exact difference and engineering reason',
        'Supports redlined drawing attachment and technical risk assessment',
        'Requires formal Engineering Review and sign-off before release',
        'Preserves original drawing revision without silent alteration',
      ],
      nextStep: 'Enforces Rule N & Q: Deviation must be formally reviewed and approved before acceptance.',
      actionTab: 'drawings' as ActiveTab,
      actionLabel: 'View Drawing Register',
    },
    'quality-release': {
      title: '11. Quality Release Control Gate',
      icon: ShieldCheck,
      color: 'text-emerald-600',
      description:
        'Dedicated release validation engine. Checks all mandatory quality conditions before allowing machine component dispatch.',
      rules: [
        'Approved drawing verified',
        'Drawing number & revision recorded',
        'Machine serial number & project linked',
        'Machinist recorded & final inspection completed',
        'All critical dimensions PASS (calculated automatically)',
        'Inspector identified & electronic sign-off verified',
        'Traceability number assigned & permanent physical mark confirmed',
        'No unresolved NCRs and no unapproved deviations',
      ],
      nextStep: 'Enforces Rule 27: Release is strictly governed by rules, not an arbitrary button.',
      actionTab: 'manufacturing' as ActiveTab,
      actionLabel: 'Check Release Statuses',
    },
    reports: {
      title: '12. Quality Reports & Traceability Certificates',
      icon: FileText,
      color: 'text-purple-600',
      description:
        'Comprehensive quality dossiers, inspection certs, machine component histories, and PDF exports.',
      rules: [
        'Machine Manufacturing Record & Component Genealogy Dossier',
        'Component Inspection Sheet with measured dimensional records',
        'Component Traceability Report for customer delivery packs',
        'NCR and Deviation History Reports',
        'Clean printable formatting with QR code verification tags',
      ],
      nextStep: 'Standardized delivery pack documentation for machine releases.',
      actionTab: 'traceability-search' as ActiveTab,
      actionLabel: 'Run Traceability Search',
    },
  }[moduleType];

  const Icon = configs.icon;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-slate-100 rounded-lg text-slate-800">
            <Icon className={`w-8 h-8 ${configs.color}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                ARCHITECTURE MODULE FOUNDATION
              </span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-mono font-bold rounded">
                PHASE 2 WORKFLOW
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-1">{configs.title}</h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{configs.description}</p>
          </div>
        </div>

        {/* Requirements Box */}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          <div className="font-bold text-slate-900 text-xs font-mono uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Mandatory Workflow Rules & Constraints
          </div>
          <ul className="space-y-2 text-xs text-slate-700">
            {configs.rules.map((rule, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Phase 1 Completion Confirmation */}
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-950 space-y-2">
          <div className="font-bold flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-700" />
            Specification Section 30 Architecture Gate
          </div>
          <p className="text-blue-900 leading-relaxed">
            Per the project brief instructions: &quot;For this first build, DO NOT attempt to create every advanced feature at once. First implement: Standalone application structure, Database, Authentication, User roles, Machine register, Project register, Component register, Drawing register, Manufacturing record, Basic navigation, Audit trail foundation. Then stop and report... Do NOT move on to the inspection workflow until these foundations are working.&quot;
          </p>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Foundation records (Machines, Projects, Components, Drawings, Manufacturing) are active.
          </span>
          <button
            onClick={() => setActiveTab(configs.actionTab)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
          >
            {configs.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
