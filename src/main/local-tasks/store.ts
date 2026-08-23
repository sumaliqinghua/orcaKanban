import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type {
  CreateLocalTaskArgs,
  CreateLocalTaskSessionArgs,
  CreateLocalTaskSubtaskArgs,
  EditLocalTaskStepTitleArgs,
  LocalTask,
  LocalTaskSession,
  ReportLocalTaskCompletedArgs,
  UpdateLocalTaskArgs,
  UpdateLocalTaskStepArgs,
  UpdateLocalTaskSubtaskArgs
} from '../../shared/local-task-types'
import {
  appendRecord,
  atomicWrite,
  localTaskDirectory,
  localTaskFile,
  readLocalTaskFile,
  taskFiles,
  writeJson,
  LOCAL_TASK_PLAN_FILE_NAME,
  LOCAL_TASK_PRD_FILE_NAME,
  LOCAL_TASK_RECORDS_FILE_NAME
} from './file-store-format'
import { findStep, findSubtask, findTaskWithSession } from './file-store-index'
import { LocalTaskFileWatchers } from './file-store-watch'

let singleton: LocalTaskStore | null = null
const timestamp = (): number => Date.now()
const text = (value: string | null | undefined, fallback: string): string =>
  value?.trim() || fallback

export class LocalTaskStore {
  private readonly locations = new Map<string, string>()
  private readonly watchers: LocalTaskFileWatchers
  private changeListener: ((task: LocalTask) => void) | null = null

  constructor() {
    this.watchers = new LocalTaskFileWatchers((path) => this.handleChangedPath(path))
  }

  close(): void {
    this.watchers.close()
  }

  setOnChanged(listener: ((task: LocalTask) => void) | null): void {
    this.changeListener = listener
  }

  list(projectId?: string, projectPath?: string): LocalTask[] {
    const roots = projectPath ? [resolve(projectPath)] : this.knownProjectPaths()
    const tasks = roots.flatMap((root) => taskFiles(root).map((path) => this.readRemembered(path)))
    if (projectPath) {
      this.watchers.watchProject(projectPath)
    }
    for (const task of tasks) {
      this.watchers.watchTask(task)
    }
    return tasks
      .filter((task): task is LocalTask => task !== null)
      .filter((task) => !projectId || task.projectId === projectId)
      .filter((task) => task.archivedAt === null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  get(id: string, projectPath?: string): LocalTask | null {
    const path = projectPath ? localTaskFile(projectPath, id) : this.locations.get(id)
    if (!path || !existsSync(path)) {
      return null
    }
    return this.readRemembered(path)
  }

  create(args: CreateLocalTaskArgs): LocalTask {
    const description = args.description.trim()
    const time = timestamp()
    const task: LocalTask = {
      schemaVersion: 1,
      id: `lt_${randomUUID()}`,
      projectId: text(args.projectId, 'local'),
      projectPath: resolve(args.projectPath),
      title: text(args.title, description.split(/\r?\n/, 1)[0] || '未命名本地任务'),
      description,
      status: 'Open',
      workspaceId: text(args.workspaceId, 'local'),
      workspaceLabel: text(args.workspaceLabel, 'local · 当前 HEAD'),
      createdAt: time,
      updatedAt: time,
      archivedAt: null,
      titleSource: args.title?.trim() ? 'user' : 'first-line',
      titleSuggestion: null,
      subtasks: [],
      sessions: [],
      latestOutput: null,
      waitingReason: null
    }
    this.writeTask(task)
    const directory = localTaskDirectory(task.projectPath, task.id)
    writeJson(join(directory, LOCAL_TASK_PLAN_FILE_NAME), {
      schemaVersion: 1,
      taskId: task.id,
      subtasks: []
    })
    atomicWrite(
      join(directory, LOCAL_TASK_PRD_FILE_NAME),
      `# ${task.title}\n\n${task.description}\n`
    )
    atomicWrite(join(directory, LOCAL_TASK_RECORDS_FILE_NAME), `# ${task.title} 实现记录\n`)
    this.watchers.watchProject(task.projectPath)
    this.watchers.watchTask(task)
    return task
  }

  update(id: string, updates: UpdateLocalTaskArgs): LocalTask {
    const current = this.require(id)
    if (updates.status === 'Done' || updates.status === 'Needs review') {
      throw new Error('This status is controlled by the review lifecycle')
    }
    if (updates.status === 'Waiting' && !text(updates.waitingReason, current.waitingReason ?? '')) {
      throw new Error('Waiting status requires a reason')
    }
    const nextStatus = updates.status ?? current.status
    return this.writeTask({
      ...current,
      title: updates.title?.trim() || current.title,
      description: updates.description?.trim() || current.description,
      status: nextStatus,
      waitingReason:
        nextStatus === 'Waiting' ? (updates.waitingReason ?? current.waitingReason) : null,
      archivedAt:
        updates.archived === true
          ? timestamp()
          : updates.archived === false
            ? null
            : current.archivedAt,
      titleSource: updates.title?.trim() ? 'user' : current.titleSource,
      titleSuggestion: updates.title?.trim() ? null : current.titleSuggestion,
      updatedAt: timestamp()
    })
  }

  updateDescription(id: string, description: string): LocalTask {
    const task = this.require(id)
    return this.writeTask({ ...task, description: description.trim(), updatedAt: timestamp() })
  }

  accept(id: string): LocalTask {
    const task = this.require(id)
    if (task.status !== 'Needs review') {
      throw new Error('Only a local task awaiting review can be accepted')
    }
    return this.writeTask({ ...task, status: 'Done', waitingReason: null, updatedAt: timestamp() })
  }

  archive(id: string): LocalTask {
    return this.update(id, { archived: true })
  }
  restore(id: string): LocalTask {
    return this.update(id, { archived: false })
  }

  createSession(args: CreateLocalTaskSessionArgs & { projectPath?: string }): LocalTaskSession {
    const task = this.require(args.taskId, args.projectPath)
    const sessionId = args.sessionId?.trim() || `lts_${randomUUID()}`
    const owner = findTaskWithSession(this.locations.values(), sessionId, (path) =>
      this.readRemembered(path)
    )
    if (owner && owner.id !== task.id) {
      throw new Error('Session is already associated with another local task')
    }
    const existing = task.sessions.find((session) => session.id === sessionId)
    if (existing) {
      return existing
    }
    const time = timestamp()
    const session: LocalTaskSession = {
      id: sessionId,
      taskId: task.id,
      workspaceId: text(args.workspaceId, task.workspaceId),
      title: text(args.title, '自动创建会话'),
      status: 'working',
      latestOutput: null,
      createdAt: time,
      updatedAt: time,
      associationSource: args.associationSource ?? 'task-center'
    }
    const status = task.status === 'Open' || task.status === 'Waiting' ? 'In progress' : task.status
    this.writeTask({ ...task, sessions: [session, ...task.sessions], status, updatedAt: time })
    return session
  }

  createSubtask(args: CreateLocalTaskSubtaskArgs & { projectPath?: string }): LocalTask {
    const task = this.require(args.taskId, args.projectPath)
    if (args.sessionId && !task.sessions.some((session) => session.id === args.sessionId)) {
      throw new Error('Session is not associated with this local task')
    }
    const time = timestamp()
    const subtask = {
      id: `ltsub_${randomUUID()}`,
      title: text(args.title, '未命名子任务'),
      status: 'todo' as const,
      sessionId: args.sessionId ?? null,
      steps: (args.steps ?? []).map((title) => ({
        id: `ltstep_${randomUUID()}`,
        title: text(title, '未命名执行步骤'),
        status: 'todo' as const,
        updatedAt: time
      })),
      createdAt: time,
      updatedAt: time
    }
    return this.writeTask({ ...task, subtasks: [subtask, ...task.subtasks], updatedAt: time })
  }

  updateSubtask(args: UpdateLocalTaskSubtaskArgs): LocalTask {
    const { task, index } = findSubtask(this.locations.values(), args.subtaskId, (path) =>
      this.readRemembered(path)
    )
    const subtasks = [...task.subtasks]
    const current = subtasks[index]
    subtasks[index] = {
      ...current,
      title: args.title?.trim() || current.title,
      status: args.status ?? current.status,
      updatedAt: timestamp()
    }
    return this.writeTask({ ...task, subtasks, updatedAt: timestamp() })
  }

  updateStep(args: UpdateLocalTaskStepArgs): LocalTask {
    const { task, subtaskIndex, stepIndex } = findStep(
      this.locations.values(),
      args.stepId,
      args.subtaskId,
      (path) => this.readRemembered(path)
    )
    const subtasks = task.subtasks.map((subtask, index) => {
      if (index !== subtaskIndex) {
        return subtask
      }
      const steps = subtask.steps.map((step, currentIndex) =>
        currentIndex === stepIndex
          ? {
              ...step,
              title: args.title?.trim() || step.title,
              status: args.status ?? step.status,
              updatedAt: timestamp()
            }
          : step
      )
      return { ...subtask, steps, updatedAt: timestamp() }
    })
    return this.writeTask({ ...task, subtasks, updatedAt: timestamp() })
  }

  editStepTitle(args: EditLocalTaskStepTitleArgs): LocalTask {
    const { task, subtaskIndex, stepIndex } = findStep(
      this.locations.values(),
      args.stepId,
      args.subtaskId,
      (path) => this.readRemembered(path)
    )
    if (task.subtasks[subtaskIndex].steps[stepIndex].status !== 'todo') {
      throw new Error('Only an unstarted AI step can be edited')
    }
    return this.updateStep({ subtaskId: args.subtaskId, stepId: args.stepId, title: args.title })
  }

  reportCompleted(args: ReportLocalTaskCompletedArgs & { projectPath?: string }): LocalTask {
    const task = this.require(args.taskId, args.projectPath)
    if (!task.sessions.some((session) => session.id === args.sessionId)) {
      throw new Error('Session is not associated with this local task')
    }
    const unfinished = task.subtasks.some(
      (subtask) =>
        subtask.status !== 'done' ||
        subtask.steps.some((step) => step.status !== 'done' && step.status !== 'canceled')
    )
    const time = timestamp()
    const sessions = task.sessions.map((session) =>
      session.id === args.sessionId
        ? {
            ...session,
            status: unfinished ? ('idle' as const) : ('done' as const),
            latestOutput: args.latestOutput ?? session.latestOutput,
            updatedAt: time
          }
        : session
    )
    const suggestedTitle =
      args.titleSuggestion?.trim() && task.titleSource === 'first-line'
        ? args.titleSuggestion.trim()
        : null
    const next: LocalTask = {
      ...task,
      sessions,
      latestOutput: args.latestOutput
        ? { sessionId: args.sessionId, text: args.latestOutput, updatedAt: time }
        : task.latestOutput,
      description: args.description?.trim() || task.description,
      title: suggestedTitle ?? task.title,
      titleSource: suggestedTitle ? 'ai-suggestion' : task.titleSource,
      titleSuggestion: suggestedTitle ?? task.titleSuggestion,
      status:
        task.status === 'Done' || task.status === 'Needs review'
          ? task.status
          : unfinished
            ? 'In progress'
            : 'Needs review',
      updatedAt: time
    }
    const result = this.writeTask(next)
    if (args.latestOutput) {
      appendRecord(
        join(localTaskDirectory(task.projectPath, task.id), LOCAL_TASK_RECORDS_FILE_NAME),
        `## ${new Date(time).toISOString()}\n\n${args.latestOutput}`
      )
    }
    return result
  }

  private require(id: string, projectPath?: string): LocalTask {
    const task = this.get(id, projectPath)
    if (!task) {
      throw new Error(`Local task not found: ${id}`)
    }
    return task
  }

  private writeTask(task: LocalTask): LocalTask {
    const path = localTaskFile(task.projectPath, task.id)
    writeJson(path, task)
    this.locations.set(task.id, path)
    this.changeListener?.(task)
    return task
  }

  private readRemembered(path: string): LocalTask {
    const task = readLocalTaskFile(path)
    this.locations.set(task.id, path)
    return task
  }

  private knownProjectPaths(): string[] {
    return [...new Set([...this.locations.values()].map((path) => dirname(dirname(dirname(path)))))]
  }

  private handleChangedPath(path: string): void {
    if (!existsSync(path)) {
      return
    }
    try {
      const task = this.readRemembered(path)
      this.watchers.watchTask(task)
      this.changeListener?.(task)
    } catch {
      // The next explicit load surfaces malformed JSON without replacing it.
    }
  }
}

export const getLocalTaskStore = (): LocalTaskStore => (singleton ??= new LocalTaskStore())
export const setLocalTaskStoreForTests = (value: LocalTaskStore | null): void => {
  singleton?.close()
  singleton = value
}
