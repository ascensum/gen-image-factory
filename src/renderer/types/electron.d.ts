declare global {
  interface Window {
    electronAPI: {
      // Test IPC communication
      ping: () => Promise<string>;
      
      // Get app version
      getAppVersion: () => Promise<string>;
      
      // Settings Management
      getSettings: () => Promise<{
        success: boolean;
        settings?: any;
        error?: string;
      }>;
      saveSettings: (settingsObject: any) => Promise<{
        success: boolean;
        error?: string;
      }>;
      refreshProtocolRoots: (extraPaths?: string[] | string) => Promise<{
        success: boolean;
        roots: string[];
      }>;
      
      // API Key Management
      getApiKey: (serviceName: string) => Promise<{
        success: boolean;
        apiKey?: string;
        error?: string;
      }>;
      setApiKey: (serviceName: string, apiKey: string) => Promise<{
        success: boolean;
        error?: string;
      }>;
      
      // File Selection
      selectFile: (options?: any) => Promise<{
        success: boolean;
        filePath?: string;
        canceled?: boolean;
        error?: string;
      }>;
      
      // Generic invoke method
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      openExternal?: (url: string) => Promise<void>;
      
      // Job Management
      jobManagement: {
        bulkRerunJobExecutions: (ids: string[]) => Promise<any>;
        processNextBulkRerunJob: () => Promise<any>;
      };
    };
  }
}

export {}; 