import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { JobExecution, GeneratedImage } from '../../../types/job';
import './SingleJobView.css';

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
  const [logs, setLogs] = useState<string[]>([]);
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
  
  // Settings editing state
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editedSettings, setEditedSettings] = useState({
    model: 'Stable Diffusion XL',
    version: '1.0.0',
    resolution: '1024x1024',
    format: 'PNG',
    quality: 'High',
    background: 'Clean White',
    lighting: 'Studio',
    style: 'Professional Product',
    autoEnhance: true,
    noiseReduction: 'Medium',
    sharpening: 'Low'
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);

  useEffect(() => {
    loadJobData();
  }, [jobId]);

  const loadJobData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load job details
      const jobResult = await window.electronAPI.jobManagement.getJobExecution(jobId);
      if (jobResult.success) {
        setJob(jobResult.execution);
        setEditedLabel(jobResult.execution.label || `Job ${jobResult.execution.id}`);
      } else {
        setError(jobResult.error || 'Failed to load job details');
      }
      
      // Load job images
      const imagesResult = await window.electronAPI.generatedImages.getGeneratedImagesByExecution(jobId);
      if (imagesResult.success) {
        setImages(imagesResult.images || []);
      }
      
      // Load job logs (placeholder - implement when available)
      setLogs(['Job started successfully', 'Processing images...', 'Job completed']);
      
    } catch (error) {
      console.error('Error loading job data:', error);
      setError('Failed to load job data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);
  
  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);
  
  const handleExport = useCallback(() => {
    onExport(jobId);
  }, [onExport, jobId]);
  
  const handleRerun = useCallback(() => {
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
      const result = await window.electronAPI.jobManagement.renameJobExecution(job.id, editedLabel.trim());
      if (result.success) {
        // Update local state
        setJob(prevJob => prevJob ? { ...prevJob, label: editedLabel.trim() } : null);
        setIsEditingLabel(false);
        // Show success feedback (could be a toast notification)
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
    setEditedLabel(job?.label || `Job ${job?.id}`);
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
    if (editedLabel !== (job?.label || `Job ${job?.id}`)) {
      handleLabelSave();
    }
  }, [editedLabel, job, handleLabelSave]);

  const handleLabelChange = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    setEditedLabel(e.currentTarget.textContent || '');
  }, []);

  // Settings editing handlers
  const handleSettingsEdit = useCallback(() => {
    setIsEditingSettings(true);
    setSettingsSaveError(null);
    // Initialize with current job settings if available
    if (job) {
      // TODO: Load actual job configuration settings from backend
      // For now, use default values
    }
  }, [job]);

  const handleSettingsSave = useCallback(async () => {
    setIsSavingSettings(true);
    setSettingsSaveError(null);
    
    try {
      // TODO: Implement actual settings save to backend
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update local state
      setIsEditingSettings(false);
      console.log('Settings updated successfully');
      
      // TODO: Refresh job data to show updated settings
      
    } catch (error) {
      console.error('Error saving settings:', error);
      setSettingsSaveError('Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  }, []);

  const handleSettingsCancel = useCallback(() => {
    setIsEditingSettings(false);
    setSettingsSaveError(null);
    // Reset to original values
    setEditedSettings({
      model: 'Stable Diffusion XL',
      version: '1.0.0',
      resolution: '1024x1024',
      format: 'PNG',
      quality: 'High',
      background: 'Clean White',
      lighting: 'Studio',
      style: 'Professional Product',
      autoEnhance: true,
      noiseReduction: 'Medium',
      sharpening: 'Low'
    });
  }, []);

  const handleSettingChange = useCallback((key: string, value: string | boolean) => {
    setEditedSettings(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'status-complete';
      case 'failed': return 'status-failed';
      case 'running': return 'status-processing';
      case 'pending': return 'status-pending';
      default: return 'status-pending';
    }
  };

  const filteredImages = useMemo(() => {
    if (imageFilter === 'all') return images;
    return images.filter(img => img.qcStatus === imageFilter);
  }, [images, imageFilter]);

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
          <div className="error-icon">⚠️</div>
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
        <div 
          className={`job-title-editable ${isEditingLabel ? 'editing' : ''}`}
          contentEditable={isEditingLabel}
          onBlur={handleLabelBlur}
          onKeyDown={handleLabelKeyDown}
          onInput={handleLabelChange}
          ref={labelInputRef}
          onClick={!isEditingLabel ? handleLabelEdit : undefined}
          title={!isEditingLabel ? "Click to edit job label" : "Press Enter to save, Escape to cancel"}
        >
          {isEditingLabel ? editedLabel : (job.label || `Job ${job.id}`)}
        </div>
        
        {/* Label editing controls */}
        {isEditingLabel && (
          <div className="label-edit-controls">
            <button 
              onClick={handleLabelSave}
              disabled={isSavingLabel}
              className="label-save-btn"
              title="Save label"
            >
              {isSavingLabel ? 'Saving...' : 'Save'}
            </button>
            <button 
              onClick={handleLabelCancel}
              disabled={isSavingLabel}
              className="label-cancel-btn"
              title="Cancel editing"
            >
              Cancel
            </button>
          </div>
        )}
        
        {/* Label save error */}
        {labelSaveError && (
          <div className="label-error">
            {labelSaveError}
          </div>
        )}
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
        <button 
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => handleTabChange('logs')}
          data-tab="logs"
        >
          Logs
        </button>
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
                  <span className={`status-badge ${getStatusColor(job.status)}`}>
                    {job.status === 'completed' ? '✓ Completed' : 
                     job.status === 'processing' ? '⟳ Processing' :
                     job.status === 'failed' ? '⚠ Failed' : '⏳ Pending'}
                  </span>
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
              </div>
              <div className="stats-card">
                <div className="stats-label">Failed</div>
                <div className="stats-value failed">{job.failedImages || 0}</div>
              </div>
            </div>

            {/* Settings */}
            <div className="settings-section">
              <div className="settings-header">
                <h2 className="section-title">Settings</h2>
                <button 
                  className="edit-button"
                  onClick={handleSettingsEdit}
                  title="Edit job settings"
                >
                  Edit
                </button>
              </div>
              <div className="settings-content">
                <div className="setting-group">
                  <h3>Model Configuration</h3>
                  <div className="setting-details">
                    <div>• Model: Stable Diffusion XL</div>
                    <div>• Version: 1.0.0</div>
                  </div>
                </div>
                <div className="setting-group">
                  <h3>Image Settings</h3>
                  <div className="setting-details">
                    <div>• Resolution: 1024x1024</div>
                    <div>• Format: PNG</div>
                    <div>• Quality: High</div>
                  </div>
                </div>
                <div className="setting-group">
                  <h3>Style Parameters</h3>
                  <div className="setting-details">
                    <div>• Background: Clean White</div>
                    <div>• Lighting: Studio</div>
                    <div>• Style: Professional Product</div>
                  </div>
                </div>
                <div className="setting-group">
                  <h3>Processing Options</h3>
                  <div className="setting-details">
                    <div>• Auto-enhance: Enabled</div>
                    <div>• Noise reduction: Medium</div>
                    <div>• Sharpening: Low</div>
                  </div>
                </div>
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
                  onChange={(e) => setImageFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Images</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
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
                      <div className="image-placeholder">
                        <span>IMG{image.id}</span>
                      </div>
                      <div className="image-info">
                        <span className="image-id">IMG{image.id}</span>
                        <span className={`image-status ${getStatusColor(image.qcStatus)}`}>
                          {image.qcStatus === 'approved' ? '✓' : image.qcStatus === 'failed' ? '⚠️' : '⏳'}
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
                        <div className="thumbnail">IMG{image.id}</div>
                      </td>
                      <td>IMG{image.id}</td>
                      <td>
                        <span className={`image-status ${getStatusColor(image.qcStatus)}`}>
                          {image.qcStatus === 'approved' ? '✓ Complete' : image.qcStatus === 'failed' ? '⚠️ Failed' : '⏳ Pending'}
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

        {/* Logs Content */}
        <div 
          id="logs" 
          className={`tab-content ${activeTab === 'logs' ? 'active' : ''}`}
        >
          <div className="logs-content">
            <div className="logs-timeline">
              {logs.map((log, index) => (
                <div key={index} className="log-entry">
                  <div className="log-dot"></div>
                  <div className="log-content">
                    <div className="log-header">
                      <div className="log-title">Log Entry {index + 1}</div>
                      <div className="log-time">{formatDate(new Date().toISOString())}</div>
                    </div>
                    <div className="log-message">{log}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
            <div className="modal-header">
              <h3>Edit Job Settings</h3>
            </div>
            <div className="modal-body">
              <div className="settings-form">
                <div className="setting-group">
                  <h4>Model Configuration</h4>
                  <div className="setting-row">
                    <label>Model:</label>
                    <input
                      type="text"
                      value={editedSettings.model}
                      onChange={(e) => handleSettingChange('model', e.target.value)}
                    />
                  </div>
                  <div className="setting-row">
                    <label>Version:</label>
                    <input
                      type="text"
                      value={editedSettings.version}
                      onChange={(e) => handleSettingChange('version', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="setting-group">
                  <h4>Image Settings</h4>
                  <div className="setting-row">
                    <label>Resolution:</label>
                    <select
                      value={editedSettings.resolution}
                      onChange={(e) => handleSettingChange('resolution', e.target.value)}
                    >
                      <option value="512x512">512x512</option>
                      <option value="768x768">768x768</option>
                      <option value="1024x1024">1024x1024</option>
                      <option value="1280x1280">1280x1280</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <label>Format:</label>
                    <select
                      value={editedSettings.format}
                      onChange={(e) => handleSettingChange('format', e.target.value)}
                    >
                      <option value="PNG">PNG</option>
                      <option value="JPEG">JPEG</option>
                      <option value="WEBP">WEBP</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <label>Quality:</label>
                    <select
                      value={editedSettings.quality}
                      onChange={(e) => handleSettingChange('quality', e.target.value)}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>
                
                <div className="setting-group">
                  <h4>Style Parameters</h4>
                  <div className="setting-row">
                    <label>Background:</label>
                    <input
                      type="text"
                      value={editedSettings.background}
                      onChange={(e) => handleSettingChange('background', e.target.value)}
                    />
                  </div>
                  <div className="setting-row">
                    <label>Lighting:</label>
                    <input
                      type="text"
                      value={editedSettings.lighting}
                      onChange={(e) => handleSettingChange('lighting', e.target.value)}
                    />
                  </div>
                  <div className="setting-row">
                    <label>Style:</label>
                    <input
                      type="text"
                      value={editedSettings.style}
                      onChange={(e) => handleSettingChange('style', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="setting-group">
                  <h4>Processing Options</h4>
                  <div className="setting-row">
                    <label>Auto-enhance:</label>
                    <input
                      type="checkbox"
                      checked={editedSettings.autoEnhance}
                      onChange={(e) => handleSettingChange('autoEnhance', e.target.checked)}
                    />
                  </div>
                  <div className="setting-row">
                    <label>Noise reduction:</label>
                    <select
                      value={editedSettings.noiseReduction}
                      onChange={(e) => handleSettingChange('noiseReduction', e.target.value)}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <label>Sharpening:</label>
                    <select
                      value={editedSettings.sharpening}
                      onChange={(e) => handleSettingChange('sharpening', e.target.value)}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Settings save error */}
              {settingsSaveError && (
                <div className="settings-error">
                  {settingsSaveError}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={handleSettingsCancel} className="btn-cancel">
                Cancel
              </button>
              <button 
                onClick={handleSettingsSave} 
                disabled={isSavingSettings}
                className="btn-save"
              >
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleJobView;
