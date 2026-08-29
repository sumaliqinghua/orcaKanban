import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LocalTaskCenterHeader } from './LocalTaskCenterHeader'

export function LocalTaskCenterEmptyState({
  onCreate,
  onOpenWorkspaceBoard,
  projectFilter,
  projectOptions,
  onProjectChange
}: {
  onCreate: () => void
  onOpenWorkspaceBoard: () => void
  projectFilter: string
  projectOptions: readonly { id: string; label: string }[]
  onProjectChange: (projectId: string) => void
}): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <LocalTaskCenterHeader
        onCreate={onCreate}
        onOpenWorkspaceBoard={onOpenWorkspaceBoard}
        onRunAll={() => {}}
        runAllDisabled
        candidateCount={0}
        agentWorktreeId={null}
        projectFilter={projectFilter}
        projectOptions={projectOptions}
        onProjectChange={onProjectChange}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
        <p>还没有本地任务</p>
        <Button variant="outline" size="sm" onClick={onCreate}>
          <Plus className="size-3.5" />
          新建本地任务
        </Button>
      </div>
    </div>
  )
}
