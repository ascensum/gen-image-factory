import { describe, it, expect } from 'vitest';
import { coerceProcessingBoolean } from './coerceProcessingBoolean';

describe('coerceProcessingBoolean', () => {
  it('treats string false as off', () => {
    expect(coerceProcessingBoolean('false')).toBe(false);
    expect(coerceProcessingBoolean('FALSE')).toBe(false);
    expect(coerceProcessingBoolean('0')).toBe(false);
    expect(coerceProcessingBoolean('no')).toBe(false);
    expect(coerceProcessingBoolean('off')).toBe(false);
  });

  it('treats string true as on', () => {
    expect(coerceProcessingBoolean('true')).toBe(true);
    expect(coerceProcessingBoolean('1')).toBe(true);
    expect(coerceProcessingBoolean('yes')).toBe(true);
  });

  it('passes through real booleans', () => {
    expect(coerceProcessingBoolean(true)).toBe(true);
    expect(coerceProcessingBoolean(false)).toBe(false);
  });

  it('empty string is false', () => {
    expect(coerceProcessingBoolean('')).toBe(false);
  });
});
