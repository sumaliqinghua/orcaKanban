import { afterEach, describe, expect, it, vi } from 'vitest'
import { RuntimeClientError } from './runtime-client'
import { resolveLocalTaskContext } from './local-task-context'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('resolveLocalTaskContext', () => {
  it('explains how to recover when an old runtime lacks sessionContext', async () => {
    process.env.ORCA_TAB_ID = 'tab-1'
    const client = {
      call: vi
        .fn()
        .mockRejectedValue(
          new RuntimeClientError('method_not_found', 'Unknown method: localTask.sessionContext')
        )
    }

    await expect(resolveLocalTaskContext(client as never)).rejects.toMatchObject({
      code: 'runtime_compatibility',
      message: expect.stringContaining('pnpm dev'),
      data: {
        nextSteps: expect.arrayContaining([expect.stringContaining('new Agent session')])
      }
    })
  })

  it('does not replace unrelated runtime errors', async () => {
    process.env.ORCA_TAB_ID = 'tab-1'
    const error = new RuntimeClientError('runtime_unavailable', 'runtime unavailable')
    const client = { call: vi.fn().mockRejectedValue(error) }

    await expect(resolveLocalTaskContext(client as never)).rejects.toBe(error)
  })
})
