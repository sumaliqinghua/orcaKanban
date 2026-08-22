import { Plus, Sparkles, TerminalSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LocalTaskCenterHeader({ onCreate }: { onCreate: () => void }): React.JSX.Element {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
          <Sparkles className="size-4" />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight">任务中心</h1>
          <p className="text-[11px] text-muted-foreground">把 AI 的并行工作变成可验收的研发目标</p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
          <TerminalSquare className="size-3.5" />
          Workspace 看板
        </Button>
        <Button variant="default" size="sm" className="gap-1.5 text-xs" onClick={onCreate}>
          <Plus className="size-3.5" />
          新建本地任务
        </Button>
      </div>
    </header>
  )
}
