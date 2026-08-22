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
  EditLocalTaskStepTitleArgs,
  UpdateLocalTaskArgs,
  UpdateLocalTaskStepArgs,
  UpdateLocalTaskSubtaskArgs
} from '../../shared/local-task-types'
import { createLocalTaskSchema, migrateLocalTaskSchema } from './store-schema'
import { readLocalTask } from './store-read'
import type { LocalTaskRows } from './store-projection'
import { editLocalTaskStepTitle, updateLocalTaskStep } from './store-step-mutations'

let singleton: LocalTaskStore | null = null
const timestamp = (): number => Date.now()
const text = (value: string | null | undefined, fallback: string): string =>
  value?.trim() || fallback
export class LocalTaskStore {
  private readonly db: SyncDatabase.Database

  constructor(dbPath = join(app.getPath('userData'), 'local-tasks.db')) {
    this.db = new SyncDatabase(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('busy_timeout = 5000')
    this.db.pragma('foreign_keys = ON')
    this.db.exec(createLocalTaskSchema())
    migrateLocalTaskSchema(this.db)
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
    return rows.map((task) => readLocalTask(this.db, task.id)!).filter(Boolean)
  }

  get(id: string): LocalTask | null {
    return readLocalTask(this.db, id)
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
        'INSERT INTO local_tasks (id, project_id, title, description, status, workspace_id, workspace_label, created_at, updated_at, archived_at, title_source, title_suggestion, waiting_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
        null,
        null
      )
    return readLocalTask(this.db, task.id)!
  }

  update(id: string, updates: UpdateLocalTaskArgs): LocalTask {
    const current = readLocalTask(this.db, id)
    if (!current) {
      throw new Error(`Local task not found: ${id}`)
    }
    if (updates.status === 'Done' || updates.status === 'Needs review') {
      throw new Error('This status is controlled by the review lifecycle')
    }
    if (updates.status === 'Waiting' && !text(updates.waitingReason, current.waitingReason ?? '')) {
      throw new Error('Waiting status requires a reason')
    }
    const time = timestamp()
    const nextStatus = updates.status ?? current.status
    const nextWaitingReason =
      nextStatus === 'Waiting'
        ? updates.waitingReason === undefined
          ? current.waitingReason
          : updates.waitingReason
        : null
    this.db
      .prepare(
        'UPDATE local_tasks SET title = ?, description = ?, status = ?, updated_at = ?, archived_at = ?, waiting_reason = ?, title_source = ?, title_suggestion = CASE WHEN ? THEN NULL ELSE title_suggestion END WHERE id = ?'
      )
      .run(
        updates.title?.trim() || current.title,
        updates.description ?? current.description,
        nextStatus,
        time,
        updates.archived === true ? time : updates.archived === false ? null : current.archivedAt,
        nextWaitingReason,
        updates.title?.trim() ? 'user' : current.titleSource,
        updates.title?.trim() ? 1 : 0,
        id
      )
    return readLocalTask(this.db, id)!
  }

  accept(id: string): LocalTask {
    const current = readLocalTask(this.db, id)
    if (!current) {
      throw new Error(`Local task not found: ${id}`)
    }
    if (current.status !== 'Needs review') {
      throw new Error('Only a local task awaiting review can be accepted')
    }
    this.db
      .prepare(
        'UPDATE local_tasks SET status = ?, waiting_reason = NULL, updated_at = ? WHERE id = ?'
      )
      .run('Done', timestamp(), id)
    return readLocalTask(this.db, id)!
  }

  archive(id: string): LocalTask {
    return this.update(id, { archived: true })
  }
  restore(id: string): LocalTask {
    return this.update(id, { archived: false })
  }

  createSession(args: CreateLocalTaskSessionArgs): LocalTaskSession {
    const task = readLocalTask(this.db, args.taskId)
    if (!task) {
      throw new Error(`Local task not found: ${args.taskId}`)
    }
    const existingSessionId = args.sessionId?.trim()
    const sessionId = existingSessionId || `lts_${randomUUID()}`
    const existingSession = this.db
      .prepare('SELECT task_id FROM local_task_sessions WHERE id = ?')
      .get(sessionId) as { task_id: string } | undefined
    if (existingSession) {
      if (existingSession.task_id === task.id) {
        const existing = readLocalTask(this.db, task.id)?.sessions.find(
          (session) => session.id === sessionId
        )
        if (existing) {
          return existing
        }
      }
      throw new Error('Session is already associated with another local task')
    }
    const time = timestamp()
    const session = {
      id: sessionId,
      taskId: task.id,
      workspaceId: text(args.workspaceId, task.workspaceId),
      title: text(args.title, '自动创建会话'),
      associationSource: args.associationSource ?? 'task-center'
    }
    this.db
      .prepare(
        'INSERT INTO local_task_sessions (id, task_id, workspace_id, title, status, latest_output, created_at, updated_at, association_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        session.id,
        session.taskId,
        session.workspaceId,
        session.title,
        'working',
        null,
        time,
        time,
        session.associationSource
      )
    this.update(task.id, { status: 'In progress' })
    return {
      ...session,
      status: 'working',
      latestOutput: null,
      createdAt: time,
      updatedAt: time
    }
  }

  createSubtask(args: CreateLocalTaskSubtaskArgs): LocalTask {
    const task = readLocalTask(this.db, args.taskId)
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
    return readLocalTask(this.db, task.id)!
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
    return readLocalTask(this.db, row.task_id)!
  }

  updateStep(args: UpdateLocalTaskStepArgs): LocalTask {
    return updateLocalTaskStep(this.db, args)
  }

  editStepTitle(args: EditLocalTaskStepTitleArgs): LocalTask {
    return editLocalTaskStepTitle(this.db, args)
  }

  reportCompleted(args: ReportLocalTaskCompletedArgs): LocalTask {
    const task = readLocalTask(this.db, args.taskId)
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
    if (args.titleSuggestion?.trim() && task.titleSource === 'first-line') {
      const titleSuggestion = args.titleSuggestion.trim()
      this.db
        .prepare(
          'UPDATE local_tasks SET title = ?, title_source = ?, title_suggestion = ?, updated_at = ? WHERE id = ? AND title_source = ?'
        )
        .run(titleSuggestion, 'ai-suggestion', titleSuggestion, time, args.taskId, 'first-line')
    }
    this.db
      .prepare(
        'UPDATE local_tasks SET description = COALESCE(?, description), status = ?, updated_at = ? WHERE id = ?'
      )
      .run(
        args.description?.trim() || null,
        unfinished ? 'In progress' : 'Needs review',
        time,
        args.taskId
      )
    return readLocalTask(this.db, args.taskId)!
  }
}

export const getLocalTaskStore = (): LocalTaskStore => (singleton ??= new LocalTaskStore())
export const setLocalTaskStoreForTests = (value: LocalTaskStore | null): void => {
  singleton?.close()
  singleton = value
}
