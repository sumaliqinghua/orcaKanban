import type SyncDatabase from '../sqlite/sync-database'
import type {
  EditLocalTaskStepTitleArgs,
  LocalTask,
  UpdateLocalTaskStepArgs
} from '../../shared/local-task-types'
import type { LocalTaskRows } from './store-projection'
import { readLocalTask } from './store-read'

type StepRow = LocalTaskRows['steps'][number] & { task_id: string }

function findStep(db: SyncDatabase.Database, subtaskId: string, stepId: string): StepRow {
  const row = db
    .prepare(
      'SELECT step.*, subtask.task_id FROM local_task_steps step JOIN local_task_subtasks subtask ON subtask.id = step.subtask_id WHERE step.id = ? AND step.subtask_id = ?'
    )
    .get(stepId, subtaskId) as StepRow | undefined
  if (!row) {
    throw new Error(`Local task step not found: ${stepId}`)
  }
  return row
}

export function updateLocalTaskStep(
  db: SyncDatabase.Database,
  args: UpdateLocalTaskStepArgs
): LocalTask {
  const row = findStep(db, args.subtaskId, args.stepId)
  db.prepare('UPDATE local_task_steps SET title = ?, status = ?, updated_at = ? WHERE id = ?').run(
    args.title?.trim() || row.title,
    args.status ?? row.status,
    Date.now(),
    row.id
  )
  return readLocalTask(db, row.task_id)!
}

export function editLocalTaskStepTitle(
  db: SyncDatabase.Database,
  args: EditLocalTaskStepTitleArgs
): LocalTask {
  const row = findStep(db, args.subtaskId, args.stepId)
  if (row.status !== 'todo') {
    throw new Error('Only an unstarted AI step can be edited')
  }
  db.prepare('UPDATE local_task_steps SET title = ?, updated_at = ? WHERE id = ?').run(
    args.title.trim() || row.title,
    Date.now(),
    row.id
  )
  return readLocalTask(db, row.task_id)!
}
