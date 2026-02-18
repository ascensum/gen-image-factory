import React from 'react';
import HeaderMenu from '../components/HeaderMenu';
import JobControls from '../JobControls';
import ForceStopButton from '../ForceStopButton';
import DashboardStats from '../components/DashboardStats';
import DashboardTabs from '../components/DashboardTabs';
import JobHistory from '../JobHistory';
import LogViewer from '../LogViewer';
import ExportZipModal from '../ExportZipModal';
import ImageGallery from '../ImageGallery';
import { DashboardGalleryTabContent } from './DashboardGalleryTabContent';
import ExportFileModal from '../../Common/ExportFileModal';

// Hooks
import { useDashboardState } from '../hooks/useDashboardState';
import { useDashboardActions } from '../hooks/useDashboardActions';
import { useDashboardPolling } from '../hooks/useDashboardPolling';
import { useDashboardProgress } from '../hooks/useDashboardProgress';
import { useDashboardGalleryFilteredIds } from '../hooks/useDashboardGalleryFilteredIds';
import { useGalleryContainerSize } from '../hooks/useGalleryContainerSize';

// Styles (reuse existing styles or migrate them)
import '../DashboardPanel.css';

interface DashboardViewProps {
  onBack?: () => void;
  onOpenFailedImagesReview?: () => void;
  onOpenSettings?: () => void;
  onOpenJobs?: () => void;
  onOpenSingleJobView?: (jobId: string) => void;
  /** When this changes (e.g. after approving images in Failed Images Review), refresh the Image Gallery. */
  dashboardGalleryRefreshTrigger?: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onBack,
  onOpenFailedImagesReview,
  onOpenSettings,
  onOpenJobs,
  onOpenSingleJobView,
  dashboardGalleryRefreshTrigger,
}) => {
  const state = useDashboardState();
  const actions = useDashboardActions({
    ...state,
    onOpenSingleJobView
  });
  
  // Initialize polling (skip initial gallery load when we will run a single refresh from Failed Review)
  const skipInitialGalleryLoad = (dashboardGalleryRefreshTrigger ?? 0) > 0;
  useDashboardPolling({
    ...state,
    ...actions,
    skipInitialGalleryLoad,
  });

  // Single refresh when returning from Failed Images Review so newly approved images show. One load only to avoid slowness.
  React.useEffect(() => {
    if (dashboardGalleryRefreshTrigger == null || dashboardGalleryRefreshTrigger <= 0) return;
    const t = setTimeout(() => {
      actions.loadGeneratedImages();
    }, 80);
    return () => clearTimeout(t);
  }, [dashboardGalleryRefreshTrigger, actions.loadGeneratedImages]);

  const { progressSteps, smartProgress } = useDashboardProgress(
    state.jobConfiguration,
    state.jobStatus,
    state.generatedImages
  );

  const filteredImageIds = useDashboardGalleryFilteredIds({
    generatedImages: state.generatedImages,
    imageJobFilter: state.imageJobFilter,
    imageSearchQuery: state.imageSearchQuery,
    imageSortBy: state.imageSortBy,
    imageDateFrom: state.imageDateFrom,
    imageDateTo: state.imageDateTo,
  });

  const galleryLoadMoreRef = React.useRef<HTMLDivElement | null>(null);
  const galleryLengthRef = React.useRef(state.generatedImages.length);
  const galleryHasMoreRef = React.useRef(state.galleryHasMore);
  galleryLengthRef.current = state.generatedImages.length;
  galleryHasMoreRef.current = state.galleryHasMore;
  React.useEffect(() => {
    if (!state.galleryHasMore) return;
    const el = galleryLoadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        const hasMore = galleryHasMoreRef.current;
        const len = galleryLengthRef.current;
        if (hasMore && actions.loadNextGalleryPage) {
          actions.loadNextGalleryPage(len);
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [state.galleryHasMore, state.activeTab, actions.loadNextGalleryPage]);

  const [showExportZipModal, setShowExportZipModal] = React.useState(false);
  const [showSingleExportModal, setShowSingleExportModal] = React.useState(false);
  const galleryScrollRef = React.useRef<HTMLDivElement | null>(null);
  const galleryContainerSize = useGalleryContainerSize(state.activeTab, galleryScrollRef);

  return (
    <div className="dashboard-panel flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-3 md:py-4 flex items-center px-6 relative">
        <div className="flex items-center justify-between w-full flex-wrap gap-y-2">
          <div className="flex items-center space-x-3">
            {onBack && (
              <button
                onClick={onBack}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Close dashboard"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <HeaderMenu 
              onOpenFailedImagesReview={onOpenFailedImagesReview} 
              onOpenSettings={onOpenSettings} 
              onOpenJobs={onOpenJobs} 
            />
            <JobControls
              jobStatus={state.jobStatus.state}
              onStartJob={actions.handleStartJob}
              onStopJob={actions.handleStopJob}
              onRefresh={() => {
                actions.loadJobHistory();
                actions.loadStatistics();
                actions.loadGeneratedImages();
              }}
              isLoading={state.isLoading}
            />
            <ForceStopButton
              onForceStop={actions.handleForceStop}
              isLoading={state.isLoading}
            />
          </div>
          
          <DashboardStats statistics={state.computedStatistics} />
        </div>
      </div>

      <DashboardTabs activeTab={state.activeTab} onTabChange={state.setActiveTab} />

      <div className="tab-content-container">
        {state.activeTab === 'overview' && (
          <div className="unified-panel-container">
            {/* Job Progress */}
            <div className="dashboard-panel job-progress">
              <div className="panel-header">
                <div className="section-header-with-icon">
                  <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Job Progress
                </div>
              </div>
              <div className="panel-content">
                <div className="mb-6">
                  <h4 className="text-sm font-medium mb-3 text-gray-700">
                    Generation Progress ({smartProgress.totalGenerations} {smartProgress.totalGenerations > 1 ? 'generations' : 'generation'})
                  </h4>
                  <div className="progress-container">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${smartProgress.totalGenerations > 1 ? smartProgress.overallGenerationProgress : smartProgress.current}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {smartProgress.totalGenerations > 1
                      ? `Completed ${smartProgress.gensDone} of ${smartProgress.totalGenerations} generations (${smartProgress.overallGenerationProgress}% complete)`
                      : (state.jobStatus.state === 'completed' ? 'Completed' : 'Running…')}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-3 text-gray-700">Progress Steps</h4>
                  <div className="progress-steps">
                    {progressSteps.map((step, index) => {
                      const currentStepIdx = Number(state.jobStatus.currentStep || (state.jobStatus.currentJob as { currentStep?: number } | undefined)?.currentStep || 1);
                      let stepState = 'pending';
                      if (state.jobStatus.state === 'failed') stepState = 'failed';
                      else if (state.jobStatus.state === 'completed') stepState = 'completed';
                      else {
                        if (step.name === 'Initialization') stepState = currentStepIdx > 1 ? 'completed' : 'active';
                        else if (step.name === 'Image Generation') stepState = currentStepIdx >= 2 ? 'active' : 'pending';
                      }
                      
                      return (
                        <React.Fragment key={step.name}>
                          <div className="progress-step">
                            <div className={`step-icon ${stepState}`}>
                              {step.name === 'Initialization' ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              )}
                            </div>
                            <div className="step-info">
                              <div className="step-name">{step.name}</div>
                              <div className="step-subtitle">{step.description}</div>
                            </div>
                          </div>
                          {index < progressSteps.length - 1 && <div className="progress-connector"></div>}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Job History */}
            <div className="dashboard-panel">
              <div className="panel-header">
                <div className="section-header-with-icon">
                  <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Job History
                </div>
              </div>
              <div className="panel-content" style={{ padding: 0 }}>
                {/* Simplified filter controls here or extract */}
                <div className="job-history-content">
                  <JobHistory
                    jobs={state.jobHistory}
                    onJobAction={actions.handleJobAction}
                    onDeleteJob={(jobId) => actions.handleJobAction('delete', jobId)}
                    isLoading={state.isLoading}
                    statusFilter="all"
                    sortBy="newest"
                  />
                </div>
              </div>
            </div>

            {/* Logs */}
            <div className="dashboard-panel">
              <div className="panel-header">
                <div className="section-header-with-icon">
                  <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  Logs Panel
                </div>
              </div>
              <div className="panel-content">
                <LogViewer
                  logs={state.logs}
                  jobStatus={state.jobStatus.state}
                  onRefresh={() => actions.loadLogs(state.jobStatus.state)}
                />
              </div>
            </div>
          </div>
        )}

        {state.activeTab === 'image-gallery' && (
          <DashboardGalleryTabContent
            GalleryComponent={ImageGallery}
            galleryScrollRef={galleryScrollRef}
            galleryContainerSize={galleryContainerSize}
            galleryLoadMoreRef={galleryLoadMoreRef}
            filteredImageIds={filteredImageIds}
            imageViewMode={state.imageViewMode}
            setImageViewMode={state.setImageViewMode}
            imageJobFilter={state.imageJobFilter}
            setImageJobFilter={state.setImageJobFilter}
            imageSearchQuery={state.imageSearchQuery}
            setImageSearchQuery={state.setImageSearchQuery}
            imageSortBy={state.imageSortBy}
            setImageSortBy={state.setImageSortBy}
            imageDateFrom={state.imageDateFrom}
            setImageDateFrom={state.setImageDateFrom}
            imageDateTo={state.imageDateTo}
            setImageDateTo={state.setImageDateTo}
            selectedImages={state.selectedImages}
            setSelectedImages={state.setSelectedImages}
            jobHistory={state.jobHistory}
            generatedImages={state.generatedImages}
            setShowExportZipModal={setShowExportZipModal}
            onBulkDelete={(ids) => actions.handleBulkAction('delete', ids)}
            generatedImagesFiltered={state.generatedImages.filter((img: { id: string }) => filteredImageIds.includes(img.id))}
            onImageAction={actions.handleImageAction}
            onBulkAction={(action, ids) => actions.handleBulkAction(action, ids)}
            isLoading={state.isLoading}
            galleryHasMore={state.galleryHasMore}
            onLoadMore={state.galleryHasMore ? () => actions.loadNextGalleryPage?.(state.generatedImages.length) : undefined}
          />
        )}
      </div>

      {state.error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
           {/* Error content */}
           <p className="text-sm text-red-800">{state.error}</p>
           <button onClick={() => state.setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Export Modals */}
      {showExportZipModal && (
        <ExportZipModal
          isOpen={showExportZipModal}
          count={state.selectedImages.size}
          defaultFilename={`exported-images-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.zip`}
          onClose={() => setShowExportZipModal(false)}
          onExport={async ({ mode, outputPath, filename, includeExcel, duplicatePolicy }) => {
            try {
              const ids = Array.from(state.selectedImages);
              if (ids.length === 0) {
                setShowExportZipModal(false);
                return;
              }
              let resolvedOutputPath: string | undefined;
              if (mode === 'custom') {
                if (outputPath && !/\.zip$/i.test(outputPath)) {
                  const base = outputPath.replace(/[\\/]+$/, '');
                  resolvedOutputPath = `${base}/${filename}`;
                } else {
                  resolvedOutputPath = outputPath || filename;
                }
              }
              const options = mode === 'custom' ? { outputPath: resolvedOutputPath || filename, duplicatePolicy } : undefined;
              const result = await (window as any).electronAPI.generatedImages.exportZip(ids, includeExcel !== false, options);
              if (result?.success && result.zipPath) {
                try { await (window as any).electronAPI.revealInFolder(result.zipPath); } catch { /* ignore */ }
              }
            } catch (e) {
              console.error('Export failed', e);
            } finally {
              setShowExportZipModal(false);
            }
          }}
        />
      )}
      
      {/* ... ShowSingleExportModal ... */}
      <ExportFileModal
        isOpen={state.showSingleExportModal}
        title="Export Job"
        count={0}
        fileKind="xlsx"
        defaultFilename={(() => {
          const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const job = state.jobHistory.find(j => String(j.id) === String(state.exportJobId));
          const shortId = state.exportJobId ? String(state.exportJobId).slice(-6) : '';
          const base = (job && ((job as any).displayLabel || (job as any).label || (job as any).configurationName)) || shortId || 'Job';
          const safe = String(base).replace(/[^a-zA-Z0-9-_]/g, '_');
          return `${safe}_${ts}.xlsx`;
        })()}
        onClose={() => { state.setShowSingleExportModal(false); state.setExportJobId(null); }}
        onExport={async ({ mode, outputPath, filename, duplicatePolicy }) => {
          try {
            if (!state.exportJobId) return;
            let resolvedOutputPath: string | undefined = undefined;
            if (mode === 'custom') {
              if (outputPath && !/\.xlsx$/i.test(outputPath)) {
                const base = outputPath.replace(/[\\/]+$/, '');
                resolvedOutputPath = `${base}/${filename}`;
              } else {
                resolvedOutputPath = outputPath || filename;
              }
            }
            const options = mode === 'custom' ? { outputPath: resolvedOutputPath || filename, duplicatePolicy } : undefined;
            const result = await (window as any).electronAPI.jobManagement.exportJobToExcel(state.exportJobId, options);
            if (result && result.success && result.filePath) {
              try { await (window as any).electronAPI.revealInFolder(result.filePath); } catch {}
            }
          } finally {
            state.setShowSingleExportModal(false);
            state.setExportJobId(null);
          }
        }}
      />
    </div>
  );
};
