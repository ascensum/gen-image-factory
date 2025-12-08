import { beforeAll, describe, expect, it } from 'vitest'
import { runMainProcessWithMocks } from '../../test-utils/electron-test-utils'

describe('IPC Communication - Main Process Handlers', () => {
  let harness: Awaited<ReturnType<typeof runMainProcessWithMocks>>

  beforeAll(async () => {
    harness = await runMainProcessWithMocks({ platform: 'linux' })
  })

  it('registers canonical handlers for ping and get-app-version', () => {
    const ping = harness.ipcHandles.get('ping')
    const getVersion = harness.ipcHandles.get('get-app-version')

    expect(ping).toBeDefined()
    expect(getVersion).toBeDefined()

    expect(ping?.()).toBe('pong')
    expect(getVersion?.()).toBe('1.0.0-test')
  })

  it('resolves protocol refresh and request access handlers', async () => {
    const refresh = harness.ipcHandles.get('protocol:refresh-roots')
    const request = harness.ipcHandles.get('protocol:request-access')

    expect(refresh).toBeDefined()
    expect(request).toBeDefined()

    await expect(refresh?.({}, ['~/Pictures'])).resolves.toMatchObject({ success: true })
    await expect(request?.({}, '/tmp/output.png')).resolves.toMatchObject({
      success: expect.any(Boolean),
    })
  })

  it('creates BrowserWindow once with environment-aware icon selection', () => {
    expect(harness.browserWindows.length).toBe(1)
    const opts = harness.browserWindowOptions
    expect(opts?.icon).toContain('build/icons')
  })

  it('configures secure webPreferences for every renderer', () => {
    const prefs = harness.browserWindowOptions?.webPreferences
    expect(prefs?.contextIsolation).toBe(true)
    expect(prefs?.nodeIntegration).toBe(false)
    expect(prefs?.preload).toContain('electron/preload.js')
  })
})

