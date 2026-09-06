import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalTaskStore, type LocalTaskProfilePersistence } from './store'
import type { LocalTask } from '../../shared/local-task-types'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('LocalTaskStore inbox updates', () => {
  it('preserves project and execution context when moving a task to the inbox', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-local-task-inbox-'))
    roots.push(root)
    let saved: LocalTask[] = []
    const persistence: LocalTaskProfilePersistence = {
      getLocalTasks: () => saved,
      saveLocalTask: (next) => {
        saved = [...saved.filter((entry) => entry.id !== next.id), next]
        return next
      },
      deleteLocalTask: (id) => {
        saved = saved.filter((entry) => entry.id !== id)
      }
    }
    const store = new LocalTaskStore(persistence)
    const task = store.create({
      projectId: 'orca',
      projectPath: root,
      title: '保留归属',
      description: '只改变收件箱整理状态',
      workspaceId: 'wt-a',
      workspaceLabel: 'feature/inbox'
    })

    const moved = store.update(task.id, { intakeState: 'inbox' }, root)

    expect(moved).toMatchObject({
      intakeState: 'inbox',
      projectId: task.projectId,
      projectPath: task.projectPath,
      workspaceId: task.workspaceId,
      workspaceLabel: task.workspaceLabel,
      status: task.status,
      sessions: task.sessions,
      subtasks: task.subtasks
    })
    store.close()
  })
})
