import type SyncDatabase from '../sqlite/sync-database'
import type { LocalTask } from '../../shared/local-task-types'
import { projectLocalTaskRows, type LocalTaskRows } from './store-projection'

export function readLocalTask(db: SyncDatabase.Database, id: string): LocalTask | null {
  const task = db.prepare('SELECT * FROM local_tasks WHERE id = ?').get(id) as
    | LocalTaskRows['tasks'][number]
    | undefined
  if (!task) {
    return null
  }
  const sessions = db
    .prepare('SELECT * FROM local_task_sessions WHERE task_id = ? ORDER BY updated_at DESC')
    .all(id) as LocalTaskRows['sessions']
  const subtasks = db
    .prepare('SELECT * FROM local_task_subtasks WHERE task_id = ? ORDER BY updated_at DESC')
    .all(id) as LocalTaskRows['subtasks']
  const steps = subtasks.length
    ? (db
        .prepare(
          `SELECT * FROM local_task_steps WHERE subtask_id IN (${subtasks.map(() => '?').join(',')}) ORDER BY updated_at`
        )
        .all(...subtasks.map((subtask) => subtask.id)) as LocalTaskRows['steps'])
    : []
  return projectLocalTaskRows(task, sessions, subtasks, steps)
}
