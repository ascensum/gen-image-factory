/**
 * useApiKeys - API keys UI state: password visibility toggles.
 * Story 3.4 Phase 2: Extracted from SettingsPanel.tsx. Copy state logic EXACTLY (NO optimizations).
 */
import { useState, useCallback } from 'react';

const DEFAULT_SHOW_PASSWORDS: Record<string, boolean> = {
  openai: false,
  piapi: false,
  runware: false,
  removeBg: false,
};

export function useApiKeys() {
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({ ...DEFAULT_SHOW_PASSWORDS });

  const togglePasswordVisibility = useCallback((field: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  }, []);

  return { showPasswords, setShowPasswords, togglePasswordVisibility };
}
