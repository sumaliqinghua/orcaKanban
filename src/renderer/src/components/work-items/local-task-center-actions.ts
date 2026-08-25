import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import { useAppStore } from '@/store'
import type { LocalTask } from '../../../../shared/local-task-types'
import { localTaskToViewModel } from './local-task-view-model'
import type { WorkItem } from './mock-data'

type ActionContext = {
  selected: WorkItem | null
  setItems: React.Dispatch<React.SetStateAction<WorkItem[]>>
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>
  setLoadError: React.Dispatch<React.SetStateAction<string | null>>
}

function replaceTask(setItems: ActionContext['setItems'], task: LocalTask): void {
  const viewItem = localTaskToViewModel(task)
  setItems((current) => current.map((item) => (item.id === task.id ? viewItem : item)))
}

export function createLocalTaskCenterActions(context: ActionContext): {
  editTitle: (title: string) => void
  editLabels: (labels: string[]) => void
  acceptSelected: () => void
  archiveSelected: () => void
  promoteSelected: () => void
  openWorkspace: () => void
  sessionStarted: (tabId: string, request: string) => void
  editStep: (subtaskId: string, stepId: string) => void
} {
  const { selected, setItems, setSelectedId, setLoadError } = context
  const editTitle = (title: string): void => {
    if (!selected) {
      return
    }
    const nextTitle = title.trim()
    if (!nextTitle || nextTitle === selected.title) {
      return
    }
    void window.api.localTasks
      .update({ taskId: selected.id, updates: { title: nextTitle } })
      .then((task) => replaceTask(setItems, task))
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '任务标题更新失败')
      )
  }
  const editLabels = (labels: string[]): void => {
    if (!selected) {
      return
    }
    void window.api.localTasks
      .update({ taskId: selected.id, updates: { labels } })
      .then((task) => replaceTask(setItems, task))
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '任务标签更新失败')
      )
  }
  const acceptSelected = (): void => {
    if (!selected) {
      return
    }
    void window.api.localTasks
      .accept({ taskId: selected.id })
      .then((task) => replaceTask(setItems, task))
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '任务验收失败')
      )
  }
  const archiveSelected = (): void => {
    if (!selected) {
      return
    }
    void window.api.localTasks
      .archive({ taskId: selected.id })
      .then((task) => {
        setItems((current) => current.filter((item) => item.id !== task.id))
        setSelectedId(null)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('Local task not found')) {
          setItems((current) => current.filter((item) => item.id !== selected.id))
          setSelectedId(null)
          return
        }
        setLoadError(message || '任务归档失败')
      })
  }
  const promoteSelected = (): void => {
    if (!selected || selected.intakeState !== 'inbox') {
      return
    }
    void window.api.localTasks
      .update({ taskId: selected.id, updates: { intakeState: 'ready' } })
      .then((task) => replaceTask(setItems, task))
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '任务整理状态更新失败')
      )
  }
  const openWorkspace = (): void => {
    if (!selected) {
      return
    }
    const activeWorktreeId = useAppStore.getState().activeWorktreeId
    const target = selected.workspaceId === 'local' ? activeWorktreeId : selected.workspaceId
    if (!target) {
      setLoadError('当前任务没有可激活的 workspace')
      return
    }
    void activateWorktreeFromSidebar(target).then(() => useAppStore.getState().closeWorkItemsPage())
  }
  const sessionStarted = (tabId: string, request: string): void => {
    if (!selected) {
      return
    }
    const workspaceId =
      selected.workspaceId === 'local'
        ? (useAppStore.getState().activeWorktreeId ?? 'local')
        : selected.workspaceId
    void window.api.localTasks
      .createSession({
        taskId: selected.id,
        projectPath: selected.projectPath,
        sessionId: tabId,
        title: request.split(/\r?\n/, 1)[0]?.trim().slice(0, 120) || 'Agent 会话',
        workspaceId,
        initialPrompt: request,
        associationSource: 'task-center'
      })
      .then(() => window.api.localTasks.get(selected.id, selected.projectPath))
      .then((task) => {
        if (task) {
          replaceTask(setItems, task)
        }
        useAppStore.getState().closeWorkItemsPage()
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '关联会话创建失败')
      )
  }
  const editStep = (subtaskId: string, stepId: string): void => {
    const title = window.prompt('编辑未开始步骤')?.trim()
    if (!title) {
      return
    }
    void window.api.localTasks
      .editStepTitle({ subtaskId, stepId, title })
      .then((task) => replaceTask(setItems, task))
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '步骤更新失败')
      )
  }
  return {
    editTitle,
    editLabels,
    acceptSelected,
    archiveSelected,
    promoteSelected,
    openWorkspace,
    sessionStarted,
    editStep
  }
}
