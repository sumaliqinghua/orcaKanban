import { randomUUID } from 'node:crypto'
import { resolveLocalTaskStatus } from '../../shared/local-task-status'
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type {
  CreateLocalTaskArgs,
  CreateLocalTaskSessionArgs,
  CreateLocalTaskSubtaskArgs,
  EditLocalTaskStepTitleArgs,
  LocalTaskDeletion,
  LocalTask,
  RebindLocalTaskSessionTabArgs,
  LocalTaskBatch,
  LocalTaskBatchTaskRef,
  LocalTaskSession,
  ReportLocalTaskCompletedArgs,
  RequestLocalTaskReviewArgs,
  UpdateLocalTaskArgs,
  UpdateLocalTaskStepArgs,
  UpdateLocalTaskSubtaskArgs,
  UpdateLocalTaskSessionOutputArgs,
  TransferLocalTaskWorkspaceArgs
} from '../../shared/local-task-types'
import { normalizeRuntimePathForComparison } from '../../shared/cross-platform-path'
import {
  atomicWrite,
  localTaskDirectory,
  localTaskFile,
  readLocalTaskFile,
  taskFiles,
  writeJson,
  LOCAL_TASK_PLAN_FILE_NAME,
  LOCAL_TASK_PRD_FILE_NAME,
  LOCAL_TASK_RECORDS_FILE_NAME,
  LOCAL_TASK_ROOT_NAME
} from './file-store-format'
import { LocalTaskFileWatchers } from './file-store-watch'
import * as mutations from './file-store-mutations'
import * as subtaskMutations from './subtask-progress-mutations'
import * as batchMutations from './file-store-batch-mutations'
import type { LocalTask as PersistedLocalTask } from '../../shared/local-task-types'

export type LocalTaskProfilePersistence = {
  getLocalTasks: () => PersistedLocalTask[]
  saveLocalTask: (task: PersistedLocalTask) => PersistedLocalTask
  deleteLocalTask: (taskId: string) => void
}

let singleton: LocalTaskStore | null = null
const timestamp = (): number => Date.now()
const text = (value: string | null | undefined, fallback: string): string =>
  value?.trim() || fallback
const normalizeLabels = (value: string[] | undefined): string[] =>
  [...new Set((value ?? []).map((label) => label.trim()).filter(Boolean))].slice(0, 20)

export class LocalTaskStore {
  private readonly locations = new Map<string, Map<string, string>>()
  private readonly watchers: LocalTaskFileWatchers
  private changeListener: ((task: LocalTask) => void) | null = null

  constructor(private readonly profilePersistence?: LocalTaskProfilePersistence) {
    this.watchers = new LocalTaskFileWatchers((path) => this.handleChangedPath(path))
  }

  close(): void {
    this.watchers.close()
  }

  setOnChanged(listener: ((task: LocalTask) => void) | null): void {
    this.changeListener = listener
  }

  list(
    projectId?: string,
    projectPath?: string,
    options: { includeArchived?: boolean } = {}
  ): LocalTask[] {
    if (this.profilePersistence) {
      return this.profilePersistence
        .getLocalTasks()
        .filter((task) => !projectId || task.projectId === projectId)
        .filter(
          (task) =>
            !projectPath ||
            normalizeRuntimePathForComparison(task.projectPath) ===
              normalizeRuntimePathForComparison(resolve(projectPath))
        )
        .filter((task) => options.includeArchived === true || task.archivedAt === null)
        .sort((a, b) => b.updatedAt - a.updatedAt)
    }
    const roots = projectPath ? [resolve(projectPath)] : this.knownProjectPaths()
    const tasks = roots.flatMap((root) =>
      taskFiles(root)
        .map((path) => this.readOwned(path, root))
        .filter((task): task is LocalTask => task !== null)
    )
    if (projectPath) {
      this.watchers.watchProject(projectPath)
    }
    for (const task of tasks) {
      this.watchers.watchTask(task)
    }
    return tasks
      .filter((task) => !projectId || task.projectId === projectId)
      .filter((task) => options.includeArchived === true || task.archivedAt === null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  get(id: string, projectPath?: string): LocalTask | null {
    if (this.profilePersistence) {
      return (
        this.profilePersistence
          .getLocalTasks()
          .find(
            (task) =>
              task.id === id &&
              (!projectPath ||
                normalizeRuntimePathForComparison(task.projectPath) ===
                  normalizeRuntimePathForComparison(resolve(projectPath)))
          ) ?? null
      )
    }
    const path = projectPath ? localTaskFile(projectPath, id) : this.latestKnownPath(id)
    if (!path || !existsSync(path)) {
      return null
    }
    try {
      return projectPath ? this.readOwned(path, projectPath) : this.readRemembered(path)
    } catch (error) {
      // A workspace may be removed between the existence check and the read.
      if (!existsSync(path)) {
        this.removeIndexedPath(id, path)
        return null
      }
      throw error
    }
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
      clarificationRequested: args.clarificationRequested === true,
      clarificationSessionId: null,
      runs: [],
      subtasks: [
        {
          id: `ltsub_${randomUUID()}`,
          title: `实现：${text(args.title, description.split(/\r?\n/, 1)[0] || '未命名本地任务')}`,
          status: 'todo',
          sessionId: null,
          steps: [],
          createdAt: time,
          updatedAt: time
        }
      ],
      sessions: [],
      latestOutput: null,
      latestOutputSource: 'report'
    }
    this.writeTask(task)
    this.writeContextFiles(task)
    this.watchers.watchProject(task.projectPath)
    this.watchers.watchTask(task)
    return task
  }

  update(id: string, updates: UpdateLocalTaskArgs, projectPath?: string): LocalTask {
    return mutations.updateTask(this.access(), id, updates, projectPath)
  }

  updateDescription(id: string, description: string, projectPath?: string): LocalTask {
    const task = this.require(id, projectPath)
    return this.writeTask({ ...task, description: description.trim(), updatedAt: timestamp() })
  }

  accept(id: string, projectPath?: string): LocalTask {
    const task = this.require(id, projectPath)
    if (
      task.status !== 'Needs review' ||
      task.sessions.some((session) => session.status === 'working')
    ) {
      throw new Error('Only a local task awaiting review can be accepted')
    }
    return this.writeTask({
      ...task,
      status: 'Done',
      executionState: 'idle',
      executionRunId: null,
      reviewKind: null,
      reviewQuestion: null,
      updatedAt: timestamp()
    })
  }

  archive(id: string, activeSessionIds?: string[], projectPath?: string): LocalTask {
    const task = this.require(id, projectPath)
    const activeIds = new Set(
      activeSessionIds ??
        task.sessions.filter((session) => session.status === 'working').map((session) => session.id)
    )
    if (task.sessions.some((session) => activeIds.has(session.id))) {
      throw new Error('Cannot archive a task with a running Agent session')
    }
    const updatedAt = timestamp()
    const sessions = task.sessions.map((session) =>
      session.status === 'working' ? { ...session, status: 'done' as const, updatedAt } : session
    )
    return this.writeTask({
      ...task,
      sessions,
      status: task.status === 'Done' ? 'Done' : sessions.length ? 'Needs review' : task.status,
      archivedAt: updatedAt,
      updatedAt
    })
  }
  restore(id: string, projectPath?: string): LocalTask {
    return this.update(id, { archived: false }, projectPath)
  }

  deleteTask(id: string, projectPath: string, activeSessionIds?: string[]): LocalTaskDeletion {
    if (!/^lt_[A-Za-z0-9-]+$/.test(id)) {
      throw new Error('Invalid local task id')
    }
    const task = this.require(id, projectPath)
    if (task.archivedAt === null) {
      throw new Error('Only an archived local task can be permanently deleted')
    }
    const activeIds = new Set(
      activeSessionIds ??
        task.sessions.filter((session) => session.status === 'working').map((session) => session.id)
    )
    if (task.sessions.some((session) => activeIds.has(session.id))) {
      throw new Error('Cannot delete a task with a running Agent session')
    }
    const directory = localTaskDirectory(task.projectPath, task.id)
    const expectedParent = join(resolve(task.projectPath), LOCAL_TASK_ROOT_NAME)
    if (
      normalizeRuntimePathForComparison(dirname(directory)) !==
      normalizeRuntimePathForComparison(expectedParent)
    ) {
      throw new Error('Refusing to delete a local task outside its workspace task directory')
    }
    this.watchers.unwatchTask(task)
    rmSync(directory, { recursive: true, force: true })
    this.profilePersistence?.deleteLocalTask(task.id)
    this.forgetLocation(task.id, task.projectPath)
    return { taskId: task.id, projectPath: task.projectPath }
  }

  transferWorkspace(args: TransferLocalTaskWorkspaceArgs): LocalTask[] {
    const sourceRoot = resolve(args.sourceProjectPath)
    const targetRoot = resolve(args.targetProjectPath)
    if (
      normalizeRuntimePathForComparison(sourceRoot) ===
      normalizeRuntimePathForComparison(targetRoot)
    ) {
      return []
    }
    const sourceTasks = taskFiles(sourceRoot)
      .map((path) => ({ path, task: readLocalTaskFile(path) }))
      .filter(({ task }) => this.isOwnedBy(task, sourceRoot))
    const updatedAt = timestamp()
    const transferred = sourceTasks.map(({ path, task }) => {
      const targetDirectory = localTaskDirectory(targetRoot, task.id)
      cpSync(localTaskDirectory(sourceRoot, task.id), targetDirectory, {
        recursive: true,
        force: true
      })
      const next: LocalTask = {
        ...task,
        projectId: args.targetProjectId,
        projectPath: targetRoot,
        workspaceId: args.targetWorkspaceId,
        workspaceLabel: args.targetWorkspaceLabel,
        updatedAt
      }
      this.writeTask(next)
      writeJson(path, next)
      this.forgetLocation(task.id, sourceRoot)
      return next
    })
    this.watchers.watchProject(targetRoot)
    for (const task of transferred) {
      this.watchers.watchTask(task)
    }
    return transferred
  }

  createSession(args: CreateLocalTaskSessionArgs & { projectPath?: string }): LocalTaskSession {
    return mutations.createSession(this.access(), args)
  }
  createSubtask(args: CreateLocalTaskSubtaskArgs & { projectPath?: string }): LocalTask {
    return mutations.createSubtask(this.access(), args)
  }
  updateSubtask(args: UpdateLocalTaskSubtaskArgs & { actorSessionId?: string }): LocalTask {
    return subtaskMutations.updateSubtask(this.access(), args)
  }
  updateStep(args: UpdateLocalTaskStepArgs & { actorSessionId?: string }): LocalTask {
    return subtaskMutations.updateStep(this.access(), args)
  }
  editStepTitle(args: EditLocalTaskStepTitleArgs): LocalTask {
    return subtaskMutations.editStepTitle(this.access(), args)
  }
  reportCompleted(args: ReportLocalTaskCompletedArgs & { projectPath?: string }): LocalTask {
    return mutations.reportCompleted(this.access(), args)
  }
  updateSessionOutput(args: UpdateLocalTaskSessionOutputArgs): LocalTask {
    return mutations.updateSessionOutput(this.access(), args)
  }

  rebindSessionTab(args: RebindLocalTaskSessionTabArgs): LocalTask {
    return mutations.rebindSessionTab(this.access(), args)
  }
  startBatch(
    refs: LocalTaskBatchTaskRef[],
    options?: {
      recoverQueued?: boolean
      automationId?: string
      automationRunId?: string
    }
  ): LocalTaskBatch {
    return batchMutations.startBatch(this.access(), refs, {
      recoverQueued: options?.recoverQueued ?? false,
      automationId: options?.automationId,
      automationRunId: options?.automationRunId
    })
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
      taskPaths: () =>
        this.profilePersistence
          ? this.profilePersistence.getLocalTasks().map((task) => `profile:${task.id}`)
          : this.knownTaskPaths(),
      readTask: (path) => {
        if (this.profilePersistence && path.startsWith('profile:')) {
          const task = this.profilePersistence
            .getLocalTasks()
            .find((entry) => `profile:${entry.id}` === path)
          if (!task) {
            throw new Error(`Local task not found: ${path}`)
          }
          return task
        }
        return this.readRemembered(path)
      },
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
    task = {
      ...task,
      status: resolveLocalTaskStatus(
        task.status,
        task.sessions.filter(
          (session) =>
            session.associationSource !== 'task-report' &&
            session.associationSource !== 'clarification'
        )
      )
    }
    if (this.profilePersistence) {
      const result = this.profilePersistence.saveLocalTask(task)
      this.writeContextFiles(result)
      return result
    }
    const path = localTaskFile(task.projectPath, task.id)
    writeJson(path, task)
    const planPath = join(localTaskDirectory(task.projectPath, task.id), LOCAL_TASK_PLAN_FILE_NAME)
    let plan: Record<string, unknown> = {}
    try {
      const parsed: unknown = JSON.parse(readFileSync(planPath, 'utf8'))
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        plan = parsed as Record<string, unknown>
      }
    } catch {
      // A missing or malformed plan gets a minimal valid document; task.json remains authoritative.
    }
    writeJson(planPath, {
      ...plan,
      schemaVersion: 1,
      taskId: task.id,
      subtasks: task.subtasks
    })
    this.rememberLocation(task, path)
    this.changeListener?.(task)
    return task
  }

  private writeContextFiles(task: LocalTask): void {
    const directory = localTaskDirectory(task.projectPath, task.id)
    const prdPath = join(directory, LOCAL_TASK_PRD_FILE_NAME)
    const planPath = join(directory, LOCAL_TASK_PLAN_FILE_NAME.replace('.json', '.md'))
    const recordsPath = join(directory, LOCAL_TASK_RECORDS_FILE_NAME)
    if (!existsSync(prdPath)) {
      atomicWrite(prdPath, `# ${task.title}\n\n${task.description}\n`)
    }
    if (!existsSync(planPath)) {
      atomicWrite(planPath, `# ${task.title} 计划\n`)
    }
    if (!existsSync(recordsPath)) {
      atomicWrite(recordsPath, `# ${task.title} 实现记录\n`)
    }
  }

  private readRemembered(path: string): LocalTask {
    const task = readLocalTaskFile(path)
    this.rememberLocation(task, path)
    return task
  }

  private readOwned(path: string, projectPath: string): LocalTask | null {
    const task = readLocalTaskFile(path)
    if (!this.isOwnedBy(task, projectPath)) {
      return null
    }
    this.rememberLocation(task, path)
    return task
  }

  private rememberLocation(task: LocalTask, path: string): void {
    const key = normalizeRuntimePathForComparison(task.projectPath)
    const byProject = this.locations.get(task.id) ?? new Map<string, string>()
    byProject.set(key, path)
    this.locations.set(task.id, byProject)
  }

  private forgetLocation(id: string, projectPath: string): void {
    const byProject = this.locations.get(id)
    if (!byProject) {
      return
    }
    byProject.delete(normalizeRuntimePathForComparison(resolve(projectPath)))
    if (byProject.size === 0) {
      this.locations.delete(id)
    }
  }

  private isOwnedBy(task: LocalTask, projectPath: string): boolean {
    return (
      normalizeRuntimePathForComparison(task.projectPath) ===
      normalizeRuntimePathForComparison(resolve(projectPath))
    )
  }

  private latestKnownPath(id: string): string | undefined {
    const byProject = this.locations.get(id)
    if (!byProject) {
      return undefined
    }
    const candidates: { path: string; updatedAt: number }[] = []
    for (const [projectPath, path] of byProject) {
      try {
        if (!existsSync(path)) {
          byProject.delete(projectPath)
          continue
        }
        candidates.push({ path, updatedAt: readLocalTaskFile(path).updatedAt })
      } catch (error) {
        // The workspace can disappear after existsSync but before readFileSync.
        if (!existsSync(path)) {
          byProject.delete(projectPath)
          continue
        }
        throw error
      }
    }
    if (byProject.size === 0) {
      this.locations.delete(id)
    }
    return candidates
      .sort(
        (left, right) => right.updatedAt - left.updatedAt || left.path.localeCompare(right.path)
      )
      .at(0)?.path
  }

  private removeIndexedPath(id: string, path: string): void {
    const byProject = this.locations.get(id)
    if (!byProject) {
      return
    }
    for (const [projectPath, indexedPath] of byProject) {
      if (indexedPath === path) {
        byProject.delete(projectPath)
      }
    }
    if (byProject.size === 0) {
      this.locations.delete(id)
    }
  }

  private *knownTaskPaths(): Iterable<string> {
    for (const [taskId, byProject] of this.locations) {
      for (const [projectPath, path] of byProject) {
        if (existsSync(path)) {
          yield path
        } else {
          // External workspace cleanup can race the in-memory index.
          byProject.delete(projectPath)
        }
      }
      if (byProject.size === 0) {
        this.locations.delete(taskId)
      }
    }
  }

  private knownProjectPaths(): string[] {
    return [...new Set([...this.knownTaskPaths()].map((path) => dirname(dirname(dirname(path)))))]
  }

  private handleChangedPath(path: string): void {
    if (!existsSync(path)) {
      return
    }
    try {
      const projectPath = dirname(dirname(dirname(path)))
      const task = this.readOwned(path, projectPath)
      if (!task) {
        return
      }
      this.watchers.watchTask(task)
      this.changeListener?.(task)
    } catch {
      // The next explicit load surfaces malformed JSON without replacing it.
    }
  }
}

export const getLocalTaskStore = (persistence?: LocalTaskProfilePersistence): LocalTaskStore =>
  (singleton ??= new LocalTaskStore(persistence))
export const setLocalTaskStoreForTests = (value: LocalTaskStore | null): void => {
  singleton?.close()
  singleton = value
}
