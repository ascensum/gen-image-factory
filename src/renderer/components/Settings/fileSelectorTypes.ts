/**
 * Types for FileSelector (Story 3.4 Phase 5c.10).
 */

export interface FileSelectorProps {
  label: string;
  value: string;
  onChange: (path: string) => void;
  onValidation?: (isValid: boolean) => void;
  type: 'file' | 'directory';
  fileTypes?: string[];
  accept?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  error?: string;
}

export type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

export type DragState = 'idle' | 'dragover' | 'dragging';

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export interface RecentPath {
  path: string;
  name: string;
  lastUsed: Date;
  type: 'file' | 'directory';
}

export const FILE_TYPE_EXTENSIONS: Record<string, string[]> = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'],
  document: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'],
  audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
  video: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'],
  archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
  code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.html', '.css']
};
