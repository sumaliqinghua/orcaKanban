import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type {
  CreateLocalTaskArgs,
  CreateLocalTaskSessionArgs,
  CreateLocalTaskSubtaskArgs,
  EditLocalTaskStepTitleArgs,
  LocalTask,
  LocalTaskBatch,
  LocalTaskBatchTaskRef,
  LocalTaskSession,
  ReportLocalTaskCompletedArgs,
  RequestLocalTaskReviewArgs,
  UpdateLocalTaskArgs,
  UpdateLocalTaskStepArgs,
  UpdateLocalTaskSubtaskArgs,
  UpdateLocalTaskSessionOutputArgs
} from '../../shared/local-task-types'
import {
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
import { LocalTaskFileWatchers } from './file-store-watch'
import * as mutations from './file-store-mutations'
import * as batchMutations from './file-store-batch-mutations'

let singleton: LocalTaskStore | null = null
const timestamp = (): number => Date.now()
const text = (value: string | null | undefined, fallback: string): string =>
  value?.trim() || fallback
const normalizeLabels = (value: string[] | undefined): string[] =>
  [...new Set((value ?? []).map((label) => label.trim()).filter(Boolean))].slice(0, 20)

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
      labels: normalizeLabels(args.labels),
      intakeState: args.intakeState ?? 'ready',
      agentId: args.agentId ?? null,
      executionState: 'idle',
      executionBatchId: null,
      executionRunId: null,
      reviewKind: null,
      reviewQuestion: null,
      runs: [],
      subtasks: [],
      sessions: [],
      latestOutput: null,
      latestOutputSource: 'report',
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
      labels: updates.labels === undefined ? current.labels : normalizeLabels(updates.labels),
      intakeState: updates.intakeState ?? current.intakeState,
      agentId: updates.agentId === undefined ? current.agentId : updates.agentId,
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
    return this.writeTask({
      ...task,
      status: 'Done',
      waitingReason: null,
      executionState: 'idle',
      executionRunId: null,
      reviewKind: null,
      reviewQuestion: null,
      updatedAt: timestamp()
    })
  }

  archive(id: string): LocalTask {
    return this.update(id, { archived: true })
  }
  restore(id: string): LocalTask {
    return this.update(id, { archived: false })
  }

  createSession(args: CreateLocalTaskSessionArgs & { projectPath?: string }): LocalTaskSession {
    return mutations.createSession(this.access(), args)
  }
  createSubtask(args: CreateLocalTaskSubtaskArgs & { projectPath?: string }): LocalTask {
    return mutations.createSubtask(this.access(), args)
  }
  updateSubtask(args: UpdateLocalTaskSubtaskArgs): LocalTask {
    return mutations.updateSubtask(this.access(), args)
  }
  updateStep(args: UpdateLocalTaskStepArgs): LocalTask {
    return mutations.updateStep(this.access(), args)
  }
  editStepTitle(args: EditLocalTaskStepTitleArgs): LocalTask {
    return mutations.editStepTitle(this.access(), args)
  }
  reportCompleted(args: ReportLocalTaskCompletedArgs & { projectPath?: string }): LocalTask {
    return mutations.reportCompleted(this.access(), args)
  }
  updateSessionOutput(args: UpdateLocalTaskSessionOutputArgs): LocalTask {
    return mutations.updateSessionOutput(this.access(), args)
  }
  startBatch(refs: LocalTaskBatchTaskRef[]): LocalTaskBatch {
    return batchMutations.startBatch(this.access(), refs)
  }
  updateRun(args: Parameters<typeof batchMutations.updateRun>[1]): LocalTask {
    return batchMutations.updateRun(this.access(), args)
  }
  requestReview(args: RequestLocalTaskReviewArgs & { projectPath?: string }): LocalTask {
    return batchMutations.requestReview(this.access(), args)
  }

  private access(): mutations.FileStoreMutationAccess {
    return {
      requireTask: (id, projectPath) => this.require(id, projectPath),
      readTask: (path) => this.readRemembered(path),
      taskPaths: () => this.locations.values(),
      writeTask: (task) => this.writeTask(task)
    }
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
    writeJson(join(localTaskDirectory(task.projectPath, task.id), LOCAL_TASK_PLAN_FILE_NAME), {
      schemaVersion: 1,
      taskId: task.id,
      subtasks: task.subtasks
    })
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
