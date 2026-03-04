import { describe, it, expect } from 'vitest';
import { parseLoraLine, parseLoraText } from '../lora';

describe('lora utils', () => {
  describe('parseLoraLine', () => {
    it('parses simple model:weight (old format)', () => {
      expect(parseLoraLine('flux-lora:0.8')).toEqual({ model: 'flux-lora', weight: 0.8 });
      expect(parseLoraLine('artist-style:0.5')).toEqual({ model: 'artist-style', weight: 0.5 });
      expect(parseLoraLine('x:1')).toEqual({ model: 'x', weight: 1 });
    });

    it('parses civitai-style ID without weight (whole line is model)', () => {
      expect(parseLoraLine('civitai:144142@160130')).toEqual({
        model: 'civitai:144142@160130',
        weight: 1,
      });
    });

    it('parses civitai-style ID with weight (last colon separates weight)', () => {
      expect(parseLoraLine('civitai:144142@160130:0.8')).toEqual({
        model: 'civitai:144142@160130',
        weight: 0.8,
      });
      expect(parseLoraLine('civitai:101055@126601:1')).toEqual({
        model: 'civitai:101055@126601',
        weight: 1,
      });
    });

    it('returns weight 1 when line has no colon', () => {
      expect(parseLoraLine('some-model')).toEqual({ model: 'some-model', weight: 1 });
    });

    it('treats segment after last colon as weight only when in 0-10 range', () => {
      // 160130 is > 10 so not treated as weight
      expect(parseLoraLine('civitai:144142@160130')).toEqual({
        model: 'civitai:144142@160130',
        weight: 1,
      });
    });

    it('returns null for empty/whitespace line', () => {
      expect(parseLoraLine('')).toBeNull();
      expect(parseLoraLine('   ')).toBeNull();
    });
  });

  describe('parseLoraText', () => {
    it('parses multiple lines', () => {
      const text = 'civitai:144142@160130:0.8\nflux-lora:0.5';
      expect(parseLoraText(text)).toEqual([
        { model: 'civitai:144142@160130', weight: 0.8 },
        { model: 'flux-lora', weight: 0.5 },
      ]);
    });

    it('skips empty lines', () => {
      expect(parseLoraText('civitai:101055@126601\n\nflux:1')).toEqual([
        { model: 'civitai:101055@126601', weight: 1 },
        { model: 'flux', weight: 1 },
      ]);
    });
  });
});
