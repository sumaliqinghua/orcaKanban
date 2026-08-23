import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
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
  editTitle: () => void
  acceptSelected: () => void
  archiveSelected: () => void
  openWorkspace: () => void
  openSession: (sessionId: string) => void
  sessionStarted: (tabId: string, request: string) => void
  editStep: (subtaskId: string, stepId: string) => void
} {
  const { selected, setItems, setSelectedId, setLoadError } = context
  const editTitle = (): void => {
    if (!selected) {
      return
    }
    const title = window.prompt('编辑任务标题', selected.title)?.trim()
    if (!title || title === selected.title) {
      return
    }
    void window.api.localTasks
      .update({ taskId: selected.id, updates: { title } })
      .then((task) => replaceTask(setItems, task))
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '任务标题更新失败')
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
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '任务归档失败')
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
  const openSession = (sessionId: string): void => {
    if (sessionId.startsWith('lts_')) {
      setLoadError('该会话还没有连接到真实终端')
      return
    }
    activateTabAndFocusPane(sessionId, null)
    useAppStore.getState().closeWorkItemsPage()
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
    acceptSelected,
    archiveSelected,
    openWorkspace,
    openSession,
    sessionStarted,
    editStep
  }
}
