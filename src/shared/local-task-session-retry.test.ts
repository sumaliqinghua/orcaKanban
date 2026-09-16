import { describe, expect, it } from 'vitest'
import {
  classifyLocalTaskFailure,
  LOCAL_TASK_RETRY_DELAYS_MS,
  localTaskRetryLabel
} from './local-task-session-retry'

describe('local task session retry classification', () => {
  it('recognizes only the three approved provider failures', () => {
    expect(
      classifyLocalTaskFailure('exceeded retry limit, last status: 429 Too Many Requests')
    ).toBe('rate_limit')
    expect(
      classifyLocalTaskFailure(
        'unexpected status 503 Service Unavailable: The service is busy. Please retry later.'
      )
    ).toBe('service_unavailable')
    expect(
      classifyLocalTaskFailure(
        'stream disconnected before completion: The request could not be processed. Please check the request parameters.'
      )
    ).toBe('stream_disconnected')
    expect(classifyLocalTaskFailure('tool failed: permission denied')).toBeNull()
  })

  it('uses bounded backoff and exposes the state in plain language', () => {
    expect(LOCAL_TASK_RETRY_DELAYS_MS).toEqual([30_000, 120_000, 300_000])
    expect(
      localTaskRetryLabel({
        kind: 'rate_limit',
        message: '429',
        turnId: 'turn-1',
        failedAt: 1,
        attempts: 1,
        phase: 'waiting',
        nextRetryAt: 2
      })
    ).toContain('请求限流')
    expect(
      localTaskRetryLabel({
        kind: 'stream_disconnected',
        message: 'disconnect',
        turnId: 'turn-1',
        failedAt: 1,
        attempts: 3,
        phase: 'exhausted',
        nextRetryAt: null
      })
    ).toContain('3 次重试上限')
  })
})
