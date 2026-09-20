import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  BrowserWindow: { getAllWindows: () => [] }
}))

import {
  setLocalTaskStoreForTests,
  LocalTaskStore,
  type LocalTaskProfilePersistence
} from '../../../local-tasks/store'
import type { LocalTask, LocalTaskCurrentContext } from '../../../../shared/local-task-types'
import { buildRegistry } from '../core'
import { LOCAL_TASK_METHODS } from './local-tasks'

const registry = buildRegistry(LOCAL_TASK_METHODS)
const directories: string[] = []
const roots = new WeakMap<LocalTaskStore, string>()

function setupStore(): LocalTaskStore {
  const directory = mkdtempSync(join(tmpdir(), 'orca-local-task-rpc-'))
  directories.push(directory)
  let saved: LocalTask[] = []
  const persistence: LocalTaskProfilePersistence = {
    getLocalTasks: () => saved,
    saveLocalTask: (task) => {
      saved = [...saved.filter((entry) => entry.id !== task.id), task]
      return task
    },
    deleteLocalTask: (id) => {
      saved = saved.filter((entry) => entry.id !== id)
    }
  }
  const store = new LocalTaskStore(persistence)
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
  return method.handler(method.params!.parse(params), { runtime: {} as never })
}

afterEach(() => {
  setLocalTaskStoreForTests(null)
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('local task Agent RPC', () => {
  it('rejects tagging a session owned by another task', () => {
    const store = setupStore()
    const first = store.create({ projectId: 'orca', intakeState: 'inbox', description: '一' })
    const second = store.create({ projectId: 'orca', intakeState: 'inbox', description: '二' })
    const session = store.createSession({ taskId: first.id, associationSource: 'clarification' })
    expect(() =>
      call('localTask.setSessionTags', {
        taskId: second.id,
        sessionId: session.id,
        tags: ['review']
      })
    ).toThrow('Session does not belong')
    call('localTask.setSessionTags', { taskId: first.id, sessionId: session.id, tags: ['review'] })
    expect(store.get(first.id)?.sessions[0].tags).toEqual(['review'])
  })

  it('lists only registered local project tasks', () => {
    const store = setupStore()
    const local = store.create({
      projectId: 'local-project',
      intakeState: 'inbox',
      description: '本机'
    })
    store.create({ projectId: 'remote-project', intakeState: 'inbox', description: '远程' })
    store.create({ projectId: 'missing-project', intakeState: 'inbox', description: '已移除' })
    const method = registry.get('localTask.list')!
    if ('stream' in method) {
      throw new Error('Expected unary method')
    }
    const result = method.handler(
      {},
      {
        runtime: {
          listRepos: () => [
            { id: 'local-project' },
            { id: 'remote-project', connectionId: 'ssh-one' }
          ]
        } as never
      }
    )
    expect(result).toEqual({ tasks: [local] })
  })

  it('provides parent goals and sibling summaries while keeping assignments separate', () => {
    const store = setupStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: rootOf(store),
      title: '资源诊断父任务',
      description: '父任务已确认的目标',
      workspaceId: 'wt-1'
    })

    call('localTask.current', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: 'tab-1',
      worktreeId: 'wt-1'
    })
    store.createSession({
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: 'other-tab',
      workspaceId: 'wt-1',
      title: '不相关子任务'
    })
    const result = call('localTask.current', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: 'tab-1',
      worktreeId: 'wt-1'
    }) as LocalTaskCurrentContext

    expect(result.task).toEqual({
      id: task.id,
      title: '资源诊断父任务',
      description: '父任务已确认的目标',
      descriptionRevision: store.get(task.id)?.descriptionRevision ?? store.get(task.id)?.updatedAt
    })
    expect(result.session).toEqual({
      id: 'tab-1',
      title: 'Agent 会话',
      status: 'working'
    })
    expect(result.assignedSubtasks).toHaveLength(1)
    expect(result.assignedSubtasks[0]?.sessionId).toBe('tab-1')
    expect(result.referenceSubtasks).toEqual([
      expect.objectContaining({ title: '不相关子任务', sessionId: 'other-tab' })
    ])
    expect(result.reference).toBeUndefined()
    const before = structuredClone(store.get(task.id))
    const selected = call('localTask.current', {
      taskId: task.id,
      sessionId: 'tab-1',
      referenceSubtaskId: result.referenceSubtasks![0].id
    }) as LocalTaskCurrentContext
    expect(selected.reference?.savedTurns).toEqual([])
    expect(selected.reference?.historySource).toBe('saved-turns')
    expect(selected.reference?.historyIsComplete).toBe(false)
    expect(JSON.stringify(selected.reference)).not.toContain('latestOutput')
    expect(store.get(task.id)).toEqual(before)
    const foreign = store.create({
      projectId: 'orca',
      intakeState: 'inbox',
      description: '另一个父任务'
    })
    expect(() =>
      call('localTask.current', {
        taskId: task.id,
        sessionId: 'tab-1',
        referenceSubtaskId: foreign.subtasks[0].id
      })
    ).toThrow('does not belong')
    expect(() =>
      call('localTask.updateSubtask', {
        taskId: task.id,
        sessionId: 'tab-1',
        subtaskId: selected.reference!.subtask.id,
        status: 'done'
      })
    ).toThrow('another Agent session')
    expect(store.get(task.id)?.sessions).toHaveLength(2)
  })

  it('returns a description revision and rejects a stale description write', () => {
    const store = setupStore()
    const task = store.create({
      projectId: 'orca',
      projectPath: rootOf(store),
      description: '只关注 iOS',
      workspaceId: 'wt-1'
    })
    const current = call('localTask.current', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: 'tab-1',
      worktreeId: 'wt-1'
    }) as LocalTaskCurrentContext
    expect(current.task.descriptionRevision).toBe(
      store.get(task.id)?.descriptionRevision ?? store.get(task.id)?.updatedAt
    )
    expect(() =>
      call('localTask.updateDescription', {
        taskId: task.id,
        projectPath: rootOf(store),
        sessionId: 'tab-1',
        worktreeId: 'wt-1',
        description: '过期写回',
        expectedRevision: task.updatedAt - 1
      })
    ).toThrow('Task description changed')
    const updated = call('localTask.updateDescription', {
      taskId: task.id,
      projectPath: rootOf(store),
      sessionId: 'tab-1',
      worktreeId: 'wt-1',
      description: '只关注 iOS 和确认后的验收',
      expectedRevision: current.task.descriptionRevision
    }) as { task: { description: string } }
    expect(updated.task.description).toBe('只关注 iOS 和确认后的验收')
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
