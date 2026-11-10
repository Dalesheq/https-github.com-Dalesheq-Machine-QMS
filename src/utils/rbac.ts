import { UserRole } from '../types';
import { ActiveTab } from '../components/Sidebar';

/**
 * MACHINE QMS - Role-Based Access Control (RBAC) Specification
 * Ensures that each user can only see what pertains to their role and what they need to action.
 */

export interface RoleConfig {
  role: UserRole;
  title: string;
  badgeLabel: string;
  badgeClass: string;
  departmentScope: string;
  description: string;
  allowedTabs: ActiveTab[];
  canCreateMachine: boolean;
  canCreateManufacturingRecord: boolean;
  canSignOffInspection: boolean;
  canApproveDrawings: boolean;
  canDispositionNCR: boolean;
  canExecuteQualityRelease: boolean;
  canManageUsers: boolean;
  canManageSystemSettings: boolean;
  canAccessAiIntelligence: boolean;
  canExportReports: boolean;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  MACHINIST: {
    role: 'MACHINIST',
    title: 'Workshop Operator / Machinist',
    badgeLabel: 'MACHINIST',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700',
    departmentScope: 'Machine Shop / Turning / Milling / Fabrication Bays',
    description: 'Executes workshop fabrication, turning, milling, and welding runs. Submits components for first-off quality inspection.',
    allowedTabs: [
      'dashboard',
      'manufacturing',
      'components',
      'drawings',
      'deviations',
      'traceability-search',
    ],
    canCreateMachine: false,
    canCreateManufacturingRecord: true,
    canSignOffInspection: false,
    canApproveDrawings: false,
    canDispositionNCR: false,
    canExecuteQualityRelease: false,
    canManageUsers: false,
    canManageSystemSettings: false,
    canAccessAiIntelligence: false,
    canExportReports: false,
  },

  INSPECTOR: {
    role: 'INSPECTOR',
    title: 'Quality Metrology Inspector',
    badgeLabel: 'INSPECTOR',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700',
    departmentScope: 'Quality Metrology & Inspection Laboratory',
    description: 'Performs dimensional verification, micrometer/caliper checks, Dale process checksheets, and initiates NCR holding points.',
    allowedTabs: [
      'dashboard',
      'manufacturing',
      'dale-inspections',
      'inspection-templates',
      'ncr',
      'components',
      'drawings',
      'deviations',
      'traceability-search',
    ],
    canCreateMachine: false,
    canCreateManufacturingRecord: true,
    canSignOffInspection: true,
    canApproveDrawings: false,
    canDispositionNCR: false, // Inspectors raise NCRs; HSEQ dispositions them
    canExecuteQualityRelease: false,
    canManageUsers: false,
    canManageSystemSettings: false,
    canAccessAiIntelligence: false,
    canExportReports: true,
  },

  MACHINE_MANAGER: {
    role: 'MACHINE_MANAGER',
    title: 'Machine Shop & Production Lead',
    badgeLabel: 'MACHINE MANAGER',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700',
    departmentScope: 'Machine Shop Management & Fleet Assembly',
    description: 'Oversees machine builds, assembly progress, BOM part allocations, shopfloor throughput, and resolves production bottlenecks.',
    allowedTabs: [
      'dashboard',
      'machines',
      'projects',
      'manufacturing',
      'components',
      'drawings',
      'dale-inspections',
      'ncr',
      'deviations',
      'traceability-search',
    ],
    canCreateMachine: true,
    canCreateManufacturingRecord: true,
    canSignOffInspection: false,
    canApproveDrawings: false,
    canDispositionNCR: false,
    canExecuteQualityRelease: false,
    canManageUsers: false,
    canManageSystemSettings: false,
    canAccessAiIntelligence: false,
    canExportReports: true,
  },

  ENGINEERING: {
    role: 'ENGINEERING',
    title: 'Mechanical Design & Engineering',
    badgeLabel: 'ENGINEERING',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700',
    departmentScope: 'Mechanical Design, CAD & Drafting Office',
    description: 'Controls technical drawings, CAD BOM imports, revision approvals, engineering deviations, and redline concessions.',
    allowedTabs: [
      'dashboard',
      'drawings',
      'components',
      'machines',
      'projects',
      'deviations',
      'inspection-templates',
      'traceability-search',
    ],
    canCreateMachine: true,
    canCreateManufacturingRecord: false,
    canSignOffInspection: false,
    canApproveDrawings: true,
    canDispositionNCR: false,
    canExecuteQualityRelease: false,
    canManageUsers: false,
    canManageSystemSettings: false,
    canAccessAiIntelligence: false,
    canExportReports: true,
  },

  HSEQ: {
    role: 'HSEQ',
    title: 'Quality Assurance & Compliance (HSEQ)',
    badgeLabel: 'HSEQ OFFICER',
    badgeClass: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-700',
    departmentScope: 'Health, Safety, Environment & Quality Assurance',
    description: 'Holds final authority over the 15-barrier Quality Release Gate, NCR quarantine & CAPA dispositions, audits, and release dossiers.',
    allowedTabs: [
      'dashboard',
      'quality-release',
      'ncr',
      'dale-inspections',
      'inspection-templates',
      'manufacturing',
      'machines',
      'components',
      'deviations',
      'reports',
      'audit-trail',
      'traceability-search',
    ],
    canCreateMachine: false,
    canCreateManufacturingRecord: false,
    canSignOffInspection: true,
    canApproveDrawings: false,
    canDispositionNCR: true,
    canExecuteQualityRelease: true,
    canManageUsers: false,
    canManageSystemSettings: false,
    canAccessAiIntelligence: false,
    canExportReports: true,
  },

  MANAGEMENT: {
    role: 'MANAGEMENT',
    title: 'Executive Management & Governance',
    badgeLabel: 'MANAGEMENT',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700',
    departmentScope: 'Executive Directorate & Quality Oversight',
    description: 'Read-only executive oversight over machine deliveries, commercial project status, quality conformance KPIs, and PDF summaries.',
    allowedTabs: [
      'dashboard',
      'projects',
      'machines',
      'dale-inspections',
      'ncr',
      'reports',
    ],
    canCreateMachine: false,
    canCreateManufacturingRecord: false,
    canSignOffInspection: false,
    canApproveDrawings: false,
    canDispositionNCR: false,
    canExecuteQualityRelease: false,
    canManageUsers: false,
    canManageSystemSettings: false,
    canAccessAiIntelligence: false,
    canExportReports: true,
  },

  ADMINISTRATOR: {
    role: 'ADMINISTRATOR',
    title: 'System Administrator & SHEQ Lead',
    badgeLabel: 'SYSTEM ADMIN',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700',
    departmentScope: 'QMS Systems, Security & Full Operations',
    description: 'Unrestricted administrative access to all registers, users, roles, audit trails, and system settings.',
    allowedTabs: [
      'dashboard',
      'machines',
      'projects',
      'components',
      'drawings',
      'manufacturing',
      'dale-inspections',
      'inspection-templates',
      'ncr',
      'deviations',
      'traceability-search',
      'quality-release',
      'reports',
      'users',
      'audit-trail',
      'settings',
      'ai-intelligence',
    ],
    canCreateMachine: true,
    canCreateManufacturingRecord: true,
    canSignOffInspection: true,
    canApproveDrawings: true,
    canDispositionNCR: true,
    canExecuteQualityRelease: true,
    canManageUsers: true,
    canManageSystemSettings: true,
    canAccessAiIntelligence: true,
    canExportReports: true,
  },
};

/**
 * Returns allowed tabs for the given role. Defaults to MACHINIST if undefined.
 */
export function getRoleAllowedTabs(role?: UserRole): ActiveTab[] {
  if (!role || !ROLE_CONFIGS[role]) {
    return ROLE_CONFIGS.MACHINIST.allowedTabs;
  }
  return ROLE_CONFIGS[role].allowedTabs;
}

/**
 * Checks if a specific tab is permitted for the given role.
 */
export function isTabAllowed(role: UserRole | undefined, tab: ActiveTab): boolean {
  const allowed = getRoleAllowedTabs(role);
  return allowed.includes(tab);
}

/**
 * Returns safe fallback tab if current active tab is forbidden for the role.
 */
export function getSafeActiveTab(role: UserRole | undefined, requestedTab: ActiveTab): ActiveTab {
  if (isTabAllowed(role, requestedTab)) {
    return requestedTab;
  }
  return 'dashboard';
}

/**
 * Returns the full role configuration.
 */
export function getRoleConfig(role?: UserRole): RoleConfig {
  if (!role || !ROLE_CONFIGS[role]) {
    return ROLE_CONFIGS.MACHINIST;
  }
  return ROLE_CONFIGS[role];
}
