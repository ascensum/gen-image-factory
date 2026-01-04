import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import vm from 'node:vm'
import { vi } from 'vitest'

type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

const thisFile = fileURLToPath(import.meta.url)
const testUtilsDir = dirname(thisFile)
const projectRoot = resolve(testUtilsDir, '..', '..')
const preloadPath = resolve(projectRoot, 'electron', 'preload.js')
const mainProcessPath = resolve(projectRoot, 'electron', 'main.js')
const preloadSource = readFileSync(preloadPath, 'utf-8')
const mainSource = readFileSync(mainProcessPath, 'utf-8')

export interface WindowMock {
  addEventListener: ReturnType<typeof vi.fn>
  electronAPI?: Record<string, any>
  [key: string]: any
}

export interface PreloadHarnessOptions {
  windowOverrides?: Partial<WindowMock>
}

export interface PreloadHarnessResult {
  window: WindowMock
  contextBridge: {
    exposeInMainWorld: ReturnType<typeof vi.fn>
  }
  ipcRenderer: {
    invoke: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    removeListener: ReturnType<typeof vi.fn>
  }
  electronAPI: Record<string, any>
}

type BrowserWindowConstructorOptions = Record<string, any>

interface BrowserWindowInstance {
  options: BrowserWindowConstructorOptions
  loadURLCalls: Array<[string]>
  loadFileCalls: Array<[string, ...unknown[]]>
  lastShown: boolean
}

interface MainHarnessOptions {
  platform?: NodeJS.Platform
  env?: Record<string, string>
}

interface MainHarnessResult {
  browserWindows: BrowserWindowInstance[]
  browserWindowOptions?: BrowserWindowConstructorOptions
  ipcHandles: Map<string, ReturnType<typeof vi.fn>>
  protocolHandlers: Map<string, ReturnType<typeof vi.fn>>
  privilegedSchemes: unknown[]
  appEvents: Map<string, ReturnType<typeof vi.fn>>
  backendAdapterMock: {
    setupCalled: boolean
    setMainWindowCalled: boolean
    reconcileCalled: boolean
  }
}

const wrapAsModule = (source: string, filename: string) => {
  const wrapped = `(function (exports, require, module, __filename, __dirname, process, global) {${source}\n})`
  return new vm.Script(wrapped, { filename })
}

export const loadPreloadScript = (
  options: PreloadHarnessOptions = {}
): PreloadHarnessResult => {
  const windowMock: WindowMock = {
    ...(options.windowOverrides ?? {}),
    addEventListener: vi.fn(),
  }

  const ipcRenderer = {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  }

  const contextBridge = {
    exposeInMainWorld: vi.fn((key: string, api: Record<string, any>) => {
      if (key === 'electronAPI') {
        ;(windowMock as any).electronAPI = api
      }
    }),
  }

  const fallbackRequire = createRequire(preloadPath)
  const mockRequire = (moduleId: string) => {
    if (moduleId === 'electron') {
      return {
        ipcRenderer,
        contextBridge,
      }
    }
    return fallbackRequire(moduleId)
  }

  const script = wrapAsModule(preloadSource, preloadPath)
  const moduleExports = {}
  const moduleObj = { exports: moduleExports }
  const context = vm.createContext({
    window: windowMock,
    console,
    process,
    global: {},
  })

  const compiled = script.runInContext(context)
  compiled(moduleExports, mockRequire, moduleObj, preloadPath, dirname(preloadPath), process, context.global)

  return {
    window: windowMock,
    contextBridge,
    ipcRenderer,
    electronAPI: (windowMock as any).electronAPI,
  }
}

export const runMainProcessWithMocks = async (
  options: MainHarnessOptions = {}
): Promise<MainHarnessResult> => {
  ensureRendererBundle()
  const ipcHandles = new Map<string, ReturnType<typeof vi.fn>>()
  const protocolHandlers = new Map<string, ReturnType<typeof vi.fn>>()
  const privilegedSchemes: unknown[] = []
  const browserWindowInstances: BrowserWindowInstance[] = []
  const appEvents = new Map<string, ReturnType<typeof vi.fn>>()
  const backendAdapterState = {
    setupCalled: false,
    setMainWindowCalled: false,
    reconcileCalled: false,
  }

  class BrowserWindowMock {
    static instances: BrowserWindowInstance[] = browserWindowInstances
    static getAllWindows = vi.fn(() => BrowserWindowMock.instances.map((inst) => inst as never))

    options: BrowserWindowConstructorOptions
    webContents = {
      on: vi.fn(),
      openDevTools: vi.fn(),
    }
    loadURL = vi.fn((url: string) => {
      this.instance.loadURLCalls.push([url])
    })
    loadFile = vi.fn((filePath: string, ...rest: any[]) => {
      this.instance.loadFileCalls.push([filePath, ...rest])
    })
    once = vi.fn((event: string, handler: () => void) => {
      if (event === 'ready-to-show') {
        handler()
      }
    })
    on = vi.fn()
    show = vi.fn(() => {
      this.instance.lastShown = true
    })

    private instance: BrowserWindowInstance

    constructor(opts: BrowserWindowConstructorOptions) {
      this.options = opts
      this.instance = {
        options: opts,
        loadURLCalls: [],
        loadFileCalls: [],
        lastShown: false,
      }
      browserWindowInstances.push(this.instance)
    }
  }

  const ipcMain = {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      ipcHandles.set(channel, vi.fn(handler))
    }),
  }

  const protocol = {
    registerSchemesAsPrivileged: vi.fn((schemes: unknown) => {
      privilegedSchemes.push(schemes)
    }),
    registerFileProtocol: vi.fn((scheme: string, handler: (...args: any[]) => any) => {
      protocolHandlers.set(scheme, vi.fn(handler))
    }),
    handle: vi.fn((scheme: string, handler: (...args: any[]) => any) => {
      protocolHandlers.set(scheme, vi.fn(handler))
    }),
  }

  const dialog = {
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
  }

  class BackendAdapterMock {
    jobExecution: {
      reconcileOrphanedRunningJobs: ReturnType<typeof vi.fn>
    }

    constructor() {
      backendAdapterState.setupCalled = true
      this.jobExecution = {
        reconcileOrphanedRunningJobs: vi.fn(async () => {
          backendAdapterState.reconcileCalled = true
          return { success: true }
        }),
      }
    }

    setupIpcHandlers = vi.fn(() => {
      backendAdapterState.setupCalled = true
    })

    setMainWindow = vi.fn(() => {
      backendAdapterState.setMainWindowCalled = true
    })
  }

  const jobConfigurationMock = class JobConfiguration {
    getDefaultSettings() {
      return {
        filePaths: {
          outputDirectory: '/tmp/output',
          tempDirectory: '/tmp/temp',
        },
      }
    }
    async getSettings() {
      return {
        success: true,
        settings: this.getDefaultSettings(),
      }
    }
  }

  const generatedImageMock = class GeneratedImage {
    async getAllGeneratedImages() {
      return {
        success: true,
        images: [],
      }
    }
  }

  const fallbackRequire = createRequire(mainProcessPath)
  const mockRequire = (moduleId: string) => {
    if (moduleId === 'electron') {
      return {
        app,
        BrowserWindow: BrowserWindowMock,
        ipcMain,
        protocol,
        dialog,
        Menu: {
          buildFromTemplate: vi.fn(() => ({})),
          setApplicationMenu: vi.fn(),
        },
        Tray: vi.fn().mockImplementation(() => ({
          setToolTip: vi.fn(),
          setContextMenu: vi.fn(),
          on: vi.fn(),
        })),
        nativeImage: {
          createFromPath: vi.fn(() => ({
            isEmpty: () => false,
          })),
        },
        net: {
          fetch: vi.fn(),
        },
      }
    }
    if (moduleId.endsWith('src/adapter/backendAdapter')) {
      return { BackendAdapter: BackendAdapterMock }
    }
    if (moduleId.endsWith('src/database/models/JobConfiguration')) {
      return { JobConfiguration: jobConfigurationMock }
    }
    if (moduleId.endsWith('src/database/models/GeneratedImage')) {
      return { GeneratedImage: generatedImageMock }
    }
    return fallbackRequire(moduleId)
  }

  const processClone = Object.assign(
    Object.create(Object.getPrototypeOf(process)),
    process,
    {
      platform: options.platform ?? process.platform,
      env: { ...process.env, ...options.env },
    }
  ) as Mutable<NodeJS.Process>
  processClone.on = process.on.bind(process)
  processClone.addListener = process.addListener.bind(process)
  processClone.once = process.once.bind(process)
  processClone.removeListener = process.removeListener.bind(process)

  const readyCallbacks: Array<() => unknown | Promise<unknown>> = []
  const app = {
    whenReady: vi.fn(() => ({
      then: (resolver: () => unknown | Promise<unknown>) => {
        readyCallbacks.push(resolver)
        return Promise.resolve()
      },
    })),
    getAppPath: vi.fn(() => projectRoot),
    getPath: vi.fn(() => '/tmp'),
    quit: vi.fn(),
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      appEvents.set(event, vi.fn(handler))
    }),
    getVersion: vi.fn(() => '1.0.0-test'),
    dock: {
      setIcon: vi.fn(),
    },
  }

  const moduleObj = { exports: {} }
  const script = wrapAsModule(mainSource, mainProcessPath)
  const context = vm.createContext({
    console,
    process: processClone,
    global: {},
    Buffer,
    setTimeout,
    clearTimeout,
  })
  const compiled = script.runInContext(context)
  compiled(moduleObj.exports, mockRequire, moduleObj, mainProcessPath, dirname(mainProcessPath), processClone, context.global)

  for (const handler of readyCallbacks) {
    await handler()
  }

  return {
    browserWindows: browserWindowInstances,
    browserWindowOptions: browserWindowInstances[0]?.options,
    ipcHandles,
    protocolHandlers,
    privilegedSchemes,
    appEvents,
    backendAdapterMock: backendAdapterState,
  }
}

export const ensureRendererBundle = () => {
  const rendererIndex = resolve(projectRoot, 'electron', 'renderer', 'index.html')
  if (!existsSync(rendererIndex)) {
    execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' })
  }
}

