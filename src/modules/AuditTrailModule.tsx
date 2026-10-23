import React, { useState } from 'react';
import { useQMS } from '../context/QMSContext';
import { AuditLog } from '../types';
import {
  History,
  Search,
  Filter,
  User,
  Shield,
  Clock,
  Download,
  Eye,
  FileCode,
} from 'lucide-react';
import { Modal } from '../components/Modal';

export const AuditTrailModule: React.FC = () => {
  const { db } = useQMS();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  const filteredLogs = db.auditLogs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.recordId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || log.recordType === typeFilter;

    return matchesSearch && matchesType;
  });

  const exportAuditLogsAsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(db.auditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `machine-qms-audit-trail-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Audit Trail Register
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all quality-affecting events, drawing status changes, manufacturing records, and user actions.
          </p>
        </div>

        <button
          onClick={exportAuditLogsAsJson}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          Export Audit Trail (JSON)
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by user, record ID (e.g. DIV-2026-...), action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 py-1.5 px-2.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Record Types</option>
            <option value="MANUFACTURING_RECORD">Manufacturing Record</option>
            <option value="INSPECTION">Inspection Sheet</option>
            <option value="NCR">Non-Conformance Report (NCR)</option>
            <option value="DEVIATION">Engineering Deviation</option>
            <option value="RELEASE">Quality Release Certificate</option>
            <option value="DRAWING">Drawing &amp; Revision</option>
            <option value="COMPONENT">Component Master</option>
            <option value="MACHINE">Machine</option>
            <option value="PROJECT">Project</option>
            <option value="ATTACHMENT">Attachment File</option>
            <option value="AUTH">Authentication &amp; Access</option>
            <option value="SYSTEM">System &amp; Settings</option>
            <option value="DATABASE">Database State</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-600 border-b border-slate-200 uppercase font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Date / Time (UTC)</th>
                <th className="py-2.5 px-4">Operator / Role</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Record Type</th>
                <th className="py-2.5 px-4">Record Reference</th>
                <th className="py-2.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No audit records match your search.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                      <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{log.user}</div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">
                        {log.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800 text-[11px]">
                      {log.action}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[10px] text-slate-700">
                        {log.recordType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-700 text-xs">
                      {log.recordId}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedAuditLog(log)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium border border-slate-200 inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Diff
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details & Diff Modal */}
      {selectedAuditLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAuditLog(null)}
          title={`Audit Record: ${selectedAuditLog.action}`}
          subtitle={`Reference: ${selectedAuditLog.recordId} • By ${selectedAuditLog.user} (${selectedAuditLog.role})`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-3 rounded text-[11px]">
              <div>
                <span className="text-slate-500">TIMESTAMP:</span> {selectedAuditLog.timestamp}
              </div>
              <div>
                <span className="text-slate-500">USER:</span> {selectedAuditLog.user} (
                {selectedAuditLog.role})
              </div>
              <div>
                <span className="text-slate-500">TARGET:</span> {selectedAuditLog.recordType}
              </div>
              <div>
                <span className="text-slate-500">RECORD ID:</span> {selectedAuditLog.recordId}
              </div>
            </div>

            {selectedAuditLog.details && (
              <div>
                <span className="text-slate-700 font-bold block mb-1">EVENT METADATA:</span>
                <pre className="bg-slate-900 text-slate-200 p-3 rounded text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedAuditLog.details, null, 2)}
                </pre>
              </div>
            )}

            {selectedAuditLog.previousValue && (
              <div>
                <span className="text-slate-700 font-bold block mb-1 text-rose-700">
                  PREVIOUS STATE:
                </span>
                <pre className="bg-rose-50 border border-rose-200 text-rose-950 p-2.5 rounded text-[10px] overflow-x-auto max-h-36">
                  {selectedAuditLog.previousValue}
                </pre>
              </div>
            )}

            {selectedAuditLog.newValue && (
              <div>
                <span className="text-slate-700 font-bold block mb-1 text-emerald-700">
                  NEW COMMITTED STATE:
                </span>
                <pre className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-2.5 rounded text-[10px] overflow-x-auto max-h-36">
                  {selectedAuditLog.newValue}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium font-sans"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
