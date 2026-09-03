import type { LocalTask } from '../../../../shared/local-task-types'
import type { WorkItem } from './mock-data'
import { LocalTaskDetailAside } from './LocalTaskDetailAside'
import type { createLocalTaskCenterActions } from './local-task-center-actions'

type TaskActions = ReturnType<typeof createLocalTaskCenterActions>

export function LocalTaskCenterDetail({
  item,
  open,
  onOpenChange,
  onCompleteSubtask,
  taskActions,
  labelSuggestions,
  onTaskChanged
}: {
  item: WorkItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleteSubtask: (subtaskId: string) => void
  taskActions: TaskActions
  labelSuggestions: string[]
  onTaskChanged: (task: LocalTask) => void
}): React.JSX.Element {
  return (
    <LocalTaskDetailAside
      key={item.id}
      item={item}
      open={open}
      onOpenChange={onOpenChange}
      onCompleteSubtask={onCompleteSubtask}
      onEditTitle={taskActions.editTitle}
      onEditDescription={taskActions.editDescription}
      onEditLabels={taskActions.editLabels}
      labelSuggestions={labelSuggestions}
      onEditStep={taskActions.editStep}
      onOpenWorkspace={taskActions.openWorkspace}
      onSessionStarted={taskActions.sessionStarted}
      onReportSessionStarted={taskActions.reportSessionStarted}
      onAccept={taskActions.acceptSelected}
      onArchive={taskActions.archiveSelected}
      onRestore={taskActions.restoreSelected}
      onDelete={taskActions.deleteSelected}
      onPromote={taskActions.promoteSelected}
      onMoveToInbox={taskActions.moveSelectedToInbox}
      onTaskChanged={onTaskChanged}
    />
  )
}
