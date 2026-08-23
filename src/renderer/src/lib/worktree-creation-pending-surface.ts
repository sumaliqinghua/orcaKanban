import { useAppStore } from '@/store'
import type {
  WorktreeCreationPhase,
  WorktreeCreationRequest
} from '@/lib/pending-worktree-creation'
import { getWorktreeCreationIndeterminate } from '@/lib/worktree-creation-flow-startup'

export function isPendingCreationSurfaceVisible(creationId: string): boolean {
  const state = useAppStore.getState()
  return state.activeView === 'terminal' && state.activePendingCreationId === creationId
}

export function revealPendingCreation(
  creationId: string,
  request: WorktreeCreationRequest,
  phase: WorktreeCreationPhase
): void {
  const store = useAppStore.getState()
  store.beginPendingWorktreeCreation({
    creationId,
    phase,
    status: 'creating',
    startedAt: Date.now(),
    indeterminate: getWorktreeCreationIndeterminate(request),
    loaderVisible: true,
    request
  })
  store.setActiveView('terminal')
  store.setSidebarOpen(true)
}
