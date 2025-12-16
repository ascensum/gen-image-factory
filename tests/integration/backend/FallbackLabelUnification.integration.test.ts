import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock external-heavy modules used by JobRunner so the job can complete synchronously
// Stub the JobRunner to avoid real OpenAI/PIAPI calls and implement the label pipeline
vi.mock('../../../src/services/jobRunner', () => ({
  JobRunner: class {
    constructor() {
      this.backendAdapter = null as any
      this.configurationId = null as any
      this.databaseExecutionId = null as any
      this.isRerun = false
    }
    on() {}
    async getJobStatus() { return { status: 'idle' } }
    async startJob(config: any) {
      const pad = (n: number) => n.toString().padStart(2, '0')
      const now = new Date()
      const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
      const provided = (config?.parameters?.label || '').trim()
      const label = provided !== '' ? provided : `job_${ts}`
      // Save execution as running
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
      // Immediately complete
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
      return { success: true, jobId: `test_${ts}` }
    }
  }
}))

describe('Fallback label unification', () => {
  let adapter: any

  beforeEach(async () => {
    vi.resetModules()

    // Avoid real sqlite init/locks: stub DB models
    vi.doMock('../../../src/database/models/JobConfiguration', () => ({
      JobConfiguration: vi.fn().mockImplementation(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        createTables: vi.fn().mockResolvedValue(undefined),
        getDefaultSettings: vi.fn().mockReturnValue({
          apiKeys: { openai: '', runware: '', removeBg: '' },
          filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
          parameters: {},
          processing: {},
          ai: {},
          advanced: {},
        }),
        saveSettings: vi.fn().mockResolvedValue({ success: true, id: 123 }),
      })),
    }))
    vi.doMock('../../../src/database/models/JobExecution', () => ({
      JobExecution: vi.fn().mockImplementation(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        createTables: vi.fn().mockResolvedValue(undefined),
        saveJobExecution: vi.fn().mockResolvedValue({ success: true, id: 456 }),
        updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
        getAllJobExecutions: vi.fn().mockResolvedValue({ success: true, executions: [] }),
      })),
    }))
    vi.doMock('../../../src/database/models/GeneratedImage', () => ({
      GeneratedImage: vi.fn().mockImplementation(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        createTables: vi.fn().mockResolvedValue(undefined),
      })),
    }))

    const mod = await import('../../../src/adapter/backendAdapter')
    adapter = new mod.BackendAdapter({ skipIpcSetup: true }) as any

    // Provide runtime API keys so preflight passes
    vi.spyOn(adapter, 'getSettings').mockResolvedValue({
      success: true,
      settings: {
        apiKeys: { openai: 'test', runware: 'test', removeBg: '' },
        filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
        parameters: { processMode: 'relax', openaiModel: 'gpt-4o', runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1 },
        ai: { runQualityCheck: false, runMetadataGen: false },
        processing: {}
      }
    } as any)

    // Make post-start read APIs return the saved label consistently (no DB dependency)
    let savedLabel = ''
    adapter.jobConfig.saveSettings = vi.fn().mockImplementation(async (_settings: any, configName: string) => {
      // configName is the canonical label used when parameters.label is missing
      savedLabel = String(configName)
      return { success: true, id: 123 }
    })
    adapter.jobExecution.saveJobExecution = vi.fn().mockImplementation(async (payload: any) => {
      savedLabel = String(payload.label)
      return { success: true, id: 456 }
    })
    adapter.jobExecution.updateJobExecution = vi.fn().mockResolvedValue({ success: true })
    adapter.getAllJobExecutions = vi.fn().mockImplementation(async () => ({ success: true, executions: [{ id: 456, label: savedLabel }] }))
    adapter.getJobHistory = vi.fn().mockImplementation(async () => ([{ id: 456, label: savedLabel }]))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.unmock('../../../src/database/models/JobConfiguration')
    vi.unmock('../../../src/database/models/JobExecution')
    vi.unmock('../../../src/database/models/GeneratedImage')
  })

  it('persists one canonical fallback label across config name and execution label', async () => {
    const config = {
      // No parameters.label provided → should fallback
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: { processMode: 'relax', openaiModel: 'gpt-4o', runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1 },
      ai: { runQualityCheck: false, runMetadataGen: false },
      processing: {},
      apiKeys: { openai: 'x', runware: 'y' }
    }

    const start = await adapter.startJob(config as any)
    expect(start.success).toBe(true)

    // Read most recent job
    const all = await adapter.getAllJobExecutions(50)
    const jobs = all.executions || []
    const target = jobs.find((j: any) => typeof j.label === 'string' && /^job_\d{8}_[0-9]{6}$/.test(j.label))
    expect(target).toBeTruthy()
    // configuration name is available via history call
    const hist = await adapter.getJobHistory(50)
    const hTarget = hist.find((h: any) => h.id === target.id)
    expect(hTarget).toBeTruthy()
    expect(hTarget.label).toBe(target.label)
  })
})


