// Job Execution Types
export interface JobConfiguration {
  apiKeys: {
    openai?: string;
    piapi?: string;
    removeBg?: string;
  };
  filePaths: {
    outputDirectory: string;
    tempDirectory: string;
    logDirectory: string;
  };
  parameters: {
    processMode: string;
    aspectRatios: string[];
    mjVersion: string;
    openaiModel: string;
    pollingTimeout: number;
    keywordRandom: boolean;
  };
  processing: {
    removeBg: boolean;
    imageConvert: boolean;
    imageEnhancement?: boolean;
    sharpening?: number;
    saturation?: number;
    convertToJpg: boolean;
    trimTransparentBackground: boolean;
    jpgBackground: string;
    jpgQuality: number;
    pngQuality: number;
    removeBgSize: string;
  };
  ai: {
    runQualityCheck: boolean;
    runMetadataGen: boolean;
  };
  advanced: {
    debugMode: boolean;
    autoSave: boolean;
  };
}

export interface JobStatus {
  state: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';
  currentJob?: JobExecution;
  progress: number;
  currentStep: number;
  totalSteps: number;
  startTime?: Date;
  estimatedTimeRemaining?: number;
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
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: string;
}

// GeneratedImage interface moved to src/types/generatedImage.d.ts
// Import from there instead: import { GeneratedImage } from './generatedImage';

export interface JobResult {
  success: boolean;
  jobId?: string;
  error?: string;
  message?: string;
}

export interface JobState {
  id: string;
  status: 'idle' | 'running' | 'stopped' | 'error' | 'completed';
  startTime?: Date;
  endTime?: Date;
  error?: string;
  progress?: number;
  currentStep?: string;
}

export interface JobRunner {
  startJob(config: JobConfiguration): Promise<JobResult>;
  stopJob(): Promise<void>;
  forceStopAll(): Promise<void>;
  getJobState(): JobState;
  onProgress(callback: (progress: ProgressUpdate) => void): void;
  onError(callback: (error: JobError) => void): void;
}

// Job Execution Types
export interface JobExecution {
  id: string | number;
  configurationId: string | number;
  configurationName?: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed' | 'stopped' | 'pending';
  totalImages: number;
  successfulImages: number;
  failedImages: number;
  errorMessage?: string;
  label?: string;
}

// Job Management Types
export interface JobFilters {
  status?: string;
  configurationId?: string | number;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  limit?: number;
  offset?: number;
  dateRange?: string;
  label?: string;
  minImages?: number;
  maxImages?: number;
  /** When true, only show jobs that have items queued for retry (pending retries) */
  hasPendingRetries?: boolean;
}

export interface JobHistoryResult {
  success: boolean;
  history?: JobExecution[];
  error?: string;
}

export interface JobResultsResult {
  success: boolean;
  results?: any[];
  error?: string;
}

export interface DeleteJobResult {
  success: boolean;
  deletedRows?: number;
  error?: string;
}

export interface ExportJobResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface RenameJobResult {
  success: boolean;
  changes?: number;
  error?: string;
}

export interface BulkDeleteJobsResult {
  success: boolean;
  deletedRows?: number;
  error?: string;
}

export interface BulkExportJobsResult {
  success: boolean;
  filePaths?: string[];
  error?: string;
}

export interface BulkRerunJobsResult {
  success: boolean;
  startedJob?: {
    jobId: string;
    label: string;
    newJobId: string;
    newExecutionId: string;
  };
  queuedJobs?: number;
  totalJobs?: number;
  failedJobs?: number;
  message?: string;
  error?: string;
}

export interface ProcessNextBulkRerunResult {
  success: boolean;
  message?: string;
  jobId?: string;
  executionId?: string;
  remainingInQueue?: number;
  error?: string;
}

export interface FilteredJobsResult {
  success: boolean;
  executions?: JobExecution[];
  error?: string;
}

export interface JobCountResult {
  success: boolean;
  count?: number;
  error?: string;
}
