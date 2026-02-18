/**
 * Story 3.4 Phase 3: Failed Images Review view container.
 * Composes useFailedImages, useImageReview, FailedImageList, BulkActions.
 * Uses same virtualization as Dashboard Image Gallery when in grid view.
 */
import React, { useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import type { GeneratedImage } from '../../../../types/generatedImage';
import { FAILED_FILTER_OPTIONS } from '../../../utils/qc';
import SimpleDropdown from '../../Common/SimpleDropdown';
import { useFailedImages, type QCStatus } from '../hooks/useFailedImages';
import { useImageReview } from '../hooks/useImageReview';
import { useFailedImagesContainerSize } from '../hooks/useFailedImagesContainerSize';
import FailedImageList from '../components/FailedImageList';
import BulkActions from '../components/BulkActions';
import FailedImageModalContainer from '../FailedImageModalContainer';
import ProcessingSettingsModal from '../ProcessingSettingsModal';

export interface FailedImagesReviewViewProps {
  onBack: () => void;
  onBackToSingleJob?: () => void;
  /** Called after one or more images are approved so Dashboard can refresh its gallery when shown. */
  onApprovedImages?: () => void;
}

const QC_STATUSES: QCStatus[] = ['qc_failed', 'retry_pending', 'processing', 'retry_failed', 'approved'];

export const FailedImagesReviewView: React.FC<FailedImagesReviewViewProps> = ({ onBack, onBackToSingleJob, onApprovedImages }) => {
  const failed = useFailedImages();
  const review = useImageReview({
    loadAllImageStatuses: failed.loadAllImageStatuses,
    loadRetryQueueStatus: failed.loadRetryQueueStatus,
    setError: failed.setError,
    getCurrentTabImages: failed.getCurrentTabImages,
    getFilteredAndSortedImages: () => failed.filteredAndSortedImages,
    onApprovedImages,
  });

  const displayedImages = useMemo(
    () => failed.filteredAndSortedImages.filter((img) => !review.deletedImageIds.has(String(img.id))),
    [failed.filteredAndSortedImages, review.deletedImageIds]
  );

  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const containerSize = useFailedImagesContainerSize(listScrollRef);

  const handleClearFilters = () => {
    failed.clearFilters();
    review.clearSelection();
  };

  if (failed.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading images...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={onBack} className="text-gray-500 hover:text-gray-700 transition-colors" aria-label="Back to dashboard">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            {onBackToSingleJob && (
              <button onClick={onBackToSingleJob} className="text-blue-500 hover:text-blue-700 transition-colors" aria-label="Back to single job view">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Failed Images Review</h1>
              <p className="text-gray-600">Review and manage images that failed quality assurance checks</p>
            </div>
          </div>
          <div className="flex items-center space-x-4 ml-auto">
            <div className="text-right">
              <div className="text-2xl font-bold text-red-600">{failed.getTabCount('qc_failed')}</div>
              <div className="text-sm text-gray-500">Failed Images</div>
            </div>
          </div>
        </div>
      </div>

      {/* Retry Queue Status Bar */}
      {(failed.retryQueueStatus.isProcessing || failed.retryQueueStatus.queueLength > 0) && (
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
                Retry Queue Status
              </h3>
              <div className="text-sm text-blue-700">{failed.retryQueueStatus.isProcessing ? 'Currently Processing' : 'Queued Jobs'}</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center"><div className="text-2xl font-bold text-blue-600">{failed.retryQueueStatus.processingJobs}</div><div className="text-sm text-blue-700">Processing</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-amber-600">{failed.retryQueueStatus.pendingJobs}</div><div className="text-sm text-amber-700">Queued</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-green-600">{failed.retryQueueStatus.completedJobs}</div><div className="text-sm text-green-700">Completed</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-red-600">{failed.retryQueueStatus.failedJobs}</div><div className="text-sm text-red-700">Failed</div></div>
            </div>
            {failed.retryQueueStatus.currentJob && (
              <div className="bg-white border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">Current Job: #{failed.retryQueueStatus.currentJob.id}</span>
                  <span className="text-xs text-blue-600">{failed.retryQueueStatus.currentJob.settings} settings + {failed.retryQueueStatus.currentJob.metadata ? 'metadata' : 'no metadata'}</span>
                </div>
                <div className="space-y-2">
                  {failed.processingImages.map((image) => (
                    <div key={image.id} className="flex items-center justify-between text-sm">
                      <span className="text-blue-800">Image {image.id}: Processing...</span>
                      <div className="w-24 bg-blue-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '75%' }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Tabs: Failed, Retry Pending, Processing, Retry Failed, All */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-2">
        <div className="flex space-x-1">
          {QC_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => failed.setActiveTab(status)}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${failed.activeTab === status ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            >
              {status === 'qc_failed' && 'Failed'}
              {status === 'retry_pending' && 'Retry Pending'}
              {status === 'processing' && 'Processing'}
              {status === 'retry_failed' && 'Retry Failed'}
              {status === 'approved' && 'All'}
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full border ${failed.getStatusColor(status)}`}>{failed.getTabCount(status)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Controls Ribbon: View, Status dropdown (detailed failed filter), Job, Search, Sort, Clear */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">View:</span>
              <button onClick={() => failed.setViewMode('grid')} className={`p-2 rounded-md transition-all duration-200 ${failed.viewMode === 'grid' ? 'bg-gray-200 text-gray-900 border border-gray-300' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'}`} aria-label="Grid View" title="Grid View">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              </button>
              <button onClick={() => failed.setViewMode('list')} className={`p-2 rounded-md transition-all duration-200 ${failed.viewMode === 'list' ? 'bg-gray-200 text-gray-900 border border-gray-300' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'}`} aria-label="List View" title="List View">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Label filter:</span>
              <SimpleDropdown
                options={FAILED_FILTER_OPTIONS}
                value={failed.imageFilter}
                onChange={(val) => failed.setImageFilter(val)}
                buttonClassName="text-sm border border-gray-300 rounded-md px-3 py-1 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[10rem] text-left"
                menuWidthClassName="w-[14rem]"
                ariaLabel="Filter by pill label (Failed (All) or specific failure label)"
              />
            </div>
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Job:</span>
                <button type="button" onClick={() => failed.setIsJobFilterOpen((v) => !v)} className="relative text-sm border border-gray-300 rounded-md px-3 py-1 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[14rem] text-left pr-8" aria-haspopup="listbox" aria-expanded={failed.isJobFilterOpen}>
                  {failed.filterJob === 'all' ? 'All Jobs' : (() => { const label = failed.jobIdToLabel[String(failed.filterJob)]; if (label?.trim()) { const base = label.trim(); return base.endsWith('(Rerun)') ? base.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(failed.filterJob).slice(-3)})` : base; } return `Job ${String(failed.filterJob).slice(0, 8)}`; })()}
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-700"><svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" /></svg></span>
                </button>
              </div>
              {failed.isJobFilterOpen && (
                <div className="absolute z-20 mt-2 w-[18rem] bg-white border border-gray-200 rounded-md shadow-lg overflow-x-hidden">
                  <div className="p-2 border-b border-gray-200">
                    <input type="text" value={failed.jobFilterQuery} onChange={(e) => failed.setJobFilterQuery(e.target.value)} placeholder="Search jobs..." className="w-full text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
                  </div>
                  <ul role="listbox" className="max-h-72 overflow-y-auto overflow-x-hidden py-1">
                    <li>
                      <button type="button" onClick={() => { failed.setFilterJob('all'); failed.setIsJobFilterOpen(false); failed.setJobFilterQuery(''); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 whitespace-normal break-words ${failed.filterJob === 'all' ? 'bg-gray-100' : ''}`} role="option" aria-selected={failed.filterJob === 'all'}>All Jobs</button>
                    </li>
                    {failed.uniqueJobIds.map((id) => ({ id, label: failed.jobIdToLabel[String(id)] || `Job ${String(id).slice(0, 8)}` })).filter((opt) => opt.label.toLowerCase().includes(failed.jobFilterQuery.toLowerCase())).map((opt) => (
                      <li key={opt.id}>
                        <button type="button" onClick={() => { failed.setFilterJob(String(opt.id)); failed.setIsJobFilterOpen(false); failed.setJobFilterQuery(''); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 whitespace-normal break-words ${String(failed.filterJob) === String(opt.id) ? 'bg-gray-100' : ''}`} role="option" aria-selected={String(failed.filterJob) === String(opt.id)}>
                          {opt.label.endsWith('(Rerun)') ? opt.label.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(opt.id).slice(-3)})` : opt.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Search:</span>
              <input type="text" placeholder="Search images..." value={failed.searchQuery} onChange={(e) => failed.setSearchQuery(e.target.value)} className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Sort:</span>
              <select value={failed.sortBy} onChange={(e) => failed.setSortBy(e.target.value as 'newest' | 'oldest' | 'name')} className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">By Name</option>
              </select>
            </div>
            <button onClick={handleClearFilters} className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors">Clear</button>
          </div>
          <BulkActions
            selectedCount={review.selectedImages.size}
            totalCount={displayedImages.length}
            isProcessing={failed.retryQueueStatus.isProcessing}
            onSelectAll={review.handleSelectAll}
            onBulkApprove={() => review.handleBulkAction('approve')}
            onBulkRetry={() => review.handleBulkAction('retry')}
            onBulkDelete={() => review.handleBulkAction('delete')}
          />
        </div>
      </div>

      {/* List scroll area: fixed height so overflow shows scrollbar */}
        <div
          ref={listScrollRef}
          role="region"
          aria-label="Failed images list"
          style={{
            height: 'calc(100vh - 320px)',
            minHeight: 280,
            maxHeight: 'calc(100vh - 320px)',
            overflowY: 'scroll',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {failed.viewMode === 'grid' && containerSize.width > 0 && containerSize.height > 0 ? (
            <FailedImageList
              images={displayedImages}
              viewMode={failed.viewMode}
              activeTab={failed.activeTab}
              selectedIds={review.selectedImages}
              jobIdToLabel={failed.jobIdToLabel}
              onSelect={review.handleImageSelect}
              onSelectAll={review.handleSelectAll}
              onAction={review.handleImageAction}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
            />
          ) : (
            <div className="p-6">
              <FailedImageList
                images={displayedImages}
                viewMode={failed.viewMode}
                activeTab={failed.activeTab}
                selectedIds={review.selectedImages}
                jobIdToLabel={failed.jobIdToLabel}
                onSelect={review.handleImageSelect}
                onSelectAll={review.handleSelectAll}
                onAction={review.handleImageAction}
              />
            </div>
          )}
        </div>
        {(failed.retryQueueStatus.completedJobs > 0 || failed.retryQueueStatus.failedJobs > 0) && (
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Retry History
              </h3>
              <div className="space-y-2 text-sm text-gray-700">
                {failed.retryQueueStatus.completedJobs > 0 && <div className="flex items-center space-x-2"><svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span>Completed: {failed.retryQueueStatus.completedJobs} retry jobs</span></div>}
                {failed.retryQueueStatus.failedJobs > 0 && <div className="flex items-center space-x-2"><svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg><span>Failed: {failed.retryQueueStatus.failedJobs} retry jobs</span></div>}
              </div>
            </div>
          </div>
        )}

      {failed.error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <div className="flex">
            <div className="flex-shrink-0"><svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg></div>
            <div className="ml-3"><p className="text-sm text-red-800">{failed.error}</p></div>
            <div className="ml-auto pl-3"><button onClick={() => failed.setError(null)} className="text-red-400 hover:text-red-600"><svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button></div>
          </div>
        </div>
      )}

      <FailedImageModalContainer
        key="failed-image-modal-container"
        selectedImage={review.selectedImageForReview}
        allImages={displayedImages}
        onClose={() => { review.setSelectedImageForReview(null); review.setDeletedImageIds(new Set()); failed.loadAllImageStatuses(true); }}
        onAction={review.handleImageAction}
        onApprove={async (imageId: string) => {
          const currIdx = displayedImages.findIndex((img) => String(img.id) === String(imageId));
          let nextImage: GeneratedImage | null = null;
          if (currIdx >= 0) { if (currIdx < displayedImages.length - 1) nextImage = displayedImages[currIdx + 1]; else if (currIdx > 0) nextImage = displayedImages[currIdx - 1]; }
          try {
            if ((window as any).electronAPI?.generatedImages?.manualApproveImage) await (window as any).electronAPI.generatedImages.manualApproveImage(imageId);
            else await (window as any).electronAPI.generatedImages.updateQCStatus(imageId, 'approved');
            review.setDeletedImageIds((prev) => new Set(prev).add(String(imageId)));
            if (nextImage) flushSync(() => review.setSelectedImageForReview(nextImage));
            else flushSync(() => review.setSelectedImageForReview(null));
          } catch (_) {}
        }}
        onRetry={async (imageId: string) => {
          const currIdx = displayedImages.findIndex((img) => String(img.id) === String(imageId));
          let nextImage: GeneratedImage | null = null;
          if (currIdx >= 0) { if (currIdx < displayedImages.length - 1) nextImage = displayedImages[currIdx + 1]; else if (currIdx > 0) nextImage = displayedImages[currIdx - 1]; }
          review.setSelectedImages((prev) => new Set(prev).add(imageId));
          if (nextImage) flushSync(() => review.setSelectedImageForReview(nextImage));
          else flushSync(() => review.setSelectedImageForReview(null));
        }}
        onDelete={async (imageId: string) => {
          const currIdx = displayedImages.findIndex((img) => String(img.id) === String(imageId));
          let nextImage: GeneratedImage | null = null;
          if (currIdx >= 0) { if (currIdx < displayedImages.length - 1) nextImage = displayedImages[currIdx + 1]; else if (currIdx > 0) nextImage = displayedImages[currIdx - 1]; }
          try {
            await (window as any).electronAPI.generatedImages.deleteGeneratedImage(imageId);
            review.setDeletedImageIds((prev) => new Set(prev).add(String(imageId)));
            if (nextImage) flushSync(() => review.setSelectedImageForReview(nextImage));
            else flushSync(() => review.setSelectedImageForReview(null));
          } catch (_) {}
        }}
        onPreviousImage={(currentImage) => { const idx = displayedImages.findIndex((img) => String(img.id) === String(currentImage.id)); if (idx > 0) review.setSelectedImageForReview(displayedImages[idx - 1]); }}
        onNextImage={(currentImage) => { const idx = displayedImages.findIndex((img) => String(img.id) === String(currentImage.id)); if (idx >= 0 && idx < displayedImages.length - 1) review.setSelectedImageForReview(displayedImages[idx + 1]); }}
        hasPrevious={(currentImage) => displayedImages.findIndex((img) => String(img.id) === String(currentImage.id)) > 0}
        hasNext={(currentImage) => { const idx = displayedImages.findIndex((img) => String(img.id) === String(currentImage.id)); return idx >= 0 && idx < displayedImages.length - 1; }}
      />

      {review.showProcessingSettingsModal && (
        <ProcessingSettingsModal isOpen={review.showProcessingSettingsModal} onClose={() => review.setShowProcessingSettingsModal(false)} onRetry={review.handleRetryWithSettings} selectedCount={review.selectedImages.size} />
      )}
    </div>
  );
};
