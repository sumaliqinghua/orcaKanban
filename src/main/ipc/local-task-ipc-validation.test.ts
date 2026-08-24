import { describe, expect, it } from 'vitest'
import {
  createLocalTaskArgsSchema,
  createLocalTaskSessionArgsSchema,
  editLocalTaskStepTitleArgsSchema,
  parseLocalTaskIpcArgs,
  updateLocalTaskArgsSchema,
  updateLocalTaskStepArgsSchema
} from './local-task-ipc-validation'

describe('local task IPC validation', () => {
  it('accepts a bounded create payload and trims values', () => {
    expect(
      parseLocalTaskIpcArgs(createLocalTaskArgsSchema, {
        projectId: ' orca ',
        projectPath: ' /tmp/orca-project ',
        description: '  修复登录  ',
        labels: [' 性能 ', 'Unity'],
        workspaceId: ' local '
      })
    ).toMatchObject({
      projectId: 'orca',
      projectPath: '/tmp/orca-project',
      description: '修复登录',
      labels: ['性能', 'Unity'],
      workspaceId: 'local'
    })
  })

  it('rejects missing descriptions, unknown fields and oversized IDs', () => {
    expect(() => createLocalTaskArgsSchema.parse({ projectId: 'orca' })).toThrow()
    expect(() =>
      createLocalTaskArgsSchema.parse({ projectId: 'orca', description: 'x', extra: 1 })
    ).toThrow()
    expect(() => createLocalTaskSessionArgsSchema.parse({ taskId: ' '.repeat(201) })).toThrow()
  })

  it('passes lifecycle statuses to the store boundary for transition checks', () => {
    expect(() =>
      updateLocalTaskArgsSchema.parse({ taskId: 'lt_1', updates: { status: 'Done' } })
    ).not.toThrow()
    expect(() =>
      updateLocalTaskArgsSchema.parse({ taskId: 'lt_1', updates: { status: 'Needs review' } })
    ).not.toThrow()
  })

  it('validates the AI step shape before it reaches the store', () => {
    expect(
      updateLocalTaskStepArgsSchema.parse({
        subtaskId: 'sub_1',
        stepId: 'step_1',
        status: 'doing'
      })
    ).toMatchObject({ subtaskId: 'sub_1', stepId: 'step_1' })
    expect(() =>
      updateLocalTaskStepArgsSchema.parse({
        subtaskId: 'sub_1',
        stepId: 'step_1',
        status: 'invalid'
      })
    ).toThrow()
  })

  it('accepts only a title for the user step-edit operation', () => {
    expect(
      editLocalTaskStepTitleArgsSchema.parse({
        subtaskId: 'sub_1',
        stepId: 'step_1',
        title: '调整步骤'
      })
    ).toEqual({ subtaskId: 'sub_1', stepId: 'step_1', title: '调整步骤' })
    expect(() =>
      editLocalTaskStepTitleArgsSchema.parse({
        subtaskId: 'sub_1',
        stepId: 'step_1',
        title: '调整步骤',
        status: 'done'
      })
    ).toThrow()
  })

  it('accepts projectPath when associating a real task session', () => {
    expect(
      createLocalTaskSessionArgsSchema.parse({
        taskId: 'lt_1',
        projectPath: '/tmp/project',
        sessionId: 'tab-1'
      })
    ).toMatchObject({ taskId: 'lt_1', projectPath: '/tmp/project' })
  })
})
