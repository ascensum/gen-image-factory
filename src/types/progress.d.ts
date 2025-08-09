// Progress Update Types
export interface ProgressUpdate {
  jobId: string;
  step: string;
  progress: number; // 0-100
  message: string;
  timestamp: Date;
  details?: {
    currentImage?: number;
    totalImages?: number;
    currentAspectRatio?: string;
    processingTime?: number;
  };
}

export interface ProgressStep {
  name: string;
  weight: number; // Relative weight for progress calculation
  description: string;
}

export const PROGRESS_STEPS: ProgressStep[] = [
  { name: 'initialization', weight: 5, description: 'Initializing job configuration' },
  { name: 'parameter_generation', weight: 15, description: 'Generating parameters from keywords' },
  { name: 'image_generation', weight: 50, description: 'Generating images with AI' },
  { name: 'background_removal', weight: 15, description: 'Removing backgrounds' },
  { name: 'quality_check', weight: 10, description: 'Running quality checks' },
  { name: 'metadata_generation', weight: 5, description: 'Generating metadata' }
];

export interface ProgressCalculator {
  calculateProgress(completedSteps: string[], currentStep?: string): number;
  getStepDescription(stepName: string): string;
  getStepWeight(stepName: string): number;
}
