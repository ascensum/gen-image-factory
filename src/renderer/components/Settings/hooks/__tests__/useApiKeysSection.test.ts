/**
 * Story 3.4 Phase 5c.9: Unit tests for useApiKeysSection hook.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useApiKeysSection } from '../useApiKeysSection';

describe('useApiKeysSection', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      electronAPI: {
        isSecureStorageAvailable: vi.fn().mockResolvedValue(true),
        openExternal: vi.fn()
      }
    });
  });

  it('initializes with default services when none provided', () => {
    const { result } = renderHook(() => useApiKeysSection({}));
    expect(result.current.services).toHaveLength(1);
    expect(result.current.services[0].name).toBe('openai');
    expect(result.current.services[0].apiKey).toBe('');
  });

  it('uses prop services when provided', () => {
    const services = [
      { name: 'openai', apiKey: '', isValid: false, isTested: false, secureStorageAvailable: false },
      { name: 'anthropic', apiKey: '', isValid: false, isTested: false, secureStorageAvailable: false }
    ];
    const { result } = renderHook(() => useApiKeysSection({ services }));
    expect(result.current.services).toHaveLength(2);
    expect(result.current.services.map((s) => s.name)).toEqual(['openai', 'anthropic']);
  });

  it('updates service apiKey and validity on handleApiKeyChange', () => {
    const onApiKeyChange = vi.fn();
    const { result } = renderHook(() =>
      useApiKeysSection({ onApiKeyChange })
    );
    act(() => {
      result.current.handleApiKeyChange('openai', 'sk-123456789012345678901234567890123456789012345678');
    });
    expect(result.current.services[0].apiKey).toBe('sk-123456789012345678901234567890123456789012345678');
    expect(result.current.services[0].isValid).toBe(true);
    expect(onApiKeyChange).toHaveBeenCalledWith('openai', 'sk-123456789012345678901234567890123456789012345678');
  });

  it('marks invalid key when format is wrong', () => {
    const { result } = renderHook(() => useApiKeysSection({}));
    act(() => {
      result.current.handleApiKeyChange('openai', 'invalid');
    });
    expect(result.current.services[0].isValid).toBe(false);
  });

  it('removes service on handleRemoveService', () => {
    const services = [
      { name: 'openai', apiKey: '', isValid: false, isTested: false, secureStorageAvailable: false },
      { name: 'anthropic', apiKey: '', isValid: false, isTested: false, secureStorageAvailable: false }
    ];
    const onRemoveService = vi.fn();
    const { result } = renderHook(() => useApiKeysSection({ services, onRemoveService }));
    act(() => {
      result.current.handleRemoveService('anthropic');
    });
    expect(result.current.services).toHaveLength(1);
    expect(result.current.services[0].name).toBe('openai');
    expect(onRemoveService).toHaveBeenCalledWith('anthropic');
  });

  it('toggles key visibility per service', () => {
    const { result } = renderHook(() => useApiKeysSection({}));
    expect(result.current.visibleKeys['openai']).toBeFalsy();
    act(() => result.current.toggleKeyVisibility('openai'));
    expect(result.current.visibleKeys['openai']).toBe(true);
    act(() => result.current.toggleKeyVisibility('openai'));
    expect(result.current.visibleKeys['openai']).toBe(false);
  });

  it('getServiceTemplate returns template for known service', () => {
    const { result } = renderHook(() => useApiKeysSection({}));
    const template = result.current.getServiceTemplate('openai');
    expect(template.name).toBe('openai');
    expect(template.displayName).toBe('OpenAI');
    expect(template.placeholder).toBe('sk-...');
  });

  it('getServiceTemplate returns custom template for unknown service', () => {
    const { result } = renderHook(() => useApiKeysSection({}));
    const template = result.current.getServiceTemplate('unknown');
    expect(template.name).toBe('custom');
  });
});
