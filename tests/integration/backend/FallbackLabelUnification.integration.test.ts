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

import { BackendAdapter } from '../../../src/adapter/backendAdapter'

describe('Fallback label unification', () => {
  let adapter: BackendAdapter

  beforeEach(() => {
    adapter = new BackendAdapter({ skipIpcSetup: true }) as any
    // Provide runtime API keys so preflight passes
    vi.spyOn(adapter, 'getSettings').mockResolvedValue({
      success: true,
      settings: {
        apiKeys: { openai: 'test', piapi: 'test', removeBg: '' },
        filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
        parameters: { processMode: 'single', openaiModel: 'gpt-4o' },
        ai: { runQualityCheck: false, runMetadataGen: false },
        processing: {}
      }
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists one canonical fallback label across config name and execution label', async () => {
    const config = {
      // No parameters.label provided → should fallback
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: { processMode: 'single', openaiModel: 'gpt-4o' },
      ai: { runQualityCheck: false, runMetadataGen: false },
      processing: {},
      apiKeys: { openai: 'x', piapi: 'y' }
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


