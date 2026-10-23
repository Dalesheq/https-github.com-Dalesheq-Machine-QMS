import React, { useState } from 'react';
import { useQMS } from '../context/QMSContext';
import { UserRole } from '../types';
import { WORKSHOP_DEPARTMENTS } from '../utils/departmentsData';
import { Modal } from './Modal';
import {
  ShieldCheck,
  RefreshCw,
  ChevronDown,
  Layers,
  Lock,
  LogOut,
  KeyRound,
  AlertCircle,
  UserPlus,
} from 'lucide-react';

interface HeaderProps {
  onNavigateToSearch: () => void;
  onOpenCreateRecord: () => void;
  onOpenCreateMachine: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigateToSearch,
  onOpenCreateRecord,
  onOpenCreateMachine,
}) => {
  const {
    currentUser,
    authSession,
    isAuthenticated,
    login,
    registerProfile,
    logout,
    isSyncing,
  } = useQMS();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'SIGN_IN' | 'CREATE_PROFILE'>('SIGN_IN');

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [regForm, setRegForm] = useState({
    name: '',
    username: '',
    email: '',
    role: 'INSPECTOR' as UserRole,
    department: 'Quality Control & Metrology',
    password: '',
    confirmPassword: '',
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'MACHINIST':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'INSPECTOR':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'MACHINE_MANAGER':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'ENGINEERING':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'HSEQ':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      case 'ADMINISTRATOR':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'MANAGEMENT':
        return 'bg-indigo-500/25 text-indigo-300 border-indigo-400/50 font-bold';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await login(loginIdentifier, loginPassword);
      if (!res.success) {
        setLoginError(res.error || 'Invalid credentials');
      } else {
        setIsLoginModalOpen(false);
        setLoginIdentifier('');
        setLoginPassword('');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCreateProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (regForm.password.length < 6) {
      setLoginError('Password must be at least 6 characters long.');
      return;
    }
    if (regForm.password !== regForm.confirmPassword) {
      setLoginError('Passwords do not match.');
      return;
    }

    setIsLoggingIn(true);
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
        setLoginError(res.error || 'Failed to create login profile.');
      } else {
        setIsLoginModalOpen(false);
        setRegForm({
          name: '',
          username: '',
          email: '',
          role: 'INSPECTOR',
          department: 'Quality Control & Metrology',
          password: '',
          confirmPassword: '',
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg text-white shadow-inner">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-wider uppercase font-mono">
                MACHINE QMS
              </h1>
              <span className="px-2 py-0.5 text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded font-mono font-bold">
                STANDALONE REV 2.4
              </span>
              <span className="px-2 py-0.5 text-[10px] rounded font-mono font-bold flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <Lock className="w-2.5 h-2.5" />
                PRODUCTION AUTH
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Manufacturing Quality &amp; Component Traceability System
            </p>
          </div>
        </div>

        {/* Right: Quick Actions & Authenticated Session */}
        <div className="flex items-center gap-3">
          <div className="hidden xl:flex items-center gap-2 mr-2">
            <button
              onClick={onNavigateToSearch}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors"
            >
              Traceability Search
            </button>
            {['MACHINIST', 'MACHINE_MANAGER', 'ADMINISTRATOR'].includes(currentUser.role) && (
              <button
                onClick={onOpenCreateRecord}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors shadow-xs"
              >
                + New Manufacturing Record
              </button>
            )}
            {['MACHINE_MANAGER', 'ENGINEERING', 'ADMINISTRATOR'].includes(currentUser.role) && (
              <button
                onClick={onOpenCreateMachine}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors"
              >
                + Register Machine
              </button>
            )}
          </div>

          {/* Sync Status */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 border-r border-slate-800 pr-3">
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : 'text-emerald-400'}`} />
            <span className="font-mono text-[11px]">
              {isSyncing ? 'SYNCING...' : 'SERVER SYNCED'}
            </span>
          </div>

          {/* Authenticated Operator Session Menu */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors text-left"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white leading-none">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ({currentUser.id})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${getRoleBadgeColor(
                      currentUser.role
                    )}`}
                  >
                    {currentUser.role}
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400">
                    ● AUTHENTICATED
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
            </button>

            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                        Authenticated Session
                      </p>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        TOKEN VERIFIED
                      </span>
                    </div>
                    <div className="mt-2 text-xs font-mono text-slate-300 space-y-0.5">
                      <div>
                        User: <strong className="text-white">{currentUser.name}</strong> ({currentUser.id})
                      </div>
                      <div>
                        Role: <strong className="text-blue-300">{currentUser.role}</strong>
                      </div>
                      <div>
                        Dept: <span className="text-slate-400">{currentUser.department}</span>
                      </div>
                      {authSession && (
                        <div className="text-[10px] text-slate-500">
                          Expires: {new Date(authSession.expiresAt).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="p-2.5 bg-slate-950 flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setLoginError(null);
                          setModalMode('SIGN_IN');
                          setIsLoginModalOpen(true);
                        }}
                        className="px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center justify-center gap-1.5"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Sign In Another
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setLoginError(null);
                          setModalMode('CREATE_PROFILE');
                          setIsLoginModalOpen(true);
                        }}
                        className="px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center justify-center gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Create Profile
                      </button>
                    </div>
                    {isAuthenticated && (
                      <button
                        onClick={async () => {
                          setIsUserMenuOpen(false);
                          await logout();
                        }}
                        className="w-full px-3 py-2 text-xs font-bold bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded flex items-center justify-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Logout Current Session
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Credential Login / Profile Creation Modal */}
      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        title={
          modalMode === 'SIGN_IN'
            ? 'Machine QMS — Operator Authentication'
            : 'Machine QMS — Create Login Profile'
        }
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-slate-800">
          <div className="grid grid-cols-2 border border-slate-200 rounded-lg overflow-hidden bg-slate-100 font-bold">
            <button
              type="button"
              onClick={() => {
                setLoginError(null);
                setModalMode('SIGN_IN');
              }}
              className={`py-2 px-3 flex items-center justify-center gap-1.5 ${
                modalMode === 'SIGN_IN'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginError(null);
                setModalMode('CREATE_PROFILE');
              }}
              className={`py-2 px-3 flex items-center justify-center gap-1.5 ${
                modalMode === 'CREATE_PROFILE'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Create Login Profile
            </button>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-lg flex items-start gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          {modalMode === 'SIGN_IN' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Username or Email Address *
                </label>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="e.g. sarah.connor, dave.vance, admin.qms"
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter operator password"
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-bold flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {isLoggingIn ? 'Signing In...' : 'Sign In & Verify Token'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateProfileSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={regForm.name}
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    placeholder="e.g. Alex Mercer"
                    className="w-full px-3 py-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={regForm.username}
                    onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                    placeholder="e.g. alex.mercer"
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  placeholder="e.g. name@spiralsystems.co.za"
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role *</label>
                  <select
                    value={regForm.role}
                    onChange={(e) => setRegForm({ ...regForm, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 border border-slate-300 rounded font-bold bg-white"
                  >
                    <option value="MACHINIST">MACHINIST (Workshop Operator)</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Privileged roles require Administrator provisioning.
                  </p>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department *</label>
                  <select
                    value={regForm.department}
                    onChange={(e) => setRegForm({ ...regForm, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-xs"
                  >
                    {WORKSHOP_DEPARTMENTS.map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        [{dept.code}] {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Password (min 6 chars) *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    placeholder="Create password"
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regForm.confirmPassword}
                    onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                    placeholder="Confirm password"
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded font-bold flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {isLoggingIn ? 'Creating Profile...' : 'Create Profile & Sign In'}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </header>
  );
};
