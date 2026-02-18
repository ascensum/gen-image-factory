/**
 * Types for ApiKeysSection (Story 3.4 Phase 5c.9).
 */
import type React from 'react';

export interface ApiService {
  name: string;
  apiKey: string;
  isValid: boolean;
  isTested: boolean;
  secureStorageAvailable: boolean;
  lastTested?: Date;
  connectionStatus?: 'success' | 'failed' | 'testing' | 'idle';
  errorMessage?: string;
}

export interface ApiKeysSectionProps {
  onApiKeyChange?: (serviceName: string, apiKey: string) => void;
  onTestConnection?: (serviceName: string) => Promise<boolean>;
  onRemoveService?: (serviceName: string) => void;
  services?: ApiService[];
  isLoading?: boolean;
  error?: string | null;
}

export interface ServiceTemplate {
  name: string;
  displayName: string;
  icon: React.ComponentType<{ className?: string }>;
  keyPattern: RegExp;
  testEndpoint?: string;
  documentationUrl?: string;
  placeholder: string;
}
