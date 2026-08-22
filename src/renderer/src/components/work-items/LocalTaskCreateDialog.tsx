import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { LocalTask } from '../../../../shared/local-task-types'
import { localTaskToViewModel } from './local-task-view-model'
import type { WorkItem } from './mock-data'

export function LocalTaskCreateDialog({
  open,
  onOpenChange,
  onCreated,
  projectId = 'local',
  workspaceId = 'local',
  workspaceLabel = 'local · 当前 HEAD'
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (item: WorkItem) => void
  projectId?: string
  workspaceId?: string
  workspaceLabel?: string
}): React.JSX.Element | null {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!open) {
    return null
  }
  const create = (): void => {
    const normalizedTitle = title.trim()
    const normalizedDescription = description.trim() || normalizedTitle
    if (!normalizedDescription) {
      setError('请填写任务描述')
      return
    }
    setError(null)
    void window.api.localTasks
      .create({
        projectId,
        title: normalizedTitle || undefined,
        description: normalizedDescription,
        workspaceId,
        workspaceLabel
      })
      .then((task: LocalTask) => {
        onCreated(localTaskToViewModel(task))
        setTitle('')
        setDescription('')
        onOpenChange(false)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : '本地任务创建失败')
      })
  }
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl">
        <div className="flex items-center">
          <h2 className="text-sm font-semibold">新建本地任务</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          创建时绑定 local + 当前 HEAD；切换 In progress 后自动创建会话。
        </p>
        <Input
          className="mt-4"
          placeholder="标题（可留空，使用描述第一行）"
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className="mt-3 min-h-24 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="任务描述（可选）"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" onClick={create}>
            创建本地任务
          </Button>
        </div>
      </div>
    </div>
  )
}
