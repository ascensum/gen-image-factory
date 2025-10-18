import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { SettingsObject } from '../../../types/settings';
import { JobExecution } from '../../../types/job';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../types/generatedImage';
import ExportDialog from '../Common/ExportDialog';
import { Toggle } from '../Settings/Toggle';
import './SingleJobView.css';
import StatusBadge from '../Common/StatusBadge';
import LogViewer from '../Dashboard/LogViewer';

interface SingleJobViewProps {
  jobId: string | number;
  onBack: () => void;
  onExport: (jobId: string | number) => void;
  onRerun: (jobId: string | number) => void;
  onDelete: (jobId: string | number) => void;
}

const SingleJobView: React.FC<SingleJobViewProps> = ({
  jobId,
  onBack,
  onExport,
  onRerun,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [job, setJob] = useState<JobExecution | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [imageFilter, setImageFilter] = useState('all');
  
  // Job label editing state
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editedLabel, setEditedLabel] = useState('');
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [labelSaveError, setLabelSaveError] = useState<string | null>(null);
  const labelInputRef = useRef<HTMLDivElement>(null);
  
  // Compute display-only fallback label from startedAt timestamp
  const getDisplayLabel = useCallback(() => {
    const jobLabel = job?.label;
    if (jobLabel && jobLabel.trim() !== '') return jobLabel;
    const started = job?.startedAt ? new Date(job.startedAt as any) : null;
    if (started && !isNaN(started.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const ts = `${started.getFullYear()}${pad(started.getMonth() + 1)}${pad(started.getDate())}_${pad(started.getHours())}${pad(started.getMinutes())}${pad(started.getSeconds())}`;
      return `job_${ts}`;
    }
    return `Job ${job?.id ?? ''}`.trim();
  }, [job]);
  
  // Settings editing state
  type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editedSettings, setEditedSettings] = useState<DeepPartial<SettingsObject> | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  
  // Job configuration state
  const [jobConfiguration, setJobConfiguration] = useState(null);
  
  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);

  useEffect(() => {
    loadJobData();
  }, [jobId]);

  const loadJobData = async () => {
    console.log('🔄 SingleJobView: loadJobData called');
    setIsLoading(true);
    setError(null);
    
    try {
      // Load job details
      const jobResult = await window.electronAPI.jobManagement.getJobExecution(jobId);
      if (jobResult.success) {
        setJob(jobResult.execution);
        // Set label to "No label" if undefined, otherwise use job label or default
        const jobLabel = jobResult.execution.label;
        if (!jobLabel || jobLabel.trim() === '') {
          // Initialize editor with the display fallback but save will convert it to empty string
          const started = jobResult.execution.startedAt ? new Date(jobResult.execution.startedAt as any) : null;
          if (started && !isNaN(started.getTime())) {
            const pad = (n: number) => n.toString().padStart(2, '0');
            const ts = `${started.getFullYear()}${pad(started.getMonth() + 1)}${pad(started.getDate())}_${pad(started.getHours())}${pad(started.getMinutes())}${pad(started.getSeconds())}`;
            setEditedLabel(`job_${ts}`);
          } else {
            setEditedLabel(`Job ${jobResult.execution.id}`);
          }
        } else {
          setEditedLabel(jobLabel);
        }

        // Calculate and update statistics from actual images
        if (jobResult.execution.id) {
          console.log('🔄 SingleJobView: Calculating statistics for execution ID:', jobResult.execution.id);
          try {
            const statsResult = await window.electronAPI.calculateJobExecutionStatistics(jobResult.execution.id);
            if (statsResult.success) {
              console.log('🔄 SingleJobView: Calculated statistics:', statsResult.statistics);
              // Update the job with calculated statistics including QC breakdown
              setJob(prevJob => ({
                ...prevJob,
                totalImages: statsResult.statistics.totalImages,
                successfulImages: statsResult.statistics.successfulImages,
                failedImages: statsResult.statistics.failedImages,
                approvedImages: statsResult.statistics.approvedImages,
                qcFailedImages: statsResult.statistics.qcFailedImages
              }));
            }
          } catch (statsError) {
            console.warn('Failed to calculate statistics:', statsError);
          }
        }
      } else {
        setError(jobResult.error || 'Failed to load job details');
      }
      
      // Load job images - use the numeric database ID from job execution
      if (jobResult.execution?.id) {
        console.log('🔄 SingleJobView: Loading images for execution ID:', jobResult.execution.id);
        const imagesResult = await window.electronAPI.generatedImages.getGeneratedImagesByExecution(jobResult.execution.id);
        console.log('🔄 SingleJobView: Images result:', imagesResult);
        if (imagesResult.success) {
          console.log('🔄 SingleJobView: Setting images:', imagesResult.images);
          console.log('🔄 SingleJobView: Images QC statuses:', imagesResult.images?.map((img: any) => ({ id: img.id, qcStatus: img.qcStatus })));
          setImages(imagesResult.images || []);
        } else {
          console.warn('Failed to load images:', imagesResult.error);
          setImages([]);
        }
      } else {
        console.warn('Job execution has no numeric ID, cannot load images');
        setImages([]);
      }
      
      // Load job logs via IPC (standard mode)
      try {
        const jobLogs = await window.electronAPI.jobManagement.getJobLogs('standard');
        if (jobLogs && Array.isArray(jobLogs)) {
          setLogs(jobLogs);
        } else {
          setLogs([]);
        }
      } catch (e) {
        setLogs([]);
      }
      
      // Load job configuration if available
      console.log('🔍 DEBUG: jobResult structure:', jobResult);
      console.log('🔍 DEBUG: jobResult.execution:', jobResult.execution);
      console.log('🔍 DEBUG: jobResult.execution?.configurationId:', jobResult.execution?.configurationId);
      
      if (jobResult.execution?.configurationId) {
        try {
          console.log('🔍 DEBUG: About to call getJobConfigurationById with:', jobResult.execution.configurationId);
          const configResult = await window.electronAPI.getJobConfigurationById(jobResult.execution.configurationId);
          console.log('🔍 DEBUG: getJobConfigurationById result:', configResult);
          if (configResult.success && configResult.configuration) {
            console.log('🔍 DEBUG: Setting job configuration:', configResult.configuration);
            setJobConfiguration(configResult.configuration);
          } else {
            console.warn('🔍 DEBUG: getJobConfigurationById failed:', configResult);
          }
        } catch (configError) {
          console.warn('Failed to load job configuration:', configError);
          // Don't fail the entire load for missing configuration
        }
      } else {
        console.warn('🔍 DEBUG: No configurationId found in jobResult.execution');
      }
      
    } catch (error) {
      console.error('Error loading job data:', error);
      setError('Failed to load job data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'logs') {
      // Refresh logs when switching to Logs tab
      refreshLogs();
    }
  }, []);
  
  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);
  
  const handleExport = useCallback(async () => {
    setShowExportDialog(true);
  }, []);
  
  const handleRerun = useCallback(() => {
    console.log('🚨 DEBUG RERUN: SingleJobView rerun button clicked for jobId:', jobId);
    console.log('🚨 DEBUG RERUN: Timestamp:', new Date().toISOString());
    console.log('🚨 DEBUG RERUN: Stack trace:', new Error().stack);
    onRerun(jobId);
  }, [onRerun, jobId]);
  
  const handleDelete = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);
  
  const handleConfirmDelete = useCallback(() => {
    onDelete(jobId);
    setShowDeleteConfirm(false);
  }, [onDelete, jobId]);
  
  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  // Logs refresh handler using same standard/debug mode as Dashboard
  const refreshLogs = useCallback(async () => {
    try {
      let mode = 'standard';
      try {
        const settingsRes = await (window as any).electronAPI.getSettings?.();
        if (settingsRes?.settings?.advanced?.debugMode) {
          mode = 'debug';
        }
      } catch {}
      const jobLogs = await (window as any).electronAPI.jobManagement.getJobLogs(mode);
      setLogs(Array.isArray(jobLogs) ? jobLogs : []);
    } catch {
      setLogs([]);
    }
  }, []);

  // Job label editing handlers
  const handleLabelEdit = useCallback(() => {
    setIsEditingLabel(true);
    setLabelSaveError(null);
    // Focus the input after a brief delay to ensure DOM is ready
    setTimeout(() => {
      if (labelInputRef.current) {
        labelInputRef.current.focus();
        // Select all text for easy replacement
        const range = document.createRange();
        range.selectNodeContents(labelInputRef.current);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }, 10);
  }, []);

  const handleLabelSave = useCallback(async () => {
    if (!job || !editedLabel.trim()) return;
    
    setIsSavingLabel(true);
    setLabelSaveError(null);
    
    try {
      // Handle "No label" case - save as empty string to database
      const labelToSave = editedLabel.trim() === 'No label' ? '' : editedLabel.trim();
      const result = await window.electronAPI.jobManagement.renameJobExecution(job.id, labelToSave);
      if (result.success) {
        // Update local state
        setJob(prevJob => prevJob ? { ...prevJob, label: labelToSave } : null);
        setIsEditingLabel(false);
        console.log('Job label updated successfully');
      } else {
        setLabelSaveError(result.error || 'Failed to save label');
      }
    } catch (error) {
      console.error('Error saving job label:', error);
      setLabelSaveError('Failed to save label');
    } finally {
      setIsSavingLabel(false);
    }
  }, [job, editedLabel]);

  const handleLabelCancel = useCallback(() => {
    setIsEditingLabel(false);
    const jobLabel = job?.label;
    if (!jobLabel || jobLabel.trim() === '') {
      setEditedLabel('No label');
    } else {
      setEditedLabel(jobLabel);
    }
    setLabelSaveError(null);
  }, [job]);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLabelSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleLabelCancel();
    }
  }, [handleLabelSave, handleLabelCancel]);

  const handleLabelBlur = useCallback(() => {
    // Auto-save on blur if content changed
    const currentLabel = job?.label || '';
    const currentDisplayLabel = currentLabel && currentLabel.trim() !== '' ? currentLabel : getDisplayLabel();
    if (editedLabel !== currentDisplayLabel) {
      handleLabelSave();
    }
  }, [editedLabel, job, handleLabelSave, getDisplayLabel]);

  // Settings editing handlers
  const handleSettingsEdit = useCallback(async () => {
    console.log('Edit button clicked, job:', job);
    console.log('Job configurationId:', job?.configurationId);
    console.log('Already loaded jobConfiguration:', jobConfiguration);
    
    setIsEditingSettings(true);
    setSettingsSaveError(null);
    setIsLoadingSettings(false); // Don't show loading since we already have the data
    
    try {
      // Use already-loaded jobConfiguration if available
      if (jobConfiguration?.settings) {
        console.log('Using already-loaded job configuration:', jobConfiguration.settings);
        setEditedSettings(jobConfiguration.settings);
      } else if (job?.configurationId) {
        // Fallback: Load job-specific settings from backend if not already loaded
        console.log('Job configuration not loaded yet, fetching from backend for ID:', job.configurationId);
        setIsLoadingSettings(true);
        const result = await window.electronAPI.getJobConfigurationById(job.configurationId);
        console.log('Configuration load result:', result);
        
        if (result.success && result.configuration?.settings) {
          setEditedSettings(result.configuration.settings);
          console.log('Loaded job configuration from backend:', result.configuration.settings);
        } else {
          // If job configuration not found, show error but keep modal open
          console.warn('Job configuration not found, showing error in modal');
          setSettingsSaveError('Job configuration not found. This job may be corrupted.');
          // Don't close modal - let user see the error
        }
      } else {
        // No configuration ID - this is a dashboard-created job (expected behavior)
        console.log('Job has no configurationId - this is a dashboard-created job');
        setSettingsSaveError('This job was created from the dashboard and has no saved configuration. You can view the job details and generated images, but cannot edit settings. This is normal behavior for dashboard-created jobs.');
        // Don't close modal - let user see the message
      }
    } catch (error) {
      console.error('Error loading job settings:', error);
      setSettingsSaveError('Failed to load job settings');
      // Don't close modal - let user see the error
    } finally {
      setIsLoadingSettings(false);
    }
  }, [job?.configurationId, jobConfiguration]);

  const handleSettingsSave = useCallback(async () => {
    if (!editedSettings || !job?.configurationId) return;
    
    setIsSavingSettings(true);
    setSettingsSaveError(null);
    
    try {
      // Save to job-specific configuration
      const result = await window.electronAPI.updateJobConfiguration(job.configurationId, editedSettings);
      
      if (result.success) {
        setIsEditingSettings(false);
        console.log('Job settings updated successfully');
        // TODO: Refresh job data to show updated settings
      } else {
        setSettingsSaveError(result.error || 'Failed to save job settings');
      }
    } catch (error) {
      console.error('Error saving job settings:', error);
      setSettingsSaveError('Failed to save job settings');
    } finally {
      setIsSavingSettings(false);
    }
  }, [editedSettings, job?.configurationId]);

  const handleSettingsCancel = useCallback(() => {
    setIsEditingSettings(false);
    setEditedSettings(null);
    setSettingsSaveError(null);
  }, []);

  const handleSettingChange = useCallback((section: string, key: string, value: any) => {
    if (!editedSettings) return;
    setEditedSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: { ...prev[section as keyof typeof prev], [key]: value }
      };
    });
  }, [editedSettings]);

  const handleToggleChange = useCallback((section: string, key: string) => (checked: boolean) => {
    handleSettingChange(section, key, checked);
  }, [handleSettingChange]);

  // Match Image Gallery badge colors/styles
  const getStatusColor = (status: string) => {
    const s = String(status || '').toLowerCase();
    // Explicit processing state when present
    if (s === 'processing') return 'status-processing';
    // Use UI bucket for all others
    const ui = getImageUiStatus(status);
    if (ui === 'approved') return 'status-complete'; // green
    return 'status-failed'; // red for qc_failed and any other
  };

  // Normalize qcStatus to UI filter/status buckets
  const getImageUiStatus = useCallback((qcStatus?: string | null): 'approved' | 'qc_failed' => {
    const s = (qcStatus || '').toLowerCase();
    return (s === 'approved' || s === 'complete' || s === 'completed') ? 'approved' : 'qc_failed';
  }, []);

  const parseImageMetadata = (raw: any): any => {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return raw;
  };

  const getImageTitle = useCallback((img: any): string => {
    const meta = parseImageMetadata(img?.metadata);
    const title = typeof meta?.title === 'string' ? meta.title : (meta?.title?.en || '');
    return title && title.trim() !== '' ? title : `Image ${img?.id}`;
  }, []);

  const filteredImages = useMemo(() => {
    if (imageFilter === 'all') return images;
    return images.filter(img => getImageUiStatus((img as any).qcStatus) === imageFilter);
  }, [images, imageFilter, getImageUiStatus]);

  const formatDate = (dateString: string | Date) => {
    if (dateString instanceof Date) {
      return dateString.toLocaleString();
    }
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (startTime: string | Date, endTime?: string | Date) => {
    if (!endTime) return 'In Progress';
    const start = startTime instanceof Date ? startTime : new Date(startTime);
    const end = endTime instanceof Date ? endTime : new Date(endTime);
    const duration = end.getTime() - start.getTime();
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="single-job-view" role="main" aria-label="Loading job details">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="single-job-view" role="main" aria-label="Job error">
        <div className="error-container">
          <div className="error-icon">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3>Error Loading Job</h3>
          <p>{error}</p>
          <button onClick={handleBack} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="single-job-view" role="main" aria-label="Job not found">
        <div className="error-container">
          <h3>Job Not Found</h3>
          <p>The requested job could not be found.</p>
          <button onClick={handleBack} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="single-job-view">
      {/* Header */}
      <header className="job-header">
        <div className="header-content">
          <div className="header-left">
            <button 
              onClick={handleBack}
              className="back-button"
              aria-label="Go back to job list"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="job-title-main">Job #{job.id}</h1>
          </div>
        </div>
        <div className="job-title-section">
          <div className="job-title-editable" onClick={!isEditingLabel ? handleLabelEdit : undefined} title={!isEditingLabel ? "Click to edit job label" : "Press Enter to save, Escape to cancel"}>
            {isEditingLabel ? (
              <input
                type="text"
                value={editedLabel}
                onChange={(e) => setEditedLabel(e.target.value)}
                onKeyDown={handleLabelKeyDown}
                onBlur={handleLabelBlur}
                ref={labelInputRef}
                className="label-input"
                autoFocus
              />
            ) : (
              <>
                <span className="job-title-text">
                  {getDisplayLabel()}
                </span>
                <svg className="edit-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </>
            )}
          </div>
          {isEditingLabel && (
            <div className="label-edit-controls">
              <button onClick={handleLabelSave} disabled={isSavingLabel} className="label-save-btn" title="Save label">
                {isSavingLabel ? 'Saving...' : 'Save'}
              </button>
              <button onClick={handleLabelCancel} disabled={isSavingLabel} className="label-cancel-btn" title="Cancel editing">
                Cancel
              </button>
            </div>
          )}
          {labelSaveError && (
            <div className="label-error">
              <span className="error-icon">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </span>
              {labelSaveError}
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => handleTabChange('overview')}
          data-tab="overview"
        >
          Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'images' ? 'active' : ''}`}
          onClick={() => handleTabChange('images')}
          data-tab="images"
        >
          Images
        </button>
        {job?.status === 'running' && (
          <button 
            className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => handleTabChange('logs')}
            data-tab="logs"
          >
            Logs
          </button>
        )}
      </div>

      {/* Tab Contents Container */}
      <main className="tab-content-container">
        {/* Overview Content */}
        <div 
          id="overview" 
          className={`tab-content ${activeTab === 'overview' ? 'active' : ''}`}
        >
          <div className="overview-content">
            {/* Job Information */}
            <div className="info-grid">
              <div className="info-card">
                <div className="info-label">Job ID</div>
                <div className="info-value">JOB-{job.id}</div>
              </div>
              <div className="info-card">
                <div className="info-label">Status</div>
                <div className="info-value">
                  <StatusBadge 
                    variant="job" 
                    status={job.status}
                  />
                </div>
              </div>
              <div className="info-card">
                <div className="info-label">Start Time</div>
                <div className="info-value">
                  {job.startedAt ? formatDate(job.startedAt) : 'Not started'}
                </div>
              </div>
              <div className="info-card">
                <div className="info-label">Duration</div>
                <div className="info-value">
                  {job.startedAt && job.completedAt ? 
                    formatDuration(job.startedAt, job.completedAt) : 'In Progress'}
                </div>
              </div>
              <div className="info-card">
                <div className="info-label">Success Rate</div>
                <div className="info-value">
                  {job.totalImages ? 
                    `${Math.round(((job.successfulImages || 0) / job.totalImages) * 100)}% (${job.successfulImages || 0}/${job.totalImages})` : 
                    'N/A'}
                </div>
              </div>
            </div>

            {/* Generated Images Summary */}
            <h2 className="section-title">Generated Images Summary</h2>
            <div className="stats-grid">
              <div className="stats-card">
                <div className="stats-label">Total Images</div>
                <div className="stats-value">{job.totalImages || 0}</div>
              </div>
              <div className="stats-card">
                <div className="stats-label">Successful</div>
                <div className="stats-value success">{job.successfulImages || 0}</div>
                {(job.successfulImages || 0) > 0 && (
                  <div className="stats-breakdown">
                    <div className="breakdown-item approved">
                      <span className="breakdown-label">Approved:</span>
                      <span className="breakdown-value">{(job as any).approvedImages || 0}</span>
                    </div>
                    <div className="breakdown-item qc-failed">
                      <span className="breakdown-label">QC Failed:</span>
                      <span className="breakdown-value">{(job as any).qcFailedImages || 0}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="stats-card">
                <div className="stats-label">Failed</div>
                <div className="stats-value failed">{job.failedImages || 0}</div>
                <div className="stats-note">Generation failed</div>
              </div>
            </div>

                    {/* Settings */}
        <div className="settings-section">
          <div className="settings-header">
            <h2 className="section-title">Settings</h2>
            <div className="settings-actions">
              <button 
                className="refresh-button"
                onClick={loadJobData}
                title="Refresh job data"
                disabled={isLoading}
              >
                {isLoading ? 'Refreshing...' : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </>
                )}
              </button>
              <button 
                className="edit-button"
                onClick={handleSettingsEdit}
                title="Edit job settings"
              >
                Edit
              </button>
            </div>
          </div>
              <div className="settings-content">
                {jobConfiguration ? (
                  <>
                    <div className="setting-group">
                      <h3>Model Configuration</h3>
                      <div className="setting-details">
                        <div>• Model: {jobConfiguration.settings?.parameters?.mjVersion ? `Midjourney v${jobConfiguration.settings.parameters.mjVersion}` : 'Not specified'}</div>
                        <div>• Process Mode: {jobConfiguration.settings?.parameters?.processMode || 'Not specified'}</div>
                        <div>• OpenAI Model: {jobConfiguration.settings?.parameters?.openaiModel || 'Not specified'}</div>
                        <div>• Random Keywords: {jobConfiguration.settings?.parameters?.keywordRandom ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                    <div className="setting-group">
                      <h3>Image Settings</h3>
                      <div className="setting-details">
                        <div>• Aspect Ratio: {Array.isArray(jobConfiguration.settings?.parameters?.aspectRatios) ? jobConfiguration.settings.parameters.aspectRatios.join(', ') : jobConfiguration.settings?.parameters?.aspectRatios || 'Not specified'}</div>
                        <div>• Generations count: {jobConfiguration.settings?.parameters?.count || 'Not specified'}</div>
                        <div>• Convert to JPG: {jobConfiguration.settings?.processing?.convertToJpg ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                    <div className="setting-group">
                      <h3>Processing Options</h3>
                      <div className="setting-details">
                        <div>• Remove Background: {jobConfiguration.settings?.processing?.removeBg ? 'Yes' : 'No'}</div>
                        <div>• Remove.bg Size: {jobConfiguration.settings?.processing?.removeBg ? (jobConfiguration.settings?.processing?.removeBgSize || 'auto') : 'Not applied (Remove Background OFF)'}</div>
                        <div>• Image Enhancement: {jobConfiguration.settings?.processing?.imageEnhancement ? 'Yes' : 'No'}</div>
                        <div>• Sharpening: {jobConfiguration.settings?.processing?.imageEnhancement ? (jobConfiguration.settings?.processing?.sharpening || 0) : 'Not applied (Image Enhancement OFF)'}</div>
                        <div>• Saturation: {jobConfiguration.settings?.processing?.imageEnhancement ? (jobConfiguration.settings?.processing?.saturation || 1.4) : 'Not applied (Image Enhancement OFF)'}</div>
                        <div>• Image Convert: {jobConfiguration.settings?.processing?.imageConvert ? 'Yes' : 'No'}</div>
                        <div>• Convert Format: {jobConfiguration.settings?.processing?.imageConvert ? (jobConfiguration.settings?.processing?.convertToJpg ? 'JPG' : 'PNG') : 'Not applied (Image Convert OFF)'}</div>
                        <div>• JPG Quality: {jobConfiguration.settings?.processing?.imageConvert && jobConfiguration.settings?.processing?.convertToJpg ? (jobConfiguration.settings?.processing?.jpgQuality || 100) : 'Not applied (Convert Format is not JPG)'}</div>
                        <div>• PNG Quality: {jobConfiguration.settings?.processing?.imageConvert && !jobConfiguration.settings?.processing?.convertToJpg ? (jobConfiguration.settings?.processing?.pngQuality || 100) : 'Not applied (Convert Format is not PNG)'}</div>
                        <div>• Trim Transparent: {jobConfiguration.settings?.processing?.trimTransparentBackground ? 'Yes' : 'No'}</div>
                        <div>• JPG Background Colour: {jobConfiguration.settings?.processing?.imageConvert && jobConfiguration.settings?.processing?.convertToJpg && jobConfiguration.settings?.processing?.removeBg ? (jobConfiguration.settings?.processing?.jpgBackground || 'white') : 'Not applied (Remove Background, Image Convert are set to OFF and Convert Format is not JPG)'}</div>
                        <div>• Quality Check: {jobConfiguration.settings?.ai?.runQualityCheck ? 'Yes' : 'No'}</div>
                        <div>• Metadata Generation: {jobConfiguration.settings?.ai?.runMetadataGen ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="no-configuration">
                    <p>No configuration available for this job.</p>
                    <p>This job was run with default settings.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Images Content */}
        <div 
          id="images" 
          className={`tab-content ${activeTab === 'images' ? 'active' : ''}`}
        >
          <div className="images-content">
            {/* Controls */}
            <div className="images-controls">
              <div className="filter-controls">
                <select 
                  value={imageFilter}
                  onChange={(e) => setImageFilter(e.target.value as 'all' | 'approved' | 'qc_failed')}
                  className="filter-select"
                >
                  <option value="all">All</option>
                  <option value="approved">Approved</option>
                  <option value="qc_failed">QC Failed</option>
                </select>
              </div>
              <div className="view-controls">
                <button 
                  className={`view-toggle ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button 
                  className={`view-toggle ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List View"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="images-scroll-area">
            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="image-grid">
                {filteredImages.length === 0 ? (
                  <div className="no-images">
                    <p>No images found with current filter.</p>
                  </div>
                ) : (
                  filteredImages.map((image) => (
                    <div key={image.id} className="image-card">
                      <div className="image-preview">
                        {(image.finalImagePath || image.tempImagePath) ? (
                          <img 
                            src={`local-file://${image.finalImagePath || image.tempImagePath}`} 
                            alt={`Generated image ${image.id}`}
                            className="w-full h-32 object-cover rounded"
                            onError={(e) => {
                              console.error('Failed to load image:', image.finalImagePath);
                              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik02NCAzMkM3Ny4yNTQ4IDMyIDg4IDQyLjc0NTIgODggNTZDODggNjkuMjU0OCA3Ny4yNTQ4IDgwIDY0IDgwQzUwLjc0NTIgODAgNDAgNjkuMjU0OCA0MCA1NkM0MCA0Mi43NDUyIDUwLjc0NTIgMzIgNjQgMzJaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0yNCA4OEgxMDRDMTEwLjYyNyA4OCAxMTYgOTMuMzcyNiAxMTYgMTAwVjExMkMxMTYgMTE4LjYyNyAxMTAuNjI3IDEyNCAxMDQgMTI0SDI0QzE3LjM3MjYgMTI0IDEyIDExOC42MjcgMTIgMTEyVjEwMEMxMiA5My4zNzI2IDE3LjM3MjYgODggMjQgODhaIiBmaWxsPSIjOUI5QkEwIi8+Cjwvc3ZnPgo=';
                            }}
                          />
                        ) : (
                          <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="image-info">
                          <span className="image-id">{getImageTitle(image)}</span>
                        <span className={`image-status ${getStatusColor(image.qcStatus)}`}>
                          {(() => {
                            const s = String((image as any).qcStatus || '').toLowerCase();
                            const ui = getImageUiStatus((image as any).qcStatus);
                            if (s === 'processing') {
                              return (
                                <>
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Processing
                                </>
                              );
                            }
                            if (ui === 'approved') {
                              return (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Approved
                            </>
                              );
                            }
                            // QC Failed bucket for everything else (failed, qc_failed, null, etc.)
                            return (
                              <>
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                QC Failed
                              </>
                            );
                          })()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <table className="image-list">
                <thead>
                  <tr>
                    <th>Preview</th>
                    <th>ID</th>
                    <th>Status</th>
                    <th>Generated At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredImages.map((image) => (
                    <tr key={image.id}>
                      <td>
                        <div className="thumbnail">
                          {(image.finalImagePath || image.tempImagePath) ? (
                            <img 
                              src={`local-file://${image.finalImagePath || image.tempImagePath}`} 
                              alt={`Generated image ${image.id}`}
                              className="w-16 h-16 object-cover rounded-lg"
                              onError={(e) => {
                                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAyNEg0MFY0MEgyNFYyNFoiIGZpbGw9IiNEMUQ1REIiLz4KPC9zdmc+';
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
                      <td>{getImageTitle(image)}</td>
                      <td>
                        <span className={`image-status ${getStatusColor(image.qcStatus)}`}>
                          {(() => {
                            const s = String((image as any).qcStatus || '').toLowerCase();
                            const ui = getImageUiStatus((image as any).qcStatus);
                            if (s === 'processing') {
                              return (
                                <>
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Processing
                                </>
                              );
                            }
                            if (ui === 'approved') {
                              return (
                                <>
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Approved
                                </>
                              );
                            }
                            return (
                              <>
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                QC Failed
                              </>
                            );
                          })()}
                        </span>
                      </td>
                      <td>{formatDate(job.startedAt || '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
          </div>
        </div>

        {/* Logs Content */}
        {job?.status === 'running' && (
          <div 
            id="logs" 
            className={`tab-content ${activeTab === 'logs' ? 'active' : ''}`}
          >
            <div className="logs-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <LogViewer
                logs={logs as any}
                jobStatus={(job?.status === 'running' || job?.status === 'processing') ? 'running' : (job?.status === 'completed' ? 'completed' : (job?.status === 'failed' ? 'failed' : 'idle'))}
                onRefresh={refreshLogs}
                // Keep inner scroll; remove tab viewport scroll; make logs comfortably tall
                minHeight={320}
                maxHeight={'70vh'}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="job-footer">
        <div className="footer-actions">
          <button onClick={handleRerun} className="btn-rerun">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Rerun Job
          </button>
          <button onClick={handleExport} className="btn-export">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Job
          </button>
          <button onClick={handleDelete} className="btn-delete">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Job
          </button>
        </div>
      </footer>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="delete-modal">
            <div className="modal-header">
              <h3>Confirm Deletion</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this job? This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button onClick={handleCancelDelete} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleConfirmDelete} className="btn-confirm-delete">
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Edit Modal */}
      {isEditingSettings && (
        <div className="modal-overlay">
          <div className="settings-modal">
            <div className="settings-header">
              <h3 className="text-lg font-medium text-gray-900">Edit Job Settings</h3>
              <button onClick={handleSettingsCancel} className="close-button" title="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {isLoadingSettings ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading current settings...</p>
              </div>
            ) : editedSettings ? (
              <div className="settings-content">
                {/* API Keys Section */}
                <div className="setting-group">
                  <h4 className="setting-group-title">API Keys</h4>
                  <div className="setting-row">
                    <label>OpenAI API Key</label>
                    <input
                      type="password"
                      value={editedSettings.apiKeys?.openai || ''}
                      onChange={(e) => handleSettingChange('apiKeys', 'openai', e.target.value)}
                      placeholder="Enter OpenAI API key"
                    />
                  </div>
                  <div className="setting-row">
                    <label>Runware API Key</label>
                    <input
                      type="password"
                      value={editedSettings.apiKeys?.runware || ''}
                      onChange={(e) => handleSettingChange('apiKeys', 'runware', e.target.value)}
                      placeholder="Enter Runware API key"
                    />
                  </div>
                  <div className="setting-row">
                    <label>Remove.bg API Key</label>
                    <input
                      type="password"
                      value={editedSettings.apiKeys?.removeBg || ''}
                      onChange={(e) => handleSettingChange('apiKeys', 'removeBg', e.target.value)}
                      placeholder="Enter Remove.bg API key"
                    />
                  </div>
                </div>

                {/* File Paths Section */}
                <div className="setting-group">
                  <h4 className="setting-group-title">File Paths</h4>
                  <p className="setting-hint" style={{ fontSize: '12px', color: '#6b7280', marginTop: '-6px', marginBottom: '8px' }}>
                    Edit file contents on disk; paths are reference-only here. Files are re-read at run/rerun. To change paths, use Settings.
                  </p>
                  <div className="setting-row">
                    <label>Output Directory</label>
                    <input
                      type="text"
                      value={editedSettings.filePaths?.outputDirectory || ''}
                      onChange={() => {}}
                      disabled
                      placeholder="Output directory path"
                    />
                  </div>
                  <div className="setting-row">
                    <label>Temp Directory</label>
                    <input
                      type="text"
                      value={editedSettings.filePaths?.tempDirectory || ''}
                      onChange={() => {}}
                      disabled
                      placeholder="Temporary directory path"
                    />
                  </div>
                  <div className="setting-row">
                    <label>System Prompt File</label>
                    <input
                      type="text"
                      value={editedSettings.filePaths?.systemPromptFile || ''}
                      onChange={() => {}}
                      disabled
                      placeholder="Path to system prompt file"
                    />
                  </div>
                  <div className="setting-row">
                    <label>Keywords File</label>
                    <input
                      type="text"
                      value={editedSettings.filePaths?.keywordsFile || ''}
                      onChange={() => {}}
                      disabled
                      placeholder="Path to keywords file"
                    />
                  </div>
                  <div className="setting-row">
                    <label>Quality Check Prompt File</label>
                    <input
                      type="text"
                      value={editedSettings.filePaths?.qualityCheckPromptFile || ''}
                      onChange={() => {}}
                      disabled
                      placeholder="Path to QC prompt file"
                    />
                  </div>
                  <div className="setting-row">
                    <label>Metadata Prompt File</label>
                    <input
                      type="text"
                      value={editedSettings.filePaths?.metadataPromptFile || ''}
                      onChange={() => {}}
                      disabled
                      placeholder="Path to metadata prompt file"
                    />
                  </div>
                </div>

                {/* Parameters Section */}
                <div className="setting-group">
                  <h4 className="setting-group-title">Parameters</h4>
                  <div className="setting-row">
                    <label>Job Name / Label</label>
                    <input
                      type="text"
                      value={editedSettings.parameters?.label || ''}
                      onChange={(e) => handleSettingChange('parameters', 'label', e.target.value)}
                      placeholder="Optional label for this job"
                    />
                  </div>

                  <div className="setting-row">
                    <label>Process Mode</label>
                    <select
                      value={editedSettings.parameters?.processMode || 'relax'}
                      onChange={(e) => handleSettingChange('parameters', 'processMode', e.target.value)}
                    >
                      <option value="relax">Relax</option>
                      <option value="fast">Fast</option>
                      <option value="turbo">Turbo</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <label>Aspect Ratios</label>
                    <input
                      type="text"
                      value={editedSettings.parameters?.aspectRatios || ['1:1', '16:9', '9:16']}
                      onChange={(e) => handleSettingChange('parameters', 'aspectRatios', e.target.value)}
                      placeholder="Comma-separated aspect ratios"
                    />
                  </div>
                  <div className="setting-row">
                    <label>MJ Version</label>
                    <input
                      type="text"
                      value={editedSettings.parameters?.mjVersion || '6.1'}
                      onChange={(e) => handleSettingChange('parameters', 'mjVersion', e.target.value)}
                      placeholder="e.g., 6.1, niji, etc."
                    />
                  </div>
                  <div className="setting-row">
                    <label>OpenAI Model</label>
                    <input
                      type="text"
                      value={editedSettings.parameters?.openaiModel || ''}
                      onChange={(e) => handleSettingChange('parameters', 'openaiModel', e.target.value)}
                      placeholder="e.g., gpt-4o-mini"
                    />
                  </div>
                  <div className="setting-row">
                    <label>Enable Polling Timeout</label>
                    <Toggle
                      checked={editedSettings.parameters?.enablePollingTimeout || false}
                      onChange={(checked) => handleSettingChange('parameters', 'enablePollingTimeout', checked)}
                    />
                  </div>
                  {editedSettings.parameters?.enablePollingTimeout && (
                    <>
                      <div className="setting-row">
                        <label>Polling Timeout (minutes)</label>
                        <input
                          type="number"
                          value={editedSettings.parameters?.pollingTimeout || 0}
                          onChange={(e) => handleSettingChange('parameters', 'pollingTimeout', parseInt(e.target.value))}
                          min="0"
                        />
                      </div>
                      <div className="setting-row">
                        <label>Polling Interval (minutes)</label>
                        <input
                          type="number"
                          value={editedSettings.parameters?.pollingInterval || 1}
                          onChange={(e) => handleSettingChange('parameters', 'pollingInterval', parseInt(e.target.value))}
                          min="1"
                        />
                      </div>
                    </>
                  )}
                  <div className="setting-row">
                    <label>Random Keywords</label>
                    <Toggle
                      checked={editedSettings.parameters?.keywordRandom || false}
                      onChange={(checked) => handleSettingChange('parameters', 'keywordRandom', checked)}
                    />
                  </div>
                  <div className="setting-row">
                    <label>Generations count</label>
                    <input
                      type="number"
                      value={editedSettings.parameters?.count || 1}
                      onChange={(e) => handleSettingChange('parameters', 'count', parseInt(e.target.value))}
                      min="1"
                      max="2500"
                    />
                    <p className="setting-description">Number of generations (up to 2500 generations).</p>
                  </div>
                  <div className="setting-row">
                    <label htmlFor="gen-retry-attempts-modal">Generation Retry Attempts</label>
                    <input
                      id="gen-retry-attempts-modal"
                      type="number"
                      value={(editedSettings.parameters as any)?.generationRetryAttempts ?? 1}
                      onChange={(e) => handleSettingChange('parameters', 'generationRetryAttempts', Math.max(0, Math.min(5, parseInt(e.target.value))))}
                      min="0"
                      max="5"
                    />
                  </div>
                  <div className="setting-row">
                    <label htmlFor="gen-retry-backoff-modal">Retry Backoff (ms)</label>
                    <input
                      id="gen-retry-backoff-modal"
                      type="number"
                      value={(editedSettings.parameters as any)?.generationRetryBackoffMs ?? 0}
                      onChange={(e) => handleSettingChange('parameters', 'generationRetryBackoffMs', Math.max(0, Math.min(60000, parseInt(e.target.value))))}
                      min="0"
                      max="60000"
                      step="100"
                    />
                  </div>
                </div>

                {/* Processing Section */}
                <div className="setting-group">
                  <h4 className="setting-group-title">Image Processing</h4>
                  
                  {/* Background Removal */}
                  <div className="setting-row toggle-row">
                    <div>
                      <label>Remove Background</label>
                      <p className="setting-description">Remove background from generated images</p>
                    </div>
                    <Toggle
                      checked={editedSettings.processing?.removeBg || false}
                      onChange={handleToggleChange('processing', 'removeBg')}
                    />
                  </div>

                  {/* Remove.bg Size - conditional */}
                  {editedSettings.processing?.removeBg && (
                    <div className="setting-row">
                      <label>Remove.bg Size</label>
                      <select
                        value={editedSettings.processing?.removeBgSize || 'auto'}
                        onChange={(e) => handleSettingChange('processing', 'removeBgSize', e.target.value)}
                      >
                        <option value="auto">Auto</option>
                        <option value="preview">Preview</option>
                        <option value="full">Full</option>
                        <option value="50MP">50MP</option>
                      </select>
                    </div>
                  )}

                  {/* Image Conversion */}
                  <div className="setting-row toggle-row">
                    <div>
                      <label>Image Convert</label>
                      <p className="setting-description">Enable image conversion and processing</p>
                    </div>
                    <Toggle
                      checked={editedSettings.processing?.imageConvert || false}
                      onChange={handleToggleChange('processing', 'imageConvert')}
                    />
                  </div>

                  {/* Convert Format - conditional */}
                  {editedSettings.processing?.imageConvert && (
                    <div className="setting-row">
                      <label>Convert Format</label>
                      <select
                        value={editedSettings.processing?.convertToJpg ? 'jpg' : 'png'}
                        onChange={(e) => handleSettingChange('processing', 'convertToJpg', e.target.value === 'jpg')}
                      >
                        <option value="png">PNG</option>
                        <option value="jpg">JPG</option>
                      </select>
                    </div>
                  )}

                  {/* Quality Settings - conditional */}
                  {editedSettings.processing?.imageConvert && (
                    <>
                      <div className="setting-row">
                        <label>JPG Quality (1-100)</label>
                        <input
                          type="number"
                          value={editedSettings.processing?.jpgQuality || 100}
                          onChange={(e) => handleSettingChange('processing', 'jpgQuality', parseInt(e.target.value))}
                          min="1"
                          max="100"
                        />
                      </div>
                      <div className="setting-row">
                        <label>PNG Quality (1-100)</label>
                        <input
                          type="number"
                          value={editedSettings.processing?.pngQuality || 100}
                          onChange={(e) => handleSettingChange('processing', 'pngQuality', parseInt(e.target.value))}
                          min="1"
                          max="100"
                        />
                      </div>
                    </>
                  )}

                  {/* JPG Background - conditional */}
                  {editedSettings.processing?.removeBg && editedSettings.processing?.imageConvert && editedSettings.processing?.convertToJpg && (
                    <div className="setting-row">
                      <label>JPG Background Color</label>
                      <select
                        value={editedSettings.processing?.jpgBackground || 'white'}
                        onChange={(e) => handleSettingChange('processing', 'jpgBackground', e.target.value)}
                      >
                        <option value="white">White</option>
                        <option value="black">Black</option>
                        <option value="transparent">Transparent</option>
                      </select>
                    </div>
                  )}

                  {/* Trim Transparent Background - conditional */}
                  {editedSettings.processing?.removeBg && (
                  <div className="setting-row toggle-row">
                    <div>
                      <label>Trim Transparent Background</label>
                      <p className="setting-description">Remove transparent areas from images (PNG only)</p>
                    </div>
                    <Toggle
                      checked={editedSettings.processing?.trimTransparentBackground || false}
                      onChange={handleToggleChange('processing', 'trimTransparentBackground')}
                    />
                  </div>
                  )}

                  {/* Image Enhancement - independent feature */}
                  <div className="setting-row toggle-row">
                    <div>
                      <label>Image Enhancement</label>
                      <p className="setting-description">Apply sharpening and saturation effects</p>
                    </div>
                    <Toggle
                      checked={editedSettings.processing?.imageEnhancement || false}
                      onChange={handleToggleChange('processing', 'imageEnhancement')}
                    />
                  </div>

                  {/* Sharpening Control - conditional */}
                  {editedSettings.processing?.imageEnhancement && (
                    <div className="setting-row">
                      <label>Sharpening Intensity (0-10)</label>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.5"
                        value={editedSettings.processing?.sharpening || 5}
                        onChange={(e) => handleSettingChange('processing', 'sharpening', parseFloat(e.target.value))}
                        className="range-slider"
                      />
                      <div className="range-labels">
                        <span>0 (None)</span>
                        <span>{editedSettings.processing?.sharpening || 5}</span>
                        <span>10 (Maximum)</span>
                      </div>
                    </div>
                  )}

                  {/* Saturation Control - conditional */}
                  {editedSettings.processing?.imageEnhancement && (
                    <div className="setting-row">
                      <label>Saturation Level (0-2)</label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={editedSettings.processing?.saturation || 1.4}
                        onChange={(e) => handleSettingChange('processing', 'saturation', parseFloat(e.target.value))}
                        className="range-slider"
                      />
                      <div className="range-labels">
                        <span>0 (Grayscale)</span>
                        <span>{editedSettings.processing?.saturation || 1.4}</span>
                        <span>2 (Vibrant)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Section */}
                <div className="setting-group">
                  <h4 className="setting-group-title">AI Features</h4>
                  <div className="setting-row toggle-row">
                    <div>
                      <label>AI Quality Check</label>
                      <p className="setting-description">Use AI to check image quality</p>
                    </div>
                    <Toggle
                      checked={editedSettings.ai?.runQualityCheck || false}
                      onChange={handleToggleChange('ai', 'runQualityCheck')}
                    />
                  </div>
                  <div className="setting-row toggle-row">
                    <div>
                      <label>AI Metadata Generation</label>
                      <p className="setting-description">Generate metadata using AI</p>
                    </div>
                    <Toggle
                      checked={editedSettings.ai?.runMetadataGen || false}
                      onChange={handleToggleChange('ai', 'runMetadataGen')}
                    />
                  </div>
                </div>

                {/* Advanced Section */}
                <div className="setting-group">
                  <h4 className="setting-group-title">Advanced Settings</h4>
                  <div className="setting-row toggle-row">
                    <div>
                      <label>Debug Mode</label>
                      <p className="setting-description">Enable detailed logging and debugging</p>
                    </div>
                    <Toggle
                      checked={editedSettings.advanced?.debugMode || false}
                      onChange={handleToggleChange('advanced', 'debugMode')}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="settings-content">
                <div className="error-state">
                  <p>Unable to load job settings. This job may be corrupted or missing configuration.</p>
                  <p>Please check the error message below for more details.</p>
                </div>
              </div>
            )}

            {settingsSaveError && (
              <div className="settings-error">
                <span className="error-icon">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </span>
                {settingsSaveError}
              </div>
            )}

            <div className="settings-actions">
              <button onClick={handleSettingsCancel} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleSettingsSave} disabled={isSavingSettings || isLoadingSettings || !editedSettings} className="btn-save">
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={async () => {
          return await window.electronAPI.exportJobToExcel(jobId);
        }}
        title="Export Job"
        description="Export this job to Excel format with all details and settings."
      />
    </div>
  );
};

export default SingleJobView;
