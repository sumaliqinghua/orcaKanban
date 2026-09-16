import type { NativeChatTurnLifecycle } from '../../shared/native-chat-types'
import type { LocalTaskSessionRetry } from '../../shared/local-task-session-retry'
import {
  classifyLocalTaskFailure,
  LOCAL_TASK_RETRY_DELAYS_MS
} from '../../shared/local-task-session-retry'

type RetryControllerDependencies = {
  read: () => LocalTaskSessionRetry | null
  save: (retry: LocalTaskSessionRetry | null, working: boolean) => void
  eligible: () => boolean
  send: (
    turn: NativeChatTurnLifecycle,
    beforeWrite: () => void,
    signal: AbortSignal
  ) => Promise<void>
}

export class LocalTaskSessionRetryController {
  private timer: ReturnType<typeof setTimeout> | null = null
  private abort: AbortController | null = null
  private latest: NativeChatTurnLifecycle | undefined
  private closed = false
  private generation = 0
  private autoTurn = false

  constructor(private readonly deps: RetryControllerDependencies) {}

  observe(lifecycle: NativeChatTurnLifecycle, initial = false): void {
    if (this.closed) {
      return
    }
    if (
      this.latest?.turnId === lifecycle.turnId &&
      this.latest.state === lifecycle.state &&
      this.latest.error === lifecycle.error
    ) {
      return
    }
    const prior = this.deps.read()
    const continuingAuto = this.autoTurn || prior?.phase === 'running'
    this.latest = lifecycle
    this.clearTimer()
    this.generation++
    if (lifecycle.state === 'working') {
      if (continuingAuto && prior) {
        this.deps.save({ ...prior, phase: 'running', nextRetryAt: null }, true)
      } else {
        this.deps.save(null, true)
        this.abort?.abort()
      }
      return
    }
    this.autoTurn = false
    const kind = lifecycle.error ? classifyLocalTaskFailure(lifecycle.error) : null
    if (!kind) {
      this.deps.save(null, false)
      this.abort?.abort()
      return
    }
    const attempts = continuingAuto ? (prior?.attempts ?? 0) : 0
    const repeated = prior?.turnId === lifecycle.turnId
    const canRetry = !initial && !repeated && lifecycle.timestamp !== null && this.deps.eligible()
    const delay = LOCAL_TASK_RETRY_DELAYS_MS[attempts]
    const retry: LocalTaskSessionRetry = {
      kind,
      message: lifecycle.error!,
      turnId: lifecycle.turnId,
      failedAt: lifecycle.timestamp ?? Date.now(),
      attempts,
      phase: canRetry ? (delay === undefined ? 'exhausted' : 'waiting') : 'stopped',
      nextRetryAt: canRetry && delay !== undefined ? Date.now() + delay : null,
      ...(!canRetry
        ? {
            reason: initial
              ? '历史失败仅展示；手动继续后会监测新的失败。'
              : '当前会话不可自动继续。'
          }
        : {})
    }
    this.deps.save(repeated ? { ...prior!, phase: 'stopped', nextRetryAt: null } : retry, false)
    if (retry.phase === 'waiting') {
      this.timer = setTimeout(() => void this.retry(), delay)
      this.timer.unref?.()
    }
  }

  stop(reason = '已停止本次失败的自动重试。'): void {
    this.clearTimer()
    this.generation++
    this.autoTurn = false
    this.abort?.abort()
    const retry = this.deps.read()
    if (retry) {
      this.deps.save({ ...retry, phase: 'stopped', nextRetryAt: null, reason }, false)
    }
  }

  dispose(): void {
    this.closed = true
    this.clearTimer()
    this.abort?.abort()
    this.generation++
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.timer = null
  }

  private async retry(): Promise<void> {
    this.timer = null
    const retry = this.deps.read()
    const turn = this.latest
    if (!retry || retry.phase !== 'waiting' || !turn || !this.deps.eligible()) {
      this.stop('任务已结束、页签已关闭或会话身份已变化。')
      return
    }
    const generation = this.generation
    const abort = new AbortController()
    this.abort = abort
    this.autoTurn = true
    this.deps.save(
      { ...retry, attempts: retry.attempts + 1, phase: 'sending', nextRetryAt: null },
      false
    )
    const assertCurrent = (): void => {
      if (
        this.closed ||
        generation !== this.generation ||
        !this.deps.eligible() ||
        abort.signal.aborted
      ) {
        throw new Error('重试已取消或原会话已开始新一轮。')
      }
    }
    try {
      await this.deps.send(turn, assertCurrent, abort.signal)
      if (generation !== this.generation) {
        return
      }
      const sent = this.deps.read()
      if (!sent) {
        return
      }
      this.deps.save({ ...sent, phase: 'running' }, true)
      this.timer = setTimeout(() => {
        if (generation === this.generation) {
          this.stop('已提交继续，但未观察到新一轮；请打开原会话确认。')
        }
      }, 30_000)
      this.timer.unref?.()
    } catch {
      if (generation === this.generation) {
        this.stop('未能确认继续是否提交成功；请检查原会话，避免重复发送。')
      }
    }
  }
}
