import React from 'react';
import type { LogEntry } from '../hooks/useDashboardState';
import { formatTimestamp, getLogLevelBadgeClasses, getLogRowClasses } from '../utils/logViewerUtils';

function getLogLevelIcon(level: string): React.ReactNode {
  switch (level) {
    case 'error':
      return (
        <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
          <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" fillRule="evenodd" />
        </svg>
      );
    case 'warn':
      return (
        <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
          <path clipRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" fillRule="evenodd" />
        </svg>
      );
    case 'info':
      return (
        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path clipRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" fillRule="evenodd" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
          <path clipRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" fillRule="evenodd" />
        </svg>
      );
  }
}

export interface LogViewerEntryRowProps {
  log: LogEntry;
  index: number;
}

const LogViewerEntryRow: React.FC<LogViewerEntryRowProps> = ({ log, index }) => (
  <div
    aria-label={`Log entry ${index + 1}: ${log.level} level message`}
    className={`flex items-start space-x-3 p-2 rounded-md border ${getLogRowClasses(log.level)}`}
  >
    <div className="flex-shrink-0 text-xs text-gray-500 w-20">
      {formatTimestamp(log.timestamp)}
    </div>
    <div className={`flex-shrink-0 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getLogLevelBadgeClasses(log.level)}`}>
      {getLogLevelIcon(log.level)}
      <span className="ml-1">{log.level.toUpperCase()}</span>
    </div>
    <div className="flex-1 text-gray-900 break-words whitespace-pre">
      {log.message}
      <div className="mt-1 text-xs text-gray-600 space-y-1">
        {(log.stepName || log.subStep) && (
          <div className="flex items-center space-x-2">
            {log.stepName && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {log.stepName}
              </span>
            )}
            {log.subStep && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                {log.subStep}
              </span>
            )}
          </div>
        )}
        {log.imageIndex !== null && log.imageIndex !== undefined && (
          <div className="text-purple-600"> Image {log.imageIndex + 1}</div>
        )}
        {log.durationMs !== null && log.durationMs !== undefined && (
          <div className="text-orange-600">️ {log.durationMs}ms</div>
        )}
        {(log.progress !== undefined || log.totalImages !== undefined) && (
          <div className="text-gray-600">
            {log.progress !== undefined && `Progress: ${log.progress}%`}
            {log.totalImages !== undefined && ` | Images: ${log.successfulImages ?? 0}/${log.totalImages}`}
          </div>
        )}
        {log.metadata && Object.keys(log.metadata).length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
              Metadata ({Object.keys(log.metadata).length} fields)
            </summary>
            <div className="mt-1 pl-2 text-gray-600">
              {Object.entries(log.metadata).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="font-medium">{key}:</span>
                  <span className="ml-2">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
    {log.source && (
      <div className="flex-shrink-0 text-xs text-gray-500">{log.source}</div>
    )}
  </div>
);

export default LogViewerEntryRow;
