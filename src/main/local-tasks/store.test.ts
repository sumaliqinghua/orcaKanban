import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }))

import SyncDatabase from '../sqlite/sync-database'
import { LocalTaskStore } from './store'

const directories: string[] = []
function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'orca-local-task-'))
  directories.push(directory)
  return join(directory, 'local-tasks.db')
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('LocalTaskStore', () => {
  it('creates a task with first-line title and default workspace', () => {
    const store = new LocalTaskStore(databasePath())
    const task = store.create({ projectId: 'orca', description: '修复登录刷新\n补充测试' })

    expect(task).toMatchObject({
      projectId: 'orca',
      title: '修复登录刷新',
      titleSource: 'first-line',
      workspaceId: 'local',
      workspaceLabel: 'local · 当前 HEAD',
      status: 'Open'
    })
    store.close()
  })

  it('keeps custom titles and supports multiple tasks in one workspace', () => {
    const store = new LocalTaskStore(databasePath())
    const first = store.create({
      projectId: 'orca',
      title: '用户标题',
      description: '需求一',
      workspaceId: 'wt-1',
      workspaceLabel: '本地 · feature/login'
    })
    const second = store.create({
      projectId: 'orca',
      description: '需求二',
      workspaceId: 'wt-1',
      workspaceLabel: '本地 · feature/login'
    })

    expect(first.titleSource).toBe('user')
    expect(store.list('orca')).toHaveLength(2)
    expect(second.workspaceId).toBe(first.workspaceId)
    store.close()
  })

  it('associates one session with one task and makes repeated requests idempotent', () => {
    const store = new LocalTaskStore(databasePath())
    const first = store.create({ projectId: 'orca', description: '任务一' })
    const second = store.create({ projectId: 'orca', description: '任务二' })
    const session = store.createSession({
      taskId: first.id,
      sessionId: 'session-a',
      title: '实现会话'
    })

    expect(store.createSession({ taskId: first.id, sessionId: 'session-a' })).toEqual(session)
    expect(() => store.createSession({ taskId: second.id, sessionId: 'session-a' })).toThrow(
      'another local task'
    )
    expect(store.get(first.id)?.sessions[0]).toMatchObject({
      id: 'session-a',
      associationSource: 'task-center'
    })
    store.close()
  })

  it('tracks subtasks and AI steps, then enters review only when all work is done', () => {
    const store = new LocalTaskStore(databasePath())
    const task = store.create({ projectId: 'orca', description: '修复并发刷新' })
    const session = store.createSession({ taskId: task.id, title: '主实现会话' })
    const withSubtask = store.createSubtask({
      taskId: task.id,
      sessionId: session.id,
      title: '修复请求去重',
      steps: ['定位原因', '补充测试']
    })
    const subtask = withSubtask.subtasks[0]!
    const firstStep = subtask.steps[0]!
    const edited = store.editStepTitle({
      subtaskId: subtask.id,
      stepId: firstStep.id,
      title: '定位并发原因'
    })
    expect(
      edited.subtasks[0]?.steps.some(
        (step) => step.title === '定位并发原因' && step.status === 'todo'
      )
    ).toBe(true)
    store.updateStep({ subtaskId: subtask.id, stepId: firstStep.id, status: 'done' })
    expect(() =>
      store.editStepTitle({
        subtaskId: subtask.id,
        stepId: firstStep.id,
        title: '不能改已执行步骤'
      })
    ).toThrow('unstarted')
    expect(
      store.reportCompleted({
        taskId: task.id,
        sessionId: session.id,
        titleSuggestion: '修复登录刷新并发覆盖',
        description: '已完成第一轮实现，仍需补齐测试。'
      })
    ).toMatchObject({ status: 'In progress', title: '修复登录刷新并发覆盖' })

    const current = store.get(task.id)!
    const remaining = current.subtasks[0]!.steps.find((step) => step.id !== firstStep.id)!
    store.updateStep({ subtaskId: subtask.id, stepId: remaining.id, status: 'done' })
    store.updateSubtask({ subtaskId: subtask.id, status: 'done' })
    expect(store.get(task.id)?.subtasks[0]).toMatchObject({
      status: 'done',
      steps: [{ status: 'done' }, { status: 'done' }]
    })
    const reviewed = store.reportCompleted({
      taskId: task.id,
      sessionId: session.id,
      titleSuggestion: '不应覆盖首次标题',
      latestOutput: '本轮完成。'
    })

    expect(reviewed.status).toBe('Needs review')
    expect(reviewed.title).toBe('修复登录刷新并发覆盖')
    expect(reviewed.description).toBe('已完成第一轮实现，仍需补齐测试。')
    expect(store.accept(task.id).status).toBe('Done')
    expect(() => store.accept(task.id)).toThrow('awaiting review')
    store.close()
  })

  it('requires a waiting reason and keeps archived history recoverable', () => {
    const store = new LocalTaskStore(databasePath())
    const task = store.create({ projectId: 'orca', description: '等待确认' })

    expect(() => store.update(task.id, { status: 'Waiting' })).toThrow('requires a reason')
    expect(store.update(task.id, { status: 'Waiting', waitingReason: '请确认方案' })).toMatchObject(
      {
        status: 'Waiting',
        waitingReason: '请确认方案'
      }
    )
    expect(store.update(task.id, { status: 'In progress' }).waitingReason).toBeNull()
    expect(store.archive(task.id).archivedAt).not.toBeNull()
    expect(store.list('orca')).toHaveLength(0)
    expect(store.restore(task.id).archivedAt).toBeNull()
    expect(store.list('orca')).toHaveLength(1)
    store.close()
  })

  it('keeps Done and Needs review when a follow-up session is opened', () => {
    const store = new LocalTaskStore(databasePath())
    const task = store.create({ projectId: 'orca', description: '已交付任务' })
    const firstSession = store.createSession({ taskId: task.id, sessionId: 'first-delivery' })
    store.reportCompleted({ taskId: task.id, sessionId: firstSession.id })
    store.createSession({ taskId: task.id, sessionId: 'review-question' })
    store.reportCompleted({
      taskId: task.id,
      sessionId: 'review-question',
      latestOutput: '追问答复'
    })
    expect(store.get(task.id)?.status).toBe('Needs review')
    store.update(task.id, { status: 'In progress' })
    store.createSession({ taskId: task.id, sessionId: 'requested-change' })
    expect(store.get(task.id)?.status).toBe('In progress')
    store.reportCompleted({ taskId: task.id, sessionId: 'requested-change' })
    store.accept(task.id)
    store.createSession({ taskId: task.id, sessionId: 'done-question' })
    store.reportCompleted({ taskId: task.id, sessionId: 'done-question', latestOutput: '继续答疑' })
    expect(store.get(task.id)?.status).toBe('Done')
    store.close()
  })

  it('migrates an older database without title and association columns', () => {
    const path = databasePath()
    const old = new SyncDatabase(path)
    old.exec(`
      CREATE TABLE local_tasks (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
        status TEXT NOT NULL, workspace_id TEXT NOT NULL, workspace_label TEXT NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, archived_at INTEGER,
        title_source TEXT NOT NULL, waiting_reason TEXT
      );
      CREATE TABLE local_task_sessions (
        id TEXT PRIMARY KEY, task_id TEXT NOT NULL, workspace_id TEXT NOT NULL, title TEXT NOT NULL,
        status TEXT NOT NULL, latest_output TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE local_task_subtasks (
        id TEXT PRIMARY KEY, task_id TEXT NOT NULL, session_id TEXT, title TEXT NOT NULL,
        status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE local_task_steps (
        id TEXT PRIMARY KEY, subtask_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, updated_at INTEGER NOT NULL
      );
    `)
    old.close()

    const store = new LocalTaskStore(path)
    const task = store.create({ projectId: 'orca', description: '迁移后的任务' })
    expect(task.titleSuggestion).toBeNull()
    expect(store.createSession({ taskId: task.id }).associationSource).toBe('task-center')
    store.close()
  })
})
