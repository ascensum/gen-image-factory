/**
 * Story 3.4 Phase 5c.5: State and refs for ProcessingSettingsModal.
 */
import React, { useState, useRef, useCallback } from 'react';
import type { ProcessingSettings } from '../../../../types/processing';

const DEFAULT_BATCH_SETTINGS: ProcessingSettings = {
  imageEnhancement: false,
  sharpening: 5,
  saturation: 1.0,
  imageConvert: false,
  convertToJpg: true,
  jpgQuality: 85,
  pngQuality: 100,
  convertToWebp: false,
  webpQuality: 85,
  removeBg: false,
  removeBgSize: 'auto',
  trimTransparentBackground: false,
  jpgBackground: '#FFFFFF',
};

export interface UseProcessingSettingsModalStateReturn {
  useOriginalSettings: boolean;
  setUseOriginalSettings: (v: boolean) => void;
  includeMetadata: boolean;
  setIncludeMetadata: (v: boolean) => void;
  failRetryEnabled: boolean;
  setFailRetryEnabled: (v: boolean) => void;
  failOnSteps: string[];
  setFailOnSteps: (v: string[]) => void;
  batchSettings: ProcessingSettings;
  updateSetting: (key: keyof ProcessingSettings, value: unknown) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
  configSectionRef: React.RefObject<HTMLDivElement | null>;
  sharpeningRef: React.RefObject<HTMLDivElement | null>;
  convertFormatRef: React.RefObject<HTMLDivElement | null>;
  removeBgSizeRef: React.RefObject<HTMLDivElement | null>;
}

export function useProcessingSettingsModalState(): UseProcessingSettingsModalStateReturn {
  const [useOriginalSettings, setUseOriginalSettings] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [failRetryEnabled, setFailRetryEnabled] = useState(false);
  const [failOnSteps, setFailOnSteps] = useState<string[]>([]);
  const [batchSettings, setBatchSettings] = useState<ProcessingSettings>(DEFAULT_BATCH_SETTINGS);

  const contentRef = useRef<HTMLDivElement | null>(null);
  const configSectionRef = useRef<HTMLDivElement | null>(null);
  const sharpeningRef = useRef<HTMLDivElement | null>(null);
  const convertFormatRef = useRef<HTMLDivElement | null>(null);
  const removeBgSizeRef = useRef<HTMLDivElement | null>(null);

  const updateSetting = useCallback((key: keyof ProcessingSettings, value: unknown) => {
    setBatchSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
    useOriginalSettings,
    setUseOriginalSettings,
    includeMetadata,
    setIncludeMetadata,
    failRetryEnabled,
    setFailRetryEnabled,
    failOnSteps,
    setFailOnSteps,
    batchSettings,
    updateSetting,
    contentRef,
    configSectionRef,
    sharpeningRef,
    convertFormatRef,
    removeBgSizeRef,
  };
}
