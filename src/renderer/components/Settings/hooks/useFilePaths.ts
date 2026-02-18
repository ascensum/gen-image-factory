/**
 * useFilePaths - Helper to update a single file path in form state.
 * Story 3.4 Phase 2: Extracted from SettingsPanel.tsx. Copy state logic EXACTLY (NO optimizations).
 */
import { useCallback } from 'react';
import type { SettingsObject } from '../../../../types/settings';

type SetForm = React.Dispatch<React.SetStateAction<SettingsObject>>;

export function useFilePaths(setForm: SetForm) {
  const updateFilePath = useCallback(
    (key: keyof SettingsObject['filePaths'], value: string) => {
      setForm((prev) => ({
        ...prev,
        filePaths: {
          ...prev.filePaths,
          [key]: value,
        },
      }));
    },
    [setForm]
  );

  return { updateFilePath };
}
