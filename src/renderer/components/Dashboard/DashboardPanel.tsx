import React, { useState, useEffect } from 'react';
import JobControls from './JobControls';
import ProgressIndicator from './ProgressIndicator';
import LogViewer from './LogViewer';
import JobHistory from './JobHistory';
import ImageGallery from './ImageGallery';
import QuickActions from './QuickActions';
import ForceStopButton from './ForceStopButton';

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
}

export interface GeneratedImage {
  id: string;
  executionId: string;
  generationPrompt: string;
  seed?: number | null;
  qcStatus: 'pending' | 'approved' | 'rejected';
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
}

const DashboardPanel: React.FC<DashboardPanelProps> = ({ onBack }) => {
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

  // Poll for job status updates
  useEffect(() => {
    const pollJobStatus = async () => {
      try {
        const status = await window.electronAPI.getJobStatus();
        setJobStatus(status);
      } catch (error) {
        console.error('Failed to get job status:', error);
      }
    };

    const interval = setInterval(pollJobStatus, 500);
    pollJobStatus(); // Initial call

    return () => clearInterval(interval);
  }, []);

  // Load initial data
  useEffect(() => {
    loadJobHistory();
    loadStatistics();
    loadGeneratedImages();
    loadLogs();
  }, []);

  // Load logs when job status changes to running
  useEffect(() => {
    if (jobStatus.state === 'running') {
      loadLogs();
    }
  }, [jobStatus.state]);

  const loadJobHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const jobs = await window.electronAPI.getJobHistory();
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
      const stats = await window.electronAPI.getJobStatistics();
      console.log('Statistics loaded:', stats);
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load statistics:', error);
      // Don't set error for statistics as it's not critical
    }
  };

  const loadGeneratedImages = async () => {
    try {
      const images = await window.electronAPI.getAllGeneratedImages();
      console.log('Generated images loaded:', images);
      // Ensure images is always an array
      if (images && Array.isArray(images)) {
        setGeneratedImages(images);
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
      if (jobStatus.state === 'running') {
        const jobLogs = await window.electronAPI.getJobLogs('standard');
        console.log('Logs loaded:', jobLogs);
        // Ensure logs is always an array
        if (jobLogs && Array.isArray(jobLogs)) {
          setLogs(jobLogs);
        } else {
          console.warn('getJobLogs returned non-array:', jobLogs);
          setLogs([]);
        }
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      setLogs([]);
      // Don't set error for logs as it's not critical
    }
  };

  const handleStartJob = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get current configuration
      const config = await window.electronAPI.getConfiguration();
      
      // Start the job
      await window.electronAPI.jobStart(config);
      
      // Reload data
      await Promise.all([
        loadJobHistory(),
        loadStatistics()
      ]);
    } catch (error) {
      setError('Failed to start job');
      console.error('Failed to start job:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopJob = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await window.electronAPI.jobStop();
      
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
      
      await window.electronAPI.jobForceStop();
      
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
          // Handle view action
          break;
        case 'export':
          await window.electronAPI.exportJobToExcel(jobId);
          break;
        case 'delete':
          await window.electronAPI.deleteJobExecution(jobId);
          await loadJobHistory();
          await loadStatistics();
          break;
        case 'rerun':
          const job = jobHistory.find(j => j.id === jobId);
          if (job) {
            await window.electronAPI.jobStart(job.configuration.parameters);
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
        case 'approve':
          await window.electronAPI.manualApproveImage(imageId);
          await loadGeneratedImages();
          break;
        case 'reject':
          await window.electronAPI.manualRejectImage(imageId);
          await loadGeneratedImages();
          break;
        case 'delete':
          await window.electronAPI.deleteGeneratedImage(imageId);
          await loadGeneratedImages();
          break;
        case 'updateQC':
          if (data && data.status) {
            await window.electronAPI.updateQCStatus(imageId, data.status);
            await loadGeneratedImages();
          }
          break;
        case 'view':
          // Handle view action
          break;
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
        case 'approve':
          await window.electronAPI.bulkApproveImages(imageIds);
          break;
        case 'reject':
          await window.electronAPI.bulkRejectImages(imageIds);
          break;
        case 'delete':
          await window.electronAPI.bulkDeleteImages(imageIds);
          break;
      }
      await loadGeneratedImages();
    } catch (error) {
      setError(`Failed to bulk ${action} images`);
      console.error(`Failed to bulk ${action} images:`, error);
    }
  };

  const handleQCStatusChange = async (imageId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    try {
      setError(null);
      await window.electronAPI.updateQCStatus(imageId, newStatus);
      await loadGeneratedImages();
    } catch (error) {
      setError(`Failed to update QC status for image ${imageId}`);
      console.error(`Failed to update QC status for image ${imageId}:`, error);
    }
  };

  return (
    <div className="dashboard-panel min-h-screen bg-gray-50">
      {/* Dashboard Header - Fixed height 48px */}
      <div className="bg-white border-b border-gray-200 h-12 flex items-center px-6">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                jobStatus.state === 'idle' ? 'bg-green-100 text-green-800' :
                jobStatus.state === 'starting' ? 'bg-blue-100 text-blue-800' :
                jobStatus.state === 'running' ? 'bg-blue-100 text-blue-800' :
                jobStatus.state === 'completed' ? 'bg-green-100 text-green-800' :
                jobStatus.state === 'failed' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {jobStatus.state === 'idle' && 'Ready'}
                {jobStatus.state === 'starting' && 'Starting'}
                {jobStatus.state === 'running' && 'Running'}
                {jobStatus.state === 'completed' && 'Completed'}
                {jobStatus.state === 'failed' && 'Failed'}
                {jobStatus.state === 'stopped' && 'Stopped'}
              </span>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Back to main view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <JobControls
              jobStatus={jobStatus.state}
              onStartJob={handleStartJob}
              onStopJob={handleStopJob}
              isLoading={isLoading}
            />
            <ForceStopButton
              onForceStop={handleForceStop}
              isLoading={isLoading}
            />
          </div>
          
          {/* Job Statistics Display */}
          <div className="flex items-center space-x-6 ml-8">
            <div className="text-sm">
              <span className="text-gray-600">Total Jobs:</span>
              <span className="ml-2 font-semibold text-blue-600">{statistics.totalJobs}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Success Rate:</span>
              <span className="ml-2 font-semibold text-green-600">{statistics.successRate}%</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Images Generated:</span>
              <span className="ml-2 font-semibold text-purple-600">{statistics.totalImagesGenerated}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Avg Duration:</span>
              <span className="ml-2 font-semibold text-orange-600">{statistics.averageExecutionTime}s</span>
            </div>
          </div>
          

          
          {/* Secure Mode Indicator */}
          <div className="text-right">
            <div className="text-xs font-medium text-green-600">Secure Mode</div>
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
            />
          </div>
          
          {/* Real-time Logs - Takes remaining space but with reduced height */}
          <div className="h-48 overflow-y-auto">
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
            onQCStatusChange={handleQCStatusChange}
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
    </div>
  );
};

export default DashboardPanel;
