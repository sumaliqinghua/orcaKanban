import { describe, expect, it, vi } from 'vitest'
import type { RuntimeClient } from '../runtime-client'
import { LOCAL_TASK_HANDLERS } from './local-tasks'
import { LOCAL_TASK_COMMAND_SPECS } from '../specs/local-tasks'

vi.mock('../local-task-context', () => ({
  resolveLocalTaskContext: async () => ({
    taskId: 'task',
    sessionId: 'caller',
    worktreeId: 'workspace'
  })
}))
vi.mock('../format', () => ({ printResult: vi.fn() }))

describe('current task reference CLI', () => {
  it('keeps the ordinary request compatible and sends the selected subtask separately', async () => {
    const call = vi.fn().mockResolvedValue({ result: {} })
    const client = { call } as unknown as RuntimeClient
    await LOCAL_TASK_HANDLERS['local-task current']({
      client,
      flags: new Map(),
      json: true,
      cwd: '.'
    })
    expect(call).toHaveBeenLastCalledWith('localTask.current', {
      taskId: 'task',
      sessionId: 'caller',
      worktreeId: 'workspace'
    })
    await LOCAL_TASK_HANDLERS['local-task current']({
      client,
      flags: new Map([['reference', 'sibling']]),
      json: true,
      cwd: '.'
    })
    expect(call).toHaveBeenLastCalledWith('localTask.current', {
      taskId: 'task',
      sessionId: 'caller',
      worktreeId: 'workspace',
      referenceSubtaskId: 'sibling'
    })
    expect(
      LOCAL_TASK_COMMAND_SPECS.find((spec) => spec.path.join(' ') === 'local-task current')
        ?.allowedFlags
    ).toContain('reference')
  })

  it('surfaces an unsupported runtime instead of silently discarding the reference request', async () => {
    const error = new Error('Unknown parameter referenceSubtaskId')
    const call = vi.fn().mockRejectedValue(error)
    await expect(
      LOCAL_TASK_HANDLERS['local-task current']({
        client: { call } as unknown as RuntimeClient,
        flags: new Map([['reference', 'sibling']]),
        json: true,
        cwd: '.'
      })
    ).rejects.toBe(error)
    expect(call).toHaveBeenCalledTimes(1)
  })
})

describe('update-description CLI', () => {
  it('forwards the expected description revision', async () => {
    const call = vi.fn().mockResolvedValue({ result: {} })
    const client = { call } as unknown as RuntimeClient
    await LOCAL_TASK_HANDLERS['local-task update-description']({
      client,
      flags: new Map([
        ['description', '只关注 iOS'],
        ['expected-revision', '12']
      ]),
      json: true,
      cwd: '.'
    })
    expect(call).toHaveBeenLastCalledWith('localTask.updateDescription', {
      taskId: 'task',
      sessionId: 'caller',
      worktreeId: 'workspace',
      description: '只关注 iOS',
      expectedRevision: 12
    })
  })
})
