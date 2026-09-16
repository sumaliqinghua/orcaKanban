import { randomUUID } from 'node:crypto'
import { resolveLocalTaskStatus } from '../../shared/local-task-status'
import { normalizeRuntimePathForComparison } from '../../shared/cross-platform-path'
import { existsSync, rmSync } from 'node:fs'
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
  UpdateLocalTaskArgs,
  UpdateLocalTaskStepArgs,
  UpdateLocalTaskSubtaskArgs,
  UpdateLocalTaskSessionOutputArgs
} from '../../shared/local-task-types'
import {
  localTaskDirectory,
  LOCAL_TASK_PLAN_FILE_NAME,
  LOCAL_TASK_PRD_FILE_NAME,
  LOCAL_TASK_RECORDS_FILE_NAME,
  LOCAL_TASK_ROOT_NAME
} from './task-context-paths'
import { atomicWrite } from './task-context-file-io'
import * as mutations from './file-store-mutations'
import * as subtaskMutations from './subtask-progress-mutations'
import * as batchMutations from './file-store-batch-mutations'
import type { LocalTask as PersistedLocalTask } from '../../shared/local-task-types'
import type { LocalTaskChangeEvent } from './event-detection'
import { detectLocalTaskEvents } from './event-detection'
import type { LocalTaskSessionRetry } from '../../shared/local-task-session-retry'

export type LocalTaskProfilePersistence = {
  getLocalTasks: () => PersistedLocalTask[]
  saveLocalTask: (task: PersistedLocalTask) => PersistedLocalTask
  deleteLocalTask: (taskId: string) => void
}

export type { LocalTaskChangeEvent } from './event-detection'

let singleton: LocalTaskStore | null = null
const timestamp = (): number => Date.now()
const text = (value: string | null | undefined, fallback: string): string =>
  value?.trim() || fallback
const normalizeLabels = (value: string[] | undefined): string[] =>
  [...new Set((value ?? []).map((label) => label.trim()).filter(Boolean))].slice(0, 20)

export class LocalTaskStore {
  private changeListener: ((task: LocalTask) => void) | null = null
  private eventListener: ((event: LocalTaskChangeEvent) => void) | null = null

  constructor(private readonly profilePersistence: LocalTaskProfilePersistence) {}

  close(): void {}

  setOnChanged(listener: ((task: LocalTask) => void) | null): void {
    this.changeListener = listener
  }

  setOnEvent(listener: ((event: LocalTaskChangeEvent) => void) | null): void {
    this.eventListener = listener
  }

  list(
    projectId?: string,
    projectPath?: string,
    options: { includeArchived?: boolean } = {}
  ): LocalTask[] {
    return this.profilePersistence
      .getLocalTasks()
      .filter((task) => !projectId || task.projectId === projectId)
      .filter(
        (task) =>
          !projectPath ||
          (task.intakeState === 'inbox' && task.projectPath === '') ||
          normalizeRuntimePathForComparison(task.projectPath) ===
            normalizeRuntimePathForComparison(resolve(projectPath))
      )
      .filter((task) => options.includeArchived === true || task.archivedAt === null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  get(id: string, projectPath?: string): LocalTask | null {
    return (
      this.profilePersistence
        .getLocalTasks()
        .find((task) => task.id === id && (!projectPath || task.projectPath === projectPath)) ??
      null
    )
  }

  create(args: CreateLocalTaskArgs): LocalTask {
    const description = args.description.trim()
    if (args.intakeState !== 'inbox' && !args.projectPath?.trim()) {
      throw new Error('A ready local task must be bound to a project workspace')
    }
    const time = timestamp()
    const task: LocalTask = {
      schemaVersion: 1,
      id: `lt_${randomUUID()}`,
      projectId: text(args.projectId, 'local'),
      projectPath: args.projectPath ? resolve(args.projectPath) : '',
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
    const directory = task.projectPath ? localTaskDirectory(task.projectPath, task.id) : null
    if (directory) {
      const expectedParent = join(resolve(task.projectPath), LOCAL_TASK_ROOT_NAME)
      if (
        normalizeRuntimePathForComparison(dirname(directory)) !==
        normalizeRuntimePathForComparison(expectedParent)
      ) {
        throw new Error('Refusing to delete a local task outside its workspace task directory')
      }
      rmSync(directory, { recursive: true, force: true })
    }
    this.profilePersistence.deleteLocalTask(task.id)
    return { taskId: task.id, projectPath: task.projectPath }
  }

  createSession(args: CreateLocalTaskSessionArgs & { projectPath?: string }): LocalTaskSession {
    return mutations.createSession(this.access(), args)
  }
  setSessionRetry(
    taskId: string,
    sessionId: string,
    retry: LocalTaskSessionRetry | null,
    working: boolean
  ): LocalTask {
    const task = this.require(taskId)
    const sessions = task.sessions.map((session) =>
      session.id === sessionId
        ? { ...session, retry, status: working ? ('working' as const) : ('idle' as const) }
        : session
    )
    return this.writeTask({
      ...task,
      sessions,
      updatedAt: timestamp(),
      status:
        task.archivedAt !== null || task.status === 'Done'
          ? task.status
          : resolveLocalTaskStatus(
              task.status,
              sessions.filter(
                (session) => !['clarification', 'task-report'].includes(session.associationSource)
              )
            )
    })
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

  private access(): mutations.FileStoreMutationAccess {
    return {
      requireTask: (id, projectPath) => this.require(id, projectPath),
      taskPaths: () => this.profilePersistence.getLocalTasks().map((task) => `profile:${task.id}`),
      readTask: (path) => {
        const task = this.profilePersistence
          .getLocalTasks()
          .find((entry) => `profile:${entry.id}` === path)
        if (!task) {
          throw new Error(`Local task not found: ${path}`)
        }
        return task
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
    const previous = this.profilePersistence.getLocalTasks().find((entry) => entry.id === task.id)
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
    const result = this.profilePersistence.saveLocalTask(task)
    this.writeContextFiles(result)
    this.changeListener?.(result)
    for (const event of detectLocalTaskEvents(result, previous)) {
      this.eventListener?.(event)
    }
    return result
  }

  private writeContextFiles(task: LocalTask): void {
    if (task.intakeState === 'inbox' || !task.projectPath) {
      return
    }
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
}

export const getLocalTaskStore = (persistence?: LocalTaskProfilePersistence): LocalTaskStore =>
  (() => {
    if (singleton) {
      return singleton
    }
    if (!persistence) {
      throw new Error('Local task profile persistence has not been initialized')
    }
    singleton = new LocalTaskStore(persistence)
    return singleton
  })()
export const setLocalTaskStoreForTests = (value: LocalTaskStore | null): void => {
  singleton?.close()
  singleton = value
}
