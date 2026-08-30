import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { QuickLaunchAgentMenuItems } from '@/components/tab-bar/QuickLaunchButton'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { useAppStore } from '@/store'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { WorkItem } from './mock-data'
import { buildTaskReportPrompt } from './local-task-report-prompt'

export function LocalTaskReportButton({
  item,
  onOpenSession,
  onStarted
}: {
  item: WorkItem
  onOpenSession: (sessionId: string) => void
  onStarted: (tabId: string, prompt: string, agent: TuiAgent) => void | Promise<void>
}): React.JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false)
  const activeWorktreeId = useAppStore((state) => state.activeWorktreeId)
  const worktreeId = item.workspaceId === 'local' ? activeWorktreeId : item.workspaceId
  const activeGroupId = useAppStore((state) =>
    worktreeId
      ? (state.activeGroupIdByWorktree[worktreeId] ?? state.groupsByWorktree[worktreeId]?.[0]?.id)
      : undefined
  )
  const existingReport = item.sessionsList.find(
    (session) => session.associationSource === 'task-report'
  )
  const prompt = buildTaskReportPrompt({
    id: item.id,
    title: item.title,
    description: item.description
  })

  const handleSelectAgent = (agent: TuiAgent): void => {
    if (!worktreeId) {
      return
    }
    const result = launchAgentInNewTab({
      agent,
      worktreeId,
      ...(activeGroupId ? { groupId: activeGroupId } : {}),
      prompt,
      promptDelivery: 'submit-after-ready',
      launchSource: 'task_page',
      localTaskId: item.id,
      localTaskRoot: item.projectPath
    })
    if (!result?.tabId) {
      return
    }
    setDialogOpen(false)
    void onStarted(result.tabId, prompt, agent)
  }

  if (existingReport?.id) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-[11px]"
        onClick={() => onOpenSession(existingReport.id!)}
      >
        <FileText className="size-3.5" />
        打开任务报告
      </Button>
    )
  }

  return (
    <DropdownMenu open={dialogOpen} onOpenChange={setDialogOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px]">
          <FileText className="size-3.5" />
          生成任务报告
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>选择生成报告的 Agent</DropdownMenuLabel>
        {worktreeId ? (
          <QuickLaunchAgentMenuItems
            worktreeId={worktreeId}
            groupId={activeGroupId}
            onFocusTerminal={() => {}}
            onSelectAgent={handleSelectAgent}
          />
        ) : (
          <div className="px-2 py-2 text-xs text-muted-foreground">当前任务没有可用 workspace</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
