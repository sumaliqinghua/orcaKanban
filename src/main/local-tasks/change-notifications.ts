import { BrowserWindow } from 'electron'
import type { LocalTask, LocalTaskDeletion } from '../../shared/local-task-types'

export const LOCAL_TASK_CHANGED_CHANNEL = 'localTasks:changed'
export const LOCAL_TASK_DELETED_CHANNEL = 'localTasks:deleted'

export function publishLocalTaskChange(task: LocalTask): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(LOCAL_TASK_CHANGED_CHANNEL, task)
    }
  }
}

export function publishLocalTaskDeletion(deletion: LocalTaskDeletion): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(LOCAL_TASK_DELETED_CHANNEL, deletion)
    }
  }
}
