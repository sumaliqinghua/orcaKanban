import { useMemo, useRef, type ReactNode } from 'react'
import { useAppStore } from '@/store'
import { useLocalTaskDataSubscription } from './use-local-task-center-data'
import { useLocalTaskSessionLiveness } from './use-local-task-session-liveness'
import { LocalTaskCatalogContext, localTaskWorkspaceKey } from './local-task-catalog-context'
import type { LocalTaskProjectRoot } from './local-task-project-scope'
import type { WorkItem } from './mock-data'

const ALL_PROJECTS: LocalTaskProjectRoot[] = []

export function LocalTaskCatalogProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const enabled = useAppStore(
    (s) => s.activeView === 'work-items' || s.sidebarWorkspaceContent === 'tasks'
  )
  const activated = useRef(false)
  activated.current ||= enabled
  // 任务来自当前软件配置的统一目录，工作区行仅查索引，不各自发请求。
  const data = useLocalTaskDataSubscription('all', ALL_PROJECTS, activated.current)
  const effectiveItems = useLocalTaskSessionLiveness(data.items)
  const byWorkspace = useMemo(() => {
    const result = new Map<string, WorkItem[]>()
    for (const item of effectiveItems) {
      if (!item.workspaceId || item.intakeState !== 'ready' || item.archivedAt != null) {
        continue
      }
      const key = localTaskWorkspaceKey(item.project, item.workspaceId)
      const group = result.get(key) ?? []
      group.push(item)
      result.set(key, group)
    }
    for (const group of result.values()) {
      group.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    }
    return result
  }, [effectiveItems])
  const value = useMemo(
    () => ({ ...data, effectiveItems, byWorkspace }),
    [data, effectiveItems, byWorkspace]
  )
  return (
    <LocalTaskCatalogContext.Provider value={value}>{children}</LocalTaskCatalogContext.Provider>
  )
}
