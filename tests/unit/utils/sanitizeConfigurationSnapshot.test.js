import { describe, it, expect } from 'vitest';

const { sanitizeConfigurationSnapshot } = require('../../../src/utils/sanitizeConfigurationSnapshot.js');

describe('sanitizeConfigurationSnapshot', () => {
  it('returns null for empty input', () => {
    expect(sanitizeConfigurationSnapshot(null)).toBeNull();
    expect(sanitizeConfigurationSnapshot(undefined)).toBeNull();
  });

  it('strips apiKeys and keeps processing', () => {
    const out = sanitizeConfigurationSnapshot({
      apiKeys: { openai: 'secret', removeBg: 'x' },
      processing: { removeBg: true, imageEnhancement: false },
      parameters: { count: 1 }
    });
    expect(out.apiKeys).toBeUndefined();
    expect(out.processing.removeBg).toBe(true);
    expect(out.parameters.count).toBe(1);
  });

  it('sets runwareAdvancedEnabled from advanced payload', () => {
    const out = sanitizeConfigurationSnapshot({
      parameters: { runwareAdvanced: { CFGScale: 7, steps: 20 } }
    });
    expect(out.parameters.runwareAdvancedEnabled).toBe(true);
  });
});
