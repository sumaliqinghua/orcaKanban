import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalTaskStore, type LocalTaskProfilePersistence } from './store'
import type { LocalTask } from '../../shared/local-task-types'

describe('LocalTaskStore profile persistence', () => {
  const roots: string[] = []
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  })

  it('keeps metadata in the profile while creating only context markdown', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-local-task-profile-'))
    roots.push(root)
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
    const task = store.create({ projectId: 'orca', projectPath: root, description: '配置任务' })
    expect(saved).toHaveLength(1)
    expect(store.list()).toEqual([task])
    expect(task.subtasks).toMatchObject([
      { title: '实现：配置任务', status: 'todo', sessionId: null, steps: [] }
    ])
    expect(() => store.get(task.id, root)).not.toThrow()
    expect(existsSync(join(root, 'orca', task.id, 'prd.md'))).toBe(true)
    expect(existsSync(join(root, 'orca', task.id, 'plan.md'))).toBe(true)
    expect(existsSync(join(root, 'orca', task.id, 'records.md'))).toBe(true)
    expect(existsSync(join(root, 'orca', task.id, 'task.json'))).toBe(false)
    const session = store.createSession({ taskId: task.id, sessionId: 'initial' })
    expect(store.get(task.id)?.subtasks[0]?.sessionId).toBe(session.id)
    const followup = store.createSession({
      taskId: task.id,
      sessionId: 'followup',
      currentPrompt: '检查另一个方案'
    })
    expect(store.get(task.id)?.subtasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sessionId: followup.id, title: '检查另一个方案' })
      ])
    )
    store.close()
  })

  it('restores task metadata in a new store instance', () => {
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
    const first = new LocalTaskStore(persistence)
    const created = first.create({ projectId: 'orca', description: '重启恢复' })
    first.close()
    const second = new LocalTaskStore(persistence)
    expect(second.get(created.id)?.subtasks[0]?.title).toBe('实现：重启恢复')
    second.close()
  })

  it('keeps inbox tasks visible when a project path filter is applied', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-local-task-inbox-'))
    roots.push(root)
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
    const task = store.create({
      projectId: 'orca',
      description: '暂存事项',
      intakeState: 'inbox'
    })
    expect(store.list('orca', root)).toEqual([task])
    store.close()
  })
})
