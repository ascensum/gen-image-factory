import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSettings } from '../hooks/useSettings';
import { useFilePaths } from '../hooks/useFilePaths';

describe('useFilePaths', () => {
  it('updateFilePath updates a single file path in form', () => {
    const { result: settingsResult } = renderHook(() => useSettings());
    const { result: filePathsResult } = renderHook(() =>
      useFilePaths(settingsResult.current.setForm)
    );

    act(() => {
      filePathsResult.current.updateFilePath('outputDirectory', '/new/output');
    });

    expect(settingsResult.current.form.filePaths.outputDirectory).toBe('/new/output');
  });

  it('updateFilePath does not overwrite other file paths', () => {
    const { result: settingsResult } = renderHook(() => useSettings());

    act(() => {
      settingsResult.current.setForm((prev) => ({
        ...prev,
        filePaths: { ...prev.filePaths, keywordsFile: '/keep/keywords.txt' },
      }));
    });

    const { result: filePathsResult } = renderHook(() =>
      useFilePaths(settingsResult.current.setForm)
    );

    act(() => {
      filePathsResult.current.updateFilePath('tempDirectory', '/new/temp');
    });

    expect(settingsResult.current.form.filePaths.tempDirectory).toBe('/new/temp');
    expect(settingsResult.current.form.filePaths.keywordsFile).toBe('/keep/keywords.txt');
  });
});
