const { buildCustomRetryJobConfiguration } = require('../../../src/utils/buildCustomRetryJobConfiguration');

describe('buildCustomRetryJobConfiguration', () => {
  it('prefers global file paths over per-image job paths (mixed-batch custom retry)', () => {
    const globalSettings = {
      filePaths: {
        outputDirectory: '/global/out',
        tempDirectory: '/global/tmp',
        metadataPromptFile: '/global/meta.txt',
      },
    };
    const perImage = {
      id: 1,
      settings: {
        filePaths: {
          outputDirectory: '/job-a/out',
          tempDirectory: '/job-a/tmp',
          metadataPromptFile: '/job-a/old-meta.txt',
        },
      },
    };
    const out = buildCustomRetryJobConfiguration(globalSettings, perImage);
    expect(out.settings.filePaths.outputDirectory).toBe('/global/out');
    expect(out.settings.filePaths.tempDirectory).toBe('/global/tmp');
    expect(out.settings.filePaths.metadataPromptFile).toBe('/global/meta.txt');
  });

  it('falls back to per-image paths when global omits them', () => {
    const globalSettings = { filePaths: { outputDirectory: '/g/out' } };
    const perImage = {
      settings: {
        filePaths: {
          outputDirectory: '/legacy/out',
          tempDirectory: '/legacy/tmp',
        },
      },
    };
    const out = buildCustomRetryJobConfiguration(globalSettings, perImage);
    expect(out.settings.filePaths.outputDirectory).toBe('/g/out');
    expect(out.settings.filePaths.tempDirectory).toBe('/legacy/tmp');
  });
});
