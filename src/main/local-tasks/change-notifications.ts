import { BrowserWindow } from 'electron'
import type { LocalTask } from '../../shared/local-task-types'

export const LOCAL_TASK_CHANGED_CHANNEL = 'localTasks:changed'

export function publishLocalTaskChange(task: LocalTask): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(LOCAL_TASK_CHANGED_CHANNEL, task)
    }
  }
}
