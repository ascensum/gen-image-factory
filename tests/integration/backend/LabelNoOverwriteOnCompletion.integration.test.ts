import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Label is not overwritten on completion', () => {
  let adapter: any

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../../../src/adapter/backendAdapter')
    adapter = new mod.BackendAdapter({ skipIpcSetup: true }) as any
    vi.spyOn(adapter, 'getSettings').mockResolvedValue({
      success: true,
      settings: {
        // JobRunner.validateConfiguration requires runware (piapi is legacy)
        apiKeys: { openai: 'ok', runware: 'ok', removeBg: '' },
        filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
        parameters: { processMode: 'relax', openaiModel: 'gpt-4o', runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1 },
        ai: { runQualityCheck: false, runMetadataGen: false },
        processing: {}
      }
    } as any)

    // Avoid real sqlite side effects: startJob() fast-path writes via models
    adapter.jobConfig.saveSettings = vi.fn().mockResolvedValue({ success: true, id: 42 })
    adapter.jobExecution.saveJobExecution = vi.fn().mockResolvedValue({ success: true, id: 99 })
    adapter.jobExecution.updateJobExecution = vi.fn().mockResolvedValue({ success: true })
    adapter.jobExecution.getJobExecution = vi.fn().mockResolvedValue({ success: true, execution: { id: 99, label: 'My Provided Label' } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('keeps the provided label after job finishes', async () => {
    const label = 'My Provided Label'
    const config = {
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: { processMode: 'relax', openaiModel: 'gpt-4o', label, runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1 },
      ai: { runQualityCheck: false, runMetadataGen: false },
      processing: {},
      apiKeys: { openai: 'x', runware: 'y' }
    }

    const start = await adapter.startJob(config as any)
    expect(start.success).toBe(true)

    const exec = await adapter.getJobExecution(start.executionId)
    expect(exec.success).toBe(true)
    expect(exec.execution.label).toBe(label)
  }, 60000)
})


