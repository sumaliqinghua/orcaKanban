import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  BrowserWindow: { getAllWindows: () => [] }
}))

import { setLocalTaskStoreForTests, LocalTaskStore } from '../../../local-tasks/store'
import { buildRegistry } from '../core'
import { LOCAL_TASK_METHODS } from './local-tasks'

const registry = buildRegistry(LOCAL_TASK_METHODS)
const directories: string[] = []
const roots = new WeakMap<LocalTaskStore, string>()

function setupStore(): LocalTaskStore {
  const directory = mkdtempSync(join(tmpdir(), 'orca-local-task-rpc-'))
  directories.push(directory)
  const store = new LocalTaskStore()
  roots.set(store, directory)
  setLocalTaskStoreForTests(store)
  return store
}

const rootOf = (store: LocalTaskStore): string => roots.get(store)!

function call(name: string, params: Record<string, unknown>): unknown {
  const method = registry.get(name)
  if (!method || 'stream' in method) {
    throw new Error(`Missing local task method: ${name}`)
  }
  return method.handler(params, { runtime: {} as never })
}

afterEach(() => {
  setLocalTaskStoreForTests(null)
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('local task Agent RPC', () => {
  it('binds current session lazily and returns the task context', () => {
    const store = setupStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: rootOf(store),
      description: '分析资源加载差异',
      workspaceId: 'wt-1'
    })

    const result = call('localTask.current', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: 'tab-1',
      worktreeId: 'wt-1'
    }) as { task: typeof task; session: { id: string; taskId: string } }

    expect(result.task.id).toBe(task.id)
    expect(result.session).toMatchObject({
      id: 'tab-1',
      taskId: task.id,
      associationSource: 'task-center'
    })
    expect(store.get(task.id)?.sessions).toHaveLength(1)
  })

  it('updates AI subtasks and enters review after reporting work', () => {
    const store = setupStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: rootOf(store),
      description: '整理 YooAsset 差异',
      workspaceId: 'wt-1'
    })
    const session = store.createSession({
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: 'tab-1',
      workspaceId: 'wt-1'
    })
    const created = call('localTask.createSubtask', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: session.id,
      worktreeId: 'wt-1',
      title: '比较运行时加载入口',
      steps: ['读取当前项目', '整理差异']
    }) as { task: typeof task }
    const subtask = created.task.subtasks[0]!
    const firstStep = subtask.steps[0]!
    const secondStep = subtask.steps[1]!

    call('localTask.updateStep', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: session.id,
      worktreeId: 'wt-1',
      subtaskId: subtask.id,
      stepId: firstStep.id,
      status: 'done'
    })
    call('localTask.updateStep', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: session.id,
      worktreeId: 'wt-1',
      subtaskId: subtask.id,
      stepId: secondStep.id,
      status: 'done'
    })
    call('localTask.updateSubtask', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: session.id,
      worktreeId: 'wt-1',
      subtaskId: subtask.id,
      status: 'done'
    })
    call('localTask.updateSubtask', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: session.id,
      worktreeId: 'wt-1',
      subtaskId: created.task.subtasks[1]!.id,
      status: 'done'
    })
    const completed = call('localTask.reportCompleted', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: session.id,
      worktreeId: 'wt-1',
      latestOutput: '差异已整理完成'
    }) as { task: typeof task }

    expect(completed.task.status).toBe('Needs review')
    expect(completed.task.latestOutput?.text).toBe('差异已整理完成')
    expect(completed.task.sessions[0]?.status).toBe('done')
  })

  it('lets an Agent pause for a user decision in Needs review', () => {
    const store = setupStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: rootOf(store),
      description: '需要产品决策',
      workspaceId: 'wt-1'
    })
    const session = store.createSession({
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: 'tab-review',
      workspaceId: 'wt-1'
    })
    const reviewed = call('localTask.requestReview', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: session.id,
      worktreeId: 'wt-1',
      question: '请确认是否兼容旧版配置格式。'
    }) as { task: typeof task }

    expect(reviewed.task.status).toBe('Needs review')
    expect(reviewed.task.reviewKind).toBe('needs_input')
    expect(reviewed.task.reviewQuestion).toContain('旧版配置')
  })

  it('rejects a session from another workspace and editing a started step', () => {
    const store = setupStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: rootOf(store),
      description: '任务',
      workspaceId: 'wt-1'
    })
    const session = store.createSession({
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: 'tab-1',
      workspaceId: 'wt-1'
    })
    const created = store.createSubtask({
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: session.id,
      title: '步骤',
      steps: ['执行']
    })
    const subtask = created.subtasks[0]!
    const step = subtask.steps[0]!

    expect(() =>
      call('localTask.current', {
        taskId: task.id,
        projectPath: rootOf(store),
        sessionId: session.id,
        worktreeId: 'wt-2'
      })
    ).toThrow('not bound')
    call('localTask.updateStep', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: session.id,
      worktreeId: 'wt-1',
      subtaskId: subtask.id,
      stepId: step.id,
      status: 'doing'
    })
    expect(() =>
      call('localTask.updateStep', {
        taskId: task.id,
        projectPath: rootOf(store),
        sessionId: session.id,
        worktreeId: 'wt-1',
        subtaskId: subtask.id,
        stepId: step.id,
        title: '不应修改已开始步骤'
      })
    ).toThrow('unstarted')
  })

  it('binds Agent-created subtasks and blocks another session until transfer', () => {
    const store = setupStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: rootOf(store),
      description: '子任务归属',
      workspaceId: 'wt-1'
    })
    store.createSession({
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: 'owner-session',
      workspaceId: 'wt-1'
    })
    store.createSession({
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: 'next-session',
      workspaceId: 'wt-1',
      initialPrompt: '新的功能'
    })
    const created = call('localTask.createSubtask', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: 'owner-session',
      worktreeId: 'wt-1',
      title: '制作工具',
      steps: ['初版实现']
    }) as { task: typeof task }
    const subtask = created.task.subtasks[0]!
    const step = subtask.steps[0]!
    expect(subtask.sessionId).toBe('owner-session')

    expect(() =>
      call('localTask.updateStep', {
        taskId: task.id,
        projectPath: rootOf(store),
        sessionId: 'next-session',
        worktreeId: 'wt-1',
        subtaskId: subtask.id,
        stepId: step.id,
        status: 'doing'
      })
    ).toThrow('another Agent session')
  })
})
