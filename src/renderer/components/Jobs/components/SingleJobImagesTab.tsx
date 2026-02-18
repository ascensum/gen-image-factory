/**
 * Story 3.4 Phase 5b: Images tab content for SingleJobView.
 * Extracted from SingleJobView.legacy.tsx – filter, grid/list view.
 */
import React from 'react';
import { buildLocalFileUrl } from '../../../utils/urls';
import StatusBadge from '../../Common/StatusBadge';
import { formatQcLabel } from '../../../utils/qc';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../../../types/generatedImage';

export interface SingleJobImagesTabProps {
  filteredImages: GeneratedImage[];
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  imageFilter: string;
  setImageFilter: (value: string) => void;
  qcReasonFilters: { value: string; label: string }[];
  getImageTitle: (img: any) => string;
  getImageUiStatus: (qcStatus?: string | null) => 'approved' | 'qc_failed';
}

const PLACEHOLDER_IMAGE_SVG =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik02NCAzMkM3Ny4yNTQ4IDMyIDg4IDQyLjc0NTIgODggNTZDODggNjkuMjU0OCA3Ny4yNTQ4IDgwIDY0IDgwQzUwLjc0NTIgODAgNDAgNjkuMjU0OCA0MCA1NkM0MCA0Mi43NDUyIDUwLjc0NTIgMzIgNjQgMzJaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0yNCA4OEgxMDRDMTEwLjYyNyA4OCAxMTYgOTMuMzcyNiAxMTYgMTAwVjExMkMxMTYgMTE4LjYyNyAxMTAuNjI3IDEyNCAxMDQgMTI0SDI0QzE3LjM3MjYgMTI0IDEyIDExOC42MjcgMTIgMTEyVjEwMEMxMiA5My4zNzI2IDE3LjM3MjYgODggMjQgODhaIiBmaWxsPSIjOUI5QkEwIi8+Cjwvc3ZnPgo=';
const THUMB_PLACEHOLDER_SVG =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAyNEg0MFY0MEgyNFYyNFoiIGZpbGw9IiNEMUQ1REIiLz4KPC9zdmc+';

const SingleJobImagesTab: React.FC<SingleJobImagesTabProps> = ({
  filteredImages,
  viewMode,
  setViewMode,
  imageFilter,
  setImageFilter,
  qcReasonFilters,
  getImageTitle,
  getImageUiStatus,
}) => (
  <div className="p-6">
    <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border)] sticky top-0 bg-[var(--card)] z-10">
      <div className="flex items-center gap-4">
        <select
          value={imageFilter}
          onChange={(e) => setImageFilter(e.target.value)}
          className="bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius)] px-4 py-2 text-[var(--foreground)] text-sm"
          aria-label="Filter images"
        >
          <option value="all">All</option>
          <option value="approved">Approved</option>
          <option value="failed_all">Failed (All)</option>
          <option value="failed_qc">Failed – QC</option>
          <option value="failed_tech">Failed – Technical</option>
          {qcReasonFilters.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`p-2 rounded-[var(--radius)] transition border cursor-pointer ${viewMode === 'grid' ? 'bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)]' : 'bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]'}`}
          onClick={() => setViewMode('grid')}
          title="Grid View"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </button>
        <button
          type="button"
          className={`p-2 rounded-[var(--radius)] transition border cursor-pointer ${viewMode === 'list' ? 'bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)]' : 'bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]'}`}
          onClick={() => setViewMode('list')}
          title="List View"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
      </div>
    </div>

    <div className="max-h-[60vh] overflow-y-auto pr-1">
      {viewMode === 'grid' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {filteredImages.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              <p>No images found with current filter.</p>
            </div>
          ) : (
            filteredImages.map((image) => (
              <div
                key={image.id}
                className="border border-[var(--border)] rounded-[var(--radius)] overflow-hidden transition bg-[var(--card)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
              >
                <div className="relative aspect-square rounded overflow-hidden">
                  {(image.finalImagePath || image.tempImagePath) ? (
                    <img
                      src={buildLocalFileUrl(image.finalImagePath || image.tempImagePath)}
                      alt={`Generated image ${image.id}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER_IMAGE_SVG;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <StatusBadge
                      variant="qc"
                      status={
                        getImageUiStatus((image as any).qcStatus) === 'approved'
                          ? 'approved'
                          : String((image as any).qcStatus || '').toLowerCase() === 'processing'
                            ? 'processing'
                            : 'qc_failed'
                      }
                      labelOverride={
                        getImageUiStatus((image as any).qcStatus) === 'qc_failed'
                          ? (formatQcLabel(String((image as any).qcStatus || ''), String((image as any).qcReason || '')) || undefined)
                          : undefined
                      }
                    />
                  </div>
                </div>
                <div className="p-2 block">
                  <div className="block">
                    <span className="text-xs font-bold text-[var(--foreground)] block mb-1 break-words [overflow-wrap:anywhere]">
                      {getImageTitle(image)}
                    </span>
                    <span className="block mt-1 text-xs text-[var(--muted-foreground)] text-right">
                      {(image as any)?.createdAt ? new Date((image as any).createdAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {viewMode === 'list' && (
        <table className="w-full border-collapse border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="bg-[var(--secondary)] py-3 px-4 text-left font-medium text-[var(--foreground)] border-b border-[var(--border)]">
                Preview
              </th>
              <th className="bg-[var(--secondary)] py-3 px-4 text-left font-medium text-[var(--foreground)] border-b border-[var(--border)]">
                ID/Title
              </th>
              <th className="bg-[var(--secondary)] py-3 px-4 text-left font-medium text-[var(--foreground)] border-b border-[var(--border)]">
                Status
              </th>
              <th className="bg-[var(--secondary)] py-3 px-4 text-left font-medium text-[var(--foreground)] border-b border-[var(--border)]">
                Generated At
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredImages.map((image) => (
              <tr key={image.id}>
                <td className="py-3 px-4 border-b border-[var(--border)] text-[var(--foreground)]">
                  <div className="w-16 h-16 bg-[var(--secondary)] rounded-lg flex items-center justify-center text-xs text-[var(--muted-foreground)] overflow-hidden">
                    {(image.finalImagePath || image.tempImagePath) ? (
                      <img
                        src={buildLocalFileUrl(image.finalImagePath || image.tempImagePath)}
                        alt={`Generated image ${image.id}`}
                        className="w-16 h-16 object-cover rounded-lg"
                        onError={(e) => {
                          e.currentTarget.src = THUMB_PLACEHOLDER_SVG;
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 border-b border-[var(--border)] text-[var(--foreground)]">
                  {getImageTitle(image)}
                </td>
                <td className="py-3 px-4 border-b border-[var(--border)] text-[var(--foreground)]">
                  <StatusBadge
                    variant="qc"
                    status={
                      getImageUiStatus((image as any).qcStatus) === 'approved'
                        ? 'approved'
                        : String((image as any).qcStatus || '').toLowerCase() === 'processing'
                          ? 'processing'
                          : 'qc_failed'
                    }
                    labelOverride={
                      getImageUiStatus((image as any).qcStatus) === 'qc_failed'
                        ? (formatQcLabel(String((image as any).qcStatus || ''), String((image as any).qcReason || '')) || undefined)
                        : undefined
                    }
                  />
                </td>
                <td className="py-3 px-4 border-b border-[var(--border)] text-[var(--foreground)]">
                  {(image as any)?.createdAt ? new Date((image as any).createdAt).toLocaleDateString() : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

export default SingleJobImagesTab;
