import { useEffect } from 'react'
import { useLocalTaskNavigation } from './local-task-navigation'
import type { WorkItem } from './mock-data'
import type { LocalTaskQueueView } from './LocalTaskQueueTabs'

export function useLocalTaskNavigationRequest({
  items,
  loaded,
  loading,
  projectFilter,
  setProjectFilter,
  setSelectedId,
  setDetailOpen,
  setQueueView,
  setQuery,
  setLabelFilter,
  setTab,
  setLoadError
}: {
  items: WorkItem[]
  loaded: boolean
  loading: boolean
  projectFilter: string
  setProjectFilter: (value: string) => void
  setSelectedId: (value: string | null) => void
  setDetailOpen: (value: boolean) => void
  setQueueView: (value: LocalTaskQueueView) => void
  setQuery: (value: string) => void
  setLabelFilter: (value: string) => void
  setTab: (value: 'work-items' | 'external') => void
  setLoadError: (value: string | null) => void
}): void {
  const target = useLocalTaskNavigation((s) => s.target)
  useEffect(() => {
    if (!target) {
      return
    }
    if (projectFilter !== target.project) {
      setProjectFilter(target.project)
      return
    }
    const item = items.find(
      (item) =>
        item.id === target.id &&
        item.project === target.project &&
        item.projectPath === target.projectPath
    )
    if (!item && (!loaded || loading)) {
      return
    }
    setTab('work-items')
    setQuery('')
    setLabelFilter('')
    if (item) {
      setQueueView(
        item.archivedAt != null ? 'archived' : item.intakeState === 'inbox' ? 'inbox' : 'ready'
      )
      setSelectedId(item.id)
      setDetailOpen(true)
    } else {
      setSelectedId(null)
      setDetailOpen(false)
      setLoadError('目标任务已删除或当前不可访问')
    }
    useLocalTaskNavigation.getState().clear()
  }, [
    target,
    items,
    loaded,
    loading,
    projectFilter,
    setProjectFilter,
    setSelectedId,
    setDetailOpen,
    setQueueView,
    setQuery,
    setLabelFilter,
    setTab,
    setLoadError
  ])
}
