import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SettingsPanel } from '../SettingsPanel';

describe('SettingsPanel robustness (load/save/reset)', () => {
  const mockSettings: any = {
    apiKeys: { openai: 'OPENAI_SECRET', piapi: '', runware: 'RUNWARE_SECRET', removeBg: 'RB_SECRET' },
    filePaths: {
      outputDirectory: '/tmp/out',
      tempDirectory: '/tmp/tmp',
      systemPromptFile: '',
      keywordsFile: '',
      qualityCheckPromptFile: '',
      metadataPromptFile: '',
    },
    parameters: {
      processMode: 'single',
      aspectRatios: ['1:1'],
      mjVersion: '6.1',
      openaiModel: 'gpt-4o-mini',
      runwareModel: 'runware:101@1',
      runwareDimensionsCsv: '',
      runwareFormat: 'png',
      variations: 1,
      runwareAdvancedEnabled: false,
      loraEnabled: false,
      label: '',
      pollingTimeout: 15,
      pollingInterval: 1,
      enablePollingTimeout: true,
      keywordRandom: false,
      count: 1,
      generationRetryAttempts: 1,
      generationRetryBackoffMs: 0,
    },
    processing: {
      removeBg: false,
      removeBgFailureMode: 'soft',
      imageConvert: false,
      imageEnhancement: false,
      sharpening: 5,
      saturation: 1.0,
      convertToJpg: false,
      convertToWebp: false,
      trimTransparentBackground: false,
      jpgBackground: 'white',
      jpgQuality: 85,
      pngQuality: 100,
      webpQuality: 85,
      removeBgSize: 'auto',
    },
    ai: { runQualityCheck: true, runMetadataGen: true },
    advanced: { debugMode: false },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    // @ts-expect-error
    window.electronAPI = {
      getSettings: vi.fn().mockResolvedValue({ success: true, settings: mockSettings }),
      saveSettings: vi.fn().mockResolvedValue(true),
      jobManagement: { rerunJobExecution: vi.fn() },
    };

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a user-visible error banner when saveSettings rejects (and does not leak secrets)', async () => {
    // @ts-expect-error
    window.electronAPI.saveSettings = vi.fn().mockRejectedValue(new Error('disk full'));

    render(<SettingsPanel />);

    // Make a change to enable Save (API key input uses onBlur to commit)
    await waitFor(() => {
      const loaded = screen.getByTestId('openai-api-key-input') as HTMLInputElement;
      expect(loaded.value).toBe('OPENAI_SECRET');
    });

    const openaiInput = screen.getByTestId('openai-api-key-input');
    fireEvent.change(openaiInput, { target: { value: 'NEW_OPENAI_SECRET' } });
    fireEvent.blur(openaiInput);

    const saveButton = screen.getByTestId('save-button');
    await waitFor(() => expect(saveButton).toBeEnabled());

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to save settings');
    });

    // Banner should not echo the secret
    expect(screen.getByTestId('error-message')).not.toHaveTextContent('NEW_OPENAI_SECRET');
  });

  it('shows a user-visible error banner when getSettings throws', async () => {
    // @ts-expect-error
    window.electronAPI.getSettings = vi.fn().mockRejectedValue(new Error('read failed'));

    render(<SettingsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to load settings');
    });
  });

  it('Full Reset clears API keys; Soft Reset preserves API keys', async () => {
    render(<SettingsPanel />);

    await waitFor(() => {
      const loaded = screen.getByTestId('openai-api-key-input') as HTMLInputElement;
      expect(loaded.value).toBe('OPENAI_SECRET');
    });

    // Open reset dialog
    fireEvent.click(screen.getByTestId('reset-button'));
    const fullResetBtn = await screen.findByText('Full Reset (clear API keys)');

    // Full reset clears keys
    fireEvent.click(fullResetBtn);

    await waitFor(() => {
      const openaiAfter = screen.getByTestId('openai-api-key-input') as HTMLInputElement;
      expect(openaiAfter.value).toBe('');
    });

    // Put a value back and soft reset should preserve it
    const openaiAfter = screen.getByTestId('openai-api-key-input');
    fireEvent.change(openaiAfter, { target: { value: 'PERSIST_ME' } });
    fireEvent.blur(openaiAfter);

    fireEvent.click(screen.getByTestId('reset-button'));
    const softResetBtn = await screen.findByText('Reset (keep API keys)');
    fireEvent.click(softResetBtn);

    await waitFor(() => {
      const openaiSoft = screen.getByTestId('openai-api-key-input') as HTMLInputElement;
      expect(openaiSoft.value).toBe('PERSIST_ME');
    });
  });
});
