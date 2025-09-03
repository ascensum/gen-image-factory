export interface GeneratedImage {
  // Database fields (as returned by SQLite)
  id: number;
  imageMappingId?: string;
  executionId: number;
  generationPrompt: string;
  seed?: number | null;
  qcStatus: 'pending' | 'passed' | 'failed' | 'approved' | 'rejected' | 'processing' | 'retry_pending';
  qcReason?: string | null;
  finalImagePath?: string | null;
  tempImagePath?: string | null;
  
  // JSON fields (parsed from database)
  metadata?: {
    title?: string | { en?: string; [key: string]: string | undefined };
    description?: string | { en?: string; [key: string]: string | undefined };
    tags?: string[];
    prompt?: string;
    [key: string]: any;
  } | null;
  
  processingSettings?: {
    imageEnhancement?: boolean;
    sharpening?: number;
    saturation?: number;
    imageConvert?: boolean;
    convertToJpg?: boolean;
    jpgQuality?: number;
    pngQuality?: number;
    removeBg?: boolean;
    removeBgSize?: string;
    trimTransparentBackground?: boolean;
    jpgBackground?: string;
    [key: string]: any;
  } | null;
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GeneratedImageWithStringId extends Omit<GeneratedImage, 'id' | 'executionId'> {
  id: string;
  executionId: string;
}
