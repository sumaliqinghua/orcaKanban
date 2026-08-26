import { MessageCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

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
        <div className="rounded-md border border-sky-500/25 bg-sky-500/10 p-2.5">
          <div className="mb-1 text-[10px] font-medium text-sky-700 dark:text-sky-300">
            当前正在解决
          </div>
          <div className="whitespace-pre-wrap leading-relaxed text-foreground">{currentPrompt}</div>
        </div>
      ) : null}
      {orderedTurns.length ? (
        <div className="space-y-1.5">
          {orderedTurns.map((turn) => (
            <div key={turn.id} className="rounded-md border border-border/70 bg-muted/20 p-2.5">
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
            </div>
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
