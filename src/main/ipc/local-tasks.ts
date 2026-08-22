import { BrowserWindow, ipcMain } from 'electron'
import type { LocalTaskApi } from '../../preload/api/local-task-api'
import { getLocalTaskStore } from '../local-tasks/store'
import type { LocalTask } from '../../shared/local-task-types'

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
  ipcMain.handle('localTasks:list', (_event, args?: { projectId?: string }) =>
    store.list(args?.projectId)
  )
  ipcMain.handle('localTasks:get', (_event, taskId: string) => store.get(taskId))
  ipcMain.handle(
    'localTasks:create',
    (_event, args: LocalTaskApi['create'] extends (args: infer T) => unknown ? T : never) => {
      const task = store.create(args)
      publish(task)
      return task
    }
  )
  ipcMain.handle(
    'localTasks:update',
    (
      _event,
      args: { taskId: string; updates: Parameters<LocalTaskApi['update']>[0]['updates'] }
    ) => {
      const task = store.update(args.taskId, args.updates)
      publish(task)
      return task
    }
  )
  ipcMain.handle(
    'localTasks:createSession',
    (_event, args: Parameters<LocalTaskApi['createSession']>[0]) => {
      const session = store.createSession(args)
      const task = store.get(args.taskId)
      if (task) {
        publish(task)
      }
      return session
    }
  )
  ipcMain.handle(
    'localTasks:createSubtask',
    (_event, args: Parameters<LocalTaskApi['createSubtask']>[0]) => {
      const task = store.createSubtask(args)
      publish(task)
      return task
    }
  )
  ipcMain.handle(
    'localTasks:updateSubtask',
    (_event, args: Parameters<LocalTaskApi['updateSubtask']>[0]) => {
      const task = store.updateSubtask(args)
      publish(task)
      return task
    }
  )
  ipcMain.handle(
    'localTasks:updateStep',
    (_event, args: Parameters<LocalTaskApi['updateStep']>[0]) => {
      const task = store.updateStep(args)
      publish(task)
      return task
    }
  )
  ipcMain.handle(
    'localTasks:reportCompleted',
    (_event, args: Parameters<LocalTaskApi['reportCompleted']>[0]) => {
      const task = store.reportCompleted(args)
      publish(task)
      return task
    }
  )
}
