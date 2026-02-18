import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useApiKeys } from '../hooks/useApiKeys';

describe('useApiKeys', () => {
  it('returns initial showPasswords all false', () => {
    const { result } = renderHook(() => useApiKeys());

    expect(result.current.showPasswords.openai).toBe(false);
    expect(result.current.showPasswords.runware).toBe(false);
    expect(result.current.showPasswords.removeBg).toBe(false);
  });

  it('togglePasswordVisibility toggles a single field', () => {
    const { result } = renderHook(() => useApiKeys());

    act(() => {
      result.current.togglePasswordVisibility('openai');
    });
    expect(result.current.showPasswords.openai).toBe(true);

    act(() => {
      result.current.togglePasswordVisibility('openai');
    });
    expect(result.current.showPasswords.openai).toBe(false);
  });

  it('togglePasswordVisibility does not affect other fields', () => {
    const { result } = renderHook(() => useApiKeys());

    act(() => {
      result.current.togglePasswordVisibility('runware');
    });

    expect(result.current.showPasswords.runware).toBe(true);
    expect(result.current.showPasswords.openai).toBe(false);
    expect(result.current.showPasswords.removeBg).toBe(false);
  });
});
