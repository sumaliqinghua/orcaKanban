import type {
  AgentLaunchPreferences,
  RuntimeCreateAgentSessionRequest
} from '../../../shared/agent-session-host-authority'
import type { SessionOptionValue } from '../../../shared/native-chat-session-options'
import { createAgentSessionOperationId } from './agent-session-operation-id'
import { RuntimeRpcCallError } from './runtime-rpc-client'

const MAX_AMBIGUOUS_CREATE_ATTEMPTS = 2
const TRANSIENT_CREATE_RETRY_DELAYS_MS = [500, 1_000, 2_000] as const

export type AgentSessionCreateOperation = {
  readonly clientOperationId: string
  run<TResult>(invoke: (clientOperationId: string) => Promise<TResult>): Promise<TResult>
}

function isAmbiguousCreateFailure(error: unknown): boolean {
  // Why: an RPC failure proves the host answered; only transport loss leaves
  // creation unknown and is safe to replay under the same operation ID.
  return (
    !(error instanceof RuntimeRpcCallError) &&
    !(error instanceof Error && error.name === 'AbortError')
  )
}

function errorStatusCode(error: RuntimeRpcCallError): number | null {
  const data = error.response.error.data
  if (typeof data !== 'object' || data === null) {
    return null
  }
  const value =
    (data as { statusCode?: unknown; httpStatus?: unknown }).statusCode ??
    (data as { httpStatus?: unknown }).httpStatus
  return typeof value === 'number' ? value : null
}

export function isTransientAgentSessionCreateFailure(error: unknown): boolean {
  if (!(error instanceof RuntimeRpcCallError)) {
    return false
  }
  const statusCode = errorStatusCode(error)
  return (
    statusCode === 429 ||
    statusCode === 503 ||
    /(?:^|[^0-9])(429|503)(?:[^0-9]|$)/.test(`${error.code} ${error.message}`)
  )
}

export function createAgentSessionCreateOperation(
  options: {
    sleep?: (delayMs: number) => Promise<void>
    retryDelaysMs?: readonly number[]
  } = {}
): AgentSessionCreateOperation {
  const clientOperationId = createAgentSessionOperationId()
  const sleep =
    options.sleep ??
    ((delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)))
  const retryDelaysMs = options.retryDelaysMs ?? TRANSIENT_CREATE_RETRY_DELAYS_MS
  return {
    clientOperationId,
    async run(invoke) {
      let lastError: unknown
      let ambiguousAttempts = 0
      let transientAttempts = 0
      while (true) {
        try {
          return await invoke(clientOperationId)
        } catch (error) {
          lastError = error
          if (isTransientAgentSessionCreateFailure(error)) {
            const delay = retryDelaysMs[transientAttempts]
            if (delay === undefined) {
              throw lastError
            }
            transientAttempts += 1
            await sleep(delay)
            continue
          }
          if (
            isAmbiguousCreateFailure(error) &&
            ambiguousAttempts < MAX_AMBIGUOUS_CREATE_ATTEMPTS - 1
          ) {
            ambiguousAttempts += 1
            continue
          }
          throw error
        }
      }
    }
  }
}

export function toAgentLaunchPreferences(
  sessionOptions: Record<string, SessionOptionValue> | null | undefined
): AgentLaunchPreferences | undefined {
  if (!sessionOptions) {
    return undefined
  }
  const readString = (key: keyof AgentLaunchPreferences): string | undefined => {
    const value = sessionOptions[key]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }
  const model = readString('model')
  const effort = readString('effort')
  const mode = readString('mode')
  const preferences: AgentLaunchPreferences = {
    ...(model ? { model } : {}),
    ...(effort ? { effort } : {}),
    ...(mode ? { mode } : {})
  }
  return Object.keys(preferences).length > 0 ? preferences : undefined
}

export function withAgentSessionCreateOperationId(
  request: Omit<RuntimeCreateAgentSessionRequest, 'clientOperationId'>,
  clientOperationId: string
): RuntimeCreateAgentSessionRequest {
  return { ...request, clientOperationId }
}
