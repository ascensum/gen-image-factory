import '@testing-library/jest-dom'
import { vi } from 'vitest'
import os from 'os'
import path from 'path'
import { threadId } from 'node:worker_threads'

// Mock Electron API for tests
Object.defineProperty(window, 'electronAPI', {
  value: {
    ping: vi.fn().mockResolvedValue('pong'),
    getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
    getSettings: vi.fn().mockResolvedValue({}),
    saveSettings: vi.fn().mockResolvedValue(true),
    selectFile: vi.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
    getApiKey: vi.fn().mockResolvedValue(''),
    setApiKey: vi.fn().mockResolvedValue(true),
  },
  writable: true,
})

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// Default Electron module mock for Node/JSDOM tests.
// This prevents runtime `require('electron')` calls from returning partial/undefined APIs,
// and isolates SQLite DB paths by making `app.getPath('userData')` unique per test process.
const __workerId = process.env.VITEST_WORKER_ID || process.env.VITEST_POOL_ID || String(threadId || 0)
const __testUserData = path.join(os.tmpdir(), `gen-image-factory-vitest-${process.pid}-${__workerId}`)
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return __testUserData
      if (name === 'desktop') return os.homedir()
      return os.tmpdir()
    }),
  },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: true, filePath: undefined }),
  },
  shell: {
    openPath: vi.fn().mockResolvedValue(''),
    showItemInFolder: vi.fn(),
  },
}))