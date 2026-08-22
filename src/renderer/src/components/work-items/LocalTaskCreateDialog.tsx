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
  onCreated
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (item: WorkItem) => void
}): React.JSX.Element | null {
  const [title, setTitle] = useState('')
  if (!open) {
    return null
  }
  const create = (): void => {
    const description = title.trim()
    if (!description) {
      return
    }
    void window.api.localTasks
      .create({
        projectId: 'local',
        description,
        workspaceId: 'local',
        workspaceLabel: 'local · 当前 HEAD'
      })
      .then((task: LocalTask) => {
        onCreated(localTaskToViewModel(task))
        setTitle('')
        onOpenChange(false)
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
          placeholder="输入任务需求，第一行作为初始标题"
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className="mt-3 min-h-24 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="任务描述（可选）"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
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
