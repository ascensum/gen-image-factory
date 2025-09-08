export interface SettingsObject {
  apiKeys: {
    openai: string;
    piapi: string;
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


