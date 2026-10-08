import { createContext } from 'react'
import type { useLocalTaskDataSubscription } from './use-local-task-center-data'
import type { WorkItem } from './mock-data'

export type LocalTaskCatalog = ReturnType<typeof useLocalTaskDataSubscription> & {
  effectiveItems: WorkItem[]
  byWorkspace: ReadonlyMap<string, WorkItem[]>
}

export const localTaskWorkspaceKey = (projectId: string, workspaceId: string): string =>
  JSON.stringify([projectId, workspaceId])

export const LocalTaskCatalogContext = createContext<LocalTaskCatalog | null>(null)
