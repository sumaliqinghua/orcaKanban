import { useAppStore } from '@/store'
import type { Worktree } from '../../../../shared/worktree/types'
import { parseWorkspaceKey } from '../../../../shared/workspace-scope'

export function openLocalTaskComposer(
  projectId: string,
  workspace?: Pick<Worktree, 'id' | 'repoId' | 'hostId'>
): void {
  const state = useAppStore.getState()
  const scope = workspace ? parseWorkspaceKey(workspace.id) : null
  const folder =
    scope?.type === 'folder'
      ? state.folderWorkspaces.find((item) => item.id === scope.folderWorkspaceId)
      : null
  state.openWorkItemsPage()
  state.openModal('new-workspace-composer', {
    localTaskMode: true,
    localTaskWorkspaceMode: 'existing',
    localTaskDraft: {
      title: '',
      description: '',
      intakeState: 'ready',
      clarificationRequested: false
    },
    ...(projectId !== 'local' ? { initialRepoId: projectId } : {}),
    ...(folder ? { initialProjectGroupId: folder.projectGroupId } : {}),
    ...(workspace
      ? { initialTaskWorkspaceId: workspace.id, initialTaskWorkspaceHostId: workspace.hostId }
      : {}),
    telemetrySource: 'sidebar'
  })
}
