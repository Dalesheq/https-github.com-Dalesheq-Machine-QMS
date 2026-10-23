import React, { useState } from 'react';
import { useQMS } from '../context/QMSContext';
import { WORKSHOP_DEPARTMENTS, getDepartmentById } from '../utils/departmentsData';
import {
  LayoutDashboard,
  Cpu,
  FolderGit2,
  Boxes,
  FileSpreadsheet,
  Hammer,
  ClipboardCheck,
  AlertTriangle,
  GitPullRequest,
  Search,
  ShieldCheck,
  FileText,
  Users,
  Settings,
  History,
  Building2,
  ChevronDown,
  Layers,
  Sparkles,
  ClipboardList,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'machines'
  | 'projects'
  | 'components'
  | 'drawings'
  | 'manufacturing'
  | 'dale-inspections'
  | 'inspections'
  | 'inspection-templates'
  | 'ncr'
  | 'deviations'
  | 'traceability-search'
  | 'quality-release'
  | 'reports'
  | 'users'
  | 'settings'
  | 'audit-trail';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number | null;
  badgeColor?: string;
  subtext?: string;
}

interface NavSection {
  group: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { db, activeWorkshopDepartment, setActiveWorkshopDepartment, currentUser } = useQMS();
  const [isDeptMenuOpen, setIsDeptMenuOpen] = useState(false);

  const currentDeptObj = activeWorkshopDepartment !== 'ALL'
    ? getDepartmentById(activeWorkshopDepartment)
    : undefined;

  // Counts for badge notifications (filtered by active department if selected)
  const relevantProcesses = currentDeptObj ? currentDeptObj.linkedProcesses : null;

  const relevantMfgRecords = db.manufacturingRecords.filter((r) => {
    if (!relevantProcesses) return true;
    const comp = db.components.find((c) => c.partNumber === r.partNumber);
    const cat = comp?.category || '';
    if (activeWorkshopDepartment === 'CNC_MACHINING') {
      return ['SHAFT', 'ROLLER', 'SPROCKET', 'GEAR', 'HOUSING'].includes(cat) || r.workstation.includes('CNC');
    }
    if (activeWorkshopDepartment === 'FABRICATION_WELDING') {
      return ['FRAME', 'MOUNT', 'HOUSING'].includes(cat) || r.workstation.includes('Weld') || r.workstation.includes('Fab');
    }
    return true;
  });

  const awaitingInspectionCount = relevantMfgRecords.filter(
    (r) => r.manufacturingStatus === 'AWAITING_INSPECTION'
  ).length;

  const criticalComponentsCount = db.components.filter((c) => c.criticalComponent).length;
  const openNcrCount = (db.ncrs || []).filter((n) => n.status !== 'CLOSED').length;
  const readyForReleaseCount = relevantMfgRecords.filter(
    (r) => r.manufacturingStatus === 'INSPECTION_PASSED'
  ).length;
  const pendingDeviationsCount = (db.deviations || []).filter((d) => d.status !== 'APPROVED').length;

  const daleInspectionSheetsCount = (db.daleInspections || []).filter((s) => {
    if (!relevantProcesses) return true;
    return relevantProcesses.includes(s.processType);
  }).length;

  const isManagement = currentUser?.role === 'MANAGEMENT';

  const navItems: NavSection[] = isManagement
    ? [
        {
          group: 'Executive Oversight',
          items: [
            {
              id: 'dashboard' as ActiveTab,
              label: 'Executive Dashboard',
              icon: LayoutDashboard,
              badge: 'READ-ONLY',
              badgeColor: 'bg-indigo-900/80 text-indigo-200 border-indigo-700 font-bold',
              subtext: 'Fleet KPIs & Quality Conformance',
            },
            {
              id: 'reports' as ActiveTab,
              label: 'Reports & Dossiers',
              icon: FileText,
              badge: 'PDF / PRINT',
              badgeColor: 'bg-emerald-900/80 text-emerald-200 border-emerald-700 font-bold',
              subtext: 'View, Preview, Print & PDF Export',
            },
          ],
        },
      ]
    : [
        {
          group: 'Core Registers & Operations',
          items: [
            {
              id: 'dashboard' as ActiveTab,
              label: '1. Dashboard',
              icon: LayoutDashboard,
              badge: null,
            },
            {
              id: 'machines' as ActiveTab,
              label: '2. Machines Register',
              icon: Cpu,
              badge: db.machines.length,
              subtext: 'Divider & Equipment',
            },
            {
              id: 'projects' as ActiveTab,
              label: '3. Projects Register',
              icon: FolderGit2,
              badge: db.projects.length,
            },
            {
              id: 'components' as ActiveTab,
              label: '4. Parts / Components',
              icon: Boxes,
              badge: `${criticalComponentsCount} crit`,
              subtext: 'Drawing & Traceability flag',
            },
            {
              id: 'drawings' as ActiveTab,
              label: '5. Drawings & Revisions',
              icon: FileSpreadsheet,
              badge: db.drawings.length,
              subtext: 'Approval & rev control',
            },
            {
              id: 'manufacturing' as ActiveTab,
              label: '6. Manufacturing Records',
              icon: Hammer,
              badge: awaitingInspectionCount > 0 ? `${awaitingInspectionCount} pending` : null,
              badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
              subtext: 'Auto Traceability & QR',
            },
          ],
        },
        {
          group: 'Quality Gates & Traceability',
          items: [
            {
              id: 'dale-inspections' as ActiveTab,
              label: '7. Quality Inspections',
              icon: ClipboardCheck,
              badge: `${daleInspectionSheetsCount} Sheets`,
              badgeColor: 'bg-blue-100 text-blue-900 border-blue-200 font-bold',
              subtext: currentDeptObj ? `${currentDeptObj.code} Workflow Sheets` : 'Process & Dimensional Sheets',
            },
            {
              id: 'inspection-templates' as ActiveTab,
              label: '8. Inspection Plan Library',
              icon: ClipboardList,
              badge: `${(db.inspectionTemplates || []).filter((t) => t.status === 'APPROVED').length} Plans`,
              badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-200 font-bold',
              subtext: '44 Controlled DIM & FAB Plans',
            },
            {
              id: 'ncr' as ActiveTab,
              label: '9. Non-Conformances (NCR)',
              icon: AlertTriangle,
              badge: openNcrCount > 0 ? `${openNcrCount} OPEN` : '0',
              badgeColor: openNcrCount > 0 ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold animate-pulse' : 'bg-slate-100 text-slate-600',
              subtext: 'Quarantine & Hold System',
            },
            {
              id: 'deviations' as ActiveTab,
              label: '9. Deviations & Changes',
              icon: GitPullRequest,
              badge: pendingDeviationsCount > 0 ? `${pendingDeviationsCount} review` : `${db.deviations.length}`,
              badgeColor: 'bg-purple-100 text-purple-900 border-purple-200',
              subtext: 'Engineering Redlines',
            },
            {
              id: 'traceability-search' as ActiveTab,
              label: '10. Traceability Search',
              icon: Search,
              badge: '2-WAY',
              badgeColor: 'bg-blue-100 text-blue-900 border-blue-200',
              subtext: 'Machine ↔ Component',
            },
            {
              id: 'quality-release' as ActiveTab,
              label: '11. Quality Release Gate',
              icon: ShieldCheck,
              badge: readyForReleaseCount > 0 ? `${readyForReleaseCount} ready` : '15 Gates',
              badgeColor: readyForReleaseCount > 0 ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-slate-100 text-slate-600',
              subtext: 'Final Release Barrier',
            },
            {
              id: 'reports' as ActiveTab,
              label: '12. Reports & Certs',
              icon: FileText,
              badge: 'Dossiers',
              badgeColor: 'bg-slate-100 text-slate-600',
              subtext: 'Printable Release Packs',
            },
          ],
        },
        {
          group: 'Governance & Administration',
          items: [
            {
              id: 'users' as ActiveTab,
              label: '13. Users & Roles',
              icon: Users,
              badge: `${db.users.length} roles`,
            },
            {
              id: 'audit-trail' as ActiveTab,
              label: 'Audit Trail Records',
              icon: History,
              badge: `${db.auditLogs.length}`,
            },
            {
              id: 'settings' as ActiveTab,
              label: '14. System Settings',
              icon: Settings,
              badge: null,
              subtext: 'Machine types, Backup, DB',
            },
          ],
        },
      ];

  return (
    <aside className="w-64 bg-slate-950 text-slate-300 border-r border-slate-800 flex flex-col shrink-0 min-h-[calc(100vh-53px)]">
      {/* Top Department Workflow Switcher or Executive Scope */}
      {isManagement ? (
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/80">
          <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-widest text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-indigo-400">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              EXECUTIVE OVERSIGHT
            </span>
            <span className="px-1.5 py-0.5 text-[9px] rounded font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              LEAST PRIVILEGE
            </span>
          </div>
          <div className="mt-2 p-2 rounded-lg bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Access Scope
            </div>
            <div className="text-xs font-bold text-slate-100 mt-0.5">
              Factory-Wide Read-Only
            </div>
            <div className="text-[10px] text-slate-400 mt-1 leading-tight">
              Production data entry &amp; administration strictly restricted.
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/80 relative">
          <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-widest text-slate-400">
            <span className="flex items-center gap-1.5 font-bold">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              WORKSHOP DEPT WORKFLOW
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Workflow Synced" />
          </div>

        <button
          type="button"
          onClick={() => setIsDeptMenuOpen(!isDeptMenuOpen)}
          className="w-full mt-2 p-2 rounded-lg bg-slate-950/80 hover:bg-slate-950 border border-slate-800 flex items-center justify-between transition-all group text-left"
          title="Switch Active Department Workflow View"
        >
          <div className="min-w-0 pr-1">
            <div className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <span>[{currentDeptObj?.code || 'ALL'}]</span>
              <span className="text-slate-400 font-sans">
                {activeWorkshopDepartment === 'ALL' ? 'Factory-Wide Scope' : 'Active Department'}
              </span>
            </div>
            <div className="text-xs font-bold text-slate-100 truncate mt-0.5">
              {currentDeptObj?.name || 'All Manufacturing Depts'}
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 group-hover:text-white shrink-0 transition-transform ${
              isDeptMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu for all 13 Dale Departments */}
        {isDeptMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsDeptMenuOpen(false)}
            />
            <div className="absolute left-2 right-2 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto text-xs divide-y divide-slate-800">
              <div className="p-2 bg-slate-950 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Select Department Workflow</span>
                <span className="text-blue-400">{WORKSHOP_DEPARTMENTS.length} Depts</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveWorkshopDepartment('ALL');
                  setIsDeptMenuOpen(false);
                }}
                className={`w-full p-2.5 flex items-center justify-between text-left transition-colors ${
                  activeWorkshopDepartment === 'ALL'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>All Workshop Departments (Full Scope)</span>
                  </div>
                  <div className={`text-[10px] mt-0.5 ${activeWorkshopDepartment === 'ALL' ? 'text-blue-100' : 'text-slate-400'}`}>
                    Includes all factory processes, sheets &amp; release gates
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30">ALL</span>
              </button>

              {WORKSHOP_DEPARTMENTS.map((dept) => {
                const isSelected = activeWorkshopDepartment === dept.id;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => {
                      setActiveWorkshopDepartment(dept.id);
                      setIsDeptMenuOpen(false);
                    }}
                    className={`w-full p-2.5 flex items-center justify-between text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold truncate">{dept.name}</div>
                      <div className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {dept.description}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {dept.code}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    )}

    {/* Nav List */}
    <nav className="flex-1 p-2 space-y-4 overflow-y-auto text-xs">
        {navItems.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              {section.group}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                activeTab === item.id ||
                (item.id === 'dale-inspections' && activeTab === 'inspections');
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md transition-all text-left group ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'hover:bg-slate-900 text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'
                      }`}
                    />
                    <div className="truncate">
                      <div className="truncate">{item.label}</div>
                      {item.subtext && !isActive && (
                        <div className="text-[10px] text-slate-500 truncate leading-tight">
                          {item.subtext}
                        </div>
                      )}
                    </div>
                  </div>

                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-medium shrink-0 ml-1 ${
                        isActive
                          ? 'bg-white/20 text-white border-white/30'
                          : item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom Quality Golden Rule Footnote */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 text-[10px] text-slate-400 space-y-1">
        <div className="font-bold text-slate-300 uppercase tracking-wider font-mono">
          MANDATORY QUALITY RULES:
        </div>
        <p className="leading-tight text-slate-400">
          • NO INSPECTION = NO RELEASE
          <br />
          • NO TRACEABILITY = NO RELEASE
          <br />
          • FAILED / UNCHECKED = HOLD
        </p>
      </div>
    </aside>
  );
};
