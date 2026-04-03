/**
 * DashboardPanel — thin wrapper (ADR-010 Frontend Decomposition).
 * Full implementation lives in views/DashboardView.tsx.
 *
 * This file only re-exports:
 *  - The shared type interfaces (backward-compat: JobHistory, LogViewer, ProgressIndicator, index.ts import them from here)
 *  - DashboardView as the default export
 */

// ─── Shared type interfaces (imported by JobHistory, LogViewer, ProgressIndicator) ───

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

export type { GeneratedImageWithStringId as GeneratedImage } from '../../../types/generatedImage';

// ─── Component ───

export { DashboardView as default } from './views/DashboardView';
