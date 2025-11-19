import React from 'react';

type BadgeVariant = 'job' | 'qc';

interface StatusBadgeProps {
  variant: BadgeVariant;
  status: string | undefined | null;
  className?: string;
  labelOverride?: string;
}

const baseClasses = 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium border';

function JobStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'processing':
    case 'running':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
      );
    case 'failed':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'pending':
    case 'starting':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'stopped':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6M5 6h14v12H5z" />
        </svg>
      );
    default:
      return null;
  }
}

function QcStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'qc_failed':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      );
    case 'retry_pending':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'processing':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
      );
    case 'approved':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'failed_retry':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    default:
      return null;
  }
}

function getJobStyle(status: string) {
  switch (status) {
    case 'completed':
      return { classes: 'bg-green-100 text-green-800 border-green-200', label: 'Completed' };
    case 'processing':
    case 'running':
      return { classes: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Processing' };
    case 'failed':
      return { classes: 'bg-red-100 text-red-800 border-red-200', label: 'Failed' };
    case 'pending':
    case 'starting':
      return { classes: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pending' };
    case 'stopped':
      return { classes: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Stopped' };
    default:
      return { classes: 'bg-gray-100 text-gray-800 border-gray-200', label: status };
  }
}

function getQcStyle(status: string) {
  switch (status) {
    case 'qc_failed':
      return { classes: 'bg-red-100 text-red-800 border-red-200', label: 'QC Failed' };
    case 'retry_pending':
      return { classes: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Pending Retry' };
    case 'processing':
      return { classes: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Processing Retry' };
    case 'approved':
      return { classes: 'bg-green-100 text-green-800 border-green-200', label: 'Approved' };
    case 'failed_retry':
      return { classes: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Failed Retry' };
    default:
      return { classes: 'bg-gray-100 text-gray-800 border-gray-200', label: status };
  }
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ variant, status, className = '', labelOverride }) => {
  if (!status) return null;

  const normalized = String(status).toLowerCase();
  const { classes, label } = variant === 'job' ? getJobStyle(normalized) : getQcStyle(normalized);
  const Icon = variant === 'job' ? JobStatusIcon : QcStatusIcon;

  return (
    <span className={`${baseClasses} ${classes} ${className}`.trim()}>
      <Icon status={normalized} />
      {labelOverride ?? label}
    </span>
  );
};

export default StatusBadge;


