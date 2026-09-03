import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { LocalTask } from '../../../../shared/local-task-types'
import type { Subtask, WorkItem } from './mock-data'

export function LocalTaskSubtaskSessionSelect({
  subtask,
  sessions,
  projectPath,
  onTaskChanged
}: {
  subtask: Subtask
  sessions: WorkItem['sessionsList']
  projectPath?: string
  onTaskChanged: (task: LocalTask) => void
}): React.JSX.Element {
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const transfer = async (sessionId: string, force = false): Promise<void> => {
    try {
      const task = await window.api.localTasks.transferSubtask({
        subtaskId: subtask.id,
        sessionId,
        ...(projectPath ? { projectPath } : {}),
        ...(force ? { force: true } : {})
      })
      setError(null)
      setPendingSessionId(null)
      onTaskChanged(task)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (message.includes('force transfer requires confirmation')) {
        setPendingSessionId(sessionId)
        return
      }
      setError(message || '执行会话更换失败')
    }
  }
  return (
    <>
      <div className="flex min-w-0 flex-col items-end gap-0.5">
        <select
          value={subtask.sessionId ?? ''}
          onChange={(event) => void transfer(event.target.value)}
          className="h-6 max-w-40 rounded border border-input bg-background px-1.5 text-[10px] text-foreground"
          aria-label={`选择“${subtask.title}”的执行会话`}
        >
          {subtask.sessionId ? null : <option value="">未绑定会话</option>}
          {sessions.flatMap((session) =>
            session.id ? (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ) : (
              []
            )
          )}
        </select>
        {error ? (
          <span className="max-w-40 text-right text-[9px] text-destructive">{error}</span>
        ) : null}
      </div>
      <Dialog
        open={pendingSessionId !== null}
        onOpenChange={(open) => !open && setPendingSessionId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>更换执行会话</DialogTitle>
            <DialogDescription>
              原执行会话仍在运行。确认后子任务将移交给所选会话，原会话下次读取任务时会停止处理该子任务。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingSessionId(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (pendingSessionId) {
                  void transfer(pendingSessionId, true)
                }
              }}
            >
              确认移交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
