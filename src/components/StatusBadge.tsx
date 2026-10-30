import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const getStyles = (s: string): string => {
    switch (s.toUpperCase()) {
      case 'APPROVED':
      case 'PASS':
      case 'RELEASED':
      case 'CLOSED':
      case 'ACTIVE':
      case 'INSPECTION_PASSED':
      case 'READY_FOR_RELEASE':
      case 'COMPLETED':
      case 'DELIVERED':
        return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/70';

      case 'ACCEPTED_BY_APPROVED_DEVIATION':
      case 'ACCEPTED_BY_DEVIATION':
      case 'FAIL (ACCEPTED_BY_APPROVED_DEVIATION)':
      case 'PASS WITH APPROVED DEVIATION - RELEASED':
      case 'USE_AS_IS':
      case 'CONCESSION_ACCEPTED':
      case 'REWORK_TO_REDLINE':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-400 dark:border-amber-700/70 font-bold';

      case 'IN_PRODUCTION':
      case 'IN_PROGRESS':
      case 'UNDER_REVIEW':
      case 'AWAITING_INSPECTION':
      case 'AWAITING_IDENTIFICATION':
      case 'AWAITING_APPROVAL':
      case 'UNDER_INSPECTION':
      case 'PENDING':
      case 'CONTAINED':
      case 'DISPOSITIONED':
      case 'DEVIATION_REVIEW':
      case 'REWORK':
      case 'SUB_ASSEMBLY':
      case 'FINAL_ASSEMBLY':
      case 'TESTING':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700/70';

      case 'HOLD':
      case 'QUALITY_HOLD':
      case 'NCR_HOLD':
      case 'ON_HOLD':
      case 'FAIL':
      case 'OPEN':
      case 'REJECTED':
      case 'OBSOLETE':
      case 'SCRAP':
      case 'SCRAPPED':
      case 'BLOCKED':
      case 'INCOMPLETE':
      case 'INACTIVE':
        return 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-700/70';

      case 'DRAFT':
      case 'PLANNED':
      case 'PLANNING':
      case 'NOT_STARTED':
      case 'SUPERSEDED':
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-mono font-bold uppercase tracking-wider border rounded ${sizeClasses} ${getStyles(
        status || 'UNKNOWN'
      )}`}
    >
      {(status || 'UNKNOWN').replace(/_/g, ' ')}
    </span>
  );
};

