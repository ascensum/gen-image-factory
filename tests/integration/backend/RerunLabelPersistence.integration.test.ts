import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BackendAdapter } from '../../../src/adapter/backendAdapter'

// Mock JobRunner to avoid external calls and simulate rerun behavior
vi.mock('../../../src/services/jobRunner', () => ({
  JobRunner: class {
    backendAdapter: any
    configurationId: any
    databaseExecutionId: any
    isRerun = false
    on() {}
    async getJobStatus() { return { status: 'idle' } }
    async startJob(config: any) {
      const label = (config?.parameters?.label || '').trim() || 'Seed Label'
      if (!this.isRerun) {
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
      } else {
        // Rerun path: databaseExecutionId is pre-set, persist label with (Rerun)
        const rLabel = `${label} (Rerun)`
        await this.backendAdapter.updateJobExecution(this.databaseExecutionId, {
          configurationId: this.configurationId,
          startedAt: new Date(),
          completedAt: new Date(),
          status: 'completed',
          totalImages: 0,
          generatedImages: 0,
          failedImages: 0,
          errorMessage: null,
          label: rLabel
        })
      }
      return { success: true, jobId: 'mock' }
    }
  }
}))

describe('Rerun label persistence', () => {
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

  it('keeps original label and appends (Rerun) for rerun execution', async () => {
    // Start original job with label
    const start = await adapter.startJob({
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: { processMode: 'single', openaiModel: 'gpt-4o', label: 'City photography' },
      ai: { runQualityCheck: false, runMetadataGen: false },
      processing: {},
      apiKeys: { openai: 'x', piapi: 'y' }
    } as any)
    expect(start.success).toBe(true)

    // Grab the most recent execution
    const all = await adapter.getAllJobExecutions(10)
    const original = all.executions?.[0]
    expect(original?.label).toBe('City photography')

    // Stub jobRunner.startJob to avoid external calls and finalize rerun label
    const jr: any = (adapter as any).jobRunner
    const startSpy = vi.spyOn(jr, 'startJob').mockImplementation(async (_cfg: any) => {
      const execId = jr.databaseExecutionId
      const current = await (adapter as any).getJobExecution(execId)
      const baseLabel = (current?.execution?.label || 'Seed Label').replace(/ \(Rerun\)$/,'')
      await (adapter as any).updateJobExecution(execId, {
        configurationId: jr.configurationId,
        startedAt: new Date(),
        completedAt: new Date(),
        status: 'completed',
        totalImages: 0,
        generatedImages: 0,
        failedImages: 0,
        errorMessage: null,
        label: `${baseLabel} (Rerun)`
      })
      return { success: true, jobId: 'mock-rerun' }
    })

    // Simulate rerun via bulk API (creates new exec and sets isRerun)
    const rerun = await (adapter as any).bulkRerunJobExecutions([original.id])
    expect(rerun?.success).toBe(true)

    // Verify latest execution now has (Rerun)
    const post = await adapter.getAllJobExecutions(10)
    const latest = post.executions?.[0]
    expect(latest?.label?.endsWith(' (Rerun)')).toBe(true)

    startSpy.mockRestore()
  })
})


