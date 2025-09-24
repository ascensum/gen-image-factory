import React, { useState, useEffect } from 'react';
import JobControls from './JobControls';
import ProgressIndicator from './ProgressIndicator';
import LogViewer from './LogViewer';
import JobHistory from './JobHistory';
import ImageGallery from './ImageGallery';
import ForceStopButton from './ForceStopButton';
import ExportDialog from '../Common/ExportDialog';
import './DashboardPanel.css';
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

// Import types only to avoid runtime loading of .d.ts
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../types/generatedImage';

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
    currentStep: 1,
    totalSteps: 2
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
  
  // NEW: Tab state management
  const [activeTab, setActiveTab] = useState<'overview' | 'image-gallery'>('overview');
  
  // Image Gallery view mode
  const [imageViewMode, setImageViewMode] = useState<'grid' | 'list'>('grid');
  
  // Image Gallery filters and controls
  const [imageJobFilter, setImageJobFilter] = useState<string>('all');
  const [imageSearchQuery, setImageSearchQuery] = useState<string>('');
  const [imageSortBy, setImageSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [imageDateFrom, setImageDateFrom] = useState<string | null>(null);
  const [imageDateTo, setImageDateTo] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  // Helpers to reflect filtered selection data from ImageGallery
  const filteredImageIds = React.useCallback(() => {
    // Build the same filter used in ImageGallery to compute ids quickly
    const uniqueJobIds = Array.from(new Set((generatedImages || []).map(img => img.executionId)));
    const images = generatedImages || [];
    const parseMetadata = (raw: any) => {
      if (!raw) return {};
      if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
      return raw;
    };
    const ids = images.filter(image => {
      if (imageJobFilter !== 'all' && image.executionId != imageJobFilter) return false;
      if (imageSearchQuery) {
        const q = imageSearchQuery.toLowerCase();
        const meta = parseMetadata(image.metadata);
        const title = typeof meta?.title === 'string' ? meta.title : meta?.title?.en || '';
        const description = typeof meta?.description === 'string' ? meta.description : meta?.description?.en || '';
        const tags = Array.isArray(meta?.tags) ? meta.tags.join(' ') : '';
        const metaPrompt = typeof meta?.prompt === 'string' ? meta.prompt : '';
        const matches = (image.generationPrompt || '').toLowerCase().includes(q)
          || title.toLowerCase().includes(q)
          || description.toLowerCase().includes(q)
          || tags.toLowerCase().includes(q)
          || metaPrompt.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (imageDateFrom || imageDateTo) {
        if (!image.createdAt) return false;
        const d = new Date(image.createdAt as any);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const ymd = `${y}-${m}-${day}`;
        if (imageDateFrom && ymd < imageDateFrom) return false;
        if (imageDateTo && ymd > imageDateTo) return false;
      }
      return true;
    }).map(img => img.id);
    return ids;
  }, [generatedImages, imageJobFilter, imageSearchQuery, imageDateFrom, imageDateTo]);

  const filteredImagesCount = React.useMemo(() => filteredImageIds().length, [filteredImageIds]);
  

  
  // Removed local failed images review state; navigation handled at App level

  // Poll for job status updates
  useEffect(() => {
    const pollJobStatus = async () => {
      try {
        const status = await window.electronAPI.jobManagement.getJobStatus();
        // UI guard: if backend reports progress ~100% but state not flipped, treat as completed for display
        const normalized = { ...status } as any;
        if (normalized && normalized.state === 'running' && typeof normalized.progress === 'number' && normalized.progress >= 0.999) {
          normalized.state = 'completed';
        }
        setJobStatus(normalized);
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
    } else if (jobStatus.state === 'failed' || jobStatus.state === 'error') {
      console.log('🔄 Job failed, refreshing data...');
      // Refresh lists so Job History reflects failure without waiting for manual actions
      loadJobHistory();
      loadStatistics();
      // Keep logs visible by marking a short grace period
      lastCompletionRef.current = Date.now();
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
      const failedOrError = jobStatus.state === 'failed' || jobStatus.state === 'error';
      if (!(jobStatus.state === 'running' || withinGrace || failedOrError)) {
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
          // Clear selection immediately so UI hides the button and resets the counter
          setSelectedImages(new Set());
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

  // NEW: Function to get dynamic progress steps based on job configuration
  const getDynamicProgressSteps = (config) => {
    if (!config) return [];
    
    const steps = [
      {
        name: 'Initialization',
        icon: '⚙️',
        description: 'Setup & Parameters',
        required: true,
        completed: true,
        weight: 20
      }
    ];
    
    // Step 2: Dynamic subtasks based on enabled features
    const subtasks = [];
    
    // AI Generation is always shown (as it's now optional in producePictureModule)
    subtasks.push('AI Generation');
    
    // Metadata only if enabled
    if (config.ai?.runMetadataGen) {
      subtasks.push('Metadata');
    }
    
    // QC only if enabled
    if (config.ai?.runQualityCheck) {
      subtasks.push('QC');
    }
    
    // Background Removal only if enabled
    if (config.processing?.removeBg) {
      subtasks.push('Background Removal');
    }
    
    // Processing if any Sharp library functions are enabled
    const hasProcessing = config.processing && (
      config.processing.imageEnhancement ||
      config.processing.imageConvert ||
      config.processing.sharpening > 0 ||
      config.processing.saturation !== 1 ||
      config.processing.convertToJpg ||
      config.processing.trimTransparentBackground
    );
    
    if (hasProcessing) {
      subtasks.push('Processing');
    }
    
    if (subtasks.length > 0) {
      steps.push({
        name: 'Image Generation',
        icon: '🎨',
        description: subtasks.join(' + '),
        required: true,
        completed: false,
        current: true,
        weight: 80
      });
    }
    
    return steps;
  };

  // NEW: Function to determine if overall progress should be shown
  const shouldShowOverallProgress = (config) => {
    return config?.parameters?.count > 1;
  };

  // NEW: Smart progress calculation based on backend weights (20% + 80%) and generation counts
  const getSmartProgressValues = (config, jobStatus) => {
    if (!config) return { overallGenerationProgress: 0, current: 0, currentGeneration: 1, totalGenerations: 1, generatedImages: 0, totalImages: 4 };
    
    const count = config.parameters?.count || 1; // Total generations (e.g., 100, 1000, 10000)
    
    // Get current progress from job status if available
    const jobState = jobStatus?.state;
    const currentProgress = Math.max(0, Math.min(jobStatus?.progress || 0, 1)); // 0.0..1.0
    // Derive step from progress to avoid dependency on currentStep
    let currentGenerationProgress = 0;
    if (jobState === 'failed' || jobState === 'error') {
      currentGenerationProgress = 0;
    } else if (jobState === 'completed') {
      currentGenerationProgress = 100;
    } else if (currentProgress <= 0.2) {
      // Map 0..0.2 -> 0..20%
      currentGenerationProgress = (currentProgress / 0.2) * 20;
    } else {
      // Map 0.2..1.0 -> 20..100%
      const stepProgress = (currentProgress - 0.2) / 0.8; // 0..1
      currentGenerationProgress = 20 + Math.min(Math.max(stepProgress, 0), 1) * 80;
    }
    
    // For multiple generations, calculate overall progress correctly
    let overallGenerationProgress = 0;
    let currentGeneration = 1;
    
    // For now, mirror the current generation progress in the overall bar
    overallGenerationProgress = Math.round(jobState === 'failed' || jobState === 'error' ? 0 : currentGenerationProgress);
    currentGeneration = 1;
    
    // Calculate generated images based on current generation progress
    const generatedImagesCount = Math.floor(currentGenerationProgress / 100 * 4);
    
    return {
      overallGenerationProgress: Math.round(overallGenerationProgress),
      current: Math.round(currentGenerationProgress),
      currentGeneration: currentGeneration,
      totalGenerations: count,
      generatedImages: generatedImagesCount,
      totalImages: 4
    };
  };

  return (
    <div className="dashboard-panel min-h-screen bg-gray-50">
      {/* Dashboard Header - compact with ordered elements */}
      <div className="bg-white border-b border-gray-200 py-2 flex items-center px-6">
        <div className="flex items-center justify-between w-full flex-wrap gap-y-2">
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
          <div className="flex items-center flex-wrap gap-x-6 gap-y-2 justify-end">
            <div className="text-sm whitespace-nowrap"><span className="text-gray-600">Total Jobs:</span><span className="ml-1 font-semibold text-blue-600">{statistics.totalJobs}</span></div>
            <div className="text-sm whitespace-nowrap"><span className="text-gray-600">Success Rate:</span><span className="ml-1 font-semibold text-green-600">{statistics.successRate}%</span></div>
            <div className="text-sm whitespace-nowrap"><span className="text-gray-600">Images Generated:</span><span className="ml-1 font-semibold text-purple-600">{statistics.totalImagesGenerated}</span></div>
            <div className="text-sm whitespace-nowrap"><span className="text-gray-600">Avg Duration:</span><span className="ml-1 font-semibold text-orange-600">{statistics.averageExecutionTime}s</span></div>
          </div>
        </div>
      </div>

      {/* NEW: Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'image-gallery' ? 'active' : ''}`}
          onClick={() => setActiveTab('image-gallery')}
        >
          Image Gallery
        </button>
      </div>

      {/* NEW: Tab Content Container */}
      <div className="tab-content-container">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="unified-panel-container">
            {/* Job Progress Section */}
            <div className="dashboard-panel job-progress">
              <div className="panel-header">
                <div className="section-header-with-icon">
                  <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Job Progress
                  {/* Delete Selected Button */}
                  {selectedImages.size > 0 && (
                    <button
                      onClick={() => handleBulkAction('delete', Array.from(selectedImages))}
                      className="px-3 py-1 text-sm rounded-md transition-colors flex items-center space-x-1 bg-red-600 text-white hover:bg-red-700"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete Selected</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="panel-content">
                {/* Multi-Generation Overall Progress - Only show when count > 1 */}
                {shouldShowOverallProgress(jobConfiguration) && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium mb-3 text-gray-700">
                      Overall Progress ({jobConfiguration.parameters.count} generations)
                    </h4>
                    <div className="progress-container">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${getSmartProgressValues(jobConfiguration, jobStatus).overallGenerationProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600">
                      Generation {getSmartProgressValues(jobConfiguration, jobStatus).currentGeneration} of {jobConfiguration.parameters.count} ({getSmartProgressValues(jobConfiguration, jobStatus).overallGenerationProgress}% complete)
                    </p>
                  </div>
                )}

                {/* Current Generation Progress */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-3 text-gray-700">
                    {shouldShowOverallProgress(jobConfiguration) ? 'Current Generation Progress' : 'Single Generation Progress'}
                  </h4>
                                      <div className="progress-container">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${getSmartProgressValues(jobConfiguration, jobStatus).current}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600">
                      Images {getSmartProgressValues(jobConfiguration, jobStatus).generatedImages} of 4 ({getSmartProgressValues(jobConfiguration, jobStatus).current}% complete)
                    </p>
                </div>

                {/* Progress Steps - Dynamic based on job configuration */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-gray-700">Progress Steps</h4>
                  <div className="progress-steps">
                    {getDynamicProgressSteps(jobConfiguration).map((step, index) => {
                      // Determine step state based on current progress
                      const currentProgress = getSmartProgressValues(jobConfiguration, jobStatus).current;
                      let stepState = 'pending'; // pending, active, completed
                      
                      const jobState = jobStatus?.state;
                      if (jobState === 'failed' || jobState === 'error') {
                        // Failure coloring rules
                        if (step.name === 'Initialization') {
                          stepState = currentProgress >= 20 ? 'completed' : 'failed';
                        } else if (step.name === 'Image Generation') {
                          stepState = currentProgress > 20 ? 'failed' : 'failed';
                        }
                      } else if (jobState === 'completed') {
                        // Success: both green
                        stepState = 'completed';
                      } else {
                        // Running/pending: only active step highlighted, other gray
                        if (step.name === 'Initialization') {
                          stepState = currentProgress >= 20 ? 'completed' : (currentProgress > 0 ? 'active' : 'pending');
                        } else if (step.name === 'Image Generation') {
                          stepState = currentProgress > 20 ? 'active' : 'pending';
                        }
                      }
                      
                      return (
                        <React.Fragment key={step.name}>
                          <div className="progress-step">
                            <div className={`step-icon ${stepState}`}>
                              {step.name === 'Initialization' ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                </svg>
                              ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                </svg>
                              )}
                            </div>
                            <div className="step-info">
                              <div className="step-name">{step.name}</div>
                              <div className="step-subtitle">{step.description}</div>
                            </div>
                          </div>
                          
                          {/* Add connector between steps, but not after the last step */}
                          {index < getDynamicProgressSteps(jobConfiguration).length - 1 && (
                            <div className="progress-connector"></div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Job History Section */}
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
                {/* Filter Controls - Static Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', background: 'white' }}>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium text-gray-700">Status:</label>
                      <select className="control-select">
                        <option>All Statuses</option>
                        <option>Completed</option>
                        <option>Failed</option>
                        <option>Running</option>
                        <option>Pending</option>
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium text-gray-700">Sort:</label>
                      <select className="control-select">
                        <option>Newest First</option>
                        <option>Oldest First</option>
                        <option>By Name</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Job History Items - Scrollable Content */}
                <div className="job-history-content">
            <JobHistory
              jobs={jobHistory}
              onJobAction={handleJobAction}
              onDeleteJob={(jobId) => handleJobAction('delete', jobId)}
              isLoading={isLoading}
            />
          </div>
        </div>
          </div>
          
            {/* Logs Panel Section */}
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
                {/* Log Entries - Direct content, no duplicate header */}
            <LogViewer
              logs={logs}
              jobStatus={jobStatus.state}
              onRefresh={loadLogs}
            />
          </div>
        </div>
      </div>
        )}

        {/* Image Gallery Tab */}
        {activeTab === 'image-gallery' && (
          <div className="flex flex-col h-full min-h-0">
            {/* Header - STATIC (non-scrollable) */}
            <div className="px-6 pt-4 pb-0 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Generated Images</h2>
            </div>

              {/* Image Count Indicators - STATIC (non-scrollable) */}
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

              {/* Filters and Controls - STATIC (non-scrollable) */}
              <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg mb-4 flex-shrink-0">
                <div className="flex items-center space-x-4">
                  {/* View Toggle */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">View:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setImageViewMode('grid')}
                        className={`p-2 rounded-md transition-all duration-200 ${
                          imageViewMode === 'grid'
                            ? 'bg-gray-200 text-gray-900 border border-gray-300'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
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
                          imageViewMode === 'list'
                            ? 'bg-gray-200 text-gray-900 border border-gray-300'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
                        }`}
                        title="List View"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {/* Job Filter */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">Job:</span>
                    <select 
                      value={imageJobFilter}
                      onChange={(e) => setImageJobFilter(e.target.value)}
                      className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Jobs</option>
                      {Array.from(new Set(generatedImages.map(img => img.executionId))).map(executionId => {
                        const job = jobHistory.find(j => j.id === executionId);
                        return (
                          <option key={executionId} value={executionId}>
                            {job?.label || job?.configurationName || `Job ${String(executionId).slice(0, 8)}`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                {/* Date Range Filter (Dashboard font sizes/styles) */}
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

                  {/* Search Field */}
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

                  {/* Sort Control */}
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

                {/* Action Buttons - STATIC (non-scrollable) */}
                <div className="flex items-center space-x-2">
                  {/* Select All Checkbox */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedImages.size === filteredImagesCount && filteredImagesCount > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          // select all currently filtered images
                          const ids = filteredImageIds();
                          setSelectedImages(new Set(ids));
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

                  {/* Clear Button */}
                  <button
                    onClick={() => {
                      setImageJobFilter('all');
                      setImageSearchQuery('');
                      setImageSortBy('newest');
                      setImageDateFrom(null);
                      setImageDateTo(null);
                      setSelectedImages(new Set());
                    }}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    Clear
                  </button>

                  {/* Excel Export Button */}
                  <button className="px-3 py-1 text-sm rounded-md transition-colors flex items-center space-x-1 bg-green-600 text-white hover:bg-green-700">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <span>Export Excel</span>
                  </button>

                  {/* Delete Selected Button (visible when there is a selection) */}
                  {selectedImages.size > 0 && (
                    <button
                      onClick={() => handleBulkAction('delete', Array.from(selectedImages))}
                      className="px-3 py-1 text-sm rounded-md transition-colors flex items-center space-x-1 bg-red-600 text-white hover:bg-red-700"
                      title={`Delete ${selectedImages.size} selected image${selectedImages.size === 1 ? '' : 's'}`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete Selected ({selectedImages.size})</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Image Grid/List - SCROLLABLE AREA */}
            <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <ImageGallery
                images={generatedImages}
                onImageAction={handleImageAction}
                onBulkAction={handleBulkAction}
                viewMode={imageViewMode}
                onViewModeChange={setImageViewMode}
                isLoading={isLoading}
                jobStatus={jobStatus.state}
                jobFilter={imageJobFilter}
                searchQuery={imageSearchQuery}
                sortBy={imageSortBy}
                jobIdToLabel={Object.fromEntries(jobHistory.map(j => [j.id, (j as any).label || j.configurationName || `Job ${j.id}`]))}
                dateFrom={imageDateFrom}
                dateTo={imageDateTo}
                selectedIds={selectedImages}
                onSelectionChange={setSelectedImages}
                onClearFilters={() => {
                  setImageJobFilter('all');
                  setImageSearchQuery('');
                  setImageSortBy('newest');
                  setImageDateFrom(null);
                  setImageDateTo(null);
                  setSelectedImages(new Set());
                }}
              />
            </div>
          </div>
        )}
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
