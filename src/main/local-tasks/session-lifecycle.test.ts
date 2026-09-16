import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalTaskStore, type LocalTaskProfilePersistence } from './store'
import type { LocalTask } from '../../shared/local-task-types'

describe('task session lifecycle', () => {
  let root: string
  let store: LocalTaskStore
  let saved: LocalTask[]
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'orca-task-lifecycle-'))
    saved = []
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
    store = new LocalTaskStore(persistence)
  })
  afterEach(() => {
    store.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('starts immediately and waits for every parallel session before acceptance', () => {
    const task = store.create({ projectId: 'orca', projectPath: root, description: '并行实现' })
    store.createSession({ taskId: task.id, sessionId: 'a' })
    expect(store.get(task.id)?.status).toBe('In progress')
    store.createSession({ taskId: task.id, sessionId: 'b' })
    const partial = store.updateSessionOutput({ sessionId: 'a', sessionStatus: 'done' })
    expect(partial.status).toBe('In progress')
    expect(() => store.accept(task.id)).toThrow(/awaiting review/)
    expect(store.updateSessionOutput({ sessionId: 'b', sessionStatus: 'done' }).status).toBe(
      'Needs review'
    )
    expect(store.accept(task.id).status).toBe('Done')
  })

  it('emits the inbox event for a newly created inbox task but not ordinary edits', () => {
    const events: { eventType: string; eventId: string }[] = []
    store.setOnEvent((event) => events.push(event))
    const task = store.create({
      projectId: 'orca',
      projectPath: root,
      description: '收件箱触发测试',
      intakeState: 'inbox'
    })
    expect(events).toEqual([expect.objectContaining({ eventType: 'local_task.intake_changed' })])
    expect(events[0]?.eventId).toContain(task.id)
    store.update(task.id, { description: '仅修改描述' }, root)
    expect(events).toHaveLength(1)
  })

  it('emits deterministic events for inbox, review, reopen, and session completion edges', () => {
    const events: { eventType: string; eventId: string }[] = []
    store.setOnEvent((event) => events.push(event))
    const task = store.create({ projectId: 'orca', projectPath: root, description: '事件' })
    store.update(task.id, { intakeState: 'inbox' }, root)
    store.createSession({ taskId: task.id, sessionId: 'event-session' })
    store.updateSessionOutput({ sessionId: 'event-session', sessionStatus: 'done' })
    store.update(task.id, { archived: true }, root)
    store.restore(task.id, root)
    expect(events.map((event) => event.eventType)).toEqual([
      'local_task.intake_changed',
      'local_task.status_changed',
      'local_task.status_changed',
      'agent_session.completed',
      'local_task.reopened'
    ])
    expect(new Set(events.map((event) => event.eventId)).size).toBe(events.length)
  })

  it('does not let a completion report override another working session', () => {
    const task = store.create({ projectId: 'orca', projectPath: root, description: '并行报告' })
    store.createSession({ taskId: task.id, sessionId: 'a' })
    store.createSession({ taskId: task.id, sessionId: 'b' })
    expect(store.reportCompleted({ taskId: task.id, sessionId: 'a' }).status).toBe('In progress')
  })

  it('accepts status events through the current restored terminal tab', () => {
    const task = store.create({ projectId: 'orca', projectPath: root, description: '恢复会话' })
    store.createSession({ taskId: task.id, sessionId: 'original' })
    store.rebindSessionTab({ sessionId: 'original', tabId: 'restored' })
    const updated = store.updateSessionOutput({ sessionId: 'restored', sessionStatus: 'done' })
    expect(updated.status).toBe('Needs review')
    expect(updated.sessions[0]).toMatchObject({ id: 'original', tabId: 'restored', status: 'done' })
    const resumed = store.updateSessionOutput({ sessionId: 'restored', sessionStatus: 'working' })
    expect(resumed.status).toBe('In progress')
    expect(resumed.sessions[0]).toMatchObject({
      id: 'original',
      tabId: 'restored',
      status: 'working'
    })
    expect(store.get(task.id)?.status).toBe('In progress')
    expect(store.updateSessionOutput({ sessionId: 'restored', sessionStatus: 'done' }).status).toBe(
      'Needs review'
    )
  })

  it('does not finish a batch on working events or manual notes', () => {
    const task = store.create({ projectId: 'orca', projectPath: root, description: '执行批次' })
    const batch = store.startBatch([{ taskId: task.id, projectPath: root }])
    const runId = batch.candidates[0]!.runId
    store.createSession({ taskId: task.id, sessionId: 'a' })
    store.updateRun({
      taskId: task.id,
      projectPath: root,
      runId,
      sessionId: 'a',
      status: 'running'
    })
    for (const event of [{ sessionStatus: 'working' as const }, { manualNotes: '观察记录' }]) {
      const updated = store.updateSessionOutput({ sessionId: 'a', ...event })
      expect(updated.status).toBe('In progress')
      expect(updated.runs[0]).toMatchObject({ status: 'running', finishedAt: null })
    }
  })
})
