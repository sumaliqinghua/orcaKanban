import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { folderWorkspaceToWorktree } from '../../../shared/folder-workspace-worktree'
import { getProjectGroupIdFromNewWorkspaceOptionId } from '@/lib/new-workspace-project-options'
import type { ComposerCardProps } from './useComposerState'

export function useLocalTaskWorkspaceSelection(
  cardProps: Pick<ComposerCardProps, 'repoId' | 'selectedProjectId'>,
  modalData: { initialRepoId?: string; initialTaskWorkspaceId?: string },
  creatingWorkspace: boolean
) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    modalData.initialTaskWorkspaceId ?? ''
  )
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const folderGroupId = getProjectGroupIdFromNewWorkspaceOptionId(cardProps.selectedProjectId ?? '')
  const taskProjectId = folderGroupId ? `folder-workspace:${folderGroupId}` : cardProps.repoId
  const taskWorkspaces = useMemo(
    () =>
      [
        ...Object.values(worktreesByRepo).flat(),
        ...folderWorkspaces.map(folderWorkspaceToWorktree)
      ].filter((workspace) => workspace.repoId === taskProjectId && !workspace.isArchived),
    [taskProjectId, worktreesByRepo, folderWorkspaces]
  )
  useEffect(() => {
    if (
      creatingWorkspace ||
      taskWorkspaces.some((workspace) => workspace.id === selectedWorkspaceId)
    ) {
      return
    }
    // 显式右键目标暂未加载或已移除时，不静默改绑当前活动工作区。
    if (
      selectedWorkspaceId === modalData.initialTaskWorkspaceId &&
      taskProjectId === modalData.initialRepoId
    ) {
      return
    }
    const active = useAppStore.getState().activeWorktreeId
    const preferred = taskWorkspaces.find((workspace) => workspace.id === active)
    const main = taskWorkspaces.find((workspace) => workspace.isMainWorktree)
    setSelectedWorkspaceId(preferred?.id ?? main?.id ?? taskWorkspaces[0]?.id ?? 'local')
  }, [
    creatingWorkspace,
    selectedWorkspaceId,
    taskWorkspaces,
    taskProjectId,
    modalData.initialRepoId,
    modalData.initialTaskWorkspaceId
  ])
  return { taskProjectId, taskWorkspaces, selectedWorkspaceId, setSelectedWorkspaceId }
}
