/**
 * Story 3.4 Phase 3: List/grid of failed images with empty state.
 * When viewMode is grid and containerWidth/Height are provided, uses virtualized FailedImageGrid.
 */
import React from 'react';
import { buildLocalFileUrl } from '../../../utils/urls';
import FailedImageCard from '../FailedImageCard';
import FailedImageGrid from './FailedImageGrid';
import StatusBadge from '../../Common/StatusBadge';
import { formatQcLabel, formatQcFailureReason } from '../../../utils/qc';
import type { GeneratedImage } from '../../../../types/generatedImage';
import type { QCStatus } from '../hooks/useFailedImages';

export interface FailedImageListProps {
  images: GeneratedImage[];
  viewMode: 'grid' | 'list';
  activeTab: QCStatus;
  selectedIds: Set<string>;
  jobIdToLabel: Record<string, string>;
  onSelect: (imageId: string) => void;
  onSelectAll: () => void;
  onAction: (action: string, imageId: string) => void;
  /** When set with viewMode grid, uses virtualized grid (same as Dashboard Image Gallery). */
  containerWidth?: number;
  containerHeight?: number;
}

const emptyTabLabels: Record<QCStatus, { title: string; subtitle: string }> = {
  qc_failed: { title: 'No Failed', subtitle: 'All images have passed quality checks or are pending review.' },
  retry_pending: { title: 'No Retry Pending', subtitle: 'No images are currently queued for retry.' },
  processing: { title: 'No Processing', subtitle: 'No images are currently being processed.' },
  retry_failed: { title: 'No Retry Failed', subtitle: 'No images have failed retry attempts.' },
  approved: { title: 'No Images', subtitle: 'No images match the current criteria.' },
};

const FailedImageList: React.FC<FailedImageListProps> = ({
  images,
  viewMode,
  activeTab,
  selectedIds,
  jobIdToLabel,
  onSelect,
  onSelectAll,
  onAction,
  containerWidth = 0,
  containerHeight = 0,
}) => {
  if (images.length === 0) {
    const { title, subtitle } = emptyTabLabels[activeTab];
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500">{subtitle}</p>
      </div>
    );
  }

  if (viewMode === 'grid') {
    if (containerWidth > 0 && containerHeight > 0) {
      return (
        <FailedImageGrid
          images={images}
          selectedIds={selectedIds}
          onSelect={onSelect}
          onAction={onAction}
          jobIdToLabel={jobIdToLabel}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
      );
    }
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image) => (
          <FailedImageCard
            key={image.id}
            image={image}
            isSelected={selectedIds.has(String(image.id))}
            onSelect={() => onSelect(String(image.id))}
            onAction={onAction}
            jobLabel={jobIdToLabel[String(image.executionId)] || `Job ${image.executionId}`}
          />
        ))}
      </div>
    );
  }

  const truncate = (s: string, n = 140) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const getTitle = (image: GeneratedImage) => {
    const raw = (image as any)?.metadata;
    try {
      const meta = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
      const t = typeof meta?.title === 'object' ? (meta.title.en || '') : (meta?.title || '');
      if (t && String(t).trim()) return String(t).trim();
      return truncate(String(image.generationPrompt || ''));
    } catch {
      return truncate(String(image.generationPrompt || ''));
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full table-fixed divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-12 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
            <th className="w-20 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
            <th className="w-28 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QC Status</th>
            <th className="w-[40%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
            <th className="w-[18%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Name/Label</th>
            <th className="w-28 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th className="w-28 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {images.map((image) => (
            <tr key={image.id} className="hover:bg-gray-50">
              <td className="w-12 px-4 py-2 align-top">
                <input
                  type="checkbox"
                  checked={selectedIds.has(String(image.id))}
                  onChange={() => onSelect(String(image.id))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td className="w-20 px-4 py-2 align-top">
                <div
                  className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex items-center justify-center"
                  title={getTitle(image)}
                >
                  {(image.finalImagePath || image.tempImagePath) ? (
                    <img
                      src={buildLocalFileUrl(image.finalImagePath || image.tempImagePath || '')}
                      alt="thumb"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src =
                          'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCAyMDAgMjAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI0YzRjRGNiIvPgo8cGF0aCBkPSJNNTAgNTBIMTUwVjc1SDc1VjEyNUg1MFY1MFoiIGZpbGw9IiNEMUQ1RDNBIi8+Cjwvc3ZnPg==';
                      }}
                    />
                  ) : (
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
              </td>
              <td className="w-28 px-4 py-2 align-top">
                <div className="inline-flex">
                  <StatusBadge
                    variant="qc"
                    status={(() => {
                      const s = String((image as any)?.qcStatus || '').toLowerCase();
                      if (s === 'approved' || s === 'complete' || s === 'completed') return 'approved';
                      if (s === 'processing') return 'processing';
                      return 'qc_failed';
                    })()}
                    labelOverride={formatQcLabel((image as any)?.qcStatus, (image as any)?.qcReason)}
                  />
                </div>
              </td>
              <td className="w-[40%] px-4 py-2 text-sm text-gray-700 whitespace-normal break-words align-top">
                {formatQcFailureReason((image as any)?.qcStatus, (image as any)?.qcReason) || (image as any)?.qcReason || '-'}
              </td>
              <td className="w-[18%] px-4 py-2 text-sm text-gray-700 align-top">
                {jobIdToLabel[String(image.executionId)] || `Job ${image.executionId}`}
              </td>
              <td className="w-28 px-4 py-2 text-sm text-gray-700 align-top">
                {image.createdAt ? new Date(image.createdAt as any).toLocaleDateString() : '-'}
              </td>
              <td className="w-28 px-4 py-2 align-top">
                <div className="flex items-center gap-3 justify-start flex-wrap">
                  <button onClick={() => onAction('view', String(image.id))} className="text-gray-600 hover:text-gray-900" title="View" aria-label="View">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </button>
                  <button onClick={() => onAction('approve', String(image.id))} className="text-green-600 hover:text-green-700" title="Approve" aria-label="Approve">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <button onClick={() => onAction('retry', String(image.id))} className="text-blue-600 hover:text-blue-700" title="Add to Retry" aria-label="Add to Retry">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13" /></svg>
                  </button>
                  <button onClick={() => onAction('delete', String(image.id))} className="text-red-600 hover:text-red-700" title="Delete" aria-label="Delete">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FailedImageList;
