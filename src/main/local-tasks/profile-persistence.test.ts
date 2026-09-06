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
    store.close()
  })
})
