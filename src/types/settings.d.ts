export interface SettingsObject {
  apiKeys: {
    openai: string;
    piapi: string;
    runware: string;
    removeBg: string;
  };
  filePaths: {
    outputDirectory: string;
    tempDirectory: string;
    systemPromptFile: string;
    keywordsFile: string;
    qualityCheckPromptFile: string;
    metadataPromptFile: string;
  };
  parameters: {
    processMode: string;
    aspectRatios: string[] | string;
    mjVersion: string;
    openaiModel: string;
    // Runware fields
    runwareModel?: string; // default runware:101@1
    runwareDimensionsCsv?: string; // e.g. 1024x1024,1280x720
    runwareFormat?: 'png' | 'jpg' | 'webp';
    variations?: number; // 1–20, default 1
    runwareAdvanced?: {
      lora?: Array<{ model: string; weight?: number }>;
      checkNSFW?: boolean;
      scheduler?: string;
      CFGScale?: number;
      steps?: number;
    };
    /** Optional job label to apply at creation time */
    label?: string;
    pollingTimeout: number;
    pollingInterval: number;
    enablePollingTimeout: boolean;
    keywordRandom: boolean;
    count: number;
  };
  processing: {
    removeBg: boolean;
    imageConvert: boolean;
    imageEnhancement: boolean;
    sharpening: number;
    saturation: number;
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
  };
}


