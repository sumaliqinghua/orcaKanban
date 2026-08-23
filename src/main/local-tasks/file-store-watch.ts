import { existsSync, watch, type FSWatcher } from 'node:fs'
import { join, resolve } from 'node:path'
import type { LocalTask } from '../../shared/local-task-types'
import { localTaskDirectory, localTaskFile, LOCAL_TASK_ROOT_NAME } from './file-store-format'

export class LocalTaskFileWatchers {
  private readonly watchers = new Map<string, FSWatcher>()

  constructor(private readonly onTaskFileChanged: (path: string) => void) {}

  close(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
  }

  watchProject(projectPath: string): void {
    const root = join(resolve(projectPath), LOCAL_TASK_ROOT_NAME)
    if (!existsSync(root) || this.watchers.has(root)) {
      return
    }
    this.watchers.set(
      root,
      watch(root, (_event, filename) => {
        if (!filename) {
          return
        }
        const relative = filename.toString().replaceAll('\\', '/')
        const path =
          relative.endsWith('/task.json') || relative === 'task.json'
            ? join(root, relative)
            : join(root, relative, 'task.json')
        if (existsSync(path)) {
          this.onTaskFileChanged(path)
        }
      })
    )
  }

  watchTask(task: LocalTask): void {
    const directory = localTaskDirectory(task.projectPath, task.id)
    if (!existsSync(directory) || this.watchers.has(directory)) {
      return
    }
    this.watchers.set(
      directory,
      watch(directory, (_event, filename) => {
        if (filename?.toString() === 'task.json') {
          this.onTaskFileChanged(localTaskFile(task.projectPath, task.id))
        }
      })
    )
  }
}
