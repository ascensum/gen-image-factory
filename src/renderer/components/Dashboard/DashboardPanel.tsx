import React, { useState, useEffect } from 'react';
import JobControls from './JobControls';
import ProgressIndicator from './ProgressIndicator';
import LogViewer from './LogViewer';
import JobHistory from './JobHistory';
import ImageGallery from './ImageGallery';
import ForceStopButton from './ForceStopButton';
import ExportDialog from '../Common/ExportDialog';
// Failed images review is a separate top-level view now

const HeaderMenu: React.FC<{
  onOpenFailedImagesReview?: () => void;
  onOpenSettings?: () => void;
  onOpenJobs?: () => void;
}> = ({ onOpenFailedImagesReview, onOpenSettings, onOpenJobs }) => {
  const [open, setOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const PANEL_WIDTH = 320; // px (~20rem)
  return (
    <div className="relative">
      <button
        aria-label="Open menu"
        title="Menu"
        ref={buttonRef}
        onClick={() => {
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) {
            const top = rect.bottom + 8;
            const idealLeft = rect.right - PANEL_WIDTH;
            const maxLeft = window.innerWidth - PANEL_WIDTH - 8;
            const left = Math.max(8, Math.min(idealLeft, maxLeft));
            setMenuPos({ top, left });
          }
          setOpen((v) => !v);
        }}
        className="p-2 rounded-md hover:bg-gray-100 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {open && (
        <div
          className="fixed min-w-[20rem] bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden"
          style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px`, width: `${PANEL_WIDTH}px` }}
        >
          <div className="py-1">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Navigate</div>
            <button
              onClick={() => {
                setOpen(false);
                onOpenFailedImagesReview && onOpenFailedImagesReview();
              }}
              className="w-full py-2 text-sm text-gray-700 hover:bg-gray-50 grid place-items-center grid-flow-col auto-cols-max gap-2"
            >
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              <span>Failed Images Review</span>
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onOpenSettings && onOpenSettings();
              }}
              className="w-full py-2 text-sm text-gray-700 hover:bg-gray-50 grid place-items-center grid-flow-col auto-cols-max gap-2"
            >
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              <span>Settings</span>
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onOpenJobs && onOpenJobs();
              }}
              className="w-full py-2 text-sm text-gray-700 hover:bg-gray-50 grid place-items-center grid-flow-col auto-cols-max gap-2"
            >
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h13M9 7h13M5 7h.01M5 17h.01M5 12h.01" /></svg>
              <span>Job Management</span>
            </button>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
};

export interface JobStatus {
  state: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';
  currentJob?: JobExecution;
  progress: number;
  currentStep: number;
  totalSteps: number;
  startTime?: Date;
  estimatedTimeRemaining?: number;
}

export interface JobExecution {
  id: string;
  configurationId: number;
  configurationName: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  totalImages: number;
  successfulImages: number;
  failedImages: number;
  errorMessage?: string | null;
}

export interface JobConfiguration {
  id: string;
  name: string;
  description?: string;
  parameters: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobStatistics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageExecutionTime: number;
  totalImagesGenerated: number;
  successRate: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
  // New structured logging fields
  stepName?: string;
  subStep?: string;
  imageIndex?: number | null;
  durationMs?: number | null;
  errorCode?: string | null;
  metadata?: Record<string, any>;
  progress?: number;
  totalImages?: number;
  successfulImages?: number;
  failedImages?: number;
}

export interface GeneratedImage {
  id: string;
  executionId: string;
  generationPrompt: string;
  seed?: number | null;
  qcStatus: 'pending' | 'approved' | 'rejected' | 'failed' | 'retry_pending';
  qcReason?: string | null;
  finalImagePath?: string | null;
  metadata?: {
    title?: string;
    description?: string;
    tags?: string[];
    prompt?: string;
    [key: string]: any;
  };
  processingSettings?: {
    imageEnhancement?: boolean;
    sharpening?: number;
    saturation?: number;
    imageConvert?: boolean;
    convertToJpg?: boolean;
    jpgQuality?: number;
    pngQuality?: number;
    removeBg?: boolean;
    removeBgSize?: string;
    trimTransparentBackground?: boolean;
    jpgBackground?: string;
    [key: string]: any;
  };
  createdAt: Date;
}

interface DashboardPanelProps {
  onBack?: () => void;
  onOpenFailedImagesReview?: () => void;
  onOpenSettings?: () => void;
  onOpenJobs?: () => void;
  onOpenSingleJobView?: (jobId: string) => void;
}

const DashboardPanel: React.FC<DashboardPanelProps> = ({ onBack, onOpenFailedImagesReview, onOpenSettings, onOpenJobs, onOpenSingleJobView }) => {
  const [jobStatus, setJobStatus] = useState<JobStatus>({
    state: 'idle',
    progress: 0,
    currentStep: 0,
    totalSteps: 0
  });
  const [jobHistory, setJobHistory] = useState<JobExecution[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statistics, setStatistics] = useState<JobStatistics>({
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    averageExecutionTime: 0,
    totalImagesGenerated: 0,
    successRate: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [jobConfiguration, setJobConfiguration] = useState<any>(null);
  // Removed local failed images review state; navigation handled at App level

  // Poll for job status updates
  useEffect(() => {
    const pollJobStatus = async () => {
      try {
        const status = await window.electronAPI.jobManagement.getJobStatus();
        setJobStatus(status);
      } catch (error) {
        console.error('Failed to get job status:', error);
      }
    };

    const interval = setInterval(pollJobStatus, 500);
    pollJobStatus(); // Initial call

    return () => clearInterval(interval);
  }, []);

  // Load job configuration for dynamic progress steps
  const loadJobConfiguration = async () => {
    try {
      const configResponse = await window.electronAPI.jobManagement.getConfiguration();
      if (configResponse?.success) {
        setJobConfiguration(configResponse.settings);
      }
    } catch (error) {
      console.error('Failed to load job configuration:', error);
    }
  };

  // Load initial data
  useEffect(() => {
    loadJobHistory();
    loadStatistics();
    loadGeneratedImages();
    loadLogs();
    loadJobConfiguration();
  }, []);

  // Track last completion time for brief post-run visibility
  const lastCompletionRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (jobStatus.state === 'completed') {
      lastCompletionRef.current = Date.now();
    }
    if (jobStatus.state === 'running') {
      lastCompletionRef.current = null;
    }
    // Attempt an immediate refresh when state changes
    loadLogs();
  }, [jobStatus.state]);

  // Poll logs periodically only while running or briefly after completion
  useEffect(() => {
    const interval = setInterval(() => {
      const withinGrace =
        lastCompletionRef.current !== null && Date.now() - lastCompletionRef.current < 60_000;
      if (jobStatus.state === 'running' || withinGrace) {
        loadLogs();
      } else {
        // Clear logs when outside grace period
        setLogs([]);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobStatus.state]);

  // Refresh data when job status changes to completed
  useEffect(() => {
    if (jobStatus.state === 'completed') {
      console.log('🔄 Job completed, refreshing data...');
      // Immediate refresh for job history and statistics
      loadJobHistory();
      loadStatistics();
      
      // Delay refresh for generated images to ensure metadata generation is complete
      setTimeout(() => {
        console.log('🔄 Delayed refresh of generated images to ensure metadata is complete...');
        loadGeneratedImages();
      }, 500); // 500ms delay to ensure backend metadata generation completes
    }
  }, [jobStatus.state]);

  const loadJobHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const jobs = await window.electronAPI.jobManagement.getJobHistory();
      console.log('Job history loaded:', jobs);
      // Ensure jobs is always an array
      if (jobs && Array.isArray(jobs)) {
        setJobHistory(jobs);
      } else {
        console.warn('getJobHistory returned non-array:', jobs);
        setJobHistory([]);
      }
    } catch (error) {
      console.error('Failed to load job history:', error);
      setError('Failed to load job history');
      setJobHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await window.electronAPI.jobManagement.getJobStatistics();
      console.log('Statistics loaded:', stats);
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load statistics:', error);
      // Don't set error for statistics as it's not critical
    }
  };

  const loadGeneratedImages = async () => {
    try {
      const images = await window.electronAPI.jobManagement.getAllGeneratedImages();
      console.log('Generated images loaded:', images);
      // Ensure images is always an array
      if (images && Array.isArray(images)) {
        // Filter to show only approved images on main dashboard
        const approvedImages = images.filter(img => img.qcStatus === 'approved');
        setGeneratedImages(approvedImages);
        console.log('🔍 Showing approved images:', approvedImages.length, 'out of', images.length, 'total');
      } else {
        console.warn('getAllGeneratedImages returned non-array:', images);
        setGeneratedImages([]);
      }
    } catch (error) {
      console.error('Failed to load generated images:', error);
      setGeneratedImages([]);
      // Don't set error for images as it's not critical
    }
  };

  const loadLogs = async () => {
    try {
      const withinGrace =
        lastCompletionRef.current !== null && Date.now() - lastCompletionRef.current < 60_000;
      if (!(jobStatus.state === 'running' || withinGrace)) {
        setLogs([]);
        return;
      }
      // Use debug mode if enabled in settings
      let mode = 'standard';
      try {
        const settingsRes = await window.electronAPI.getSettings?.();
        if (settingsRes?.settings?.advanced?.debugMode) {
          mode = 'debug';
        }
      } catch {}
      const jobLogs = await window.electronAPI.jobManagement.getJobLogs(mode);
      console.log('Logs loaded:', jobLogs);
      if (jobLogs && Array.isArray(jobLogs)) {
        // Replace logs instead of appending to prevent duplication
        // Backend already maintains the log buffer, so we just use what it gives us
        setLogs(jobLogs);
      } else {
        console.warn('getJobLogs returned non-array:', jobLogs);
        // Do not clear existing logs on malformed response
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      setLogs([]);
    }
  };

  const handleStartJob = async () => {
    try {
      console.log('🚀 handleStartJob called - starting job execution...');
      setIsLoading(true);
      setError(null);
      
      console.log('📋 Getting current configuration...');
      // Get current configuration
      const configResponse = await window.electronAPI.jobManagement.getConfiguration();
      console.log('✅ Configuration response loaded:', configResponse);
      
      // Extract the actual settings from the response
      if (!configResponse.success || !configResponse.settings) {
        throw new Error('Failed to load configuration or invalid response structure');
      }
      
      const config = configResponse.settings;
      console.log('✅ Configuration extracted:', config);
      
      console.log('🎯 Starting the job with config...');
      // Start the job
      const result = await window.electronAPI.jobManagement.jobStart(config);
      console.log('✅ Job start result:', result);
      
      console.log('🔄 Reloading data...');
      // Reload data
      await Promise.all([
        loadJobHistory(),
        loadStatistics()
      ]);
      console.log('✅ Data reloaded successfully');
      
    } catch (error) {
      console.error('❌ Failed to start job:', error);
      setError('Failed to start job');
    } finally {
      console.log('🏁 handleStartJob completed, setting loading to false');
      setIsLoading(false);
    }
  };

  const handleStopJob = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await window.electronAPI.jobManagement.jobStop();
      
      // Reload data
      await Promise.all([
        loadJobHistory(),
        loadStatistics()
      ]);
    } catch (error) {
      setError('Failed to stop job');
      console.error('Failed to stop job:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceStop = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await window.electronAPI.jobManagement.jobForceStop();
      
      // Reload data
      await Promise.all([
        loadJobHistory(),
        loadStatistics()
      ]);
    } catch (error) {
      setError('Failed to force stop job');
      console.error('Failed to force stop job:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJobAction = async (action: string, jobId: string) => {
    try {
      setError(null);
      
      switch (action) {
        case 'view':
          onOpenSingleJobView && onOpenSingleJobView(jobId);
          break;
        case 'export':
          setExportJobId(jobId);
          setShowExportDialog(true);
          break;
        case 'delete':
          await window.electronAPI.jobManagement.deleteJobExecution(jobId);
          await loadJobHistory();
          await loadStatistics();
          break;
        case 'rerun':
          console.log('🚨 DEBUG RERUN: DashboardPanel rerun case triggered for jobId:', jobId);
          console.log('🚨 DEBUG RERUN: Timestamp:', new Date().toISOString());
          console.log('🚨 DEBUG RERUN: Stack trace:', new Error().stack);
          
          try {
            // Use the same rerun logic as Job Management to prevent duplicate jobs
            console.log('🚨 DEBUG RERUN: About to call rerunJobExecution...');
            const rerunResult = await window.electronAPI.jobManagement.rerunJobExecution(jobId);
            console.log('🚨 DEBUG RERUN: rerunJobExecution result:', rerunResult);
            
            if (rerunResult && rerunResult.success) {
              console.log('🚨 DEBUG RERUN: Rerun successful, waiting for job registration...');
              // Add a small delay to ensure the job is fully registered, then refresh UI
              setTimeout(async () => {
                console.log('🔄 Refreshing UI after rerun...');
                await loadJobHistory();
                await loadStatistics();
              }, 1000);
            } else {
              console.error('🚨 DEBUG RERUN: Rerun failed:', rerunResult);
              setError(`Failed to rerun job: ${rerunResult?.error || 'Unknown error'}`);
            }
          } catch (error) {
            console.error('🚨 DEBUG RERUN: Exception during rerun:', error);
            setError(`Failed to rerun job: ${error.message}`);
          }
          break;
      }
    } catch (error) {
      setError(`Failed to ${action} job`);
      console.error(`Failed to ${action} job:`, error);
    }
  };

  const handleImageAction = async (action: string, imageId: string, data?: any) => {
    try {
      setError(null);
      
      switch (action) {
        case 'delete':
          await window.electronAPI.jobManagement.deleteGeneratedImage(imageId);
          await loadGeneratedImages();
          break;
        case 'view':
          // Handle view action
          break;
        case 'update-qc-status':
          if (data) {
            await window.electronAPI.jobManagement.updateQCStatus(imageId, data);
            await loadGeneratedImages();
          }
          break;
        // Note: Review actions (approve/reject) are handled in the separate Failed Images Review page
      }
    } catch (error) {
      setError(`Failed to ${action} image`);
      console.error(`Failed to ${action} image:`, error);
    }
  };

  const handleBulkAction = async (action: string, imageIds: string[]) => {
    try {
      setError(null);
      if (imageIds.length === 0) return;

      switch (action) {
        case 'delete':
          await window.electronAPI.jobManagement.bulkDeleteImages(imageIds);
          break;
        // Note: Review actions (approve/reject) are handled in the separate Failed Images Review page
      }
      await loadGeneratedImages();
    } catch (error) {
      setError(`Failed to bulk ${action} images`);
      console.error(`Failed to bulk ${action} images:`, error);
    }
  };

  // Note: QC status changes are handled in the separate Failed Images Review page

  return (
    <div className="dashboard-panel min-h-screen bg-gray-50">
      {/* Dashboard Header - compact with ordered elements */}
      <div className="bg-white border-b border-gray-200 h-14 flex items-center px-6">
        <div className="flex items-center justify-between w-full">
          {/* Left: Close, Menu, Start/Stop/Force */}
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
            <HeaderMenu onOpenFailedImagesReview={onOpenFailedImagesReview} onOpenSettings={onOpenSettings} onOpenJobs={onOpenJobs} />
            <JobControls
              jobStatus={jobStatus.state}
              onStartJob={handleStartJob}
              onStopJob={handleStopJob}
              onRefresh={() => {
                loadJobHistory();
                loadStatistics();
                loadGeneratedImages();
              }}
              isLoading={isLoading}
            />
            <ForceStopButton
              onForceStop={handleForceStop}
              isLoading={isLoading}
            />
          </div>
          {/* Right: compact stats only */}
          <div className="flex items-center space-x-6">
            <div className="text-sm whitespace-nowrap"><span className="text-gray-600">Total Jobs:</span><span className="ml-1 font-semibold text-blue-600">{statistics.totalJobs}</span></div>
            <div className="text-sm whitespace-nowrap"><span className="text-gray-600">Success Rate:</span><span className="ml-1 font-semibold text-green-600">{statistics.successRate}%</span></div>
            <div className="text-sm whitespace-nowrap"><span className="text-gray-600">Images Generated:</span><span className="ml-1 font-semibold text-purple-600">{statistics.totalImagesGenerated}</span></div>
            <div className="text-sm whitespace-nowrap"><span className="text-gray-600">Avg Duration:</span><span className="ml-1 font-semibold text-orange-600">{statistics.averageExecutionTime}s</span></div>
          </div>
        </div>
      </div>

      {/* Main Content - Two Panel Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel - Job History (40% width) - Takes full vertical space down to Image Gallery */}
        <div className="w-2/5 bg-white border-r border-gray-200 p-6 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <JobHistory
              jobs={jobHistory}
              onJobAction={handleJobAction}
              onDeleteJob={(jobId) => handleJobAction('delete', jobId)}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Right Panel - Current Job Status (60% width) - Reduced height to give space to Image Gallery */}
        <div className="w-3/5 bg-white p-6 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Job</h2>
          
          {/* Progress Indicator */}
          <div className="mb-4 flex-shrink-0">
            <ProgressIndicator
              jobStatus={jobStatus}
              isLoading={isLoading}
              jobConfiguration={jobConfiguration}
            />
          </div>
          
          {/* Real-time Logs - Allow component to control scrolling; fill available space */}
          <div className="flex-1 min-h-0">
            <LogViewer
              logs={logs}
              jobStatus={jobStatus.state}
              onRefresh={loadLogs}
            />
          </div>
        </div>
      </div>

      {/* Bottom Panel - Generated Images Gallery (Full width) - Now with more vertical space and proper scrolling */}
      <div className="bg-white border-t border-gray-200 p-6 flex-1 flex flex-col min-h-0">
        {/* Image Gallery with proper scrolling - Takes more vertical space */}
        <div className="h-96 overflow-y-auto min-h-0">
          {/* Scroll indicator - shows when content overflows */}
          {generatedImages.length > 20 && (
            <div className="text-xs text-gray-500 text-center py-2 border-b border-gray-200 mb-2">
              📜 Image Gallery area - scroll when content overflows ({generatedImages.length} total images)
            </div>
          )}
                        <ImageGallery
                images={generatedImages}
                onImageAction={handleImageAction}
                onBulkAction={handleBulkAction}
                isLoading={isLoading}
                jobStatus={jobStatus.state}
              />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Job Constraint Message */}
      {jobStatus.state === 'running' && (
        <div className="fixed bottom-4 left-4 bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-800">
                Only one job can run at a time. Please wait for the current job to complete.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Failed Images Review is now a separate page, navigated from App */}

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => {
          setShowExportDialog(false);
          setExportJobId(null);
        }}
        onExport={async () => {
          if (exportJobId) {
            return await window.electronAPI.jobManagement.exportJobToExcel(exportJobId);
          }
          return { success: false, error: 'No job ID specified' };
        }}
        title="Export Job"
        description="Export this job to Excel format with all details and settings."
      />
    </div>
  );
};

export default DashboardPanel;
