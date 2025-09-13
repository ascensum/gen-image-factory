import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../src/services/jobRunner', () => ({
  JobRunner: class {
    constructor() { this.backendAdapter = null as any; this.configurationId = null as any; this.databaseExecutionId = null as any; this.isRerun = false }
    on() {}
    async getJobStatus() { return { status: 'idle' } }
    async startJob(config: any) {
      const label = (config?.parameters?.label || '').trim()
      const save = await this.backendAdapter.saveJobExecution({
        configurationId: this.configurationId,
        startedAt: new Date(),
        status: 'running',
        totalImages: 0,
        successfulImages: 0,
        failedImages: 0,
        errorMessage: null,
        label
      })
      this.databaseExecutionId = save.id
      await this.backendAdapter.updateJobExecution(this.databaseExecutionId, {
        configurationId: this.configurationId,
        startedAt: new Date(),
        completedAt: new Date(),
        status: 'completed',
        totalImages: 0,
        generatedImages: 0,
        failedImages: 0,
        errorMessage: null,
        label
      })
      return { success: true, jobId: 'ok', executionId: this.databaseExecutionId }
    }
  }
}))

import { BackendAdapter } from '../../../src/adapter/backendAdapter'

describe('Label is not overwritten on completion', () => {
  let adapter: BackendAdapter

  beforeEach(() => {
    adapter = new BackendAdapter({ skipIpcSetup: true }) as any
    vi.spyOn(adapter, 'getSettings').mockResolvedValue({
      success: true,
      settings: {
        apiKeys: { openai: 'ok', piapi: 'ok', removeBg: '' },
        filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
        parameters: { processMode: 'single', openaiModel: 'gpt-4o' },
        ai: { runQualityCheck: false, runMetadataGen: false },
        processing: {}
      }
    } as any)
  })

  afterEach(() => vi.restoreAllMocks())

  it('keeps the provided label after job finishes', async () => {
    const label = 'My Provided Label'
    const config = {
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: { processMode: 'single', openaiModel: 'gpt-4o', label },
      ai: { runQualityCheck: false, runMetadataGen: false },
      processing: {},
      apiKeys: { openai: 'x', piapi: 'y' }
    }

    const start = await adapter.startJob(config as any)
    expect(start.success).toBe(true)

    const exec = await adapter.getJobExecution(start.executionId)
    expect(exec.success).toBe(true)
    expect(exec.execution.label).toBe(label)
  })
})


