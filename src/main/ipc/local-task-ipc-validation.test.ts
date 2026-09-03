import { describe, expect, it } from 'vitest'
import {
  acceptLocalTaskArgsSchema,
  createLocalTaskArgsSchema,
  createLocalTaskSessionArgsSchema,
  createLocalTaskSubtaskArgsSchema,
  deleteLocalTaskArgsSchema,
  archiveLocalTaskArgsSchema,
  editLocalTaskStepTitleArgsSchema,
  kanbanAiRecordListArgsSchema,
  markKanbanAiRecordReadArgsSchema,
  localTaskListArgsSchema,
  parseLocalTaskIpcArgs,
  startLocalTaskBatchArgsSchema,
  transferLocalTaskSubtaskArgsSchema,
  transferLocalTaskWorkspaceArgsSchema,
  updateLocalTaskArgsSchema,
  updateLocalTaskRunArgsSchema,
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

  it('accepts archived listing and rejects unsafe delete task ids', () => {
    expect(
      localTaskListArgsSchema.parse({
        projectId: 'orca',
        projectPath: '/tmp/project',
        includeArchived: true
      })
    ).toEqual({ projectId: 'orca', projectPath: '/tmp/project', includeArchived: true })
    expect(
      deleteLocalTaskArgsSchema.parse({
        taskId: 'lt_123e4567-e89b-12d3-a456-426614174000',
        projectPath: '/tmp/project',
        activeSessionIds: []
      })
    ).toMatchObject({ projectPath: '/tmp/project', activeSessionIds: [] })
    expect(() =>
      deleteLocalTaskArgsSchema.parse({ taskId: '../outside', projectPath: '/tmp/project' })
    ).toThrow()
  })

  it('accepts projectPath when creating a subtask in the project file store', () => {
    expect(
      createLocalTaskSubtaskArgsSchema.parse({
        taskId: 'lt_1',
        projectPath: '/tmp/project',
        title: '制作校验工具',
        sessionId: null
      })
    ).toEqual({
      taskId: 'lt_1',
      projectPath: '/tmp/project',
      title: '制作校验工具',
      sessionId: null
    })
  })

  it('accepts projectPath when transferring a subtask', () => {
    expect(
      transferLocalTaskSubtaskArgsSchema.parse({
        subtaskId: 'sub_1',
        sessionId: 'session-1',
        projectPath: '/tmp/project'
      })
    ).toEqual({
      subtaskId: 'sub_1',
      sessionId: 'session-1',
      projectPath: '/tmp/project'
    })
  })

  it('validates batch references and run transitions', () => {
    expect(
      startLocalTaskBatchArgsSchema.parse({
        tasks: [{ taskId: 'lt_1', projectPath: '/tmp/project' }],
        recoverQueued: true
      })
    ).toEqual({ tasks: [{ taskId: 'lt_1', projectPath: '/tmp/project' }], recoverQueued: true })
    expect(
      updateLocalTaskRunArgsSchema.parse({
        taskId: 'lt_1',
        projectPath: '/tmp/project',
        runId: 'ltr_1',
        status: 'running',
        sessionId: 'tab-1'
      })
    ).toMatchObject({ status: 'running', sessionId: 'tab-1' })
    expect(() => updateLocalTaskRunArgsSchema.parse({ runId: 'ltr_1' })).toThrow()
  })

  it('accepts bounded live session evidence when archiving', () => {
    expect(
      acceptLocalTaskArgsSchema.parse({ taskId: 'lt_1', projectPath: '/tmp/project' })
    ).toEqual({ taskId: 'lt_1', projectPath: '/tmp/project' })
    expect(
      archiveLocalTaskArgsSchema.parse({
        taskId: 'lt_1',
        projectPath: '/tmp/project',
        activeSessionIds: ['session-1']
      })
    ).toEqual({
      taskId: 'lt_1',
      projectPath: '/tmp/project',
      activeSessionIds: ['session-1']
    })
  })

  it('validates workspace ownership transfers', () => {
    expect(
      transferLocalTaskWorkspaceArgsSchema.parse({
        sourceProjectPath: '/tmp/source',
        targetProjectId: 'project-1',
        targetProjectPath: '/tmp/target',
        targetWorkspaceId: 'workspace-2',
        targetWorkspaceLabel: 'main'
      })
    ).toEqual({
      sourceProjectPath: '/tmp/source',
      targetProjectId: 'project-1',
      targetProjectPath: '/tmp/target',
      targetWorkspaceId: 'workspace-2',
      targetWorkspaceLabel: 'main'
    })
  })

  it('validates Kanban AI record list and read requests', () => {
    expect(
      kanbanAiRecordListArgsSchema.parse({
        projectId: ' project-1 ',
        projectPath: ' /tmp/project '
      })
    ).toEqual({ projectId: 'project-1', projectPath: '/tmp/project' })
    expect(
      markKanbanAiRecordReadArgsSchema.parse({
        projectId: 'project-1',
        projectPath: '/tmp/project',
        recordId: 'air_1'
      })
    ).toMatchObject({ recordId: 'air_1' })
    expect(() =>
      markKanbanAiRecordReadArgsSchema.parse({
        projectId: 'project-1',
        projectPath: '/tmp/project',
        recordId: 'air_1',
        readAt: 1
      })
    ).toThrow()
  })
})
