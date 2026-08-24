import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import type { ComposerCardProps } from './useComposerState'
import type { WorktreeCreationCompletion } from '@/lib/worktree-creation-completion'
import type { Worktree } from '../../../shared/worktree/types'
import type { WorkspaceSource as WorkspaceCreateTelemetrySource } from '../../../shared/workspace-source'

type LocalTaskComposerModalData = {
  initialRepoId?: string
  telemetrySource?: WorkspaceCreateTelemetrySource
  localTaskDraft?: {
    title: string
    description: string
    labels?: string[]
    intakeState?: 'inbox' | 'ready'
  }
}

export function useLocalTaskComposer({
  modalData,
  cardProps,
  creatingWorkspace,
  onClose
}: {
  modalData: LocalTaskComposerModalData
  cardProps: ComposerCardProps
  creatingWorkspace: boolean
  onClose: () => void
}): {
  taskTitle: string
  taskDescription: string
  taskLabels: string
  taskIntakeState: 'inbox' | 'ready'
  taskError: string | null
  taskWorkspaces: Worktree[]
  selectedWorkspaceId: string
  setTaskTitle: (value: string) => void
  setTaskDescription: (value: string) => void
  setTaskLabels: (value: string) => void
  setTaskIntakeState: (value: 'inbox' | 'ready') => void
  setSelectedWorkspaceId: (value: string) => void
  createTaskDirectly: () => void
  createTaskAfterNewWorkspace: (completion: WorktreeCreationCompletion) => void
  openNewWorkspaceForTask: () => void
  openExistingWorkspacePicker: () => void
} {
  const [taskTitle, setTaskTitle] = useState(modalData.localTaskDraft?.title ?? '')
  const [taskDescription, setTaskDescription] = useState(
    modalData.localTaskDraft?.description ?? ''
  )
  const [taskLabels, setTaskLabels] = useState((modalData.localTaskDraft?.labels ?? []).join(', '))
  const [taskIntakeState, setTaskIntakeState] = useState<'inbox' | 'ready'>(
    modalData.localTaskDraft?.intakeState ?? 'ready'
  )
  const normalizedLabels = useMemo(
    () =>
      [
        ...new Set(
          taskLabels
            .split(',')
            .map((label) => label.trim())
            .filter(Boolean)
        )
      ].slice(0, 20),
    [taskLabels]
  )
  const [taskError, setTaskError] = useState<string | null>(null)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const taskWorkspaces = useMemo(
    () =>
      (useAppStore.getState().allWorktrees?.() ?? []).filter(
        (workspace) => workspace.repoId === cardProps.repoId && !workspace.isArchived
      ),
    [cardProps.repoId]
  )

  useEffect(() => {
    if (
      creatingWorkspace ||
      taskWorkspaces.some((workspace) => workspace.id === selectedWorkspaceId)
    ) {
      return
    }
    const active = useAppStore.getState().activeWorktreeId
    const preferred = taskWorkspaces.find((workspace) => workspace.id === active)
    const main = taskWorkspaces.find((workspace) => workspace.isMainWorktree)
    setSelectedWorkspaceId(preferred?.id ?? main?.id ?? taskWorkspaces[0]?.id ?? 'local')
  }, [creatingWorkspace, selectedWorkspaceId, taskWorkspaces])

  const createTaskDirectly = useCallback((): void => {
    const description = taskDescription.trim()
    if (!description) {
      setTaskError('任务描述不能为空')
      return
    }
    const state = useAppStore.getState()
    const repoId = cardProps.repoId || modalData.initialRepoId || state.activeRepoId || 'local'
    const workspaceId = selectedWorkspaceId || 'local'
    const workspace =
      workspaceId === 'local'
        ? null
        : state.getKnownWorktreeById(workspaceId, state.activeWorkspaceExecutionHostId ?? undefined)
    void window.api.localTasks
      .create({
        projectId: workspace?.repoId ?? repoId,
        projectPath: workspace?.path ?? cardProps.selectedRepoPath ?? '',
        title: taskTitle.trim() || undefined,
        description,
        labels: normalizedLabels,
        intakeState: taskIntakeState,
        workspaceId,
        workspaceLabel: workspace
          ? `${workspace.displayName} · ${workspace.branch || `HEAD ${workspace.head.slice(0, 7)}`}`
          : 'local · 当前 HEAD'
      })
      .then(onClose)
      .catch((error: unknown) =>
        setTaskError(error instanceof Error ? error.message : '本地任务创建失败')
      )
  }, [
    cardProps.repoId,
    cardProps.selectedRepoPath,
    modalData.initialRepoId,
    onClose,
    selectedWorkspaceId,
    taskDescription,
    taskTitle,
    normalizedLabels,
    taskIntakeState
  ])

  const createTaskAfterNewWorkspace = useCallback(
    (completion: WorktreeCreationCompletion): void => {
      const description = taskDescription.trim()
      if (!description) {
        setTaskError('任务描述不能为空')
        return
      }
      const state = useAppStore.getState()
      const workspace = state.getKnownWorktreeById(
        completion.worktreeId,
        state.activeWorkspaceExecutionHostId ?? undefined
      )
      const sessionId = completion.primaryTabId ?? completion.startupTerminalTabId
      const sessionTab = sessionId
        ? state.tabsByWorktree[completion.worktreeId]?.find(
            (candidate) => candidate.id === sessionId
          )
        : null
      void window.api.localTasks
        .create({
          projectId: workspace?.repoId ?? modalData.initialRepoId ?? state.activeRepoId ?? 'local',
          projectPath: workspace?.path ?? cardProps.selectedRepoPath ?? '',
          title: taskTitle.trim() || undefined,
          description,
          labels: normalizedLabels,
          intakeState: taskIntakeState,
          workspaceId: completion.worktreeId,
          workspaceLabel: workspace
            ? `${workspace.displayName} · ${workspace.branch || `HEAD ${workspace.head.slice(0, 7)}`}`
            : '新建 workspace'
        })
        .then((task) => {
          if (!sessionTab?.launchAgent || !sessionId) {
            onClose()
            return
          }
          return window.api.localTasks
            .createSession({
              taskId: task.id,
              sessionId,
              title: `${sessionTab.launchAgent} 会话`,
              workspaceId: completion.worktreeId
            })
            .then(onClose)
        })
        .catch((error: unknown) =>
          setTaskError(error instanceof Error ? error.message : '本地任务创建失败')
        )
    },
    [
      cardProps.selectedRepoPath,
      modalData.initialRepoId,
      onClose,
      taskDescription,
      normalizedLabels,
      taskTitle,
      taskIntakeState
    ]
  )

  const openModalWithTaskDraft = useCallback(
    (workspaceMode: 'existing' | 'new'): void => {
      useAppStore.getState().openModal('new-workspace-composer', {
        localTaskMode: true,
        localTaskWorkspaceMode: workspaceMode,
        localTaskDraft: {
          title: taskTitle,
          description: taskDescription,
          labels: normalizedLabels,
          intakeState: taskIntakeState
        },
        ...(cardProps.repoId ? { initialRepoId: cardProps.repoId } : {}),
        telemetrySource: modalData.telemetrySource ?? 'sidebar'
      })
    },
    [
      cardProps.repoId,
      modalData.telemetrySource,
      normalizedLabels,
      taskDescription,
      taskIntakeState,
      taskTitle
    ]
  )

  return {
    taskTitle,
    taskDescription,
    taskLabels,
    taskIntakeState,
    taskError,
    taskWorkspaces,
    selectedWorkspaceId,
    setTaskTitle,
    setTaskDescription,
    setTaskLabels,
    setTaskIntakeState,
    setSelectedWorkspaceId,
    createTaskDirectly,
    createTaskAfterNewWorkspace,
    openNewWorkspaceForTask: () => openModalWithTaskDraft('new'),
    openExistingWorkspacePicker: () => openModalWithTaskDraft('existing')
  }
}
