import '@testing-library/jest-dom'
import { vi } from 'vitest'

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