import { BrowserWindow, ipcMain } from 'electron'
import { getLocalTaskStore } from '../local-tasks/store'
import type { LocalTask } from '../../shared/local-task-types'
import type {
  ReportLocalTaskCompletedArgs,
  UpdateLocalTaskStepArgs
} from '../../shared/local-task-types'
import {
  acceptLocalTaskArgsSchema,
  createLocalTaskArgsSchema,
  createLocalTaskSessionArgsSchema,
  createLocalTaskSubtaskArgsSchema,
  editLocalTaskStepTitleArgsSchema,
  localTaskIdSchema,
  localTaskListArgsSchema,
  parseLocalTaskIpcArgs,
  reportLocalTaskCompletedArgsSchema,
  updateLocalTaskArgsSchema,
  updateLocalTaskStepArgsSchema,
  updateLocalTaskSubtaskArgsSchema
} from './local-task-ipc-validation'

const CHANGE_CHANNEL = 'localTasks:changed'
let registered = false

function publish(task: LocalTask): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(CHANGE_CHANNEL, task)
    }
  }
}

export function registerLocalTaskHandlers(): void {
  if (registered) {
    return
  }
  registered = true
  const store = getLocalTaskStore()
  ipcMain.handle('localTasks:list', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(localTaskListArgsSchema, args)
    return store.list(parsed?.projectId)
  })
  ipcMain.handle('localTasks:get', (_event, taskId: unknown) =>
    store.get(parseLocalTaskIpcArgs(localTaskIdSchema, taskId))
  )
  ipcMain.handle('localTasks:create', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(createLocalTaskArgsSchema, args)
    const task = store.create(parsed)
    publish(task)
    return task
  })
  ipcMain.handle('localTasks:update', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(updateLocalTaskArgsSchema, args)
    const task = store.update(parsed.taskId, parsed.updates)
    publish(task)
    return task
  })
  ipcMain.handle('localTasks:createSession', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(createLocalTaskSessionArgsSchema, args)
    const session = store.createSession(parsed)
    const task = store.get(parsed.taskId)
    if (task) {
      publish(task)
    }
    return session
  })
  ipcMain.handle('localTasks:createSubtask', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(createLocalTaskSubtaskArgsSchema, args)
    const task = store.createSubtask(parsed)
    publish(task)
    return task
  })
  ipcMain.handle('localTasks:updateSubtask', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(updateLocalTaskSubtaskArgsSchema, args)
    const task = store.updateSubtask(parsed)
    publish(task)
    return task
  })
  ipcMain.handle('localTasks:editStepTitle', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(editLocalTaskStepTitleArgsSchema, args)
    const task = store.editStepTitle(parsed)
    publish(task)
    return task
  })
  ipcMain.handle('localTasks:accept', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(acceptLocalTaskArgsSchema, args)
    const task = store.accept(parsed.taskId)
    publish(task)
    return task
  })
  ipcMain.handle('localTasks:archive', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(acceptLocalTaskArgsSchema, args)
    const task = store.archive(parsed.taskId)
    publish(task)
    return task
  })
  ipcMain.handle('localTasks:restore', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(acceptLocalTaskArgsSchema, args)
    const task = store.restore(parsed.taskId)
    publish(task)
    return task
  })
  ipcMain.handle('localTasks:updateStep', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(
      updateLocalTaskStepArgsSchema,
      args
    ) as UpdateLocalTaskStepArgs
    const task = store.updateStep(parsed)
    publish(task)
    return task
  })
  ipcMain.handle('localTasks:reportCompleted', (_event, args: unknown) => {
    const parsed = parseLocalTaskIpcArgs(
      reportLocalTaskCompletedArgsSchema,
      args
    ) as ReportLocalTaskCompletedArgs
    const task = store.reportCompleted(parsed)
    publish(task)
    return task
  })
}
