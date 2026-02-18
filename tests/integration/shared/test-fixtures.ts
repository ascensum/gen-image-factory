/**
 * Test data factories and sample configurations for BackendAdapter integration tests (Story 3.5 Phase 4).
 * Each file < 400 lines (ADR-011).
 */

/** Minimal valid job config for startJob (test mode). */
export function minimalJobConfig(overrides: Record<string, unknown> = {}) {
  return {
    apiKeys: {
      openai: 'test-openai-key',
      runware: 'test-runware-key',
      removeBg: 'test-removebg-key',
    },
    filePaths: {
      outputDirectory: './test-output',
      tempDirectory: './test-temp',
      logDirectory: './test-logs',
    },
    parameters: {
      runwareModel: 'runware:101@1',
      runwareDimensionsCsv: '1024x1024,1920x1080',
      runwareFormat: 'png',
      variations: 1,
      pollingTimeout: 15,
      enablePollingTimeout: true,
    },
    processing: {
      removeBg: false,
      imageConvert: false,
      convertToJpg: false,
      trimTransparentBackground: false,
      jpgBackground: 'white',
      jpgQuality: 100,
      pngQuality: 100,
      removeBgSize: 'auto',
    },
    ai: {
      runQualityCheck: true,
      runMetadataGen: true,
    },
    advanced: {
      debugMode: false,
      autoSave: true,
    },
    ...overrides,
  };
}

/** Short config for tests that only need a few fields. */
export function shortJobConfig(overrides: Record<string, unknown> = {}) {
  return {
    apiKeys: {
      openai: 'test-openai-key',
      piapi: 'test-piapi-key',
    },
    filePaths: {
      outputDirectory: './test-output',
    },
    parameters: {
      runwareModel: 'runware:101@1',
      runwareFormat: 'png',
      variations: 1,
    },
    processing: {},
    ai: {},
    advanced: {},
    ...overrides,
  };
}

/** Full settings object for saveSettings. */
export function fullSettingsFixture(overrides: Record<string, unknown> = {}) {
  return {
    apiKeys: {
      openai: 'test-openai-key',
      piapi: 'test-piapi-key',
      removeBg: 'test-removebg-key',
    },
    filePaths: {
      outputDirectory: './test-output',
      tempDirectory: './test-temp',
      logDirectory: './test-logs',
    },
    parameters: {
      runwareModel: 'runware:101@1',
      runwareDimensionsCsv: '1024x1024,1920x1080',
      runwareFormat: 'png',
      variations: 1,
      pollingTimeout: 15,
      enablePollingTimeout: true,
    },
    processing: {
      removeBg: false,
      imageConvert: false,
      convertToJpg: false,
      trimTransparentBackground: false,
      jpgBackground: 'white',
      jpgQuality: 100,
      pngQuality: 100,
      removeBgSize: 'auto',
    },
    ai: {
      runQualityCheck: true,
      runMetadataGen: true,
    },
    advanced: {
      debugMode: false,
      autoSave: true,
    },
    ...overrides,
  };
}

/** Saved settings shape for config used in rerun tests. */
export function savedSettingsForRerun(overrides: Record<string, unknown> = {}) {
  return {
    apiKeys: { openai: 'test', runware: 'test' },
    filePaths: { outputDirectory: './test-output' },
    parameters: {
      runwareModel: 'runware:101@1',
      runwareFormat: 'png',
      variations: 1,
    },
    ...overrides,
  };
}
