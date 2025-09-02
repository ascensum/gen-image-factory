/**
 * Database Model TypeScript Interfaces
 * 
 * Defines type safety for database operations and model structures
 */

export interface JobExecution {
  id?: number;
  configurationId: number;
  startedAt?: Date;
  completedAt?: Date;
  status?: 'running' | 'completed' | 'failed' | 'cancelled';
  totalImages?: number;
  successfulImages?: number;
  failedImages?: number;
  errorMessage?: string;
}

// GeneratedImage interface moved to src/types/generatedImage.d.ts
// Import from there instead: import { GeneratedImage } from './generatedImage';

export interface JobStatistics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalImages: number;
  successfulImages: number;
  failedImages: number;
  averageJobDuration: number;
}

export interface ImageStatistics {
  totalImages: number;
  passedImages: number;
  failedImages: number;
  pendingImages: number;
  averageSeed: number;
}

export interface JobHistoryEntry extends JobExecution {
  configurationName?: string;
}

export interface ImageMetadataEntry extends GeneratedImage {
  jobStatus?: string;
  configurationId?: number;
}

// Database operation result types
export interface DatabaseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface JobExecutionResult extends DatabaseResult<JobExecution> {
  execution?: JobExecution;
}

export interface JobExecutionsResult extends DatabaseResult<JobExecution[]> {
  executions?: JobExecution[];
}

export interface GeneratedImageResult extends DatabaseResult<GeneratedImage> {
  image?: GeneratedImage;
}

export interface GeneratedImagesResult extends DatabaseResult<GeneratedImage[]> {
  images?: GeneratedImage[];
}

export interface JobHistoryResult extends DatabaseResult<JobHistoryEntry[]> {
  history?: JobHistoryEntry[];
}

export interface JobStatisticsResult extends DatabaseResult<JobStatistics> {
  statistics?: JobStatistics;
}

export interface ImageStatisticsResult extends DatabaseResult<ImageStatistics> {
  statistics?: ImageStatistics;
}

export interface ImageMetadataResult extends DatabaseResult<ImageMetadataEntry[]> {
  images?: ImageMetadataEntry[];
}

// Database transaction types
export interface DatabaseTransaction {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  execute(sql: string, params?: any[]): Promise<any>;
}

export interface TransactionOperation {
  sql: string;
  params?: any[];
}

export interface TransactionResult {
  success: boolean;
  results: Array<{
    success: boolean;
    lastID?: number;
    changes?: number;
  }>;
  executionTime: number;
}

// Database migration types
export interface DatabaseMigration {
  version: number;
  description: string;
  up(): Promise<void>;
  down(): Promise<void>;
}

// Database backup types
export interface DatabaseBackup {
  timestamp: Date;
  path: string;
  size: number;
  checksum: string;
}

export interface DatabaseBackupResult extends DatabaseResult<DatabaseBackup> {
  backup?: DatabaseBackup;
}

export interface BackupMetadata {
  timestamp: string;
  originalPath: string;
  version: string;
  checksum: string;
}

export interface BackupInfo {
  file: string;
  path: string;
  metadata: BackupMetadata;
}

export interface DatabaseMaintenanceResult {
  success: boolean;
  integrityCheck: {
    success: boolean;
    result: string;
  };
  databaseSize: {
    size: number;
    sizeInMB: string;
  };
  backupCount: number;
}

// Database performance monitoring types
export interface DatabasePerformanceMetrics {
  queryCount: number;
  averageQueryTime: number;
  slowQueries: Array<{
    sql: string;
    executionTime: number;
    timestamp: Date;
  }>;
  connectionPoolSize: number;
  activeConnections: number;
  recentQueries: Array<{
    sql: string;
    executionTime: number;
    timestamp: Date;
  }>;
}

export interface DatabasePerformanceResult extends DatabaseResult<DatabasePerformanceMetrics> {
  metrics?: DatabasePerformanceMetrics;
}

// Model validation types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ModelValidator<T> {
  validate(data: T): ValidationResult;
  sanitize(data: T): T;
}

// Database operation types
export interface DatabaseOperation {
  type: 'create' | 'read' | 'update' | 'delete';
  table: string;
  data?: any;
  conditions?: any;
  options?: any;
}

export interface DatabaseQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  includeDeleted?: boolean;
}
