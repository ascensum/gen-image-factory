/**
 * Shared utilities for LogViewer (formatting, level styles).
 */

export function formatTimestamp(timestamp: Date): string {
  const utcDate = new Date(timestamp);
  return utcDate.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC'
  });
}

export function getLogLevelBadgeClasses(level: string): string {
  switch (level) {
    case 'error':
      return 'text-red-600 bg-red-100 border-red-300';
    case 'warn':
      return 'text-yellow-600 bg-yellow-100 border-yellow-300';
    case 'info':
      return 'text-blue-600 bg-blue-100 border-blue-300';
    default:
      return 'text-gray-600 bg-gray-100 border-gray-300';
  }
}

export function getLogRowClasses(level: string): string {
  switch (level) {
    case 'error':
      return 'bg-red-50 border-red-200';
    case 'warn':
      return 'bg-yellow-50 border-yellow-200';
    case 'info':
      return 'bg-blue-50 border-blue-200';
    default:
      return 'bg-white border-gray-200';
  }
}
