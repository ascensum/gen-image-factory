import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPanel } from '../SettingsPanel';

declare global {
  interface Window {
    electronAPI?: any;
  }
}

describe('SettingsPanel - retry controls persistence', () => {
  it('saves generation retry attempts/backoff in payload', async () => {
    const mockSave = vi.fn().mockResolvedValue({ success: true });
    window.electronAPI = {
      getSettings: vi.fn().mockResolvedValue({ success: true, settings: undefined }),
      saveSettings: mockSave
    };

    render(<SettingsPanel />);

    // Switch to Parameters tab
    fireEvent.click(screen.getByTestId('parameters-tab'));

    // Set values
    const attempts = screen.getByLabelText('Generation Retry Attempts') as HTMLInputElement;
    fireEvent.blur(attempts, { target: { value: '2' } });
    const backoff = screen.getByLabelText('Retry Backoff (ms)') as HTMLInputElement;
    fireEvent.blur(backoff, { target: { value: '500' } });

    // Save
    const saveBtn = screen.getByTestId('save-button');
    fireEvent.click(saveBtn);

    expect(mockSave).toHaveBeenCalled();
    const payload = mockSave.mock.calls[0][0];
    expect(payload.parameters.generationRetryAttempts).toBe(2);
    expect(payload.parameters.generationRetryBackoffMs).toBe(500);
  });
});


