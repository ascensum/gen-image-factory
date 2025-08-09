// IPC Communication Types
export interface IpcChannels {
  // Job Control
  'job:start': (config: JobConfiguration) => Promise<JobResult>;
  'job:stop': () => Promise<void>;
  'job:force-stop': () => Promise<void>;
  
  // Progress Updates (Event-based)
  'job:progress': (progress: ProgressUpdate) => void;
  'job:error': (error: JobError) => void;
  
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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
