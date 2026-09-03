import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { launchAgentBackgroundSession } from '@/lib/launch-agent-background-session'
import { buildLocalTaskClarificationPrompt } from '@/components/work-items/local-task-clarification-prompt'
import type { TuiAgent } from '../../../shared/tui-agent'
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
    clarificationRequested?: boolean
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
  clarificationRequested: boolean
  taskError: string | null
  taskWorkspaces: Worktree[]
  selectedWorkspaceId: string
  setTaskTitle: (value: string) => void
  setTaskDescription: (value: string) => void
  setTaskLabels: (value: string) => void
  setTaskIntakeState: (value: 'inbox' | 'ready') => void
  setClarificationRequested: (value: boolean) => void
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
  const [clarificationRequested, setClarificationRequested] = useState(
    modalData.localTaskDraft?.clarificationRequested ?? false
  )
  const effectiveIntakeState = taskIntakeState === 'inbox' ? 'inbox' : 'ready'
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

  const startClarification = useCallback(
    async (task: Awaited<ReturnType<typeof window.api.localTasks.create>>): Promise<void> => {
      if (
        !task.clarificationRequested ||
        task.clarificationSessionId ||
        task.sessions.some((session) => session.associationSource === 'clarification')
      ) {
        return
      }
      const state = useAppStore.getState()
      const worktree =
        state.getKnownWorktreeById(task.workspaceId) ??
        state.allWorktrees?.().find((candidate) => candidate.path === task.projectPath)
      if (!worktree) {
        return
      }
      const configuredAgent = state.settings?.defaultTuiAgent
      const agent: TuiAgent =
        task.agentId ?? (configuredAgent && configuredAgent !== 'blank' ? configuredAgent : 'codex')
      const prompt = buildLocalTaskClarificationPrompt(task)
      const launch = await launchAgentBackgroundSession({
        agent,
        worktreeId: worktree.id,
        prompt,
        localTaskId: task.id,
        localTaskRoot: task.projectPath,
        launchSource: 'task_page',
        title: `任务澄清 · ${task.title}`
      })
      if (!launch) {
        return
      }
      await window.api.localTasks.createSession({
        taskId: task.id,
        projectPath: task.projectPath,
        sessionId: launch.tabId,
        workspaceId: worktree.id,
        title: `任务澄清 · ${task.title}`,
        currentPrompt: prompt,
        associationSource: 'clarification'
      })
    },
    []
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
        intakeState: effectiveIntakeState,
        clarificationRequested: effectiveIntakeState === 'inbox' && clarificationRequested,
        workspaceId,
        workspaceLabel: workspace
          ? `${workspace.displayName} · ${workspace.branch || `HEAD ${workspace.head.slice(0, 7)}`}`
          : 'local · 当前 HEAD'
      })
      .then((task) => startClarification(task).finally(onClose))
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
    effectiveIntakeState,
    clarificationRequested,
    startClarification
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
          intakeState: effectiveIntakeState,
          clarificationRequested: effectiveIntakeState === 'inbox' && clarificationRequested,
          workspaceId: completion.worktreeId,
          workspaceLabel: workspace
            ? `${workspace.displayName} · ${workspace.branch || `HEAD ${workspace.head.slice(0, 7)}`}`
            : '新建 workspace'
        })
        .then((task) => {
          if (task.clarificationRequested) {
            return startClarification(task).finally(onClose)
          }
          if (!sessionTab?.launchAgent || !sessionId) {
            onClose()
            return
          }
          return window.api.localTasks
            .createSession({
              taskId: task.id,
              projectPath: task.projectPath,
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
      effectiveIntakeState,
      clarificationRequested,
      startClarification
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
          intakeState: effectiveIntakeState,
          clarificationRequested
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
      effectiveIntakeState,
      clarificationRequested,
      taskTitle
    ]
  )

  return {
    taskTitle,
    taskDescription,
    taskLabels,
    taskIntakeState,
    clarificationRequested,
    taskError,
    taskWorkspaces,
    selectedWorkspaceId,
    setTaskTitle,
    setTaskDescription,
    setTaskLabels,
    setTaskIntakeState,
    setClarificationRequested,
    setSelectedWorkspaceId,
    createTaskDirectly,
    createTaskAfterNewWorkspace,
    openNewWorkspaceForTask: () => openModalWithTaskDraft('new'),
    openExistingWorkspacePicker: () => openModalWithTaskDraft('existing')
  }
}
