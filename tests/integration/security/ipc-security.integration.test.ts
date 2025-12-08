import { beforeAll, describe, expect, it } from 'vitest'
import {
  loadPreloadScript,
  runMainProcessWithMocks,
} from '../../test-utils/electron-test-utils'

describe('IPC & Electron Security Integration', () => {
  let preloadHarness: ReturnType<typeof loadPreloadScript>
  let mainHarness: Awaited<ReturnType<typeof runMainProcessWithMocks>>

  beforeAll(async () => {
    preloadHarness = loadPreloadScript()
    mainHarness = await runMainProcessWithMocks({ platform: 'darwin' })
  })

  describe('contextBridge exposure', () => {
    it('exposes only the hardened electronAPI object', () => {
      expect(preloadHarness.contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        'electronAPI',
        expect.any(Object)
      )
      expect(preloadHarness.window.electronAPI).toBe(preloadHarness.electronAPI)
    })

    it('rejects non-whitelisted channels and prevents renderer escape hatches', async () => {
      await expect(preloadHarness.electronAPI.invoke('untrusted')).rejects.toThrow(
        'Invalid channel: untrusted'
      )
      expect(preloadHarness.ipcRenderer.invoke).not.toHaveBeenCalledWith('untrusted')
      expect(Object.keys(preloadHarness.window)).not.toContain('require')
    })

    it('permits security-sensitive channels such as protocol maintenance', async () => {
      preloadHarness.ipcRenderer.invoke.mockResolvedValue({ success: true })
      await preloadHarness.electronAPI.invoke('protocol:refresh-roots', ['/tmp'])
      expect(preloadHarness.ipcRenderer.invoke).toHaveBeenCalledWith(
        'protocol:refresh-roots',
        ['/tmp']
      )
    })
  })

  describe('BrowserWindow configuration', () => {
    it('enforces contextIsolation and disables nodeIntegration', () => {
      const prefs = mainHarness.browserWindowOptions?.webPreferences
      expect(prefs?.contextIsolation).toBe(true)
      expect(prefs?.nodeIntegration).toBe(false)
      expect(prefs?.preload).toContain('electron/preload.js')
      expect(prefs?.webSecurity).toBe(true)
      expect(prefs?.allowRunningInsecureContent).toBe(false)
    })

    it('loads a single secure window instance and delays presentation until ready', () => {
      expect(mainHarness.browserWindows.length).toBe(1)
      const instance = mainHarness.browserWindows[0]
      expect(instance.lastShown).toBe(true)
      expect(
        instance.loadURLCalls.length + instance.loadFileCalls.length
      ).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Protocol hardening', () => {
    it('registers the local-file scheme as secure with CSP enforcement', () => {
      const privileged = mainHarness.privilegedSchemes[0] as Array<{
        scheme: string
        privileges: Record<string, boolean>
      }>
      expect(privileged?.[0]?.scheme).toBe('local-file')
      expect(privileged?.[0]?.privileges?.secure).toBe(true)
      expect(privileged?.[0]?.privileges?.bypassCSP).toBe(false)
    })

    it('installs the guarded file protocol handler', () => {
      expect(mainHarness.protocolHandlers.has('local-file')).toBe(true)
    })
  })

  describe('IPC surface monitoring', () => {
    it('registers mandatory handlers for ping/version and protocol access control', () => {
      const channels = Array.from(mainHarness.ipcHandles.keys())
      expect(channels).toEqual(
        expect.arrayContaining([
          'ping',
          'get-app-version',
          'protocol:refresh-roots',
          'protocol:request-access',
        ])
      )
    })

    it('boots the backend adapter once and wires reconciliation hooks', () => {
      expect(mainHarness.backendAdapterMock.setupCalled).toBe(true)
      expect(mainHarness.backendAdapterMock.setMainWindowCalled).toBe(true)
      expect(mainHarness.backendAdapterMock.reconcileCalled).toBe(true)
    })
  })
})


