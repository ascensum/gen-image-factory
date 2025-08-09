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
    aspectRatios: string;
    mjVersion: string;
    openaiModel: string;
    pollingTimeout: number;
    keywordRandom: boolean;
  };
  processing: {
    removeBg: boolean;
    imageConvert: boolean;
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
