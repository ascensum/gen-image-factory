export interface ProcessingSettings {
  imageEnhancement: boolean;
  sharpening: number;
  saturation: number;
  imageConvert: boolean;
  convertToJpg: boolean;
  convertToWebp?: boolean;
  jpgQuality: number;
  pngQuality: number;
  webpQuality?: number;
  removeBg: boolean;
  removeBgSize: string;
  trimTransparentBackground: boolean;
  jpgBackground: string;
}


