import React from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SettingsPanel } from '../../src/renderer/components/Settings/SettingsPanel';

// Mock Electron API
const mockElectronAPI = {
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  selectFile: vi.fn(),
  validatePath: vi.fn().mockResolvedValue({ isValid: true }),
};

// @ts-ignore
window.electronAPI = mockElectronAPI;

describe('SettingsPanel Characterization Baseline', () => {
  const initialSettings = {
    apiKeys: {
      openai: 'sk-initial-openai',
      piapi: 'initial-piapi',
      runware: 'initial-runware',
      removeBg: 'initial-removebg',
    },
    filePaths: {
      outputDirectory: '/path/to/output',
      tempDirectory: '/path/to/temp',
      systemPromptFile: '/path/to/system.txt',
      keywordsFile: '/path/to/keywords.txt',
      qualityCheckPromptFile: '/path/to/qc.txt',
      metadataPromptFile: '/path/to/metadata.txt',
    },
    parameters: {
      openaiModel: 'gpt-4o',
      runwareModel: 'runware:101@1',
      runwareDimensionsCsv: '1024x1024',
      runwareFormat: 'png',
      variations: 1,
      count: 1,
      enablePollingTimeout: true,
      pollingTimeout: 15,
      loraEnabled: false,
      runwareAdvancedEnabled: false,
    },
    processing: {
      removeBg: false,
      removeBgFailureMode: 'soft',
      imageConvert: false,
      imageEnhancement: false,
      sharpening: 5,
      saturation: 1.4,
      convertToJpg: false,
      jpgQuality: 85,
    },
    ai: {
      runQualityCheck: true,
      runMetadataGen: true,
    },
    advanced: {
      debugMode: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockElectronAPI.getSettings.mockResolvedValue({ success: true, settings: initialSettings });
    mockElectronAPI.saveSettings.mockResolvedValue({ success: true });
    mockElectronAPI.selectFile.mockResolvedValue({ success: true, filePath: '/new/path/from/dialog' });
  });

  afterEach(() => {
    cleanup();
  });

  it('baselines initial render and settings loading', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(mockElectronAPI.getSettings).toHaveBeenCalled());
    expect(screen.getByTestId('api-keys-section')).toBeInTheDocument();
    expect(screen.getByTestId('openai-api-key-input')).toHaveValue('sk-initial-openai');
  });

  it('baselines tab switching and section rendering', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(mockElectronAPI.getSettings).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('files-tab'));
    expect(await screen.findByTestId('file-paths-section')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('parameters-tab'));
    expect(await screen.findByTestId('parameters-section')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('processing-tab'));
    expect(await screen.findByTestId('processing-section')).toBeInTheDocument();
  });

  it('baselines API key visibility toggle', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(mockElectronAPI.getSettings).toHaveBeenCalled());
    
    // Toggle ON
    const input1 = screen.getByTestId('openai-api-key-input');
    const toggle1 = within(input1.parentElement!).getByRole('button');
    fireEvent.click(toggle1);
    await waitFor(() => expect(screen.getByTestId('openai-api-key-input')).toHaveAttribute('type', 'text'));

    // Toggle OFF
    const input2 = screen.getByTestId('openai-api-key-input');
    const toggle2 = within(input2.parentElement!).getByRole('button');
    fireEvent.click(toggle2);
    await waitFor(() => expect(screen.getByTestId('openai-api-key-input')).toHaveAttribute('type', 'password'));
  });

  it('baselines unsaved changes warning', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(mockElectronAPI.getSettings).toHaveBeenCalled());

    const openaiInput = screen.getByTestId('openai-api-key-input');
    fireEvent.change(openaiInput, { target: { value: 'changed-key' } });
    fireEvent.blur(openaiInput);

    await waitFor(() => {
      expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
    });
  });

  it('baselines file selection workflow', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(mockElectronAPI.getSettings).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('files-tab'));
    await screen.findByTestId('file-paths-section');

    const outputGroup = screen.getByText('Output Directory').closest('div');
    const browseBtn = within(outputGroup!).getByRole('button', { name: /browse/i });
    
    fireEvent.click(browseBtn);
    
    await waitFor(() => expect(mockElectronAPI.selectFile).toHaveBeenCalled());

    await waitFor(() => {
      expect(screen.getByLabelText(/Output Directory/i)).toHaveValue('/new/path/from/dialog');
    }, { timeout: 5000 });
  });

  it('baselines parameter constraints - generations vs variations', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(mockElectronAPI.getSettings).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('parameters-tab'));
    await screen.findByTestId('parameters-section');

    // Set variations to 20
    const variationsInput = screen.getByLabelText(/Variations per generation/i);
    fireEvent.change(variationsInput, { target: { value: '20' } });
    fireEvent.blur(variationsInput);

    // Wait for state update/re-render
    await waitFor(() => expect(screen.getByTestId('save-button')).not.toBeDisabled());

    // Set count to 1000 - find element AGAIN because it might have re-rendered
    const countInput = screen.getByLabelText(/Generations count/i);
    fireEvent.change(countInput, { target: { value: '1000' } });
    fireEvent.blur(countInput);

    // Wait for state update/re-render
    await waitFor(() => expect(screen.getByTestId('save-button')).not.toBeDisabled());

    const saveBtn = screen.getByTestId('save-button');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockElectronAPI.saveSettings).toHaveBeenCalledWith(expect.objectContaining({
        parameters: expect.objectContaining({
          count: 1000,
          variations: 10
        })
      }));
    });
  });

  it('baselines toggle switches and conditional visibility', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(mockElectronAPI.getSettings).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('processing-tab'));
    await screen.findByTestId('processing-section');

    expect(screen.queryByLabelText(/Remove.bg Size/i)).not.toBeInTheDocument();

    const removeBgLabel = screen.getByText('Remove Background');
    const removeBgToggle = within(removeBgLabel.closest('.flex')!).getByRole('switch');
    fireEvent.click(removeBgToggle);

    expect(await screen.findByLabelText(/Remove.bg Size/i)).toBeInTheDocument();
  });

  it('baselines save workflow', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(mockElectronAPI.getSettings).toHaveBeenCalled());

    const openaiInput = screen.getByTestId('openai-api-key-input');
    fireEvent.change(openaiInput, { target: { value: 'sk-new' } });
    fireEvent.blur(openaiInput);

    const saveBtn = screen.getByTestId('save-button');
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    fireEvent.click(saveBtn);

    expect(mockElectronAPI.saveSettings).toHaveBeenCalled();
    expect(await screen.findByTestId('success-message')).toBeInTheDocument();
  });

  it('baselines reset workflow', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(mockElectronAPI.getSettings).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('reset-button'));
    expect(screen.getByText(/Reset Settings/i)).toBeInTheDocument();

    const confirmResetBtn = screen.getByText(/Reset \(keep API keys\)/i);
    fireEvent.click(confirmResetBtn);

    await waitFor(() => expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument());
  });
});