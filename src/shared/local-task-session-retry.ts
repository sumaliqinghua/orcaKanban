export const LOCAL_TASK_RETRY_DELAYS_MS = [30_000, 120_000, 300_000] as const
export type LocalTaskFailureKind = 'rate_limit' | 'service_unavailable' | 'stream_disconnected'
export type LocalTaskSessionRetry = {
  kind: LocalTaskFailureKind
  message: string
  turnId: string
  failedAt: number
  attempts: number
  phase: 'waiting' | 'sending' | 'running' | 'stopped' | 'exhausted'
  nextRetryAt: number | null
  reason?: string
}

export function classifyLocalTaskFailure(error: string): LocalTaskFailureKind | null {
  const text = error.replace(/\s+/g, ' ').trim()
  if (/exceeded retry limit, last status: 429 Too Many Requests/i.test(text)) {
    return 'rate_limit'
  }
  if (
    /unexpected status 503 Service Unavailable: The service is busy\. Please retry later\./i.test(
      text
    )
  ) {
    return 'service_unavailable'
  }
  if (
    /stream disconnected before completion: The request could not be processed\. Please check the request parameters\./i.test(
      text
    )
  ) {
    return 'stream_disconnected'
  }
  return null
}

export function localTaskRetryLabel(retry: LocalTaskSessionRetry): string {
  const label = {
    rate_limit: '请求限流',
    service_unavailable: '服务暂不可用',
    stream_disconnected: '响应中断'
  }[retry.kind]
  if (retry.phase === 'running') {
    return `自动重试第 ${retry.attempts} 次进行中`
  }
  if (retry.phase === 'sending') {
    return `正在提交第 ${retry.attempts} 次重试`
  }
  if (retry.phase === 'waiting') {
    return `${label}，等待第 ${retry.attempts + 1} 次自动重试`
  }
  if (retry.phase === 'exhausted') {
    return `${label}，已达 3 次重试上限`
  }
  return `${label}，自动重试已停止`
}
