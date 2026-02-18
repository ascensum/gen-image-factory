/**
 * Story 3.4 Phase 5b: SingleJobView – decomposed view using hooks + tab components.
 * Same UI and behavior as SingleJobView.legacy.tsx.
 */
import React from 'react';
import ExportDialog from '../../Common/ExportDialog';
import LogViewer from '../../Dashboard/LogViewer';
import { useSingleJobData } from '../hooks/useSingleJobData';
import { useSingleJobActions } from '../hooks/useSingleJobActions';
import { useSingleJobSettings } from '../hooks/useSingleJobSettings';
import { useSingleJobImages } from '../hooks/useSingleJobImages';
import SingleJobOverviewTab from '../components/SingleJobOverviewTab';
import SingleJobImagesTab from '../components/SingleJobImagesTab';
import SingleJobSettingsModal from '../components/SingleJobSettingsModal';

export interface SingleJobViewProps {
  jobId: string | number;
  onBack: () => void;
  onRerun: (jobId: string | number) => void;
  onDelete: (jobId: string | number) => void;
}

function formatDate(dateString: string | Date): string {
  if (dateString instanceof Date) return dateString.toLocaleString();
  return new Date(dateString).toLocaleString();
}

function formatDuration(startTime: string | Date, endTime?: string | Date): string {
  if (!endTime) return 'In Progress';
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  const end = endTime instanceof Date ? endTime : new Date(endTime);
  const duration = end.getTime() - start.getTime();
  const hours = Math.floor(duration / 3600000);
  const minutes = Math.floor((duration % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

const SingleJobView: React.FC<SingleJobViewProps> = ({ jobId, onBack, onRerun, onDelete }) => {
  const data = useSingleJobData(jobId);
  const actions = useSingleJobActions(jobId, onBack, onRerun, onDelete, data.refreshLogs);
  const settings = useSingleJobSettings(data.job, data.jobConfiguration, data.setJobConfiguration);
  const imagesState = useSingleJobImages(data.images, data.job);

  const {
    job,
    isLoading,
    error,
    getDisplayLabel,
    loadJobData,
    jobConfiguration,
    overviewSettings,
    logs,
  } = data;
  const {
    activeTab,
    handleTabChange,
    handleBack,
    handleExport,
    handleRerun,
    handleDelete,
    handleConfirmDelete,
    handleCancelDelete,
    showDeleteConfirm,
    showExportDialog,
    setShowExportDialog,
  } = actions;
  const {
    handleSettingsEdit,
    isEditingSettings,
    editedSettings,
    handleSettingsSave,
    handleSettingsCancel,
    handleSettingChange,
    handleToggleChange,
    isSavingSettings,
    isLoadingSettings,
    settingsSaveError,
  } = settings;
  const {
    viewMode,
    setViewMode,
    imageFilter,
    setImageFilter,
    filteredImages,
    qcReasonFilters,
    failedProcessingCount,
    getImageUiStatus,
    getImageTitle,
  } = imagesState;

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] font-[var(--font-sans)]"
        role="main"
        aria-label="Loading job details"
      >
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="w-12 h-12 border-[3px] border-[var(--border)] border-t-[var(--primary)] rounded-full animate-spin mb-4" />
          <p>Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] font-[var(--font-sans)]"
        role="main"
        aria-label="Job error"
      >
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="text-3xl mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3>Error Loading Job</h3>
          <p>{error}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] border-0 rounded-[var(--radius)] cursor-pointer transition hover:opacity-90"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div
        className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] font-[var(--font-sans)]"
        role="main"
        aria-label="Job not found"
      >
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <h3>Job Not Found</h3>
          <p>The requested job could not be found.</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] border-0 rounded-[var(--radius)] cursor-pointer transition hover:opacity-90"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] font-[var(--font-sans)]">
      <header className="border-b border-[var(--border)] p-6 bg-[var(--card)] shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="text-[var(--muted-foreground)] bg-transparent border-0 cursor-pointer transition flex items-center justify-center p-0 hover:text-[var(--foreground)]"
              aria-label="Go back to job list"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-[var(--foreground)] m-0">Job #{job.id}</h1>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <span className="text-2xl font-semibold text-[var(--foreground)] flex-1">{getDisplayLabel()}</span>
          </div>
        </div>
      </header>

      <div className="flex gap-2 pt-4 px-6 bg-[var(--background)] shrink-0">
        <button
          type="button"
          className={`px-6 py-3 font-medium rounded-t border border-[var(--border)] border-b-0 transition cursor-pointer ${activeTab === 'overview' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'}`}
          onClick={() => handleTabChange('overview')}
          data-tab="overview"
        >
          Overview
        </button>
        <button
          type="button"
          className={`px-6 py-3 font-medium rounded-t border border-[var(--border)] border-b-0 transition cursor-pointer ${activeTab === 'images' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'}`}
          onClick={() => handleTabChange('images')}
          data-tab="images"
        >
          Images
        </button>
        {job?.status === 'running' && (
          <button
            type="button"
            className={`px-6 py-3 font-medium rounded-t border border-[var(--border)] border-b-0 transition cursor-pointer ${activeTab === 'logs' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'}`}
            onClick={() => handleTabChange('logs')}
            data-tab="logs"
          >
            Logs
          </button>
        )}
      </div>

      <main className="flex-1 min-h-0 relative bg-[var(--card)] border border-t-0 border-[var(--border)] rounded-b mx-6">
        <div
          id="overview"
          className={`absolute inset-0 overflow-auto ${activeTab === 'overview' ? 'block' : 'hidden'}`}
        >
          <SingleJobOverviewTab
            job={job}
            overviewSettings={overviewSettings}
            jobConfiguration={jobConfiguration}
            isLoading={isLoading}
            loadJobData={loadJobData}
            handleSettingsEdit={handleSettingsEdit}
            failedProcessingCount={failedProcessingCount}
            formatDate={formatDate}
            formatDuration={formatDuration}
          />
        </div>

        <div
          id="images"
          className={`absolute inset-0 overflow-auto ${activeTab === 'images' ? 'block' : 'hidden'}`}
        >
          <SingleJobImagesTab
            filteredImages={filteredImages}
            viewMode={viewMode}
            setViewMode={setViewMode}
            imageFilter={imageFilter}
            setImageFilter={setImageFilter}
            qcReasonFilters={qcReasonFilters}
            getImageTitle={getImageTitle}
            getImageUiStatus={getImageUiStatus}
          />
        </div>

        {job?.status === 'running' && (
          <div
            id="logs"
            className={`absolute inset-0 overflow-auto ${activeTab === 'logs' ? 'block' : 'hidden'}`}
          >
            <div className="flex flex-col flex-1 min-h-0 p-6">
              <LogViewer
                logs={logs}
                jobStatus="running"
                onRefresh={data.refreshLogs}
                minHeight={320}
                maxHeight="70vh"
              />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--background)] py-4 px-6 shrink-0 mt-auto">
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={handleRerun}
            className="px-4 py-2 rounded-[var(--radius)] font-medium cursor-pointer transition border-0 flex items-center gap-2 bg-[var(--action-rerun)] text-white hover:opacity-90"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Rerun Job
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2 rounded-[var(--radius)] font-medium cursor-pointer transition border-0 flex items-center gap-2 bg-[var(--action-export)] text-white hover:opacity-90"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 rounded-[var(--radius)] font-medium cursor-pointer transition border-0 flex items-center gap-2 bg-[var(--action-delete)] text-white hover:opacity-90"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      </footer>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] rounded-[var(--radius)] p-6 max-w-[28rem] w-[90%] mx-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[var(--foreground)] m-0 mb-4">Confirm Deletion</h3>
            </div>
            <div className="text-[var(--muted-foreground)] mb-6 leading-normal">
              <p>Are you sure you want to delete this job? This action cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2 bg-[var(--secondary)] text-[var(--secondary-foreground)] border border-[var(--border)] rounded-[var(--radius)] cursor-pointer transition hover:bg-[var(--accent)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-[var(--status-failed)] text-white border-0 rounded-[var(--radius)] cursor-pointer transition hover:opacity-90"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      <SingleJobSettingsModal
        isOpen={isEditingSettings}
        onClose={handleSettingsCancel}
        editedSettings={editedSettings}
        onSettingChange={handleSettingChange}
        onToggleChange={handleToggleChange}
        onSave={handleSettingsSave}
        onCancel={handleSettingsCancel}
        isSaving={isSavingSettings}
        isLoading={isLoadingSettings}
        saveError={settingsSaveError}
        job={job}
      />

      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={async () => window.electronAPI.exportJobToExcel(jobId)}
        title="Export Job"
        description="Export this job to Excel format with all details and settings."
      />
    </div>
  );
};

export { SingleJobView };
