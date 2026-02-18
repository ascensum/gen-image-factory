/**
 * Story 3.4 Phase 0.5: Visual regression baselines.
 * Run with CAPTURE_VISUAL_BASELINES=1 to capture screenshots to tests/visual-regression/baselines/.
 */
import path from 'path';
import { test, expect, Page } from '@playwright/test';

const BASELINES_DIR = path.join(__dirname, '../../visual-regression/baselines');
const CAPTURE = process.env.CAPTURE_VISUAL_BASELINES === '1';

declare global {
  interface Window {
    electronAPI?: any;
  }
}

/** Default settings shape so Settings panel renders without errors */
const defaultSettingsStub = {
  apiKeys: { openai: '', piapi: '', runware: '', removeBg: '' },
  filePaths: {
    outputDirectory: '',
    tempDirectory: '',
    systemPromptFile: '',
    keywordsFile: '',
    qualityCheckPromptFile: '',
    metadataPromptFile: '',
  },
  parameters: {
    processMode: 'relax',
    aspectRatios: ['1:1', '16:9', '9:16'],
    mjVersion: '6.1',
    openaiModel: 'gpt-4o',
    runwareModel: 'runware:101@1',
    runwareDimensionsCsv: '',
    runwareFormat: 'png',
    variations: 1,
    runwareAdvancedEnabled: false,
    loraEnabled: false,
    label: '',
    pollingTimeout: 15,
    pollingInterval: 1,
    enablePollingTimeout: true,
    keywordRandom: false,
    count: 1,
    generationRetryAttempts: 1,
    generationRetryBackoffMs: 0,
  },
  processing: {
    removeBg: false,
    removeBgFailureMode: 'soft',
    imageConvert: false,
    imageEnhancement: false,
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
  },
  ai: { runQualityCheck: true, runMetadataGen: true },
  advanced: { debugMode: false },
};

async function injectVisualStub(page: Page): Promise<void> {
  await page.addInitScript((settings: typeof defaultSettingsStub) => {
    if (window.electronAPI) return;
    const createAsync = () => {
      const fn = function () {};
      return new Proxy(fn, {
        apply: () => Promise.resolve(undefined),
        get: (_t, p) => (p === 'then' ? undefined : createAsync()),
      });
    };
    const createNs = () =>
      new Proxy(
        {},
        {
          get: (_t, p) => {
            if (p === 'then') return undefined;
            if (typeof p === 'string' && p.startsWith('on')) return () => {};
            return createAsync();
          },
        }
      );
    const jobStats = { totalJobs: 0, completedJobs: 0, failedJobs: 0, averageExecutionTime: 0, totalImagesGenerated: 0, successRate: 0 };
    const jobStatus = { state: 'idle', currentJob: null, progress: 0 };
    window.electronAPI = {
      ping: () => Promise.resolve('pong'),
      getAppVersion: () => Promise.resolve('0.0.0'),
      getSettings: () => Promise.resolve({ success: true, settings }),
      saveSettings: () => Promise.resolve(),
      selectFile: () => Promise.resolve({ success: true, filePath: '' }),
      generatedImages: createNs(),
      jobManagement: new Proxy(createNs(), {
        get(_t, p) {
          if (p === 'getJobHistory') return () => Promise.resolve([]);
          if (p === 'getStatistics' || p === 'getJobStatistics') return () => Promise.resolve(jobStats);
          if (p === 'getJobStatus') return () => Promise.resolve(jobStatus);
          if (p === 'getConfiguration') return () => Promise.resolve(null);
          if (p === 'getAllGeneratedImages') return () => Promise.resolve([]);
          if (p === 'getJobLogs') return () => Promise.resolve([]);
          if (p === 'getAllJobExecutions') return () => Promise.resolve([]);
          return (createNs() as any)[p];
        },
      }),
    };
  }, defaultSettingsStub);
}

test.describe('Visual regression baselines - Story 3.4 Phase 0.5', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await injectVisualStub(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('capture dashboard baseline', async ({ page }) => {
    test.skip(!CAPTURE);
    await page.getByRole('button', { name: /Open Dashboard/i }).click();
    await page.waitForSelector('text=Total Jobs', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(BASELINES_DIR, 'dashboard-initial.png'), fullPage: true });
  });

  test('capture failed images review baseline', async ({ page }) => {
    test.skip(!CAPTURE);
    await page.getByRole('button', { name: /Open Dashboard/i }).click();
    await page.locator('text=Success Rate').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByRole('button', { name: /open menu/i }).click();
    await page.getByRole('button', { name: /Failed Images Review/i }).click();
    await page.waitForSelector('text=Failed Images Review', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(BASELINES_DIR, 'failed-review-initial.png'), fullPage: true });
  });

  test('capture job management baseline', async ({ page }) => {
    test.skip(!CAPTURE);
    await page.getByRole('button', { name: /Open Dashboard/i }).click();
    await page.locator('text=Success Rate').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByRole('button', { name: /open menu/i }).click();
    await page.getByRole('button', { name: /Job Management/i }).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(BASELINES_DIR, 'job-management-initial.png'), fullPage: true });
  });

  test('capture settings tabs baselines', async ({ page }) => {
    test.skip(!CAPTURE);
    await page.getByRole('button', { name: /Open Settings/i }).click();
    await page.waitForSelector('[data-testid="settings-panel"]', { timeout: 10000 });
    await page.waitForTimeout(500);

    const tabs = [
      { testid: 'api-keys-tab', name: 'settings-api-keys.png' },
      { testid: 'files-tab', name: 'settings-files.png' },
      { testid: 'parameters-tab', name: 'settings-parameters.png' },
      { testid: 'processing-tab', name: 'settings-processing.png' },
      { testid: 'ai-tab', name: 'settings-ai.png' },
      { testid: 'advanced-tab', name: 'settings-advanced.png' },
    ];
    for (const { testid, name } of tabs) {
      await page.locator(`[data-testid="${testid}"]`).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(BASELINES_DIR, name), fullPage: true });
    }
  });
});
