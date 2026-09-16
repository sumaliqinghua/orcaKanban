import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  localTaskRetryLabel,
  type LocalTaskSessionRetry
} from '../../../../shared/local-task-session-retry'

export function LocalTaskSessionRetryNotice({
  sessionId,
  retry
}: {
  sessionId: string
  retry: LocalTaskSessionRetry
}): React.JSX.Element {
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stop = async (): Promise<void> => {
    setStopping(true)
    try {
      await window.api.localTasks.stopSessionRetry(sessionId)
    } catch {
      setError('停止失败，请重试。')
    } finally {
      setStopping(false)
    }
  }
  return (
    <div className="space-y-1 border-t border-border px-2.5 py-2 text-xs" role="status">
      <p className={retry.phase === 'running' ? 'text-muted-foreground' : 'text-destructive'}>
        {localTaskRetryLabel(retry)}
      </p>
      {retry.nextRetryAt ? (
        <p className="text-muted-foreground">
          下次重试：{new Date(retry.nextRetryAt).toLocaleTimeString()}，向原会话发送“继续”。
        </p>
      ) : null}
      {retry.reason ? <p className="text-muted-foreground">{retry.reason}</p> : null}
      <details className="text-muted-foreground">
        <summary className="cursor-pointer">查看原始错误</summary>
        <p className="break-words whitespace-pre-wrap">{retry.message}</p>
      </details>
      {retry.phase === 'waiting' || retry.phase === 'sending' ? (
        <Button size="sm" variant="outline" disabled={stopping} onClick={() => void stop()}>
          停止自动重试
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
