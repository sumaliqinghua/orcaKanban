import { MessageCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LocalTaskSessionDisclosure } from './LocalTaskSessionDisclosure'

export type LocalTaskSessionTurnView = {
  id: string
  prompt: string
  summary: string | null
  createdAt: number
  updatedAt: number
}

export function LocalTaskSessionTurnHistory({
  currentPrompt,
  turns,
  compact = false
}: {
  currentPrompt?: string | null
  turns?: LocalTaskSessionTurnView[]
  compact?: boolean
}): React.JSX.Element {
  const orderedTurns = (turns ?? []).toReversed()
  return (
    <section className={cn('space-y-2', compact ? 'text-[11px]' : 'text-xs')}>
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <MessageCircle className="size-3.5 text-muted-foreground" />
        会话历史
      </div>
      {currentPrompt ? (
        <LocalTaskSessionDisclosure title="最近请求" preview={currentPrompt}>
          <div className="whitespace-pre-wrap leading-relaxed text-foreground">{currentPrompt}</div>
        </LocalTaskSessionDisclosure>
      ) : null}
      {orderedTurns.length ? (
        <div className="space-y-1.5">
          {orderedTurns.map((turn, index) => (
            <LocalTaskSessionDisclosure
              key={turn.id}
              title={`第 ${orderedTurns.length - index} 轮问答`}
              preview={turn.prompt}
            >
              <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <MessageCircle className="size-3" />
                用户问题
              </div>
              <div className="whitespace-pre-wrap leading-relaxed text-foreground">
                {turn.prompt}
              </div>
              <div className="my-2 border-t border-border/60" />
              <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Sparkles className="size-3" />
                Agent 小结
              </div>
              <div className="max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed text-muted-foreground scrollbar-sleek">
                {turn.summary || '本轮没有保存小结。'}
              </div>
            </LocalTaskSessionDisclosure>
          ))}
        </div>
      ) : !currentPrompt ? (
        <div className="rounded-md border border-dashed border-border px-2.5 py-3 text-muted-foreground">
          还没有记录本轮会话内容。
        </div>
      ) : null}
    </section>
  )
}
