import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BackendAdapter } from '../../../src/adapter/backendAdapter'

vi.mock('../../../src/services/jobRunner', () => ({
  JobRunner: class {
    constructor() { this.backendAdapter = null as any; this.configurationId = null as any; this.databaseExecutionId = null as any; this.isRerun = false }
    on() {}
    async getJobStatus() { return { status: 'idle' } }
    async startJob(config: any) {
      const label = (config?.parameters?.label || '').trim() || 'job_20240101_000000'
      const save = await this.backendAdapter.saveJobExecution({ configurationId: this.configurationId, startedAt: new Date(), status: 'running', totalImages: 0, successfulImages: 0, failedImages: 0, errorMessage: null, label })
      this.databaseExecutionId = save.id
      await this.backendAdapter.updateJobExecution(this.databaseExecutionId, { configurationId: this.configurationId, startedAt: new Date(), completedAt: new Date(), status: 'completed', totalImages: 0, generatedImages: 0, failedImages: 0, errorMessage: null, label })
      return { success: true, jobId: 'ok', executionId: this.databaseExecutionId }
    }
  }
}))

describe('Inline rename updates configuration name', () => {
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

  it('renameJobExecution updates execution.label (configuration name unchanged)', async () => {
    // Start with fallback so we can see rename effect
    const config = {
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: { processMode: 'single', openaiModel: 'gpt-4o' },
      ai: { runQualityCheck: false, runMetadataGen: false },
      processing: {},
      apiKeys: { openai: 'x', piapi: 'y' }
    }
    const start = await adapter.startJob(config as any)
    expect(start.success).toBe(true)

    const history = await adapter.getJobHistory(5)
    const job = history.find((h: any) => !!h.id) || history[0]

    const newLabel = 'Renamed Label'
    const rename = await adapter.renameJobExecution(job.id, newLabel)
    expect(rename.success).toBe(true)

    const updatedExec = await adapter.getJobExecution(job.id)
    expect(updatedExec.success).toBe(true)
    expect(updatedExec.execution.label).toBe(newLabel)

    // Configuration name should remain as originally saved (not coupled to inline rename)
    const cfg = await adapter.getJobConfigurationById(updatedExec.execution.configurationId)
    expect(cfg.success).toBe(true)
    expect(cfg.configuration.name).not.toBe(newLabel)
  })
})


