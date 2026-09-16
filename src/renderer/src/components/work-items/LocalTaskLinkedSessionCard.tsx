import { ArrowUpRight, Bot, ChevronDown, PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { WorkItem } from './mock-data'
import { LocalTaskSessionTurnHistory } from './LocalTaskSessionTurnHistory'
import { LocalTaskSessionRetryNotice } from './LocalTaskSessionRetryNotice'

export function LocalTaskLinkedSessionCard({
  session,
  historyExpanded,
  onOpenSession,
  onOpenWorkspace,
  onHistoryToggle
}: {
  session: WorkItem['sessionsList'][number]
  historyExpanded: boolean
  onOpenSession: (sessionId: string) => void
  onOpenWorkspace: (sessionId: string) => void
  onHistoryToggle: () => void
}): React.JSX.Element {
  const sessionId = session.id ?? session.title
  return (
    <div className="rounded-md border border-border/70">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onOpenSession(sessionId)}
          aria-label={`侧边预览会话：${session.title}`}
          className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left hover:bg-accent"
        >
          <Bot className="size-3.5 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-[11px]">{session.title}</span>
          <span className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
            {session.associationSource === 'automation'
              ? '自动化'
              : session.associationSource === 'clarification'
                ? '任务澄清'
                : session.associationSource === 'task-report'
                  ? '任务报告'
                  : '手动'}
          </span>
          <span
            role="img"
            aria-label={
              session.livenessUnverifiable
                ? '会话状态无法确认'
                : session.status === 'working'
                  ? '会话运行中'
                  : session.status === 'done'
                    ? '会话已结束'
                    : '会话空闲'
            }
            className={cn(
              'size-1.5 rounded-full',
              session.status === 'working'
                ? 'bg-sky-500'
                : session.status === 'done'
                  ? 'bg-emerald-500'
                  : 'bg-muted-foreground/40'
            )}
          />
          <span className="text-[10px] text-muted-foreground">{session.time}</span>
          <PanelRight className="size-3 text-muted-foreground" />
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`打开会话标签页：${session.title}`}
              onClick={() => onOpenWorkspace(sessionId)}
            >
              <ArrowUpRight className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>打开会话标签页</TooltipContent>
        </Tooltip>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="mr-1 size-6"
          aria-label={historyExpanded ? '收起会话历史' : '展开会话历史'}
          onClick={onHistoryToggle}
        >
          <ChevronDown
            className={cn('size-3.5 transition-transform', historyExpanded && 'rotate-180')}
          />
        </Button>
      </div>
      {session.retry ? (
        <LocalTaskSessionRetryNotice sessionId={sessionId} retry={session.retry} />
      ) : null}
      {session.currentPrompt ? (
        <div className="border-t border-border/50 px-2.5 py-1.5 text-[10px] leading-relaxed text-muted-foreground line-clamp-2">
          当前：{session.currentPrompt}
        </div>
      ) : null}
      {historyExpanded ? (
        <div className="border-t border-border/60 p-2">
          <LocalTaskSessionTurnHistory
            currentPrompt={session.currentPrompt}
            turns={session.turns}
            compact
          />
        </div>
      ) : null}
    </div>
  )
}
