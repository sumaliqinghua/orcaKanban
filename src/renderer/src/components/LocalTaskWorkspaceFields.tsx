import { Input } from '@/components/ui/input'

export function LocalTaskWorkspaceFields({
  creatingWorkspace,
  title,
  description,
  error,
  onTitleChange,
  onDescriptionChange
}: {
  creatingWorkspace: boolean
  title: string
  description: string
  error: string | null
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
}): React.JSX.Element {
  return (
    <div className="shrink-0 space-y-2 border-b border-border/70 px-2 pb-3">
      <div className="text-xs font-semibold">本地任务</div>
      <p className="text-[11px] text-muted-foreground">
        {creatingWorkspace
          ? '任务已确认，下面创建并绑定新的 workspace。'
          : '选择已有 workspace，或选择新建；已有 workspace 可以是本地 HEAD。'}
      </p>
      <Input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="任务标题（可选）"
        className="h-8 text-xs"
      />
      <textarea
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="任务描述（必填，支持多行）"
        className="min-h-20 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
