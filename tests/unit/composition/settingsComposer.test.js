import { describe, it, expect, vi } from 'vitest';

const SettingsComposer = require('../../../src/composition/settingsComposer');

const defaultShape = () => ({
  apiKeys: { openai: '', piapi: '', removeBg: '' },
  filePaths: {
    outputDirectory: '/default/out',
    tempDirectory: '/default/tmp',
    systemPromptFile: '',
    keywordsFile: '',
    qualityCheckPromptFile: '',
    metadataPromptFile: ''
  },
  parameters: {
    processMode: 'relax',
    count: 1,
    variations: 1,
    label: '',
    runwareModel: 'runware:101@1',
    runwareDimensionsCsv: '',
    runwareFormat: 'png',
    enablePollingTimeout: true,
    pollingTimeout: 15,
    pollingInterval: 1
  },
  processing: {
    removeBg: false,
    imageConvert: false,
    imageEnhancement: true,
    sharpening: 5,
    saturation: 1.4,
    convertToJpg: false,
    convertToWebp: false,
    trimTransparentBackground: false,
    jpgBackground: 'white',
    jpgQuality: 85,
    pngQuality: 100,
    webpQuality: 85,
    removeBgSize: 'auto',
    removeBgFailureMode: 'approve'
  },
  ai: { runQualityCheck: true, runMetadataGen: true },
  advanced: { debugMode: false }
});

describe('SettingsComposer (legacy backendAdapter parity)', () => {
  it('getSettings shallow-merges: DB `processing` replaces defaults.processing wholesale', async () => {
    const configRepository = {
      getSettings: vi.fn().mockResolvedValue({
        success: true,
        settings: {
          processing: { imageEnhancement: false, imageConvert: true }
        }
      })
    };
    const securityService = {
      getSecret: vi.fn().mockResolvedValue({ success: false })
    };
    const composer = new SettingsComposer({
      configRepository,
      securityService,
      getDefaultSettings: defaultShape
    });
    const r = await composer.getSettings();
    expect(r.success).toBe(true);
    expect(r.settings.processing.imageEnhancement).toBe(false);
    expect(r.settings.processing.imageConvert).toBe(true);
    expect(r.settings.processing.removeBg).toBeUndefined();
  });

  it('prepareJobConfig: uses saved processing and ai only (ignores stale IPC); merge apiKeys; parameters unchanged', async () => {
    const stored = {
      success: true,
      settings: {
        ...defaultShape(),
        apiKeys: { openai: 'k' },
        processing: { imageEnhancement: false, sharpening: 0 },
        ai: { runQualityCheck: false, runMetadataGen: true }
      }
    };
    const configRepository = {
      getSettings: vi.fn().mockResolvedValue(stored)
    };
    const securityService = {
      getSecret: vi.fn().mockResolvedValue({ success: false })
    };
    const composer = new SettingsComposer({
      configRepository,
      securityService,
      getDefaultSettings: defaultShape
    });
    const out = await composer.prepareJobConfig({
      processing: { imageEnhancement: true, sharpening: 99 },
      parameters: { count: 5, label: 'L' },
      ai: { runQualityCheck: true, runMetadataGen: false }
    });
    expect(out.processing.imageEnhancement).toBe(false);
    expect(out.processing.sharpening).toBe(0);
    expect(out.parameters.count).toBe(5);
    expect(out.parameters.label).toBe('L');
    expect(out.ai.runQualityCheck).toBe(false);
    expect(out.ai.runMetadataGen).toBe(true);
    expect(out.apiKeys.openai).toBe('k');
  });
});
