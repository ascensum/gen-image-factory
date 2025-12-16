import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ExportDialog from '../ExportDialog';

describe('ExportDialog', () => {
  beforeEach(() => {
    // @ts-expect-error
    window.electronAPI = { openExportsFolder: vi.fn().mockResolvedValue(undefined) };
  });

  const baseProps = (overrides = {}) => ({
    isOpen: true,
    onClose: vi.fn(),
    onExport: vi.fn().mockResolvedValue({ success: true, message: 'done', filename: 'export.xlsx' }),
    title: 'Export Results',
    description: 'desc',
    ...overrides,
  });

  it('shows progress then success and auto-close path', async () => {
    render(<ExportDialog {...baseProps()} />);

    fireEvent.click(screen.getByText('Export'));

    expect(await screen.findByText(/Export Successful/i)).toBeInTheDocument();
  });

  it('shows error state and allows retry', async () => {
    const onExport = vi.fn()
      .mockResolvedValueOnce({ success: false, error: 'bad path' })
      .mockResolvedValueOnce({ success: true, message: 'ok', filename: 'x.xlsx' });
    render(<ExportDialog {...baseProps({ onExport })} />);

    fireEvent.click(screen.getByText('Export'));

    expect(await screen.findByText(/Export Failed/i)).toBeInTheDocument();
    expect(screen.getByText(/bad path/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Try Again/i));

    expect(await screen.findByText(/Export Successful/i)).toBeInTheDocument();
  });
});
