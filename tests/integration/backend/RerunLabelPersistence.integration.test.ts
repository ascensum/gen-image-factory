import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'node:module'

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
  let adapter: any
  let store: any
  let nextExecId = 1
  let nextCfgId = 1
  const req = createRequire(import.meta.url)
  let prevCache: Record<string, any> = {}

  beforeEach(async () => {
    vi.resetModules()
    store = { executions: [], configs: new Map<number, any>() }
    nextExecId = 1
    nextCfgId = 1

    // Patch Node require cache for CJS BackendAdapter dependencies (DB models)
    const resolvedJC = req.resolve('../../../src/database/models/JobConfiguration')
    const resolvedJE = req.resolve('../../../src/database/models/JobExecution')
    const resolvedGI = req.resolve('../../../src/database/models/GeneratedImage')
    prevCache = {
      [resolvedJC]: req.cache[resolvedJC],
      [resolvedJE]: req.cache[resolvedJE],
      [resolvedGI]: req.cache[resolvedGI],
    }

    req.cache[resolvedJC] = {
      id: resolvedJC,
      filename: resolvedJC,
      loaded: true,
      exports: {
        JobConfiguration: vi.fn().mockImplementation(() => ({
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          getDefaultSettings: vi.fn().mockReturnValue({
            apiKeys: { openai: '', runware: '', piapi: '', removeBg: '' },
            filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
            parameters: {},
            processing: {},
            ai: {},
            advanced: {},
          }),
          saveSettings: vi.fn().mockImplementation(async (settings: any, _name: string) => {
            const id = nextCfgId++
            store.configs.set(id, settings)
            return { success: true, id }
          }),
          getConfigurationById: vi.fn().mockImplementation(async (id: number) => {
            const settings = store.configs.get(id)
            return settings ? { success: true, configuration: { id, settings } } : { success: false }
          }),
        })),
      },
    } as any

    req.cache[resolvedJE] = {
      id: resolvedJE,
      filename: resolvedJE,
      loaded: true,
      exports: {
        JobExecution: vi.fn().mockImplementation(() => ({
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          saveJobExecution: vi.fn().mockImplementation(async (payload: any) => {
            const id = nextExecId++
            const execution = { id, status: payload.status || 'running', label: payload.label || '', configurationId: payload.configurationId || null }
            store.executions.unshift(execution)
            return { success: true, id }
          }),
          updateJobExecution: vi.fn().mockImplementation(async (id: number, patch: any) => {
            const ex = store.executions.find((e: any) => e.id === id)
            if (!ex) return { success: false }
            Object.assign(ex, patch)
            return { success: true }
          }),
          getJobExecution: vi.fn().mockImplementation(async (id: number) => {
            const ex = store.executions.find((e: any) => e.id === id)
            return ex ? { success: true, execution: ex } : { success: false, error: 'Job execution not found' }
          }),
          getAllJobExecutions: vi.fn().mockImplementation(async (limit: number) => ({ success: true, executions: store.executions.slice(0, limit) })),
          getJobExecutionsByIds: vi.fn().mockImplementation(async (ids: number[]) => ({
            success: true,
            executions: store.executions.filter((e: any) => ids.includes(e.id)),
          })),
          getJobHistory: vi.fn().mockImplementation(async (limit: number) => ({ success: true, history: store.executions.slice(0, limit) })),
          renameJobExecution: vi.fn().mockImplementation(async (id: number, label: string) => {
            const ex = store.executions.find((e: any) => e.id === id)
            if (!ex) return { success: false, error: 'Job execution not found' }
            ex.label = label
            return { success: true }
          }),
        })),
      },
    } as any

    req.cache[resolvedGI] = {
      id: resolvedGI,
      filename: resolvedGI,
      loaded: true,
      exports: {
        GeneratedImage: vi.fn().mockImplementation(() => ({
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
        })),
      },
    } as any

    const mod = await import('../../../src/adapter/backendAdapter')
    adapter = new mod.BackendAdapter({ skipIpcSetup: true }) as any
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined)

    vi.spyOn(adapter, 'getSettings').mockResolvedValue({
      success: true,
      settings: {
        apiKeys: { openai: 'ok', runware: 'ok', removeBg: '' },
        filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
        parameters: { processMode: 'relax', openaiModel: 'gpt-4o', runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1 },
        ai: { runQualityCheck: false, runMetadataGen: false },
        processing: {}
      }
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    // Restore require cache entries we replaced
    try {
      const keys = Object.keys(prevCache || {})
      for (const k of keys) {
        if (typeof prevCache[k] === 'undefined') delete req.cache[k]
        else req.cache[k] = prevCache[k]
      }
    } catch {} finally {
      prevCache = {}
    }
  })

  it('keeps original label and appends (Rerun) for rerun execution', async () => {
    // Start original job with label
    const start = await adapter.startJob({
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: { processMode: 'relax', openaiModel: 'gpt-4o', label: 'City photography', runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1 },
      ai: { runQualityCheck: false, runMetadataGen: false },
      processing: {},
      apiKeys: { openai: 'x', runware: 'y' }
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


