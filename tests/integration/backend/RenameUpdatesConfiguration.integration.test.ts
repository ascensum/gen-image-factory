import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
  let adapter: any
  let store: any

  beforeEach(async () => {
    vi.resetModules()
    store = {
      configId: 1,
      execId: 2,
      configName: 'job_20240101_000000',
      execLabel: 'job_20240101_000000',
    }

    const mod = await import('../../../src/adapter/backendAdapter')
    adapter = new mod.BackendAdapter({ skipIpcSetup: true }) as any

    // Avoid real DB init: stub out model methods used by adapter paths under test
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined)
    adapter.jobConfig.saveSettings = vi.fn().mockResolvedValue({ success: true, id: store.configId })
    adapter.jobConfig.getConfigurationById = vi.fn().mockResolvedValue({
      success: true,
      configuration: { id: store.configId, name: store.configName, settings: {} },
    })

    adapter.jobExecution.saveJobExecution = vi.fn().mockResolvedValue({ success: true, id: store.execId })
    adapter.jobExecution.updateJobExecution = vi.fn().mockImplementation(async (_id: number, patch: any) => {
      if (patch && typeof patch.label === 'string') store.execLabel = patch.label
      return { success: true }
    })
    adapter.jobExecution.getJobHistory = vi.fn().mockResolvedValue({
      success: true,
      history: [{ id: store.execId, label: store.execLabel, configurationId: store.configId }],
    })
    adapter.jobExecution.getJobExecution = vi.fn().mockImplementation(async (id: number) => {
      if (id !== store.execId) return { success: false, error: 'Job execution not found' }
      return { success: true, execution: { id: store.execId, label: store.execLabel, configurationId: store.configId } }
    })
    adapter.jobExecution.renameJobExecution = vi.fn().mockImplementation(async (id: number, label: string) => {
      if (id !== store.execId) return { success: false, error: 'Job execution not found' }
      store.execLabel = label
      return { success: true }
    })

    vi.spyOn(adapter, 'getSettings').mockResolvedValue({
      success: true,
      settings: {
        apiKeys: { openai: 'ok', runware: 'ok', removeBg: '' },
        filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
        parameters: { processMode: 'relax', openaiModel: 'gpt-4o', runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1 },
        ai: { runQualityCheck: false, runMetadataGen: false },
        processing: {},
      },
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('renameJobExecution updates execution.label (configuration name unchanged)', async () => {
    // Start with fallback so we can see rename effect
    const config = {
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: { processMode: 'relax', openaiModel: 'gpt-4o', runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1 },
      ai: { runQualityCheck: false, runMetadataGen: false },
      processing: {},
      apiKeys: { openai: 'x', runware: 'y' }
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


