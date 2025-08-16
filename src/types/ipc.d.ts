// IPC Communication Types
export interface IpcChannels {
  // Job Control
  'job:start': (config: JobConfiguration) => Promise<JobResult>;
  'job:stop': () => Promise<void>;
  'job:force-stop': () => Promise<void>;
  
  // Progress Updates (Event-based)
  'job:progress': (progress: ProgressUpdate) => void;
  'job:error': (error: JobError) => void;
  
  // Job Management
  'get-job-history': (limit?: number) => Promise<JobHistoryResult>;
  'get-job-results': (jobId: string) => Promise<JobResultsResult>;
  'delete-job-execution': (jobId: string) => Promise<DeleteJobResult>;
  'export-job-to-excel': (jobId: string) => Promise<ExportJobResult>;
  'job-execution:rename': (id: string, label: string) => Promise<RenameJobResult>;
  'job-execution:bulk-delete': (ids: string[]) => Promise<BulkDeleteJobsResult>;
  'job-execution:bulk-export': (ids: string[]) => Promise<BulkExportJobsResult>;
  'job-execution:bulk-rerun': (ids: string[]) => Promise<BulkRerunJobsResult>;
  'get-job-executions-with-filters': (filters: JobFilters) => Promise<FilteredJobsResult>;
  'get-job-executions-count': (filters: JobFilters) => Promise<JobCountResult>;
  
  // Job Status and Statistics
  'get-job-status': () => Promise<JobStatus>;
  'get-job-statistics': () => Promise<JobStatistics>;
  'get-job-logs': (type: string) => Promise<LogEntry[]>;
  
  // Generated Images
  'get-all-generated-images': () => Promise<GeneratedImage[]>;
  'delete-generated-image': (imageId: string) => Promise<void>;
  'bulk-delete-images': (imageIds: string[]) => Promise<void>;
  
  // Configuration
  'get-configuration': () => Promise<JobConfiguration>;
  
  // Settings (existing)
  'get-settings': () => Promise<SettingsResult>;
  'save-settings': (settings: SettingsObject) => Promise<SettingsResult>;
  'get-api-key': (serviceName: string) => Promise<ApiKeyResult>;
  'set-api-key': (serviceName: string, apiKey: string) => Promise<ApiKeyResult>;
  'select-file': (options: FileDialogOptions) => Promise<FileSelectResult>;
  
  // Security Status
  'get-security-status': () => Promise<SecurityStatus>;
}

export interface ElectronAPI {
  // Job Control
  jobStart: (config: JobConfiguration) => Promise<JobResult>;
  jobStop: () => Promise<void>;
  jobForceStop: () => Promise<void>;
  
  // Progress Updates
  onJobProgress: (callback: (progress: ProgressUpdate) => void) => void;
  onJobError: (callback: (error: JobError) => void) => void;
  
  // Job Management
  getJobHistory: (limit?: number) => Promise<JobHistoryResult>;
  getJobResults: (jobId: string) => Promise<JobResultsResult>;
  deleteJobExecution: (jobId: string) => Promise<DeleteJobResult>;
  exportJobToExcel: (jobId: string) => Promise<ExportJobResult>;
  renameJobExecution: (id: string | number, label: string) => Promise<JobResult>;
  rerunJobExecution: (id: string | number) => Promise<JobResult>;
  exportJobExecution: (id: string | number) => Promise<JobResult>;
  deleteJobExecution: (id: string | number) => Promise<JobResult>;
  getJobExecutionsWithFilters: (filters: JobFilters, page?: number, pageSize?: number) => Promise<JobExecutionsResult>;
  getJobExecutionsCount: (filters: JobFilters) => Promise<JobCountResult>;
  
  // Job Status and Statistics
  getJobStatus: () => Promise<JobStatus>;
  getJobStatistics: () => Promise<JobStatistics>;
  getJobLogs: (type: string) => Promise<LogEntry[]>;
  
  // Generated Images
  getAllGeneratedImages: () => Promise<GeneratedImage[]>;
  deleteGeneratedImage: (imageId: string) => Promise<void>;
  bulkDeleteImages: (imageIds: string[]) => Promise<void>;
  
  // Configuration
  getConfiguration: () => Promise<JobConfiguration>;
  
  // Settings (existing)
  getSettings: () => Promise<SettingsResult>;
  saveSettings: (settings: SettingsObject) => Promise<SettingsResult>;
  getApiKey: (serviceName: string) => Promise<ApiKeyResult>;
  setApiKey: (serviceName: string, apiKey: string) => Promise<ApiKeyResult>;
  selectFile: (options: FileDialogOptions) => Promise<FileSelectResult>;
  
  // Security Status
  getSecurityStatus: () => Promise<SecurityStatus>;
  
  // Utility
  ping: () => Promise<string>;
  getAppVersion: () => Promise<string>;
}

export interface JobExecutionsResult {
  success: boolean;
  jobs: JobExecution[];
  totalCount?: number;
  error?: string;
}

export interface JobCountResult {
  success: boolean;
  count: number;
  error?: string;
}

export interface JobResult {
  success: boolean;
  changes?: number;
  deletedRows?: number;
  data?: any;
  error?: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
