import React, { useState, useMemo, useEffect } from 'react';
import { useQMS } from '../context/QMSContext';
import { StatusBadge } from '../components/StatusBadge';
import { DBService } from '../services/db';
import {
  getMachineCrossReferences,
  getComponentCrossReferences,
} from '../utils/crossReference';
import {
  Search,
  Cpu,
  Boxes,
  QrCode,
  FileSpreadsheet,
  FolderKanban,
  ExternalLink,
  Hammer,
} from 'lucide-react';

interface TraceabilitySearchModuleProps {
  initialQuery?: string;
  onViewTraceabilityTag?: (traceabilityNumber: string) => void;
}

export const TraceabilitySearchModule: React.FC<TraceabilitySearchModuleProps> = ({
  initialQuery = '',
  onViewTraceabilityTag,
}) => {
  const { db, crossNavTarget, navigateToCrossRef, clearCrossNavTarget } = useQMS();

  const [queryMode, setQueryMode] = useState<'MACHINE_TO_COMPONENTS' | 'COMPONENT_TO_MACHINES'>(
    'MACHINE_TO_COMPONENTS'
  );
  const [selectedMachineSerial, setSelectedMachineSerial] = useState<string>(
    db.machines[0]?.serialNumber || 'DIV-SN-2026-001'
  );
  const [selectedPartNumber, setSelectedPartNumber] = useState<string>(
    db.components[0]?.partNumber || 'PART-DIV-001'
  );
  const [freeSearch, setFreeSearch] = useState(initialQuery);

  useEffect(() => {
    if (crossNavTarget && crossNavTarget.tab === 'traceability-search') {
      if (crossNavTarget.searchQuery) {
        const q = crossNavTarget.searchQuery.trim().toUpperCase();
        const matchingMachine = db.machines.find(
          (m) => m.serialNumber.toUpperCase() === q
        );
        const matchingComp = db.components.find(
          (c) => c.partNumber.toUpperCase() === q
        );
        if (matchingMachine) {
          setQueryMode('MACHINE_TO_COMPONENTS');
          setSelectedMachineSerial(matchingMachine.serialNumber);
          setFreeSearch('');
        } else if (matchingComp) {
          setQueryMode('COMPONENT_TO_MACHINES');
          setSelectedPartNumber(matchingComp.partNumber);
          setFreeSearch('');
        } else {
          setFreeSearch(crossNavTarget.searchQuery);
        }
      }
      clearCrossNavTarget();
    }
  }, [crossNavTarget, db.machines, db.components, clearCrossNavTarget]);

  useEffect(() => {
    if (initialQuery) {
      const q = initialQuery.trim().toUpperCase();
      const matchingMachine = db.machines.find(
        (m) => m.serialNumber.toUpperCase() === q
      );
      const matchingComp = db.components.find(
        (c) => c.partNumber.toUpperCase() === q
      );
      if (matchingMachine) {
        setQueryMode('MACHINE_TO_COMPONENTS');
        setSelectedMachineSerial(matchingMachine.serialNumber);
        setFreeSearch('');
      } else if (matchingComp) {
        setQueryMode('COMPONENT_TO_MACHINES');
        setSelectedPartNumber(matchingComp.partNumber);
        setFreeSearch('');
      } else {
        setFreeSearch(initialQuery);
      }
    }
  }, [initialQuery, db.machines, db.components]);

  const currentMachineObj = useMemo(
    () =>
      db.machines.find(
        (m) => m.serialNumber.toLowerCase() === selectedMachineSerial.toLowerCase()
      ),
    [db.machines, selectedMachineSerial]
  );

  const currentMachineXref = useMemo(
    () => (currentMachineObj ? getMachineCrossReferences(db, currentMachineObj) : null),
    [db, currentMachineObj]
  );

  const currentCompObj = useMemo(
    () =>
      db.components.find(
        (c) => c.partNumber.toLowerCase() === selectedPartNumber.toLowerCase()
      ),
    [db.components, selectedPartNumber]
  );

  const currentCompXref = useMemo(
    () => (currentCompObj ? getComponentCrossReferences(db, currentCompObj) : null),
    [db, currentCompObj]
  );

  // Query 1: "Given this machine serial number, what critical components were fitted to it?"
  const machineComponents = useMemo(() => {
    return db.manufacturingRecords.filter((r) => {
      const matchSerial =
        r.machineSerialNumber.toLowerCase() === selectedMachineSerial.toLowerCase();
      const matchFree =
        !freeSearch.trim() ||
        r.machineSerialNumber.toLowerCase().includes(freeSearch.toLowerCase()) ||
        r.traceabilityNumber.toLowerCase().includes(freeSearch.toLowerCase()) ||
        r.partNumber.toLowerCase().includes(freeSearch.toLowerCase());
      return matchSerial && matchFree;
    });
  }, [db.manufacturingRecords, selectedMachineSerial, freeSearch]);

  // Query 2: "Given this component/part number, which machines received it?"
  const componentMachines = useMemo(() => {
    return db.manufacturingRecords.filter((r) => {
      const matchPart = r.partNumber.toLowerCase() === selectedPartNumber.toLowerCase();
      const matchFree =
        !freeSearch.trim() ||
        r.partNumber.toLowerCase().includes(freeSearch.toLowerCase()) ||
        r.machineSerialNumber.toLowerCase().includes(freeSearch.toLowerCase()) ||
        r.traceabilityNumber.toLowerCase().includes(freeSearch.toLowerCase());
      return matchPart && matchFree;
    });
  }, [db.manufacturingRecords, selectedPartNumber, freeSearch]);

  const activeList =
    queryMode === 'MACHINE_TO_COMPONENTS' ? machineComponents : componentMachines;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600" />
            Bi-Directional Component & Machine Traceability Search
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Answers both mandatory QMS genealogy queries with full Project, Drawing, Part, Inspection, Deviation, and Snapshot links.
          </p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => {
            setQueryMode('MACHINE_TO_COMPONENTS');
            setFreeSearch('');
          }}
          className={`p-4 rounded-lg border-2 text-left transition-all ${
            queryMode === 'MACHINE_TO_COMPONENTS'
              ? 'bg-blue-50 border-blue-600 shadow-xs'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-mono font-black uppercase text-blue-700">
            <Cpu className="w-4 h-4" />
            Query 1: Machine Serial → Allocated Drawings, Parts & Fitted Components
          </div>
          <div className="text-sm font-bold text-slate-900 mt-1">
            "Given this machine serial number, what drawings, parts & critical components are allocated to it?"
          </div>
        </button>

        <button
          onClick={() => {
            setQueryMode('COMPONENT_TO_MACHINES');
            setFreeSearch('');
          }}
          className={`p-4 rounded-lg border-2 text-left transition-all ${
            queryMode === 'COMPONENT_TO_MACHINES'
              ? 'bg-blue-50 border-blue-600 shadow-xs'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-mono font-black uppercase text-blue-700">
            <Boxes className="w-4 h-4" />
            Query 2: Part Number → Allocated Projects, Drawings & Recipient Machines
          </div>
          <div className="text-sm font-bold text-slate-900 mt-1">
            "Given this component/part number, which drawings, projects & machines received it?"
          </div>
        </button>
      </div>

      {/* Selector Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-4">
        {queryMode === 'MACHINE_TO_COMPONENTS' ? (
          <div className="w-full md:w-96">
            <label className="block text-[10px] font-mono uppercase font-bold text-slate-500 mb-1">
              Select Machine Serial Number
            </label>
            <select
              value={selectedMachineSerial}
              onChange={(e) => setSelectedMachineSerial(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-xs font-bold bg-slate-50"
            >
              {db.machines.map((m) => (
                <option key={m.id} value={m.serialNumber}>
                  {m.serialNumber} — {m.projectName} ({m.projectNumber})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="w-full md:w-96">
            <label className="block text-[10px] font-mono uppercase font-bold text-slate-500 mb-1">
              Select Component / Part Number
            </label>
            <select
              value={selectedPartNumber}
              onChange={(e) => setSelectedPartNumber(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-xs font-bold bg-slate-50"
            >
              {db.components.map((c) => (
                <option key={c.id} value={c.partNumber}>
                  {c.partNumber} — {c.description}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-1 w-full">
          <label className="block text-[10px] font-mono uppercase font-bold text-slate-500 mb-1">
            Filter by Traceability Ref / Drawing / Serial
          </label>
          <input
            type="text"
            placeholder="Optional keyword filter..."
            value={freeSearch}
            onChange={(e) => setFreeSearch(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
          />
        </div>
      </div>

      {/* Cross-Referenced Register Allocations Summary Card */}
      {queryMode === 'MACHINE_TO_COMPONENTS' && currentMachineXref && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              Cross-Referenced Register Allocations for Machine{' '}
              <span className="font-mono text-blue-700">{currentMachineXref.machine.serialNumber}</span>
            </div>
            {currentMachineXref.project && (
              <button
                onClick={() =>
                  navigateToCrossRef('projects', currentMachineXref.project!.projectNumber)
                }
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded font-mono font-bold inline-flex items-center gap-1"
              >
                <FolderKanban className="w-3 h-3 text-blue-600" />
                Project: {currentMachineXref.project.projectNumber} — {currentMachineXref.project.projectName}
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded">
              <div className="text-[10px] font-mono uppercase font-bold text-indigo-800 mb-1.5">
                Allocated Controlled Drawings ({currentMachineXref.drawings.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {currentMachineXref.drawings.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => navigateToCrossRef('drawings', d.drawingNumber, d.id)}
                    className="px-2 py-0.5 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded font-mono text-[10px] font-bold inline-flex items-center gap-1"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-indigo-600" />
                    {d.drawingNumber} Rev {d.revision}
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded">
              <div className="text-[10px] font-mono uppercase font-bold text-emerald-800 mb-1.5">
                Allocated BOM Parts & Components ({currentMachineXref.parts.length})
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {currentMachineXref.parts.map((pt) => (
                  <button
                    key={pt.partNumber}
                    onClick={() => navigateToCrossRef('components', pt.partNumber)}
                    className="px-2 py-0.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded font-mono text-[10px] font-bold inline-flex items-center gap-1"
                    title={`${pt.description} (Qty: ${pt.quantity})`}
                  >
                    <Boxes className="w-3 h-3 text-emerald-600" />
                    {pt.partNumber}
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {queryMode === 'COMPONENT_TO_MACHINES' && currentCompXref && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-600" />
              Cross-Referenced Register Allocations for Part{' '}
              <span className="font-mono text-emerald-700">{currentCompXref.component.partNumber}</span>{' '}
              — {currentCompXref.component.description}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded">
              <div className="text-[10px] font-mono uppercase font-bold text-indigo-800 mb-1.5">
                Controlled Drawings ({currentCompXref.drawings.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {currentCompXref.drawings.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => navigateToCrossRef('drawings', d.drawingNumber, d.id)}
                    className="px-2 py-0.5 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded font-mono text-[10px] font-bold inline-flex items-center gap-1"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-indigo-600" />
                    {d.drawingNumber} Rev {d.revision}
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-blue-50/50 border border-blue-200 rounded">
              <div className="text-[10px] font-mono uppercase font-bold text-blue-800 mb-1.5">
                Allocated Projects ({currentCompXref.projects.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {currentCompXref.projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigateToCrossRef('projects', p.projectNumber)}
                    className="px-2 py-0.5 bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 rounded font-mono text-[10px] font-bold inline-flex items-center gap-1"
                  >
                    <FolderKanban className="w-3 h-3 text-blue-600" />
                    {p.projectNumber}
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-100 border border-slate-300 rounded">
              <div className="text-[10px] font-mono uppercase font-bold text-slate-700 mb-1.5">
                Allocated Machine Serials ({currentCompXref.machines.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {currentCompXref.machines.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => navigateToCrossRef('machines', m.serialNumber)}
                    className="px-2 py-0.5 bg-white hover:bg-slate-200 text-slate-900 border border-slate-300 rounded font-mono text-[10px] font-bold inline-flex items-center gap-1"
                  >
                    <Cpu className="w-3 h-3 text-slate-600" />
                    {m.serialNumber}
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Genealogy Cards */}
      <div className="space-y-4">
        {activeList.map((rec) => {
          const insp = db.inspections.find((i) => i.manufacturingRecordId === rec.id);
          const devs = db.deviations.filter((d) => d.manufacturingRecordId === rec.id);
          const ncrs = db.ncrs.filter((n) => n.manufacturingRecordId === rec.id);
          const rel = db.releases.find((rl) => rl.manufacturingRecordId === rec.id);
          const syncedChars = insp
            ? DBService.syncCharacteristicsWithDeviations(insp.characteristics, devs)
            : [];

          return (
            <div
              key={rec.id}
              className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => navigateToCrossRef('manufacturing', rec.traceabilityNumber, rec.id)}
                      className="font-mono font-black text-sm text-blue-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Hammer className="w-3.5 h-3.5" />
                      {rec.traceabilityNumber}
                    </button>
                    <button
                      onClick={() => navigateToCrossRef('components', rec.partNumber)}
                      className="font-mono font-bold text-emerald-800 hover:underline"
                    >
                      • {rec.partNumber} ({rec.componentDescription})
                    </button>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => navigateToCrossRef('machines', rec.machineSerialNumber)}
                      className="hover:text-blue-700 hover:underline"
                    >
                      Machine Serial: <strong>{rec.machineSerialNumber}</strong>
                    </button>
                    <span>|</span>
                    <button
                      onClick={() => navigateToCrossRef('projects', rec.projectNumber)}
                      className="hover:text-blue-700 hover:underline"
                    >
                      Project: <strong>{rec.projectNumber}</strong>
                    </button>
                    <span>|</span>
                    <span>
                      Qty: <strong>{rec.quantity}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={rec.manufacturingStatus} size="md" />
                  {onViewTraceabilityTag && (
                    <button
                      onClick={() => onViewTraceabilityTag(rec.traceabilityNumber)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1"
                    >
                      <QrCode className="w-3 h-3" /> Tag
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] font-mono text-slate-500 uppercase font-bold">
                    Historical Drawing Snapshot Used
                  </div>
                  <button
                    onClick={() => navigateToCrossRef('drawings', rec.drawingNumber)}
                    className="font-mono font-bold text-indigo-900 hover:underline mt-0.5 inline-flex items-center gap-1"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-indigo-600" />
                    {rec.drawingNumber} Rev {rec.drawingRevision}
                  </button>
                  <div className="text-[11px] text-emerald-700 font-semibold">
                    Status at Mfg: {rec.drawingSnapshot?.approvalStatusAtManufacture || 'APPROVED'} (
                    {rec.drawingSnapshot?.drawingApprovalDate || 'Verified'})
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] font-mono text-slate-500 uppercase font-bold">
                    Machinist & Permanent Marking
                  </div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {rec.machinist} ({rec.machinistId})
                  </div>
                  <div className="text-[11px] font-mono text-slate-600">
                    {rec.permanentIdCompleted
                      ? `${rec.permanentIdMethod}: ${rec.permanentIdReference}`
                      : 'Awaiting Permanent ID'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] font-mono text-slate-500 uppercase font-bold">
                    QMS Inspection & Sign-Off
                  </div>
                  {insp ? (
                    <>
                      <div className="font-mono font-bold text-slate-900 mt-0.5">
                        {insp.id} ({insp.status})
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {insp.inspectorSignOff?.confirmed
                          ? `Signed: ${insp.inspectorSignOff.inspectorName} (${insp.inspectorSignOff.inspectorId})`
                          : `Inspector: ${insp.inspectorName} (Unsigned)`}
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-400 mt-0.5">No inspection sheet yet</div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] font-mono text-slate-500 uppercase font-bold">
                    Release Certificate & Concessions
                  </div>
                  {rel ? (
                    <>
                      <div className="font-mono font-bold text-emerald-700 mt-0.5">
                        {rel.releaseId} — {rel.releaseResult}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Released by {rel.releasedBy} ({rel.releasedById})
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-500 mt-0.5">
                      Not yet released ({ncrs.length} NCR, {devs.length} Dev)
                    </div>
                  )}
                </div>
              </div>

              {syncedChars.length > 0 && (
                <div className="pt-2">
                  <div className="text-[10px] font-mono uppercase font-bold text-slate-500 mb-1.5">
                    Recorded Dimensional Inspection Readings
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {syncedChars.map((c) => (
                      <div
                        key={c.id}
                        className="p-2 rounded border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-semibold text-slate-800">
                            #{c.charNumber} {c.feature}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">
                            Spec: {c.nominal} ({c.lowerTolerance}/+{c.upperTolerance}{c.unit}) |{' '}
                            <strong>Actual: {c.actual ?? 'Pending'}</strong>
                          </div>
                          {c.disposition === 'ACCEPTED_BY_APPROVED_DEVIATION' && (
                            <div className="text-[10px] font-mono font-bold text-amber-800">
                              Concession: {c.deviationNumber} ({c.deviationApprovedBy})
                            </div>
                          )}
                        </div>
                        <StatusBadge
                          status={
                            c.disposition === 'ACCEPTED_BY_APPROVED_DEVIATION'
                              ? 'ACCEPTED_BY_APPROVED_DEVIATION'
                              : c.result
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
