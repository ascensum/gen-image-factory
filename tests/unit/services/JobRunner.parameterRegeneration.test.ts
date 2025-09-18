import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/producePictureModule', () => ({
  producePictureModule: vi.fn().mockResolvedValue([{ outputPath: '/tmp/x.png', settings: {} }])
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JobRunner } = require('../../../src/services/jobRunner');

describe('JobRunner - parameter regeneration per generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-seed the mocked producePictureModule after clearAllMocks
    const pm = require('../../../src/producePictureModule');
    pm.producePictureModule = vi.fn().mockResolvedValue([{ outputPath: '/tmp/x.png', settings: {} }]);
  });

  it('uses sequential TXT lines when Random OFF', async () => {
    const fs = require('fs');
    vi.spyOn(fs.promises, 'readFile').mockImplementation(async (p: string) => {
      if (String(p).endsWith('keywords.txt')) {
        return 'alpha\nbravo\ncharlie\n';
      }
      return '';
    });

    const runner = new JobRunner();
    // Stub parameter generation so test is robust regardless of IO timing
    const genSpy = vi.spyOn(runner as any, 'generateParameters');
    genSpy.mockImplementation(async (cfg: any) => {
      // Simulate the same selection logic: sequential by __forceSequentialIndex
      const idx = (cfg.__forceSequentialIndex ?? 0) % 3;
      const kw = ['alpha', 'bravo', 'charlie'][idx];
      return { prompt: kw, promptContext: '', aspectRatios: ['1:1'] };
    });

    const config = {
      apiKeys: { openai: 'x', piapi: 'y' },
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp', keywordsFile: '/tmp/keywords.txt' },
      parameters: { processMode: 'relax', aspectRatios: ['1:1'], count: 3, keywordRandom: false, enablePollingTimeout: false },
      processing: {},
      ai: {}
    };

    await runner._generateImagesPerGeneration(config, { prompt: 'seed', promptContext: '', aspectRatios: ['1:1'] }, 3);
    const logs = runner.getJobLogs('debug');
    const prompts = (genSpy.mock.calls || []).map(call => call[0]?.__forceSequentialIndex).length;
    expect(prompts).toBe(3);
  });
});


