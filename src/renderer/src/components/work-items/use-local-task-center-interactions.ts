import { useCallback } from 'react'
import { useAppStore } from '@/store'
import { TOGGLE_WORKSPACE_BOARD_EVENT } from '@/components/sidebar/useWorkspaceBoardPanel'
import type { LocalTask } from '../../../../shared/local-task-types'
import type { WorkItem } from './mock-data'
import type { LocalTaskQueueView } from './LocalTaskQueueTabs'
import { localTaskToViewModel } from './local-task-view-model'

export function useLocalTaskCenterInteractions({
  createProjectId,
  setProjectFilter,
  selected,
  setItems,
  setSelectedId,
  setLoadError,
  setDetailOpen,
  setQueueView,
  setQuery,
  setExpandedIds
}: {
  createProjectId: string
  setProjectFilter: (value: string) => void
  selected: WorkItem | null
  setItems: React.Dispatch<React.SetStateAction<WorkItem[]>>
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>
  setLoadError: (value: string | null) => void
  setDetailOpen: React.Dispatch<React.SetStateAction<boolean>>
  setQueueView: React.Dispatch<React.SetStateAction<LocalTaskQueueView>>
  setQuery: React.Dispatch<React.SetStateAction<string>>
  setExpandedIds: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>
}): {
  openTaskComposer: () => void
  openWorkspaceBoard: () => void
  openAiRecordTask: (task: WorkItem) => void
  applyTaskUpdate: (task: LocalTask) => void
  completeSubtask: (subtaskId: string) => void
  toggleExpanded: (id: string) => void
} {
  const openTaskComposer = useCallback((): void => {
    useAppStore.getState().openModal('new-workspace-composer', {
      localTaskMode: true,
      localTaskDraft: {
        title: '',
        description: '',
        intakeState: 'ready',
        clarificationRequested: false
      },
      ...(createProjectId !== 'local' ? { initialRepoId: createProjectId } : {}),
      telemetrySource: 'sidebar'
    })
  }, [createProjectId])

  const openWorkspaceBoard = useCallback((): void => {
    useAppStore.getState().closeWorkItemsPage()
    window.dispatchEvent(new CustomEvent(TOGGLE_WORKSPACE_BOARD_EVENT))
  }, [])

  const openAiRecordTask = useCallback(
    (task: WorkItem): void => {
      setProjectFilter(task.project)
      setQueueView(task.intakeState === 'inbox' ? 'inbox' : 'ready')
      setSelectedId(task.id)
      setDetailOpen(true)
      setQuery('')
    },
    [setDetailOpen, setProjectFilter, setQuery, setQueueView, setSelectedId]
  )

  const applyTaskUpdate = useCallback(
    (task: LocalTask): void => {
      setItems((current) =>
        current.map((item) => (item.id === task.id ? localTaskToViewModel(task) : item))
      )
    },
    [setItems]
  )

  const completeSubtask = useCallback(
    (subtaskId: string): void => {
      if (!selected) {
        return
      }
      const subtask = selected.subtasks.find((item) => item.id === subtaskId)
      if (!subtask) {
        return
      }
      void window.api.localTasks
        .updateSubtask({ subtaskId, status: subtask.status === 'done' ? 'todo' : 'done' })
        .then((task) =>
          setItems((current) =>
            current.map((item) => (item.id === task.id ? localTaskToViewModel(task) : item))
          )
        )
        .catch((error: unknown) =>
          setLoadError(error instanceof Error ? error.message : '子任务更新失败')
        )
    },
    [selected, setItems, setLoadError]
  )

  const toggleExpanded = useCallback(
    (id: string): void => {
      setExpandedIds((current) => {
        const next = new Set(current)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    },
    [setExpandedIds]
  )

  return {
    openTaskComposer,
    openWorkspaceBoard,
    openAiRecordTask,
    applyTaskUpdate,
    completeSubtask,
    toggleExpanded
  }
}
