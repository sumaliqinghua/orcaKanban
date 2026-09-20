import { afterEach, describe, expect, it } from 'vitest'
import { LocalTaskStore, type LocalTaskProfilePersistence } from './store'
import type { LocalTask } from '../../shared/local-task-types'
import {
  buildLocalTaskCurrentContext,
  buildLocalTaskReferenceDetail
} from '../../shared/local-task-reference-context'

const stores: LocalTaskStore[] = []
afterEach(() => {
  for (const store of stores.splice(0)) {
    store.close()
  }
})

function fixture() {
  let tasks: LocalTask[] = []
  const persistence: LocalTaskProfilePersistence = {
    getLocalTasks: () => tasks,
    saveLocalTask: (task) => {
      tasks = [...tasks.filter((row) => row.id !== task.id), structuredClone(task)]
      return task
    },
    deleteLocalTask: () => {}
  }
  const store = new LocalTaskStore(persistence)
  stores.push(store)
  const task = store.create({
    projectId: 'repo',
    intakeState: 'inbox',
    description: '完善下载流程'
  })
  store.createSession({ taskId: task.id, sessionId: 'a', currentPrompt: '实现下载重试' })
  const b = store.createSession({ taskId: task.id, sessionId: 'b', currentPrompt: '验证取消下载' })
  return { store, taskId: task.id, b, persistence }
}

describe('subtask reference context', () => {
  it('preserves the initial description across follow-ups and a store restart', () => {
    const f = fixture()
    f.store.updateSessionOutput({
      sessionId: 'a',
      prompt: '为什么这样设计',
      sessionStatus: 'done',
      latestOutput: '解释与工具记录'
    })
    const reloaded = new LocalTaskStore(f.persistence)
    stores.push(reloaded)
    const task = reloaded.get(f.taskId)!
    const context = buildLocalTaskCurrentContext(task, f.b)
    expect(context.referenceSubtasks).toEqual([
      expect.objectContaining({ description: '实现下载重试', descriptionSource: 'subtask' })
    ])
    expect(context.assignedSubtasks.every((row) => row.sessionId === 'b')).toBe(true)
    expect(JSON.stringify(context)).not.toContain('为什么这样设计')
    expect(JSON.stringify(context)).not.toContain('解释与工具记录')
    const a = task.subtasks.find((row) => row.sessionId === 'a')!
    const detail = buildLocalTaskReferenceDetail(task, a)
    expect(detail.savedTurns).toEqual([
      expect.objectContaining({ prompt: '为什么这样设计', summary: '解释与工具记录' })
    ])
    expect(JSON.stringify(detail)).not.toContain('latestOutput')
    expect(detail.historySource).toBe('saved-turns')
    expect(detail.historyIsComplete).toBe(false)
  })

  it('keeps new sibling requests stable and exposes a complete description only on demand', () => {
    const f = fixture()
    const request = '完整实现要求'.repeat(600)
    const c = f.store.createSession({ taskId: f.taskId, sessionId: 'c', currentPrompt: request })
    f.store.updateSessionOutput({ sessionId: c.id, prompt: '后续追问', sessionStatus: 'working' })
    const task = f.store.get(f.taskId)!
    const context = buildLocalTaskCurrentContext(task, f.b)
    const preview = context.referenceSubtasks!.find((row) => row.sessionId === c.id)!
    expect(preview.description).toHaveLength(2000)
    expect(preview.descriptionTruncated).toBe(true)
    expect(
      buildLocalTaskReferenceDetail(
        task,
        task.subtasks.find((row) => row.id === preview.id)!
      ).subtask.description
    ).toBe(request)
  })

  it('labels legacy descriptions without claiming the oldest retained prompt is the original', () => {
    const f = fixture()
    f.store.updateSessionOutput({
      sessionId: 'a',
      prompt: '最早保留的追问',
      sessionStatus: 'done',
      latestOutput: '回答'
    })
    f.store.updateSessionOutput({ sessionId: 'a', prompt: '最近追问', sessionStatus: 'working' })
    const task = structuredClone(f.store.get(f.taskId)!)
    const a = task.subtasks.find((row) => row.sessionId === 'a')!
    delete a.description
    expect(buildLocalTaskReferenceDetail(task, a).subtask).toMatchObject({
      description: '最早保留的追问',
      descriptionSource: 'retained-prompt'
    })
    task.sessions.find((row) => row.id === 'a')!.turns = []
    expect(buildLocalTaskReferenceDetail(task, a).subtask.descriptionSource).toBe('recent-prompt')
    task.sessions = []
    expect(buildLocalTaskReferenceDetail(task, a)).toMatchObject({
      subtask: { description: null, descriptionSource: 'unavailable' },
      savedTurns: []
    })
  })

  it('includes unstarted siblings without creating or waking a session', () => {
    const f = fixture()
    const task = f.store.createSubtask({ taskId: f.taskId, title: '补文档' })
    const before = structuredClone(task)
    const context = buildLocalTaskCurrentContext(task, f.b)
    const unstarted = context.referenceSubtasks!.find((row) => row.sessionId === null)!
    expect(unstarted).toMatchObject({ description: '补文档', descriptionSource: 'subtask' })
    expect(
      buildLocalTaskReferenceDetail(
        task,
        task.subtasks.find((row) => row.id === unstarted.id)!
      ).savedTurns
    ).toEqual([])
    expect(f.store.get(f.taskId)).toEqual(before)
  })
})
