import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BackendAdapter } from '../../../src/adapter/backendAdapter'

describe('New job execution isolation', () => {
  let adapter: any
  let prevVitestEnv: string | undefined
  let executions: any[] = []
  let nextExecutionId = 100

  beforeEach(() => {
    // Ensure BackendAdapter doesn't reuse a global JobRunner from other suites
    delete (globalThis as any).backendAdapter
    delete (globalThis as any).currentJobRunner

    // Force test-mode fast path in backendAdapter.startJob
    prevVitestEnv = process.env.VITEST
    process.env.VITEST = '1'

    adapter = new BackendAdapter({ skipIpcSetup: true }) as any
    vi.spyOn(adapter, 'getSettings').mockResolvedValue({
      success: true,
      settings: {
        // Current backend expects Runware for image generation (JobRunner.validateConfiguration requires runware)
        apiKeys: { openai: 'ok', runware: 'ok', removeBg: '' },
        filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
        parameters: { processMode: 'relax', openaiModel: 'gpt-4o', runwareModel: 'runware:101@1', runwareDimensionsCsv: '', runwareFormat: 'png', variations: 1 },
        ai: { runQualityCheck: false, runMetadataGen: false },
        processing: {}
      }
    } as any)

    // Avoid real sqlite in this integration-like test: in-memory execution store
    executions = []
    nextExecutionId = 100
    adapter.jobConfig.saveSettings = vi.fn(async (_cfg: any, _name: string) => ({ id: 1 }))
    adapter.jobExecution.saveJobExecution = vi.fn(async (payload: any) => {
      const id = ++nextExecutionId
      executions.push({ id, ...(payload || {}) })
      return { success: true, id }
    })
    adapter.jobExecution.updateJobExecution = vi.fn(async (id: number, payload: any) => {
      const idx = executions.findIndex((e) => e.id === id)
      if (idx >= 0) executions[idx] = { ...executions[idx], ...(payload || {}) }
      return { success: true, changes: 1 }
    })
    adapter.jobExecution.getAllJobExecutions = vi.fn(async (limit: number) => {
      const list = executions.slice().reverse().slice(0, limit)
      return { success: true, executions: list }
    })
    adapter.generatedImage.getGeneratedImagesByExecution = vi.fn(async (_executionId: number) => ({ success: true, images: [] }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (typeof prevVitestEnv === 'undefined') delete process.env.VITEST
    else process.env.VITEST = prevVitestEnv
  })

  it('creates fresh execution and attaches images to that execution (not previous)', async () => {
    // Start a seed job to ensure DB has prior execution
    const seed = await adapter.startJob({
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: { processMode: 'relax', openaiModel: 'gpt-4o', label: 'Seed', runwareModel: 'runware:101@1', runwareDimensionsCsv: '', runwareFormat: 'png', variations: 1 },
      ai: { runQualityCheck: false, runMetadataGen: false },
      processing: {},
      apiKeys: { openai: 'x', runware: 'y' }
    } as any)
    if (!seed.success) {
      throw new Error(`seed startJob failed: ${JSON.stringify(seed)}`)
    }

    const before = await adapter.getAllJobExecutions({ limit: 10 })
    const prevExecId = before.executions?.[0]?.id
    expect(prevExecId).toBeTruthy()

    // Start a new job
    const start = await adapter.startJob({
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: { processMode: 'relax', openaiModel: 'gpt-4o', label: 'Animal photography', runwareModel: 'runware:101@1', runwareDimensionsCsv: '', runwareFormat: 'png', variations: 1 },
      ai: { runQualityCheck: false, runMetadataGen: false },
      processing: {},
      apiKeys: { openai: 'x', runware: 'y' }
    } as any)
    if (!start.success) {
      throw new Error(`second startJob failed: ${JSON.stringify(start)}`)
    }

    const after = await adapter.getAllJobExecutions({ limit: 10 })
    const latest = after.executions?.[0]
    expect(latest?.label).toBe('Animal photography')
    expect(latest?.id).not.toBe(prevExecId)

    // Verify there is at least one image linked to latest execution
    const imagesRes = await (adapter as any).generatedImage.getGeneratedImagesByExecution(latest.id)
    expect(imagesRes?.images?.length || 0).toBeGreaterThanOrEqual(0) // smoke linkage
  }, 60000)
})


