import { beforeAll, describe, expect, it } from 'vitest'
import { runMainProcessWithMocks } from '../../test-utils/electron-test-utils'

type PlatformCase = {
  platform: NodeJS.Platform
  expectedIcon: string
}

const platforms: PlatformCase[] = [
  { platform: 'darwin', expectedIcon: 'build/icons/mac/icon.icns' },
  { platform: 'win32', expectedIcon: 'build/icons/win/icon.ico' },
  { platform: 'linux', expectedIcon: 'build/icons/png/512x512.png' },
]

describe.each(platforms)('Electron main bootstrap (%s)', ({ platform, expectedIcon }) => {
  let harness: Awaited<ReturnType<typeof runMainProcessWithMocks>>

  beforeAll(async () => {
    harness = await runMainProcessWithMocks({ platform })
  })

  it('chooses platform-appropriate window icon', () => {
    expect(harness.browserWindowOptions?.icon).toContain(expectedIcon)
  })

  it('registers activate/window-all-closed lifecycle hooks', () => {
    expect(Array.from(harness.appEvents.keys())).toEqual(
      expect.arrayContaining(['window-all-closed', 'activate'])
    )
  })

  it('keeps security toggles consistent regardless of platform', () => {
    const prefs = harness.browserWindowOptions?.webPreferences
    expect(prefs?.contextIsolation).toBe(true)
    expect(prefs?.nodeIntegration).toBe(false)
    expect(prefs?.webSecurity).toBe(true)
  })
})

