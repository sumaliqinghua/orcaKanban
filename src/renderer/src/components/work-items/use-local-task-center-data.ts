import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { WorkItem } from './mock-data'
import { localTaskToViewModel } from './local-task-view-model'
import {
  isLocalTaskInProjectScope,
  loadLocalTasksForProjectScope,
  type LocalTaskProjectRoot
} from './local-task-project-scope'

import { LocalTaskCatalogContext } from './local-task-catalog-context'

const identity = (item: WorkItem): string => JSON.stringify([item.projectPath, item.id])

export function useLocalTaskDataSubscription(
  projectFilter: string,
  roots: LocalTaskProjectRoot[],
  enabled = true
) {
  // 目录内容相同就复用加载范围，忽略工作树状态和目录顺序变化。
  const rootsKey = JSON.stringify(
    roots
      .map(({ projectId, projectPath }) => ({ projectId, projectPath }))
      .sort(
        (a, b) =>
          a.projectId.localeCompare(b.projectId) || a.projectPath.localeCompare(b.projectPath)
      )
  )
  const projectRoots = useMemo<LocalTaskProjectRoot[]>(() => JSON.parse(rootsKey), [rootsKey])
  const [items, updateItems] = useState<WorkItem[]>([])
  const currentItems = useRef(items)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const requestId = useRef(0)
  const deletedTasks = useRef(new Set<string>())
  const invalidateRequests = useCallback(() => {
    requestId.current++
  }, [])
  const setItems = useCallback<React.Dispatch<React.SetStateAction<WorkItem[]>>>((update) => {
    const next = typeof update === 'function' ? update(currentItems.current) : update
    currentItems.current = next
    updateItems(next)
  }, [])
  const loadTasks = useCallback(async (): Promise<void> => {
    const id = ++requestId.current
    const before = new Map(currentItems.current.map((item) => [identity(item), item]))
    setLoading(true)
    try {
      const tasks = await loadLocalTasksForProjectScope(
        projectRoots,
        projectFilter,
        window.api.localTasks.list,
        { includeArchived: true }
      )
      if (id !== requestId.current) {
        return
      }
      setItems((current) => {
        const latest = new Map(current.map((item) => [identity(item), item]))
        const merged = new Map(latest)
        for (const item of tasks.map(localTaskToViewModel)) {
          const key = identity(item)
          if (deletedTasks.current.has(key)) {
            continue
          }
          // 请求期间的更新和删除优先；列表暂缺不作为任务删除证据。
          if (latest.get(key) === before.get(key) && (!before.has(key) || latest.has(key))) {
            merged.set(key, item)
          }
        }
        return [...merged.values()]
      })
      setLoaded(true)
      setLoadError(null)
    } catch (error) {
      if (id === requestId.current) {
        setLoadError(error instanceof Error ? error.message : '本地任务加载失败')
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false)
      }
    }
  }, [projectFilter, projectRoots, setItems])

  useEffect(() => {
    if (!enabled) {
      return
    }
    const inScope = (task: { projectId: string; projectPath: string }): boolean =>
      projectRoots.length === 0
        ? projectFilter === 'all' || task.projectId === projectFilter
        : isLocalTaskInProjectScope(task, projectRoots)
    setItems((current) =>
      current.filter((item) =>
        inScope({ projectId: item.project, projectPath: item.projectPath ?? '' })
      )
    )
    const unsubscribeChanged = window.api.localTasks.onChanged((task) => {
      if (!inScope(task)) {
        return
      }
      const viewItem = localTaskToViewModel(task)
      deletedTasks.current.delete(identity(viewItem))
      setItems((current) =>
        current.some((item) => identity(item) === identity(viewItem))
          ? current.map((item) => (identity(item) === identity(viewItem) ? viewItem : item))
          : [viewItem, ...current]
      )
    })
    const unsubscribeDeleted = window.api.localTasks.onDeleted((deletion) => {
      deletedTasks.current.add(JSON.stringify([deletion.projectPath, deletion.taskId]))
      const known = currentItems.current.some(
        (item) => item.id === deletion.taskId && item.projectPath === deletion.projectPath
      )
      setItems((current) =>
        current.filter(
          (item) => item.id !== deletion.taskId || item.projectPath !== deletion.projectPath
        )
      )
      if (known) {
        setLoadError('任务已删除')
      }
    })
    void loadTasks()
    return () => {
      invalidateRequests()
      unsubscribeChanged()
      unsubscribeDeleted()
    }
  }, [enabled, invalidateRequests, loadTasks, projectFilter, projectRoots, setItems])
  return { items, setItems, loading, loaded, loadError, setLoadError, loadTasks }
}

export function useLocalTaskCenterData(projectFilter: string, roots: LocalTaskProjectRoot[]) {
  const shared = useContext(LocalTaskCatalogContext)
  const fallback = useLocalTaskDataSubscription(projectFilter, roots, !shared)
  const data = shared ?? { ...fallback, effectiveItems: fallback.items }
  const inScope = useCallback(
    (item: WorkItem) => projectFilter === 'all' || item.project === projectFilter,
    [projectFilter]
  )
  const items = useMemo(() => data.items.filter(inScope), [data.items, inScope])
  const effectiveItems = useMemo(
    () => data.effectiveItems.filter(inScope),
    [data.effectiveItems, inScope]
  )
  const updateItems = data.setItems
  const setItems = useCallback<React.Dispatch<React.SetStateAction<WorkItem[]>>>(
    (update) => {
      updateItems((current) => {
        const scoped = current.filter(inScope)
        const next = typeof update === 'function' ? update(scoped) : update
        return [...current.filter((item) => !inScope(item)), ...next]
      })
    },
    [inScope, updateItems]
  )
  return { ...data, items, effectiveItems, setItems }
}
