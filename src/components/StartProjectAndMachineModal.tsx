import React, { useState } from 'react';
import { useQMS } from '../context/QMSContext';
import { Modal } from './Modal';
import {
  FolderKanban,
  Cpu,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Building,
  Hash,
  FileText,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

interface StartProjectAndMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (projectNumber: string, machineSerial: string) => void;
}

export const StartProjectAndMachineModal: React.FC<StartProjectAndMachineModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { db, currentUser, startNewProjectAndMachine } = useQMS();
  const isAdmin = currentUser?.role === 'ADMINISTRATOR';

  const [projectNumber, setProjectNumber] = useState('');
  const [projectName, setProjectName] = useState('');
  const [customer, setCustomer] = useState('');
  const [machineType, setMachineType] = useState('SPIRAL FREEZER');
  const [machineSerial, setMachineSerial] = useState('');
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate realistic starter numbers if empty
  const handleAutoSuggest = () => {
    const year = new Date().getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    setProjectNumber(`PRJ-${year}-${rand}`);
    setProjectName(
      machineType.includes('SPIRAL')
        ? 'Single Drum Ambient Spiral Cooling System'
        : machineType.includes('CONVEYOR')
        ? 'Sanitary Modular Plastic Belt Incline Conveyor'
        : `${machineType} Precision Production Cell`
    );
    setCustomer('Premier Food Industries');
    setMachineSerial(
      machineType.includes('SPIRAL')
        ? `SF-${year}-${rand}`
        : machineType.includes('CONVEYOR')
        ? `CV-${year}-${rand}`
        : `MC-${year}-${rand}`
    );
    setNotes('Manufactured under Dale Automation & Spiral Systems ISO 9001:2015 quality procedures.');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanProjNum = projectNumber.trim().toUpperCase();
    const cleanSerial = machineSerial.trim().toUpperCase();

    if (!cleanProjNum) {
      setError('Please provide a Project Number (e.g. PRJ-2026-001 or T0560).');
      return;
    }
    if (!cleanSerial) {
      setError('Please provide a Machine Serial Number (e.g. SF-2026-01).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await startNewProjectAndMachine({
        projectNumber: cleanProjNum,
        projectName: projectName.trim() || `${machineType} Build`,
        customer: customer.trim() || 'Internal Production',
        machineType,
        machineSerialNumber: cleanSerial,
        assemblyStatus: 'NOT_STARTED',
        startDate: new Date().toISOString().split('T')[0],
        targetCompletionDate: targetDate,
        notes: notes.trim(),
      });

      if (!res.success) {
        setError(res.error || 'Failed to initialize project and machine.');
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onClose();
      if (onSuccess) {
        onSuccess(cleanProjNum, cleanSerial);
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error creating project and machine.');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Start New Project & Machine"
      subtitle="Clean Slate Setup: Initialize your master project contract and link its first machine unit"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Banner with clean-slate indicator */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 rounded-xl shadow-xs border border-blue-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-400/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
                Fresh Production Setup
              </h4>
              <p className="text-xs text-blue-200/90 leading-relaxed">
                Creates your Project and Machine simultaneously with automatic cross-linking.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAutoSuggest}
            className="px-3 py-1.5 bg-blue-500/30 hover:bg-blue-500/50 text-blue-100 border border-blue-400/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>Auto-Fill Template</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Project Details */}
        <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <FolderKanban className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>1. Project Contract Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. PRJ-2026-001 or T0560"
                  value={projectNumber}
                  onChange={(e) => setProjectNumber(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-xs uppercase text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Customer / Client <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. McCain Foods / Premier Bakeries"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project Name / Machine Description
              </label>
              <input
                type="text"
                placeholder="e.g. Ambient Spiral Proofer & Incline Conveyor Line"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Machine Details */}
        <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>2. Machine Serial &amp; Classification</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Machine Serial Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Cpu className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. SF-2026-001 or DALE-MC-01"
                  value={machineSerial}
                  onChange={(e) => setMachineSerial(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-xs uppercase text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Machine Type
              </label>
              <select
                value={machineType}
                onChange={(e) => setMachineType(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                {(db.settings?.machineTypes || [
                  'SPIRAL FREEZER',
                  'CONVEYOR',
                  'DIVIDER',
                  'ROUNDER',
                  'PROOFER',
                  'MOULDER',
                  'CHILLER',
                  'OTHER',
                ]).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Completion Date
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Engineering / Build Notes
              </label>
              <div className="relative">
                <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. Sanitary food-grade design, SS304"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Initializing System...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Create Project &amp; Machine</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
