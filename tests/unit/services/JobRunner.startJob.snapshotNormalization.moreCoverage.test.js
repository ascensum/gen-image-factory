import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { JobRunner } = require('../../../src/services/jobRunner');

describe('JobRunner.startJob configurationSnapshot normalization (more coverage)', () => {
  let prevGlobal;

  beforeEach(() => {
    vi.clearAllMocks();
    prevGlobal = global.backendAdapter;
  });

  afterEach(() => {
    global.backendAdapter = prevGlobal;
    // Ensure cleanup even if global.backendAdapter was not previously defined
    try { delete global.backendAdapter; } catch {}
  });

  it('sanitizes execution snapshot: drops apiKeys, normalizes removeBgFailureMode, derives runwareAdvancedEnabled', async () => {
    const runner = new JobRunner();
    runner.configurationId = 777;

    const saveJobExecution = vi.fn(async (payload) => ({ success: true, id: 123, _payload: payload }));
    global.backendAdapter = { saveJobExecution };

    // Prevent executing the full pipeline; focus this test on startJob snapshot logic.
    runner.executeJob = vi.fn(async () => undefined);

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw', removeBg: 'rb' },
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: {
        processMode: 'relax',
        // leave runwareAdvancedEnabled undefined but include advanced payload -> should become true
        runwareAdvanced: { CFGScale: 7, steps: 28, scheduler: 'DPM++' },
      },
      processing: {
        removeBg: true,
        // invalid mode should normalize to 'approve'
        removeBgFailureMode: 'invalid_mode',
      },
      ai: { runQualityCheck: false, runMetadataGen: false },
    };

    const res = await runner.startJob(config);
    expect(res.success).toBe(true);

    expect(saveJobExecution).toHaveBeenCalledTimes(1);
    const payload = saveJobExecution.mock.calls[0][0];

    // Snapshot should exist and exclude apiKeys entirely
    expect(payload.configurationSnapshot).toBeTruthy();
    expect(payload.configurationSnapshot.apiKeys).toBeUndefined();

    // Derived flags
    expect(payload.configurationSnapshot.parameters.runwareAdvancedEnabled).toBe(true);

    // Normalization
    expect(payload.configurationSnapshot.processing.removeBgFailureMode).toBe('approve');
  });
});
