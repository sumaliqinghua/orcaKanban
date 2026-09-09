import { describe, expect, it } from 'vitest'
import { LocalTaskStore } from './store'
import type { LocalTask } from '../../shared/local-task-types'
import { findTaggedTaskSession } from '../../shared/local-task-session-tags'

describe('task session tags', () => {
  it('persists tags without ending work or changing message order', () => {
    let tasks: LocalTask[] = []
    const persistence = {
      getLocalTasks: () => tasks,
      saveLocalTask: (task: LocalTask) => {
        tasks = [...tasks.filter((entry) => entry.id !== task.id), task]
        return task
      },
      deleteLocalTask: () => {}
    }
    const store = new LocalTaskStore(persistence)
    const task = store.create({ projectId: 'test', intakeState: 'inbox', description: '需求' })
    const session = store.createSession({
      taskId: task.id,
      associationSource: 'clarification',
      tags: ['review']
    })
    const updated = store.updateSessionOutput({ sessionId: session.id, tags: [' inbox ', 'inbox'] })
    expect(updated.sessions[0]).toMatchObject({
      tags: ['inbox'],
      status: 'working',
      updatedAt: session.updatedAt
    })
    expect(updated.status).toBe('Open')
    expect(updated.runs).toEqual([])
    const restored = new LocalTaskStore(persistence).get(task.id)!
    expect(findTaggedTaskSession(restored.sessions, 'inbox')?.id).toBe(session.id)
    expect(findTaggedTaskSession(restored.sessions, 'review')).toBeUndefined()
    expect(store.updateSessionOutput({ sessionId: session.id, tags: [] }).sessions[0].tags).toEqual(
      []
    )
  })
})
