import { describe, it, expect } from 'vitest';
import { formatSaturationDisplay, formatSharpeningDisplay } from './formatProcessingDisplay';

describe('formatSharpeningDisplay', () => {
  it('shows half steps and integers cleanly', () => {
    expect(formatSharpeningDisplay(7.5)).toBe('7.5');
    expect(formatSharpeningDisplay(8)).toBe('8');
    expect(formatSharpeningDisplay('7.5')).toBe('7.5');
  });

  it('clamps to 0–10 for display', () => {
    expect(formatSharpeningDisplay(12)).toBe('10');
    expect(formatSharpeningDisplay(-1)).toBe('0');
  });
});

describe('formatSaturationDisplay', () => {
  it('formats one decimal when needed', () => {
    expect(formatSaturationDisplay(1.4)).toBe('1.4');
    expect(formatSaturationDisplay(1)).toBe('1');
  });
});
