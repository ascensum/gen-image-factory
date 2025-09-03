/**
 * Authoritative GeneratedImage interface
 * 
 * This interface represents the actual structure returned by the database
 * and used throughout the application. It consolidates all previous
 * duplicate definitions.
 */

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
    title?: string | { en?: string; [key: string]: string };
    description?: string | { en?: string; [key: string]: string };
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

/**
 * Helper type for frontend components that need string IDs
 * (for React keys, etc.)
 */
export type GeneratedImageWithStringId = Omit<GeneratedImage, 'id' | 'executionId'> & {
  id: string;
  executionId: string;
};

/**
 * Helper type for database operations
 */
export interface GeneratedImageForDatabase extends Omit<GeneratedImage, 'metadata' | 'processingSettings'> {
  metadata?: string; // JSON string in database
  processingSettings?: string; // JSON string in database
}
