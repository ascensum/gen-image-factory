import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'node:module'

const req = createRequire(import.meta.url)

describe('BackendAdapter.setupIpcHandlers (unit) - expanded coverage', () => {
  let prevCache: Record<string, any> = {}
  let handlers: Map<string, Function>
  let ipc: any

  const patchCjs = (overrides: { generatedImage?: any } = {}) => {
    const resolvedElectron = req.resolve('electron')
    const resolvedJC = req.resolve('../../../../src/database/models/JobConfiguration')
    const resolvedJE = req.resolve('../../../../src/database/models/JobExecution')
    const resolvedGI = req.resolve('../../../../src/database/models/GeneratedImage')
    const resolvedAdapter = req.resolve('../../../../src/adapter/backendAdapter')

    prevCache = {
      [resolvedElectron]: req.cache[resolvedElectron],
      [resolvedJC]: req.cache[resolvedJC],
      [resolvedJE]: req.cache[resolvedJE],
      [resolvedGI]: req.cache[resolvedGI],
      [resolvedAdapter]: req.cache[resolvedAdapter],
    }

    req.cache[resolvedElectron] = {
      id: resolvedElectron,
      filename: resolvedElectron,
      loaded: true,
      exports: {
        ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() },
        app: { getPath: vi.fn(() => '/tmp') },
        dialog: {
          showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
          showSaveDialog: vi.fn().mockResolvedValue({ canceled: true, filePath: undefined }),
        },
        shell: {
          openPath: vi.fn().mockResolvedValue(''),
          showItemInFolder: vi.fn(),
        },
      },
    } as any

    req.cache[resolvedJC] = {
      id: resolvedJC,
      filename: resolvedJC,
      loaded: true,
      exports: {
        JobConfiguration: vi.fn().mockImplementation(() => ({
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          getDefaultSettings: vi.fn().mockReturnValue({}),
          getConfigurationById: vi.fn().mockResolvedValue({ success: true, configuration: { id: 1, settings: {} } }),
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
          getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: { id: 1 } }),
          getAllJobExecutions: vi.fn().mockResolvedValue({ success: true, executions: [] }),
          renameJobExecution: vi.fn().mockResolvedValue({ success: true }),
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
          getGeneratedImage: overrides.generatedImage?.getGeneratedImage || vi.fn().mockResolvedValue({ success: false }),
        })),
      },
    } as any

    delete req.cache[resolvedAdapter]
  }

  const restore = () => {
    try {
      for (const k of Object.keys(prevCache || {})) {
        if (typeof prevCache[k] === 'undefined') delete req.cache[k]
        else req.cache[k] = prevCache[k]
      }
    } catch {} finally {
      prevCache = {}
    }
  }

  beforeEach(() => {
    handlers = new Map()
    ipc = {
      handle: vi.fn((channel: string, fn: any) => handlers.set(channel, fn)),
      removeHandler: vi.fn(),
    }
  })

  afterEach(() => {
    restore()
    handlers = new Map()
  })

  it('registers a broad set of handlers and routes a few key calls', async () => {
    patchCjs()
    const mod = await import('../../../../src/adapter/backendAdapter')
    const adapter: any = new mod.BackendAdapter({ ipc, skipIpcSetup: true })

    // Stub methods that handlers call
    adapter.getApiKey = vi.fn().mockResolvedValue({ success: true, apiKey: 'k' })
    adapter.setApiKey = vi.fn().mockResolvedValue({ success: true })
    adapter.getSettings = vi.fn().mockResolvedValue({ success: true, settings: {} })
    adapter.saveSettings = vi.fn().mockResolvedValue({ success: true })
    adapter.startJob = vi.fn().mockResolvedValue({ success: true, jobId: 'j' })
    adapter.stopJob = vi.fn().mockResolvedValue({ success: true })
    adapter.forceStopAll = vi.fn().mockResolvedValue({ success: true })
    adapter.getJobStatus = vi.fn().mockResolvedValue({ status: 'idle' })
    adapter.getJobProgress = vi.fn().mockResolvedValue({ progress: 0 })
    adapter.getJobLogs = vi.fn().mockResolvedValue([])
    adapter.getSecurityStatus = vi.fn().mockResolvedValue({ secureStorage: 'ok' })

    adapter.setupIpcHandlers()

    // Spot-check registration
    expect(handlers.has('get-api-key')).toBe(true)
    expect(handlers.has('set-api-key')).toBe(true)
    expect(handlers.has('job:start')).toBe(true)
    expect(handlers.has('job:get-status')).toBe(true)
    expect(handlers.has('reveal-in-folder')).toBe(true)
    expect(handlers.has('job-execution:get-by-image-id')).toBe(true)

    // Routing assertions
    await expect(handlers.get('get-api-key')?.({}, 'openai')).resolves.toEqual({ success: true, apiKey: 'k' })
    await expect(handlers.get('set-api-key')?.({}, 'openai', 'x')).resolves.toEqual({ success: true })
    await expect(handlers.get('job:start')?.({}, { foo: 'bar' })).resolves.toEqual({ success: true, jobId: 'j' })
    await expect(handlers.get('job:get-status')?.({})).resolves.toEqual({ status: 'idle' })
  })

  it('covers error branches for get-by-image-id and reveal-in-folder invalid path', async () => {
    patchCjs({
      generatedImage: {
        getGeneratedImage: vi.fn().mockResolvedValue({ success: false }), // triggers Image not found branch
      },
    })
    const mod = await import('../../../../src/adapter/backendAdapter')
    const adapter: any = new mod.BackendAdapter({ ipc, skipIpcSetup: true })

    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined)
    adapter.setupIpcHandlers()

    await expect(handlers.get('job-execution:get-by-image-id')?.({}, 999)).resolves.toEqual({ success: false, error: 'Image not found' })
    await expect(handlers.get('reveal-in-folder')?.({}, null)).resolves.toEqual({ success: false, error: 'Invalid path' })
  })
})

