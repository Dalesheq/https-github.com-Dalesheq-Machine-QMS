import React, { useState, useMemo } from 'react';
import { useQMS } from '../context/QMSContext';
import { User, UserRole } from '../types';
import { DBService } from '../services/db';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { WORKSHOP_DEPARTMENTS } from '../utils/departmentsData';
import { Users, KeyRound, ShieldCheck, Plus, AlertCircle, Trash2, Building2, Filter } from 'lucide-react';

export const UsersModule: React.FC = () => {
  const { db, currentUser, refreshDatabase, deleteUser } = useQMS();

  const isAdmin = currentUser.role === 'ADMINISTRATOR';

  // Filters
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');

  // Create User Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    name: '',
    role: 'MACHINIST' as UserRole,
    department: WORKSHOP_DEPARTMENTS[0].name,
    email: '',
    password: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Reset Password Modal (Admin only)
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setStatusMessage(null);

    try {
      if (isAdmin) {
        const res = await DBService.createUserAccount({
          user: {
            username: newUserForm.username.trim().toLowerCase(),
            name: newUserForm.name.trim(),
            role: newUserForm.role,
            department: newUserForm.department.trim(),
            email: newUserForm.email.trim(),
          },
          newPassword: newUserForm.password,
        });
        if (!res.success || !res.user) {
          setFormError(res.error || 'Failed to create user.');
          return;
        }
        await refreshDatabase();
        setIsCreateOpen(false);
        setStatusMessage(`User ${res.user.name} (${res.user.id}) created.`);
      } else {
        const res = await DBService.registerUserProfile({
          username: newUserForm.username.trim().toLowerCase(),
          name: newUserForm.name.trim(),
          role: newUserForm.role,
          department: newUserForm.department.trim(),
          email: newUserForm.email.trim(),
          password: newUserForm.password,
          preserveCurrentSession: true,
        });
        if (!res.success || !res.user) {
          setFormError(res.error || 'Failed to create login profile.');
          return;
        }
        await refreshDatabase();
        setIsCreateOpen(false);
        setStatusMessage(`Login profile ${res.user.name} (${res.user.id}) registered.`);
      }

      setNewUserForm({
        username: '',
        name: '',
        role: 'MACHINIST',
        department: 'CNC Machining & Turning',
        email: '',
        password: '',
      });
    } catch (err: any) {
      setFormError(err.message || 'Error creating user.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    setFormError(null);

    try {
      const res = await DBService.resetUserPassword(resetTargetUser.id, newPassword);
      if (!res.success) {
        setFormError(res.error || 'Failed to reset password.');
        return;
      }
      setStatusMessage(`Password updated for ${resetTargetUser.name} (${resetTargetUser.id}).`);
      setResetTargetUser(null);
      setNewPassword('');
    } catch (err: any) {
      setFormError(err.message || 'Error resetting password.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Personnel Directory &amp; Role Authority Register
            </h2>
            <p className="text-xs text-slate-500">
              Immutable User IDs enforced for Separation of Duties (<code className="font-mono">machinistId !== inspectorId</code> &amp; <code className="font-mono">machinistId !== releasedById</code>).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={() => {
              setFormError(null);
              setIsCreateOpen(true);
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-sans font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Login Profile
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900">
          {statusMessage}
        </div>
      )}

      {/* Department & Role Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Filter by Department:</span>
          </div>
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
          >
            <option value="ALL">All Departments ({WORKSHOP_DEPARTMENTS.length})</option>
            {WORKSHOP_DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.name}>
                [{d.code}] {d.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 font-bold text-slate-700 ml-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span>Role:</span>
          </div>
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
          >
            <option value="ALL">All Roles</option>
            <option value="MACHINIST">MACHINIST</option>
            <option value="INSPECTOR">INSPECTOR</option>
            <option value="MACHINE_MANAGER">MACHINE_MANAGER</option>
            <option value="ENGINEERING">ENGINEERING</option>
            <option value="HSEQ">HSEQ</option>
            <option value="ADMINISTRATOR">ADMINISTRATOR</option>
            <option value="MANAGEMENT">MANAGEMENT (Executive)</option>
          </select>
        </div>

        <span className="text-[11px] font-mono text-slate-500">
          Showing {
            db.users.filter((u) => {
              if (selectedDeptFilter !== 'ALL' && !u.department.toLowerCase().includes(selectedDeptFilter.toLowerCase())) return false;
              if (selectedRoleFilter !== 'ALL' && u.role !== selectedRoleFilter) return false;
              return true;
            }).length
          } of {db.users.length} accounts
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white uppercase font-mono text-[10px] tracking-wider">
                <th className="py-3 px-4">Immutable User ID</th>
                <th className="py-3 px-4">Name &amp; Username</th>
                <th className="py-3 px-4">Role &amp; Authority</th>
                <th className="py-3 px-4">Department &amp; Email</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {db.users
                .filter((u) => {
                  if (selectedDeptFilter !== 'ALL' && !u.department.toLowerCase().includes(selectedDeptFilter.toLowerCase())) return false;
                  if (selectedRoleFilter !== 'ALL' && u.role !== selectedRoleFilter) return false;
                  return true;
                })
                .map((u) => {
                const isCurrent = u.id === currentUser.id;
                return (
                  <tr
                    key={u.id}
                    className={isCurrent ? 'bg-blue-50/70' : 'hover:bg-slate-50'}
                  >
                    <td className="py-3.5 px-4 font-mono font-black text-blue-700">
                      {u.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      <div className="text-[11px] font-mono text-slate-500">@{u.username}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={u.role} />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 font-medium">{u.department}</div>
                      <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={u.active === false ? 'INACTIVE' : 'ACTIVE'} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-mono font-bold text-[11px] mr-2">
                          <ShieldCheck className="w-4 h-4" /> CURRENT SESSION
                        </span>
                      )}
                      {isAdmin && (
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setFormError(null);
                              setNewPassword('');
                              setResetTargetUser(u);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            <KeyRound className="w-3 h-3" /> Reset Password
                          </button>

                          {!isCurrent && (
                            <>
                              {confirmDeleteUserId !== u.id ? (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteUserId(u.id)}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-[11px] font-bold inline-flex items-center gap-1"
                                  title={`Delete user account ${u.username}`}
                                >
                                  <Trash2 className="w-3 h-3" /> Delete
                                </button>
                              ) : (
                                <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setFormError(null);
                                      setStatusMessage(null);
                                      const res = await deleteUser(u.id);
                                      setConfirmDeleteUserId(null);
                                      if (res.success) {
                                        setStatusMessage(`Deleted user account ${u.name} (${u.id}).`);
                                      } else {
                                        setFormError(res.error || 'Failed to delete user.');
                                      }
                                    }}
                                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold"
                                  >
                                    Confirm Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteUserId(null)}
                                    className="px-1.5 py-0.5 bg-white text-slate-700 border border-slate-300 rounded text-[10px] font-semibold"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Operator Login Profile"
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded flex items-start gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={newUserForm.name}
                onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                placeholder="e.g. Willem Botha"
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Username *</label>
              <input
                type="text"
                required
                value={newUserForm.username}
                onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                placeholder="e.g. willem.botha"
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Role *</label>
              <select
                value={newUserForm.role}
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
                  setNewUserForm({
                    ...newUserForm,
                    role,
                    department: defaultDept[role] || newUserForm.department,
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white font-bold text-slate-900"
              >
                <option value="ADMINISTRATOR">ADMINISTRATOR (System Admin & QMS Governance)</option>
                <option value="MACHINE_MANAGER">MACHINE_MANAGER (Machine Shop / Production Lead)</option>
                <option value="INSPECTOR">INSPECTOR (Quality Metrology & Inspection)</option>
                <option value="ENGINEERING">ENGINEERING (Mechanical Design & CAD)</option>
                <option value="HSEQ">HSEQ (Quality Assurance & Compliance)</option>
                <option value="MACHINIST">MACHINIST (Workshop Operator / Bay Machinist)</option>
                <option value="MANAGEMENT">MANAGEMENT (Executive Oversight & Reporting)</option>
              </select>
              <p className="text-[10px] text-blue-700 font-medium mt-1">
                {newUserForm.role === 'ADMINISTRATOR' && 'Full governance authority: user admin, permissions, drawings, and QMS settings.'}
                {newUserForm.role === 'MACHINE_MANAGER' && 'Production lead: machine builds, scheduling, BOMs, and inspection templates.'}
                {newUserForm.role === 'INSPECTOR' && 'Quality authority: dimensional inspection, holding points, CMM, NCRs, and FAT release.'}
                {newUserForm.role === 'ENGINEERING' && 'Technical authority: drawing revisions, CAD redlines, and engineering deviations.'}
                {newUserForm.role === 'HSEQ' && 'Compliance authority: NCR disposition, corrective actions, audits, and release sign-offs.'}
                {newUserForm.role === 'MACHINIST' && 'Workshop authority: machining, turning, fabrication, pre-fitting, and first-off checks.'}
                {newUserForm.role === 'MANAGEMENT' && 'Executive oversight: machine progress, quality KPIs, and management reports.'}
              </p>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Department *</label>
              <select
                value={newUserForm.department}
                onChange={(e) =>
                  setNewUserForm({ ...newUserForm, department: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white font-medium"
              >
                {WORKSHOP_DEPARTMENTS.map((dept) => (
                  <option key={dept.id} value={dept.name}>
                    [{dept.code}] {dept.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder="w.botha@spiralsystems.co.za"
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Password (min 6 chars) *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newUserForm.password}
                onChange={(e) =>
                  setNewUserForm({ ...newUserForm, password: e.target.value })
                }
                placeholder="Set operator password"
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
            >
              Create Login Profile
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={Boolean(resetTargetUser)}
        onClose={() => setResetTargetUser(null)}
        title={`Reset Password — ${resetTargetUser?.name} (${resetTargetUser?.id})`}
        maxWidth="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded font-semibold">
              {formError}
            </div>
          )}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              New Password (min 6 chars) *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setResetTargetUser(null)}
              className="px-4 py-2 border border-slate-300 rounded font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold"
            >
              Save New Password
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
