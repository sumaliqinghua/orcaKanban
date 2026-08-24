import { Input } from '@/components/ui/input'

export function LocalTaskWorkspaceFields({
  creatingWorkspace,
  title,
  description,
  labels,
  intakeState,
  error,
  onTitleChange,
  onDescriptionChange,
  onLabelsChange,
  onIntakeStateChange
}: {
  creatingWorkspace: boolean
  title: string
  description: string
  labels: string
  intakeState: 'inbox' | 'ready'
  error: string | null
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onLabelsChange: (value: string) => void
  onIntakeStateChange: (value: 'inbox' | 'ready') => void
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
      <Input
        value={labels}
        onChange={(event) => onLabelsChange(event.target.value)}
        placeholder="标签（可选，逗号分隔）"
        className="h-8 text-xs"
      />
      <label className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>任务进入</span>
        <select
          value={intakeState}
          onChange={(event) => onIntakeStateChange(event.target.value as 'inbox' | 'ready')}
          className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground"
        >
          <option value="ready">可执行任务</option>
          <option value="inbox">收件箱，稍后整理</option>
        </select>
      </label>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
