import React, { useState } from 'react';
import { useQMS } from '../context/QMSContext';
import {
  Settings,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

export const SystemSettingsModule: React.FC = () => {
  const {
    db,
    currentUser,
    resetToDefaultData,
    importDatabaseJson,
    clearCollectionList,
  } = useQMS();

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmClearTarget, setConfirmClearTarget] = useState<string | null>(null);
  const [confirmResetBaseline, setConfirmResetBaseline] = useState(false);

  const isAdmin = currentUser.role === 'ADMINISTRATOR';

  const handleExport = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(db, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute(
      'download',
      `machine-qms-backup-${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatusMessage('Database JSON backup exported.');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setStatusMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const res = await importDatabaseJson(text);
      if (!res.success) {
        setErrorMessage(res.error || 'Database restore rejected.');
      } else {
        setStatusMessage('Database successfully restored from backup by Administrator.');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    const res = await resetToDefaultData();
    setConfirmResetBaseline(false);
    if (!res.success) {
      setErrorMessage(res.error || 'Database reset rejected.');
    } else {
      setStatusMessage('Database reset to initial compliance seed baseline (registered user accounts preserved).');
    }
  };

  const handleClearCollection = async (
    collectionKey:
      | 'projects'
      | 'machines'
      | 'components'
      | 'drawings'
      | 'manufacturingRecords'
      | 'inspections'
      | 'ncrs'
      | 'deviations'
      | 'releases'
      | 'auditLogs'
      | 'ALL_DATA',
    label: string
  ) => {
    setErrorMessage(null);
    setStatusMessage(null);
    const res = await clearCollectionList(collectionKey);
    setConfirmClearTarget(null);
    if (!res.success) {
      setErrorMessage(res.error || `Failed to clear ${label}.`);
    } else {
      setStatusMessage(
        collectionKey === 'ALL_DATA'
          ? 'All QMS register lists have been permanently cleared (User Login Accounts preserved).'
          : `${label} list has been permanently cleared by Administrator.`
      );
    }
  };

  const registerListCollections: Array<{
    key:
      | 'projects'
      | 'machines'
      | 'components'
      | 'drawings'
      | 'manufacturingRecords'
      | 'inspections'
      | 'ncrs'
      | 'deviations'
      | 'releases'
      | 'auditLogs';
    label: string;
    count: number;
    desc: string;
  }> = [
    {
      key: 'projects',
      label: 'Projects Register List',
      count: db.projects.length,
      desc: 'Customer contracts & project engineering allocations',
    },
    {
      key: 'machines',
      label: 'Machines Register List',
      count: db.machines.length,
      desc: 'Serial numbers, machine builds & assembly statuses',
    },
    {
      key: 'components',
      label: 'Component Master / Parts List',
      count: db.components.length,
      desc: 'Master parts register & QMS applicability flags',
    },
    {
      key: 'drawings',
      label: 'Controlled Drawings & BOM Lists',
      count: db.drawings.length,
      desc: 'Engineering drawings, revisions & multi-part BOM lists',
    },
    {
      key: 'manufacturingRecords',
      label: 'Manufacturing Traceability List',
      count: db.manufacturingRecords.length,
      desc: 'Machining traceability records & permanent IDs',
    },
    {
      key: 'inspections',
      label: 'Dimensional Inspections List',
      count: db.inspections.length,
      desc: 'QMS inspection sheets & characteristic measurements',
    },
    {
      key: 'ncrs',
      label: 'Non-Conformance (NCR) List',
      count: db.ncrs.length,
      desc: 'Quarantine holds, root causes & dispositions',
    },
    {
      key: 'deviations',
      label: 'Engineering Deviations List',
      count: db.deviations.length,
      desc: 'Concessions & redline drawing approvals',
    },
    {
      key: 'releases',
      label: 'Quality Release Certificates List',
      count: db.releases.length,
      desc: '18-point gate release certificates',
    },
    {
      key: 'auditLogs',
      label: 'Audit Trail Log List',
      count: db.auditLogs.length,
      desc: 'System activity log entries',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              System Governance, Security &amp; Database Administration
            </h2>
            <p className="text-xs text-slate-500">
              Production Authentication enforcement, QMS compliance rules, and Administrator-restricted data &amp; list deletion operations.
            </p>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-lg text-xs font-semibold text-rose-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Production Auth Status (Locked) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              Production Authentication &amp; Role-Switching Lock
            </h3>
            <p className="text-slate-600 mt-1">
              <strong>Production Security Mode is permanently active.</strong> Unauthenticated role switching is strictly blocked (<code className="font-mono">POST /api/auth/switch-role</code> returns HTTP 403). All operators must sign in with username/email and password credentials.
            </p>
          </div>
          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded font-mono font-bold shrink-0">
            LOCKED: PRODUCTION AUTH
          </span>
        </div>
      </div>

      {/* Database Backup, Restore & Reset (Admin Restricted) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 text-xs">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          Database Backup, Restore &amp; Baseline Reset (Administrator Restricted)
        </h3>
        <p className="text-slate-600">
          Database Import/Overwrite, Reset to Defaults, and Data/List Deletion are strictly restricted to <strong>ADMINISTRATOR</strong> on both frontend and server (<code className="font-mono">POST /api/db</code>). Current role: <strong className="font-mono">{currentUser.role}</strong>.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Full Database JSON Backup
          </button>

          <label
            className={`px-4 py-2 rounded font-bold inline-flex items-center gap-2 cursor-pointer ${
              isAdmin
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            <Upload className="w-4 h-4" />
            Import / Restore Database JSON (Admin Only)
            <input
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>

          {!confirmResetBaseline ? (
            <button
              type="button"
              onClick={() => {
                if (isAdmin) {
                  setConfirmResetBaseline(true);
                } else {
                  handleReset();
                }
              }}
              className={`px-4 py-2 rounded font-bold inline-flex items-center gap-2 ${
                isAdmin
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              Reset Database to Baseline (Admin Only)
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-300 px-3 py-1.5 rounded">
              <span className="font-bold text-amber-950">Reset to default baseline?</span>
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded font-bold"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetBaseline(false)}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-semibold"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Administrator Data & Register List Deletion Controls */}
      {isAdmin && (
        <div className="bg-white border-2 border-rose-200 rounded-lg p-5 shadow-xs space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-200 pb-3">
            <div>
              <h3 className="text-sm font-black text-rose-950 flex items-center gap-2 uppercase font-mono tracking-wider">
                <Trash2 className="w-4 h-4 text-rose-600" />
                Administrator Data &amp; Register List Deletion Controls
              </h3>
              <p className="text-slate-600 mt-1">
                Permanently delete individual register lists or clear all QMS register data. Deleted items and cleared lists are tombstoned so they will not reappear on sync or update. User login accounts are always preserved.
              </p>
            </div>

            <div>
              {confirmClearTarget !== 'ALL_DATA' ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearTarget('ALL_DATA')}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded font-bold inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All Register Lists (Clean Slate)
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 bg-rose-100 border border-rose-400 px-3 py-1.5 rounded">
                  <span className="font-bold text-rose-950">
                    Confirm clearing ALL register data?
                  </span>
                  <button
                    type="button"
                    onClick={() => handleClearCollection('ALL_DATA', 'All Register Data')}
                    className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded font-bold"
                  >
                    Yes, Clear All Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearTarget(null)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {registerListCollections.map((col) => {
              const isConfirming = confirmClearTarget === col.key;
              return (
                <div
                  key={col.key}
                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{col.label}</span>
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-mono font-bold text-[11px]">
                        {col.count} {col.count === 1 ? 'record' : 'records'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{col.desc}</p>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-200/80">
                    {!isConfirming ? (
                      <button
                        type="button"
                        disabled={col.count === 0}
                        onClick={() => setConfirmClearTarget(col.key)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 border border-rose-300 rounded font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear List ({col.count})
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-rose-800">Confirm?</span>
                        <button
                          type="button"
                          onClick={() => handleClearCollection(col.key, col.label)}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[11px]"
                        >
                          Yes, Delete List
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearTarget(null)}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-semibold text-[11px]"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
