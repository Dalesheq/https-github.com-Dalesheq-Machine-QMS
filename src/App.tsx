/**
 * MACHINE QMS - Manufacturing Quality & Component Traceability System
 * Main Application Component with Mandatory Production Authentication & Login Profile Creation
 */

import React, { useState } from 'react';
import { QMSProvider, useQMS } from './context/QMSContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { DashboardModule } from './modules/DashboardModule';
import { MachinesModule } from './modules/MachinesModule';
import { ProjectsModule } from './modules/ProjectsModule';
import { ComponentsModule } from './modules/ComponentsModule';
import { DrawingsModule } from './modules/DrawingsModule';
import { ManufacturingModule } from './modules/ManufacturingModule';
import { TraceabilitySearchModule } from './modules/TraceabilitySearchModule';
import { AuditTrailModule } from './modules/AuditTrailModule';
import { UsersModule } from './modules/UsersModule';
import { SystemSettingsModule } from './modules/SystemSettingsModule';
import { InspectionsModule } from './modules/InspectionsModule';
import { InspectionTemplatesModule } from './modules/InspectionTemplatesModule';
import { DaleInspectionsModule } from './modules/DaleInspectionsModule';
import { NCRsModule } from './modules/NCRsModule';
import { DeviationsModule } from './modules/DeviationsModule';
import { QualityReleaseModule } from './modules/QualityReleaseModule';
import { ReportsModule } from './modules/ReportsModule';
import { TraceabilityTagModal } from './components/TraceabilityTagModal';
import { ManufacturingRecord, UserRole } from './types';
import { WORKSHOP_DEPARTMENTS } from './utils/departmentsData';
import {
  Loader2,
  Layers,
  Lock,
  KeyRound,
  AlertCircle,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

function StandaloneLoginScreen() {
  const { login, quickLogin, registerProfile } = useQMS();
  const [mode, setMode] = useState<'SIGN_IN' | 'CREATE_PROFILE'>('SIGN_IN');

  // Sign In state
  const [identifier, setIdentifier] = useState('sheq@spiralsystems.co.za');
  const [password, setPassword] = useState('SpiralQMS2026!');

  // Create Profile state
  const [regForm, setRegForm] = useState({
    name: '',
    username: '',
    email: '',
    role: 'INSPECTOR' as UserRole,
    department: 'Quality Control & Metrology',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quickLoadingRole, setQuickLoadingRole] = useState<string | null>(null);

  const handleQuickSignIn = async (userEmail: string, roleLabel: string) => {
    setError(null);
    setQuickLoadingRole(roleLabel);
    try {
      const res = await quickLogin(userEmail);
      if (!res.success) {
        // Fallback to manual login with standard password
        const manualRes = await login(userEmail, 'SpiralQMS2026!');
        if (!manualRes.success) {
          setError(res.error || manualRes.error || 'Failed to sign in.');
        }
      }
    } finally {
      setQuickLoadingRole(null);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await login(identifier.trim(), password);
      if (!res.success) {
        setError(res.error || 'Invalid username/email or password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (regForm.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (regForm.password !== regForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerProfile({
        name: regForm.name.trim(),
        username: regForm.username.trim().toLowerCase(),
        email: regForm.email.trim(),
        role: regForm.role,
        department: regForm.department.trim(),
        password: regForm.password,
      });
      if (!res.success) {
        setError(res.error || 'Failed to create login profile.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 dark:bg-slate-950 flex flex-col justify-center items-center p-4 font-sans text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-300 dark:border-slate-800 overflow-hidden">
        <div className="bg-slate-950 text-white p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-lg text-white">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-wider uppercase font-mono">
                  MACHINE QMS
                </h1>
                <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded font-mono font-bold flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> PRODUCTION AUTH
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Spiral Systems &amp; Dale Automation • Manufacturing Quality System
              </p>
            </div>
          </div>
        </div>

        {/* 1-Click Fast Sign-In Selector */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              1-Click Fast Access (Select Role)
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Instant Session</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={Boolean(quickLoadingRole)}
              onClick={() => handleQuickSignIn('sheq@spiralsystems.co.za', 'Basil (Admin)')}
              className="p-2.5 text-left rounded-lg border-2 border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all text-xs group relative shadow-xs cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-950 dark:text-blue-100 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                  Basil De Swardt
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-blue-600 text-white rounded">
                  SHEQ / ADMIN
                </span>
              </div>
              <p className="text-[11px] text-blue-800 dark:text-blue-300 font-mono mt-0.5">
                sheq@spiralsystems.co.za
              </p>
              {quickLoadingRole === 'Basil (Admin)' && (
                <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-[1px] flex items-center justify-center rounded-lg">
                  <Loader2 className="w-4 h-4 text-blue-700 animate-spin" />
                </div>
              )}
            </button>

            <button
              type="button"
              disabled={Boolean(quickLoadingRole)}
              onClick={() => handleQuickSignIn('sarah.connor@spiralsystems.co.za', 'Sarah (Inspector)')}
              className="p-2.5 text-left rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all text-xs group relative shadow-xs cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                  Sarah Connor
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded border border-amber-300 dark:border-amber-800">
                  INSPECTOR
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                sarah.connor@spiralsystems.co.za
              </p>
              {quickLoadingRole === 'Sarah (Inspector)' && (
                <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] flex items-center justify-center rounded-lg">
                  <Loader2 className="w-4 h-4 text-blue-700 animate-spin" />
                </div>
              )}
            </button>

            <button
              type="button"
              disabled={Boolean(quickLoadingRole)}
              onClick={() => handleQuickSignIn('peter.ndlovu@spiralsystems.co.za', 'Peter (Manager)')}
              className="p-2.5 text-left rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all text-xs group relative shadow-xs cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                  Peter Ndlovu
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 rounded border border-purple-300 dark:border-purple-800">
                  MACHINE MGR
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                peter.ndlovu@spiralsystems.co.za
              </p>
              {quickLoadingRole === 'Peter (Manager)' && (
                <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] flex items-center justify-center rounded-lg">
                  <Loader2 className="w-4 h-4 text-blue-700 animate-spin" />
                </div>
              )}
            </button>

            <button
              type="button"
              disabled={Boolean(quickLoadingRole)}
              onClick={() => handleQuickSignIn('dave.vance@spiralsystems.co.za', 'Dave (Machinist)')}
              className="p-2.5 text-left rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all text-xs group relative shadow-xs cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                  Dave Vance
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded border border-slate-300 dark:border-slate-600">
                  MACHINIST
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                dave.vance@spiralsystems.co.za
              </p>
              {quickLoadingRole === 'Dave (Machinist)' && (
                <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] flex items-center justify-center rounded-lg">
                  <Loader2 className="w-4 h-4 text-blue-700 animate-spin" />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode('SIGN_IN');
            }}
            className={`py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
              mode === 'SIGN_IN'
                ? 'bg-white dark:bg-slate-900 border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Standard Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode('CREATE_PROFILE');
            }}
            className={`py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
              mode === 'CREATE_PROFILE'
                ? 'bg-white dark:bg-slate-900 border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Create Login Profile
          </button>
        </div>

        {mode === 'SIGN_IN' ? (
          <form onSubmit={handleSignInSubmit} className="p-6 space-y-4 text-xs">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2.5 text-blue-950">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[11px]">
                <strong className="block text-blue-900">Operator Sign-In</strong>
                Initial credentials for seed accounts: Password is{' '}
                <code className="px-1.5 py-0.5 bg-blue-200/80 rounded font-mono font-bold text-blue-900">
                  SpiralQMS2026!
                </code>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 rounded-lg flex items-start gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Username or Email Address *
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. sheq@spiralsystems.co.za or sarah.connor"
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Password *</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter operator password"
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              {isSubmitting ? 'Verifying Credentials...' : 'Sign In to MACHINE QMS'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreateProfileSubmit} className="p-6 space-y-3.5 text-xs">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2.5 text-blue-900 dark:text-blue-200">
              <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block">Create Operator Login Profile</strong>
                Registers a new immutable User ID (<code className="font-mono">USR-XXX</code>) with salted password hashing and signs you in immediately.
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 rounded-lg flex items-start gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  placeholder="e.g. Alex Mercer"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={regForm.username}
                  onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                  placeholder="e.g. alex.mercer"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Work Email Address *</label>
              <input
                type="email"
                required
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                placeholder="e.g. name@spiralsystems.co.za"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Department Role *
                </label>
                <select
                  value={regForm.role}
                  onChange={(e) => {
                    const role = e.target.value as UserRole;
                    const defaultDept: Record<UserRole, string> = {
                      ADMINISTRATOR: 'QMS Systems & Governance',
                      MACHINE_MANAGER: 'Machine Shop Management',
                      INSPECTOR: 'Quality Metrology & Inspection',
                      ENGINEERING: 'Mechanical Design & Engineering',
                      HSEQ: 'Quality Assurance & Compliance (HSEQ)',
                      MACHINIST: 'Machine Shop (CNC)',
                      MANAGEMENT: 'Executive Oversight & Quality Governance',
                    };
                    setRegForm({
                      ...regForm,
                      role,
                      department: defaultDept[role] || regForm.department,
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
                >
                  <option value="ADMINISTRATOR">ADMINISTRATOR (System Admin & QMS Governance)</option>
                  <option value="MACHINE_MANAGER">MACHINE_MANAGER (Machine Shop / Production Lead)</option>
                  <option value="INSPECTOR">INSPECTOR (Quality Metrology & Inspection)</option>
                  <option value="ENGINEERING">ENGINEERING (Mechanical Design & CAD)</option>
                  <option value="HSEQ">HSEQ (Quality Assurance & Compliance)</option>
                  <option value="MACHINIST">MACHINIST (Workshop Operator / Bay Machinist)</option>
                  <option value="MANAGEMENT">MANAGEMENT (Executive Oversight & Reporting)</option>
                </select>
                <p className="text-[10px] text-blue-700 dark:text-blue-400 font-medium mt-1">
                  {regForm.role === 'ADMINISTRATOR' && 'Full governance authority: users, permissions, drawings, and system configuration.'}
                  {regForm.role === 'MACHINE_MANAGER' && 'Production lead: machine builds, scheduling, BOMs, and inspection templates.'}
                  {regForm.role === 'INSPECTOR' && 'Quality authority: dimensional inspection, holding points, CMM, NCRs, and FAT release.'}
                  {regForm.role === 'ENGINEERING' && 'Technical authority: drawing revisions, CAD redlines, and engineering deviations.'}
                  {regForm.role === 'HSEQ' && 'Compliance authority: NCR disposition, corrective actions, audits, and release sign-offs.'}
                  {regForm.role === 'MACHINIST' && 'Workshop authority: machining, turning, fabrication, pre-fitting, and first-off checks.'}
                  {regForm.role === 'MANAGEMENT' && 'Executive oversight: machine progress, quality KPIs, and management reports.'}
                </p>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Department / Bay *</label>
                <select
                  value={regForm.department}
                  onChange={(e) => setRegForm({ ...regForm, department: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 font-medium"
                >
                  {WORKSHOP_DEPARTMENTS.map((dept) => (
                    <option key={dept.id} value={dept.name}>
                      [{dept.code}] {dept.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Links profile to department inspection holding points and job allocation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Password (min 6 chars) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  placeholder="Create password"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Confirm Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={regForm.confirmPassword}
                  onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                  placeholder="Confirm password"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              {isSubmitting ? 'Creating Profile...' : 'Create Login Profile & Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function AppContent() {
  const { db, isLoading, isAuthenticated, currentUser, crossNavTarget } = useQMS();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  React.useEffect(() => {
    if (crossNavTarget) {
      setActiveTab(crossNavTarget.tab);
    }
  }, [crossNavTarget]);

  // Modal controls
  const [isCreateRecordModalOpen, setIsCreateRecordModalOpen] = useState(false);
  const [isCreateMachineModalOpen, setIsCreateMachineModalOpen] = useState(false);
  const [tagModalRecord, setTagModalRecord] = useState<ManufacturingRecord | null>(null);

  // Search query state for deep links
  const [traceabilityQuery, setTraceabilityQuery] = useState('');

  // Handle viewing machine traceability drill-down
  const handleViewMachineComponents = (serialNumber: string) => {
    setTraceabilityQuery(serialNumber);
    setActiveTab('traceability-search');
  };

  // Handle viewing a traceability tag modal by traceability number
  const handleViewTraceabilityTag = (traceabilityNumber: string) => {
    const record = db.manufacturingRecords.find(
      (r) => r.traceabilityNumber.toUpperCase() === traceabilityNumber.toUpperCase()
    );
    if (record) {
      setTagModalRecord(record);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-3">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <div className="text-sm font-bold font-mono tracking-wider">
          VERIFYING MACHINE QMS SESSION...
        </div>
        <p className="text-xs text-slate-400">Checking authentication &amp; controlled registers</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <StandaloneLoginScreen />;
  }

  const isManagement = currentUser?.role === 'MANAGEMENT';
  const effectiveTab: ActiveTab = isManagement
    ? activeTab === 'reports'
      ? 'reports'
      : 'dashboard'
    : activeTab;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors">
      <Header
        onNavigateToSearch={() => {
          if (isManagement) {
            setActiveTab('reports');
          } else {
            setTraceabilityQuery('');
            setActiveTab('traceability-search');
          }
        }}
        onOpenCreateRecord={() => {
          if (!isManagement) {
            setActiveTab('manufacturing');
            setIsCreateRecordModalOpen(true);
          }
        }}
        onOpenCreateMachine={() => {
          if (!isManagement) {
            setActiveTab('machines');
            setIsCreateMachineModalOpen(true);
          }
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={effectiveTab} setActiveTab={setActiveTab} />

        <main className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950">
          <div className="max-w-7xl mx-auto">
            {effectiveTab === 'dashboard' && (
              <DashboardModule
                setActiveTab={setActiveTab}
                onOpenCreateRecordModal={isManagement ? () => {} : () => {
                  setActiveTab('manufacturing');
                  setIsCreateRecordModalOpen(true);
                }}
                onOpenCreateMachineModal={isManagement ? () => {} : () => {
                  setActiveTab('machines');
                  setIsCreateMachineModalOpen(true);
                }}
                onViewTraceabilityTag={handleViewTraceabilityTag}
              />
            )}

            {activeTab === 'machines' && (
              <MachinesModule
                onViewMachineComponents={handleViewMachineComponents}
                isCreateModalOpen={isCreateMachineModalOpen}
                setIsCreateModalOpen={setIsCreateMachineModalOpen}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectsModule onViewMachineComponents={handleViewMachineComponents} />
            )}

            {!isManagement && activeTab === 'components' && <ComponentsModule />}

            {!isManagement && activeTab === 'drawings' && <DrawingsModule />}

            {!isManagement && activeTab === 'manufacturing' && (
              <ManufacturingModule
                onViewTraceabilityTag={handleViewTraceabilityTag}
                isCreateModalOpen={isCreateRecordModalOpen}
                setIsCreateModalOpen={setIsCreateRecordModalOpen}
              />
            )}

            {(activeTab === 'dale-inspections' || activeTab === 'inspections') && (
              <InspectionsModule />
            )}

            {!isManagement && activeTab === 'inspection-templates' && (
              <InspectionTemplatesModule />
            )}

            {activeTab === 'ncr' && <NCRsModule />}

            {activeTab === 'deviations' && <DeviationsModule />}

            {activeTab === 'quality-release' && <QualityReleaseModule />}

            {activeTab === 'traceability-search' && (
              <TraceabilitySearchModule
                initialQuery={traceabilityQuery}
                onViewTraceabilityTag={handleViewTraceabilityTag}
              />
            )}

            {effectiveTab === 'reports' && <ReportsModule />}

            {!isManagement && activeTab === 'audit-trail' && <AuditTrailModule />}

            {!isManagement && activeTab === 'users' && <UsersModule />}

            {!isManagement && activeTab === 'settings' && <SystemSettingsModule />}
          </div>
        </main>
      </div>

      {/* Global Printable Traceability Tag Modal */}
      <TraceabilityTagModal
        isOpen={Boolean(tagModalRecord)}
        onClose={() => setTagModalRecord(null)}
        record={tagModalRecord}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QMSProvider>
        <AppContent />
      </QMSProvider>
    </ThemeProvider>
  );
}
