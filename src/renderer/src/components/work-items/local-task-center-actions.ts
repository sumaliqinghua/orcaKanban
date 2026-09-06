import { useAppStore } from '@/store'
import type { LocalTask } from '../../../../shared/local-task-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { DashboardRevealAgentArgs } from '../../../../shared/dashboard-snapshot'
import type { Worktree } from '../../../../shared/worktree/types'
import { localTaskToViewModel } from './local-task-view-model'
import type { WorkItem } from './mock-data'
import { openLocalTaskWorkspace } from './local-task-workspace-navigation'

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
  editDescription: (description: string) => void
  editLabels: (labels: string[]) => void
  acceptSelected: () => void
  archiveSelected: () => void
  restoreSelected: () => void
  deleteSelected: () => void
  promoteSelected: (workspace: Worktree) => void
  moveSelectedToInbox: () => void
  openWorkspace: (request?: string | DashboardRevealAgentArgs) => void
  sessionStarted: (tabId: string, request: string) => void
  reportSessionStarted: (tabId: string, request: string, agent: TuiAgent) => Promise<void>
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
      .update({
        taskId: selected.id,
        projectPath: selected.projectPath,
        updates: { title: nextTitle }
      })
      .then((task) => replaceTask(setItems, task))
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '任务标题更新失败')
      )
  }
  const editDescription = (description: string): void => {
    if (!selected) {
      return
    }
    const nextDescription = description.trim()
    if (nextDescription === selected.description) {
      return
    }
    void window.api.localTasks
      .update({
        taskId: selected.id,
        projectPath: selected.projectPath,
        updates: { description: nextDescription }
      })
      .then((task) => replaceTask(setItems, task))
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '任务描述更新失败')
      )
  }
  const editLabels = (labels: string[]): void => {
    if (!selected) {
      return
    }
    void window.api.localTasks
      .update({ taskId: selected.id, projectPath: selected.projectPath, updates: { labels } })
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
      .accept({ taskId: selected.id, projectPath: selected.projectPath })
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
      .archive({
        taskId: selected.id,
        projectPath: selected.projectPath,
        activeSessionIds: selected.sessionsList.flatMap((session) =>
          session.id && session.status === 'working' ? [session.id] : []
        )
      })
      .then((task) => {
        replaceTask(setItems, task)
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
  const restoreSelected = (): void => {
    if (!selected || selected.archivedAt == null || !selected.projectPath) {
      return
    }
    void window.api.localTasks
      .restore({ taskId: selected.id, projectPath: selected.projectPath })
      .then((task) => {
        replaceTask(setItems, task)
        setSelectedId(null)
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '任务恢复失败')
      )
  }
  const deleteSelected = (): void => {
    if (!selected || selected.archivedAt == null || !selected.projectPath) {
      return
    }
    void window.api.localTasks
      .delete({
        taskId: selected.id,
        projectPath: selected.projectPath,
        activeSessionIds: selected.sessionsList.flatMap((session) =>
          session.id && session.status === 'working' ? [session.id] : []
        )
      })
      .then((deletion) => {
        setItems((current) =>
          current.filter(
            (item) => item.id !== deletion.taskId || item.projectPath !== deletion.projectPath
          )
        )
        setSelectedId(null)
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '任务永久删除失败')
      )
  }
  const promoteSelected = (workspace: Worktree): void => {
    if (!selected || selected.intakeState !== 'inbox') {
      return
    }
    void window.api.localTasks
      .update({
        taskId: selected.id,
        projectPath: selected.projectPath,
        updates: {
          intakeState: 'ready',
          status: 'Open',
          projectPath: workspace.path,
          workspaceId: workspace.id,
          workspaceLabel: workspace.displayName
        }
      })
      .then((task) => replaceTask(setItems, task))
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '任务整理状态更新失败')
      )
  }
  const moveSelectedToInbox = (): void => {
    if (!selected || selected.intakeState === 'inbox') {
      return
    }
    void window.api.localTasks
      .update({
        taskId: selected.id,
        projectPath: selected.projectPath,
        updates: { intakeState: 'inbox' }
      })
      .then((task) => replaceTask(setItems, task))
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : '任务移至收件箱失败')
      )
  }
  const openWorkspace = (request?: string | DashboardRevealAgentArgs): void => {
    if (!selected) {
      return
    }
    openLocalTaskWorkspace({
      item: selected,
      request,
      setLoadError,
      rebindSessionTab: (sessionId, tabId) => {
        void window.api.localTasks
          .rebindSessionTab({ sessionId, tabId })
          .then((task) => replaceTask(setItems, task))
          .catch(() => {})
      }
    })
  }
  const sessionStarted = (): void => {
    if (!selected) {
      return
    }
    void window.api.localTasks
      .get(selected.id, selected.projectPath)
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
  const reportSessionStarted = async (
    tabId: string,
    request: string,
    agent: TuiAgent
  ): Promise<void> => {
    if (!selected) {
      return
    }
    try {
      const workspaceId =
        selected.workspaceId === 'local'
          ? (useAppStore.getState().activeWorktreeId ?? 'local')
          : selected.workspaceId
      await window.api.localTasks.createSession({
        taskId: selected.id,
        projectPath: selected.projectPath,
        sessionId: tabId,
        title: `任务报告 · ${agent}`,
        workspaceId,
        agentId: agent,
        currentPrompt: request,
        associationSource: 'task-report'
      })
      const refreshed = await window.api.localTasks.get(selected.id, selected.projectPath)
      if (refreshed) {
        replaceTask(setItems, refreshed)
      }
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : '任务报告会话创建失败')
    }
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
    editDescription,
    editLabels,
    acceptSelected,
    archiveSelected,
    restoreSelected,
    deleteSelected,
    promoteSelected,
    moveSelectedToInbox,
    openWorkspace,
    sessionStarted,
    reportSessionStarted,
    editStep
  }
}
