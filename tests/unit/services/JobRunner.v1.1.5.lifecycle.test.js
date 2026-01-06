import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const originalCache = new Map();
const rememberCache = (id) => {
  if (!originalCache.has(id)) originalCache.set(id, require.cache[id]);
};
const restoreCache = () => {
  for (const [id, entry] of originalCache.entries()) {
    if (entry) require.cache[id] = entry;
    else delete require.cache[id];
  }
  originalCache.clear();
};

describe('JobRunner v1.1.5 Lifecycle (Universal Metadata Bridge)', () => {
  let JobRunner;
  let runner;
  let mockAiVision;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock dependencies
    mockAiVision = {
      generateMetadata: vi.fn().mockResolvedValue({ new_title: 'New Title', new_description: 'New Desc' }),
      runQualityCheck: vi.fn(),
    };
    
    // CJS Mocking Strategy
    const aiVisionId = require.resolve('../../../src/aiVision');
    rememberCache(aiVisionId);
    require.cache[aiVisionId] = {
      id: aiVisionId,
      filename: aiVisionId,
      loaded: true,
      exports: mockAiVision
    };

    const produceId = require.resolve('../../../src/producePictureModule');
    rememberCache(produceId);
    require.cache[produceId] = {
      id: produceId,
      filename: produceId,
      loaded: true,
      exports: { producePictureModule: vi.fn() }
    };

    const paramsId = require.resolve('../../../src/paramsGeneratorModule');
    rememberCache(paramsId);
    require.cache[paramsId] = {
      id: paramsId,
      filename: paramsId,
      loaded: true,
      exports: { paramsGeneratorModule: vi.fn() }
    };

    // Reload JobRunner to pick up mocks
    const jobRunnerId = require.resolve('../../../src/services/jobRunner');
    rememberCache(jobRunnerId);
    delete require.cache[jobRunnerId];
    
    const mod = require('../../../src/services/jobRunner');
    JobRunner = mod.JobRunner;
    runner = new JobRunner();
  });

  afterEach(() => {
    restoreCache();
    vi.clearAllMocks();
  });

  it('Rerun with Custom Settings: uses imageMappingId to update existing record when mappingId is missing', async () => {
    // 1. Setup Mock Image Record (Retrieved from DB - has imageMappingId, no mappingId)
    const mockImage = {
      id: 101,
      imageMappingId: 'legacy_map_101', // The persisted ID
      mappingId: undefined, // Runtime ID missing on retrieval
      tempImagePath: '/tmp/test.png',
      metadata: { prompt: 'Original Prompt' }
    };

    // 2. Setup DB Mock
    const dbUpdateSpy = vi.fn().mockResolvedValue({ success: true });
    runner.db = {
      generatedImage: {
        update: dbUpdateSpy
      }
    };
    
    // Mock backendAdapter for failure handling (though we expect success here)
    runner.backendAdapter = {
      updateQCStatusByMappingId: vi.fn(),
      updateGeneratedImageByMappingId: vi.fn()
    };

    // 3. Configure Custom Settings (Metadata Enabled)
    const customSettings = {
      ai: {
        runMetadataGen: true,
        metadataPrompt: 'Fix titles'
      },
      parameters: {
        openaiModel: 'gpt-4o'
      }
    };

    // 4. Execution
    await runner.generateMetadata([mockImage], customSettings);

    // 5. Verification
    // Ensure the bridge worked: used imageMappingId ('legacy_map_101') for the update
    expect(dbUpdateSpy).toHaveBeenCalledWith(
      { mappingId: 'legacy_map_101' }, 
      expect.objectContaining({
        metadata: expect.stringContaining('"title":"New Title"')
      })
    );
    
    // Ensure AI was called with correct prompts
    expect(mockAiVision.generateMetadata).toHaveBeenCalledWith(
      '/tmp/test.png',
      'Original Prompt',
      'Fix titles',
      'gpt-4o'
    );
  });
});
