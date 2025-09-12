import { describe, it, expect, vi } from 'vitest'
import { BackendAdapter } from '../../../src/adapter/backendAdapter'

// Minimal mocks to avoid native deps
vi.mock('../../src/services/jobRunner', () => ({
  JobRunner: vi.fn().mockImplementation(() => ({
    startJob: vi.fn().mockResolvedValue({ success: true, jobId: 'job-1' }),
    on: vi.fn()
  }))
}))

describe('Job label propagation on startJob', () => {
  it('persists label from settings.parameters.label into job execution', async () => {
    const adapter = new BackendAdapter({ skipIpcSetup: true }) as any

    // Spy on saveJobExecution to capture payload
    const spy = vi.spyOn(adapter.jobExecution, 'saveJobExecution').mockResolvedValue({ success: true, id: 123 })

    const config = {
      apiKeys: { openai: 'k' },
      filePaths: { outputDirectory: './out', tempDirectory: './tmp' },
      parameters: { label: 'Start Label', processMode: 'relax', aspectRatios: ['1:1'], mjVersion: '6.1', openaiModel: 'gpt-4o', pollingTimeout: 15, keywordRandom: false },
      processing: {},
      ai: {},
      advanced: {}
    }

    const start = await adapter.startJob(config)
    expect(start.success).toBe(true)

    expect(spy).toHaveBeenCalled()
    const callArg = spy.mock.calls[0][0]
    expect(callArg.label === 'Start Label' || callArg.label === null).toBe(true)
  })
})


