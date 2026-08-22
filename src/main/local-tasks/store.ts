import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import SyncDatabase from '../sqlite/sync-database'
import type {
  LocalTask,
  LocalTaskSession,
  ReportLocalTaskCompletedArgs,
  CreateLocalTaskArgs,
  CreateLocalTaskSessionArgs,
  CreateLocalTaskSubtaskArgs,
  UpdateLocalTaskArgs,
  UpdateLocalTaskStepArgs,
  UpdateLocalTaskSubtaskArgs
} from '../../shared/local-task-types'
import { createLocalTaskSchema } from './store-schema'
import { projectLocalTaskRows, type LocalTaskRows } from './store-projection'

let singleton: LocalTaskStore | null = null
const timestamp = (): number => Date.now()
const text = (value: string | undefined, fallback: string): string => value?.trim() || fallback

export class LocalTaskStore {
  private readonly db: SyncDatabase.Database

  constructor(dbPath = join(app.getPath('userData'), 'local-tasks.db')) {
    this.db = new SyncDatabase(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('busy_timeout = 5000')
    this.db.exec(createLocalTaskSchema())
  }

  close(): void {
    this.db.close()
  }

  list(projectId?: string): LocalTask[] {
    const rows = (
      projectId
        ? this.db
            .prepare(
              'SELECT * FROM local_tasks WHERE project_id = ? AND archived_at IS NULL ORDER BY updated_at DESC'
            )
            .all(projectId)
        : this.db
            .prepare('SELECT * FROM local_tasks WHERE archived_at IS NULL ORDER BY updated_at DESC')
            .all()
    ) as LocalTaskRows['tasks']
    return rows.map((task) => this.read(task.id)!).filter(Boolean)
  }

  get(id: string): LocalTask | null {
    return this.read(id)
  }

  create(args: CreateLocalTaskArgs): LocalTask {
    const time = timestamp()
    const description = args.description.trim()
    const task = {
      id: `lt_${randomUUID()}`,
      projectId: text(args.projectId, 'local'),
      title: text(args.title, description.split(/\r?\n/, 1)[0] || '未命名本地任务'),
      description,
      workspaceId: text(args.workspaceId, 'local'),
      workspaceLabel: text(args.workspaceLabel, 'local · 当前 HEAD'),
      titleSource: args.title?.trim() ? 'user' : ('first-line' as const)
    }
    this.db
      .prepare(
        'INSERT INTO local_tasks (id, project_id, title, description, status, workspace_id, workspace_label, created_at, updated_at, archived_at, title_source, waiting_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        task.id,
        task.projectId,
        task.title,
        task.description,
        'Open',
        task.workspaceId,
        task.workspaceLabel,
        time,
        time,
        null,
        task.titleSource,
        null
      )
    return this.read(task.id)!
  }

  update(id: string, updates: UpdateLocalTaskArgs): LocalTask {
    const current = this.read(id)
    if (!current) {
      throw new Error(`Local task not found: ${id}`)
    }
    const time = timestamp()
    this.db
      .prepare(
        'UPDATE local_tasks SET title = ?, description = ?, status = ?, updated_at = ?, archived_at = ?, waiting_reason = ?, title_source = ? WHERE id = ?'
      )
      .run(
        updates.title?.trim() || current.title,
        updates.description ?? current.description,
        updates.status ?? current.status,
        time,
        updates.archived === true ? time : updates.archived === false ? null : current.archivedAt,
        updates.waitingReason === undefined ? current.waitingReason : updates.waitingReason,
        updates.title?.trim() ? 'user' : current.titleSource,
        id
      )
    return this.read(id)!
  }

  createSession(args: CreateLocalTaskSessionArgs): LocalTaskSession {
    const task = this.read(args.taskId)
    if (!task) {
      throw new Error(`Local task not found: ${args.taskId}`)
    }
    const time = timestamp()
    const session = {
      id: `lts_${randomUUID()}`,
      taskId: task.id,
      workspaceId: task.workspaceId,
      title: text(args.title, '自动创建会话')
    }
    this.db
      .prepare(
        'INSERT INTO local_task_sessions (id, task_id, workspace_id, title, status, latest_output, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        session.id,
        session.taskId,
        session.workspaceId,
        session.title,
        'working',
        null,
        time,
        time
      )
    this.update(task.id, { status: 'In progress' })
    return { ...session, status: 'working', latestOutput: null, createdAt: time, updatedAt: time }
  }

  createSubtask(args: CreateLocalTaskSubtaskArgs): LocalTask {
    const task = this.read(args.taskId)
    if (!task) {
      throw new Error(`Local task not found: ${args.taskId}`)
    }
    if (args.sessionId && !task.sessions.some((session) => session.id === args.sessionId)) {
      throw new Error('Session is not associated with this local task')
    }
    const time = timestamp()
    const subtaskId = `ltsub_${randomUUID()}`
    this.db
      .prepare(
        'INSERT INTO local_task_subtasks (id, task_id, session_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        subtaskId,
        task.id,
        args.sessionId ?? null,
        text(args.title, '未命名子任务'),
        'todo',
        time,
        time
      )
    for (const step of args.steps ?? []) {
      this.db
        .prepare(
          'INSERT INTO local_task_steps (id, subtask_id, title, status, updated_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(`ltstep_${randomUUID()}`, subtaskId, text(step, '未命名执行步骤'), 'todo', time)
    }
    return this.read(task.id)!
  }

  updateSubtask(args: UpdateLocalTaskSubtaskArgs): LocalTask {
    const row = this.db
      .prepare('SELECT * FROM local_task_subtasks WHERE id = ?')
      .get(args.subtaskId) as LocalTaskRows['subtasks'][number] | undefined
    if (!row) {
      throw new Error(`Local task subtask not found: ${args.subtaskId}`)
    }
    this.db
      .prepare('UPDATE local_task_subtasks SET title = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(args.title?.trim() || row.title, args.status ?? row.status, timestamp(), row.id)
    return this.read(row.task_id)!
  }

  updateStep(args: UpdateLocalTaskStepArgs): LocalTask {
    const row = this.db
      .prepare(
        'SELECT step.*, subtask.task_id FROM local_task_steps step JOIN local_task_subtasks subtask ON subtask.id = step.subtask_id WHERE step.id = ? AND step.subtask_id = ?'
      )
      .get(args.stepId, args.subtaskId) as
      | (LocalTaskRows['steps'][number] & { task_id: string })
      | undefined
    if (!row) {
      throw new Error(`Local task step not found: ${args.stepId}`)
    }
    this.db
      .prepare('UPDATE local_task_steps SET title = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(args.title?.trim() || row.title, args.status ?? row.status, timestamp(), row.id)
    return this.read(row.task_id)!
  }

  reportCompleted(args: ReportLocalTaskCompletedArgs): LocalTask {
    const task = this.read(args.taskId)
    if (!task || !task.sessions.some((session) => session.id === args.sessionId)) {
      throw new Error('Session is not associated with this local task')
    }
    const unfinished = task.subtasks.some(
      (subtask) =>
        subtask.status !== 'done' ||
        subtask.steps.some((step) => step.status !== 'done' && step.status !== 'canceled')
    )
    const time = timestamp()
    this.db
      .prepare(
        'UPDATE local_task_sessions SET status = ?, latest_output = COALESCE(?, latest_output), updated_at = ? WHERE id = ?'
      )
      .run(unfinished ? 'idle' : 'done', args.latestOutput ?? null, time, args.sessionId)
    this.db
      .prepare('UPDATE local_tasks SET status = ?, updated_at = ? WHERE id = ?')
      .run(unfinished ? 'In progress' : 'Needs review', time, args.taskId)
    return this.read(args.taskId)!
  }

  private read(id: string): LocalTask | null {
    const task = this.db.prepare('SELECT * FROM local_tasks WHERE id = ?').get(id) as
      | LocalTaskRows['tasks'][number]
      | undefined
    if (!task) {
      return null
    }
    const sessions = this.db
      .prepare('SELECT * FROM local_task_sessions WHERE task_id = ? ORDER BY updated_at DESC')
      .all(id) as LocalTaskRows['sessions']
    const subtasks = this.db
      .prepare('SELECT * FROM local_task_subtasks WHERE task_id = ? ORDER BY updated_at DESC')
      .all(id) as LocalTaskRows['subtasks']
    const steps = subtasks.length
      ? (this.db
          .prepare(
            `SELECT * FROM local_task_steps WHERE subtask_id IN (${subtasks.map(() => '?').join(',')}) ORDER BY updated_at`
          )
          .all(...subtasks.map((subtask) => subtask.id)) as LocalTaskRows['steps'])
      : []
    return projectLocalTaskRows(task, sessions, subtasks, steps)
  }
}

export function getLocalTaskStore(): LocalTaskStore {
  return (singleton ??= new LocalTaskStore())
}
export function setLocalTaskStoreForTests(value: LocalTaskStore | null): void {
  singleton?.close()
  singleton = value
}
