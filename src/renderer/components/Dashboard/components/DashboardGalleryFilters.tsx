import React, { useState } from 'react';
import type { JobExecution } from '../hooks/useDashboardState';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../types/generatedImage';

interface DashboardGalleryFiltersProps {
  imageViewMode: 'grid' | 'list';
  setImageViewMode: (mode: 'grid' | 'list') => void;
  imageJobFilter: string;
  setImageJobFilter: (jobId: string) => void;
  imageSearchQuery: string;
  setImageSearchQuery: (query: string) => void;
  imageSortBy: 'newest' | 'oldest' | 'name';
  setImageSortBy: (sortBy: 'newest' | 'oldest' | 'name') => void;
  imageDateFrom: string | null;
  setImageDateFrom: (date: string | null) => void;
  imageDateTo: string | null;
  setImageDateTo: (date: string | null) => void;
  selectedImages: Set<string>;
  setSelectedImages: (ids: Set<string>) => void;
  filteredImagesCount: number;
  filteredImageIds: () => string[];
  jobHistory: JobExecution[];
  generatedImages: GeneratedImage[];
  setShowExportModal: (show: boolean) => void;
  onDeleteSelected?: (ids: string[]) => void;
}

const DashboardGalleryFilters: React.FC<DashboardGalleryFiltersProps> = ({
  imageViewMode, setImageViewMode,
  imageJobFilter, setImageJobFilter,
  imageSearchQuery, setImageSearchQuery,
  imageSortBy, setImageSortBy,
  imageDateFrom, setImageDateFrom,
  imageDateTo, setImageDateTo,
  selectedImages, setSelectedImages,
  filteredImagesCount, filteredImageIds,
  jobHistory, generatedImages,
  setShowExportModal,
  onDeleteSelected
}) => {
  const [isJobFilterOpen, setIsJobFilterOpen] = useState(false);
  const [jobFilterQuery, setJobFilterQuery] = useState('');

  return (
    <div className="px-6 pt-4 pb-0 flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Generated Images</h2>
      </div>

      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-4">
        <div className="text-sm font-medium text-gray-700">
          {generatedImages.length} Total Images
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700">
              {generatedImages.filter(img => img.qcStatus === 'approved').length} Success Images
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg mb-4 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">View:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setImageViewMode('grid')}
                className={`p-2 rounded-md transition-all duration-200 ${
                  imageViewMode === 'grid' ? 'bg-gray-200 text-gray-900 border border-gray-300' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
                }`}
                title="Grid View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setImageViewMode('list')}
                className={`p-2 rounded-md transition-all duration-200 ${
                  imageViewMode === 'list' ? 'bg-gray-200 text-gray-900 border border-gray-300' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
                }`}
                title="List View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Job:</span>
              <button
                type="button"
                onClick={() => setIsJobFilterOpen(v => !v)}
                className="relative text-sm border border-gray-300 rounded-md px-3 py-1 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[14rem] text-left pr-8"
              >
                {imageJobFilter === 'all' ? 'All Jobs' : (() => {
                  const job = jobHistory.find(j => String(j.id) === String(imageJobFilter));
                  const prefer = (job as any)?.displayLabel || (job as any)?.label || job?.configurationName;
                  if (prefer && String(prefer).trim() !== '') {
                    const base = String(prefer).trim();
                    const isRerun = base.endsWith('(Rerun)');
                    return isRerun ? base.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(job?.id).slice(-3)})` : base;
                  }
                  return `Job ${String(imageJobFilter).slice(0, 8)}`;
                })()}
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-700">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
                  </svg>
                </span>
              </button>
            </div>

            {isJobFilterOpen && (
              <div className="absolute z-20 mt-2 w-[18rem] bg-white border border-gray-200 rounded-md shadow-lg overflow-x-hidden">
                <div className="p-2 border-b border-gray-200">
                  <input
                    type="text"
                    value={jobFilterQuery}
                    onChange={(e) => setJobFilterQuery(e.target.value)}
                    placeholder="Search jobs..."
                    className="w-full text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <ul role="listbox" className="max-h-72 overflow-y-auto overflow-x-hidden py-1">
                  <li>
                    <button
                      type="button"
                      onClick={() => { setImageJobFilter('all'); setIsJobFilterOpen(false); setJobFilterQuery(''); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 whitespace-normal break-words ${imageJobFilter === 'all' ? 'bg-gray-100' : ''}`}
                    >
                      All Jobs
                    </button>
                  </li>
                  {Array.from(new Set(generatedImages.map(img => img.executionId)))
                    .map(executionId => ({
                      id: executionId,
                      label: (() => {
                        const job = jobHistory.find(j => String(j.id) === String(executionId));
                        const prefer = (job as any)?.displayLabel || (job as any)?.label || job?.configurationName;
                        if (prefer && String(prefer).trim() !== '') {
                          const base = String(prefer).trim();
                          const isRerun = base.endsWith('(Rerun)');
                          return isRerun ? base.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(executionId).slice(-3)})` : base;
                        }
                        return `Job ${String(executionId).slice(0, 8)}`;
                      })()
                    }))
                    .filter(opt => opt.label.toLowerCase().includes(jobFilterQuery.toLowerCase()))
                    .map(opt => (
                      <li key={opt.id}>
                        <button
                          type="button"
                          onClick={() => { setImageJobFilter(String(opt.id)); setIsJobFilterOpen(false); setJobFilterQuery(''); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 whitespace-normal break-words ${String(imageJobFilter) === String(opt.id) ? 'bg-gray-100' : ''}`}
                          title={opt.label}
                        >
                          {opt.label}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-md h-9 px-2">
              <input
                type="date"
                className="bg-transparent px-2 h-full text-sm focus:outline-none"
                value={imageDateFrom ?? ''}
                onChange={(e) => setImageDateFrom(e.target.value || null)}
              />
              <div className="h-4 w-px bg-gray-300" />
              <input
                type="date"
                className="bg-transparent px-2 h-full text-sm focus:outline-none"
                value={imageDateTo ?? ''}
                onChange={(e) => setImageDateTo(e.target.value || null)}
              />
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  const today = new Date();
                  const yyyy = today.getFullYear();
                  const mm = String(today.getMonth() + 1).padStart(2, '0');
                  const dd = String(today.getDate()).padStart(2, '0');
                  const d = `${yyyy}-${mm}-${dd}`;
                  setImageDateFrom(d);
                  setImageDateTo(d);
                }}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const toY = now.getFullYear();
                  const toM = String(now.getMonth() + 1).padStart(2, '0');
                  const toD = String(now.getDate()).padStart(2, '0');
                  const end = `${toY}-${toM}-${toD}`;
                  const startDate = new Date(now);
                  startDate.setDate(startDate.getDate() - 7);
                  const frY = startDate.getFullYear();
                  const frM = String(startDate.getMonth() + 1).padStart(2, '0');
                  const frD = String(startDate.getDate()).padStart(2, '0');
                  const start = `${frY}-${frM}-${frD}`;
                  setImageDateFrom(start);
                  setImageDateTo(end);
                }}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
              >
                Week
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const toY = now.getFullYear();
                  const toM = String(now.getMonth() + 1).padStart(2, '0');
                  const toD = String(now.getDate()).padStart(2, '0');
                  const end = `${toY}-${toM}-${toD}`;
                  const startDate = new Date(now);
                  startDate.setMonth(startDate.getMonth() - 1);
                  const frY = startDate.getFullYear();
                  const frM = String(startDate.getMonth() + 1).padStart(2, '0');
                  const frD = String(startDate.getDate()).padStart(2, '0');
                  const start = `${frY}-${frM}-${frD}`;
                  setImageDateFrom(start);
                  setImageDateTo(end);
                }}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
              >
                Month
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Search:</span>
            <input 
              type="text" 
              placeholder="Search images..." 
              value={imageSearchQuery}
              onChange={(e) => setImageSearchQuery(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Sort:</span>
            <select 
              value={imageSortBy}
              onChange={(e) => setImageSortBy(e.target.value as 'newest' | 'oldest' | 'name')}
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">By Name</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={selectedImages.size === filteredImagesCount && filteredImagesCount > 0}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedImages(new Set(filteredImageIds()));
                } else {
                  setSelectedImages(new Set());
                }
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Select All ({selectedImages.size}/{filteredImagesCount})
            </span>
          </div>

          <button
            onClick={() => {
              setImageJobFilter('all');
              setImageSearchQuery('');
              setImageSortBy('newest');
              setImageDateFrom(null);
              setImageDateTo(null);
              setSelectedImages(new Set());
            }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium rounded-md shadow-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Clear
          </button>

          {onDeleteSelected && (
            <button
              onClick={() => onDeleteSelected(Array.from(selectedImages))}
              disabled={selectedImages.size === 0}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                selectedImages.size === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
              }`}
            >
              Delete Selected ({selectedImages.size})
            </button>
          )}
          <button
            onClick={() => setShowExportModal(true)}
            disabled={selectedImages.size === 0}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
              selectedImages.size === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white'
            }`}
          >
            Export ZIP
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardGalleryFilters;
