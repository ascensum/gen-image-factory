import { describe, it, expect } from 'vitest'
import { BackendAdapter } from '../../../src/adapter/backendAdapter'

describe('Settings Label Persistence', () => {
  it('saves and loads parameters.label via IPC', async () => {
    const adapter = new BackendAdapter({ skipIpcSetup: true }) as any

    const settings = (await adapter.getSettings()).settings
    settings.parameters = settings.parameters || {}
    settings.parameters.label = 'My Test Label'

    const save = await adapter.saveSettings(settings)
    expect(save.success).toBe(true)

    const load = await adapter.getSettings()
    expect(load.success).toBe(true)
    expect(load.settings.parameters.label).toBe('My Test Label')
  }, 60000)
})


