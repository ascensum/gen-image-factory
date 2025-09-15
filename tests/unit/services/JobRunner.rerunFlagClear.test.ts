import { describe, it, expect, vi } from 'vitest'

import { JobRunner } from '../../../src/services/jobRunner'

describe('JobRunner rerun leak guard', () => {
  it('clears isRerun and persists a new execution when no databaseExecutionId is set', async () => {
    const runner = new JobRunner()

    // Mock backendAdapter with spies
    const mockAdapter = {
      saveJobExecution: vi.fn().mockResolvedValue({ success: true, id: 999 }),
    } as any
    runner.backendAdapter = mockAdapter

    // Simulate leftover rerun state but without an execution id
    runner.isRerun = true as any
    ;(runner as any).databaseExecutionId = undefined
    runner.configurationId = 123 as any

    // Stub internals to avoid heavy work
    ;(runner as any).validateConfiguration = vi.fn().mockReturnValue({ valid: true })
    ;(runner as any).setEnvironmentFromConfig = vi.fn()
    ;(runner as any).executeJob = vi.fn().mockResolvedValue(undefined)

    const config = {
      apiKeys: { openai: 'k', piapi: 'p' },
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: { processMode: 'fast', openaiModel: 'gpt-4o', label: 'Unit Test Job' },
    }

    const res = await runner.startJob(config as any)
    expect(res.success).toBe(true)

    // Should have cleared rerun mode and saved a fresh execution
    expect(mockAdapter.saveJobExecution).toHaveBeenCalled()
    const payload = mockAdapter.saveJobExecution.mock.calls[0][0]
    expect(payload).toMatchObject({ configurationId: 123, status: 'running' })
  })
})


