import { ipcMain } from 'electron'
import { getLocalTaskStore } from '../local-tasks/store'
import type {
  ReportLocalTaskCompletedArgs,
  UpdateLocalTaskStepArgs
} from '../../shared/local-task-types'
import {
  acceptLocalTaskArgsSchema,
  archiveLocalTaskArgsSchema,
  createLocalTaskArgsSchema,
  createLocalTaskSessionArgsSchema,
  createLocalTaskSubtaskArgsSchema,
  editLocalTaskStepTitleArgsSchema,
  localTaskIdSchema,
  localTaskListArgsSchema,
  parseLocalTaskIpcArgs,
  reportLocalTaskCompletedArgsSchema,
  startLocalTaskBatchArgsSchema,
  transferLocalTaskSubtaskArgsSchema,
  updateLocalTaskRunArgsSchema,
  updateLocalTaskArgsSchema,
  updateLocalTaskStepArgsSchema,
  updateLocalTaskSessionOutputArgsSchema,
  updateLocalTaskSubtaskArgsSchema
} from './local-task-ipc-validation'
import { publishLocalTaskChange } from '../local-tasks/change-notifications'

let registered = false

export function registerLocalTaskHandlers(): void {
  if (registered) {
    return
  }
  registered = true
  const store = getLocalTaskStore()
  store.setOnChanged(publishLocalTaskChange)
  ipcMain.handle('localTasks:list', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(localTaskListArgsSchema, args)
    return store.list(parsed?.projectId, parsed?.projectPath)
  })
  ipcMain.handle('localTasks:get', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(localTaskIdSchema, args)
    return store.get(parsed.taskId, parsed.projectPath)
  })
  ipcMain.handle('localTasks:create', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(createLocalTaskArgsSchema, args)
    const task = store.create(parsed)
    publishLocalTaskChange(task)
    return task
  })
  ipcMain.handle('localTasks:update', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(updateLocalTaskArgsSchema, args)
    const task = store.update(parsed.taskId, parsed.updates)
    publishLocalTaskChange(task)
    return task
  })
  ipcMain.handle('localTasks:createSession', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(createLocalTaskSessionArgsSchema, args)
    const session = store.createSession(parsed)
    const task = store.get(parsed.taskId)
    if (task) {
      publishLocalTaskChange(task)
    }
    return session
  })
  ipcMain.handle('localTasks:updateSessionOutput', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(updateLocalTaskSessionOutputArgsSchema, args)
    const task = store.updateSessionOutput(parsed)
    publishLocalTaskChange(task)
    return task
  })
  ipcMain.handle('localTasks:startBatch', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(startLocalTaskBatchArgsSchema, args)
    const batch = store.startBatch(parsed.tasks, {
      recoverQueued: parsed.recoverQueued ?? true,
      automationId: parsed.automationId,
      automationRunId: parsed.automationRunId
    })
    for (const candidate of batch.candidates) {
      publishLocalTaskChange(candidate.task)
    }
    return batch
  })
  ipcMain.handle('localTasks:updateRun', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(updateLocalTaskRunArgsSchema, args)
    const task = store.updateRun(parsed)
    publishLocalTaskChange(task)
    return task
  })
  ipcMain.handle('localTasks:createSubtask', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(createLocalTaskSubtaskArgsSchema, args)
    const task = store.createSubtask(parsed)
    publishLocalTaskChange(task)
    return task
  })
  ipcMain.handle('localTasks:updateSubtask', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(updateLocalTaskSubtaskArgsSchema, args)
    const task = store.updateSubtask(parsed)
    publishLocalTaskChange(task)
    return task
  })
  ipcMain.handle('localTasks:transferSubtask', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(transferLocalTaskSubtaskArgsSchema, args)
    const task = store.transferSubtask(parsed)
    publishLocalTaskChange(task)
    return task
  })
  ipcMain.handle('localTasks:editStepTitle', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(editLocalTaskStepTitleArgsSchema, args)
    const task = store.editStepTitle(parsed)
    publishLocalTaskChange(task)
    return task
  })
  ipcMain.handle('localTasks:accept', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(acceptLocalTaskArgsSchema, args)
    const task = store.accept(parsed.taskId)
    publishLocalTaskChange(task)
    return task
  })
  ipcMain.handle('localTasks:archive', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(archiveLocalTaskArgsSchema, args)
    const task = store.archive(parsed.taskId, parsed.activeSessionIds)
    publishLocalTaskChange(task)
    return task
  })
  ipcMain.handle('localTasks:restore', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(acceptLocalTaskArgsSchema, args)
    const task = store.restore(parsed.taskId)
    publishLocalTaskChange(task)
    return task
  })
  ipcMain.handle('localTasks:updateStep', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(
      updateLocalTaskStepArgsSchema,
      args
    ) as UpdateLocalTaskStepArgs
    const task = store.updateStep(parsed)
    publishLocalTaskChange(task)
    return task
  })
  ipcMain.handle('localTasks:reportCompleted', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(
      reportLocalTaskCompletedArgsSchema,
      args
    ) as ReportLocalTaskCompletedArgs
    const task = store.reportCompleted(parsed)
    publishLocalTaskChange(task)
    return task
  })
}
