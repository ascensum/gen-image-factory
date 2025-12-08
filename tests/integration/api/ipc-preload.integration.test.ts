import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadPreloadScript } from '../../test-utils/electron-test-utils'

describe('IPC Communication - preload.js contextBridge', () => {
  let exposedApi: any
  let harness: ReturnType<typeof loadPreloadScript>

  beforeEach(() => {
    vi.clearAllMocks()
    exposedApi = undefined
    harness = loadPreloadScript()
    exposedApi = harness.electronAPI
  })

  describe('contextBridge Implementation', () => {
    it('should expose electronAPI to main world', () => {
      expect(harness.contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        'electronAPI',
        expect.any(Object)
      )
      expect(exposedApi).toBeDefined()
    })

    it('should register preload error handlers', () => {
      expect(harness.window.addEventListener).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      )
      expect(harness.window.addEventListener).toHaveBeenCalledWith(
        'unhandledrejection',
        expect.any(Function)
      )
    })

    it('should whitelist valid IPC channels', async () => {
      const validChannels = ['ping', 'get-settings', 'job:start']

      for (const channel of validChannels) {
        harness.ipcRenderer.invoke.mockClear()
        harness.ipcRenderer.invoke.mockResolvedValue('success')
        await exposedApi.invoke(channel, { sample: true })
        expect(harness.ipcRenderer.invoke).toHaveBeenCalledWith(
          channel,
          { sample: true }
        )
      }
    })

    it('should reject invalid IPC channels', async () => {
      await expect(exposedApi.invoke('invalid-channel')).rejects.toThrow(
        'Invalid channel: invalid-channel'
      )
      expect(harness.ipcRenderer.invoke).not.toHaveBeenCalledWith('invalid-channel')
    })

    it('should proxy generated image export progress events', () => {
      const progressCallback = vi.fn()
      exposedApi.generatedImages.onZipExportProgress(progressCallback)

      expect(harness.ipcRenderer.on).toHaveBeenCalledWith(
        'zip-export:progress',
        expect.any(Function)
      )

      const [, registeredHandler] = harness.ipcRenderer.on.mock.calls.find(
        ([eventName]) => eventName === 'zip-export:progress'
      ) ?? []

      expect(registeredHandler).toBeDefined()

      const payload = { percent: 42 }
      registeredHandler?.({}, payload)

      expect(progressCallback).toHaveBeenCalledWith(payload)
    })

    it('should remove generated image listeners when requested', () => {
      const callback = vi.fn()
      exposedApi.generatedImages.removeZipExportProgress(callback)

      expect(harness.ipcRenderer.removeListener).toHaveBeenCalledWith(
        'zip-export:progress',
        callback
      )
    })
  })
})
