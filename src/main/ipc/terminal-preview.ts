import { ipcMain, type WebContents } from 'electron'
import type {
  TerminalPreviewConnectResult,
  TerminalPreviewSnapshot
} from '../../shared/terminal-preview'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { isDashboardPopoutRenderer } from '../window/dashboard-popout-window'
import { isTrustedUIRenderer } from './ui'
import {
  TERMINAL_PREVIEW_OUTPUT_BATCH_MAX_BYTES,
  TerminalPreviewOutputStream
} from './terminal-preview-output-stream'

const PREVIEW_ID_MAX_LENGTH = 4096
const PREVIEW_INSTANCE_ID_MAX_LENGTH = 256

function isValidPtyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= PREVIEW_ID_MAX_LENGTH
}

function isValidOptionalPreviewId(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    (typeof value === 'string' &&
      value.length > 0 &&
      value.length <= PREVIEW_INSTANCE_ID_MAX_LENGTH)
  )
}

function previewSubscriptionKey(ptyId: string, previewId?: string): string {
  return previewId ? `preview:${previewId}` : `pty:${ptyId}`
}

type TerminalPreviewFitClaim = {
  token: symbol
  ptyId: string
  viewerKey: string
}

// Why: the preview dialog has two hosts — the pop-out window and the main
// renderer's in-window overlay. The trusted UI renderer already has full PTY
// access through the regular terminal channels, so admitting it adds no reach.
function isTerminalPreviewRenderer(sender: WebContents): boolean {
  return isDashboardPopoutRenderer(sender) || isTrustedUIRenderer(sender)
}
/** Pop-out terminal transport with an atomic snapshot/live boundary. */
export function registerTerminalPreviewHandlers(runtime: OrcaRuntimeService): void {
  ipcMain.removeHandler('terminalPreview:connect')
  ipcMain.removeHandler('terminalPreview:unsubscribe')
  ipcMain.removeHandler('terminalPreview:input')
  ipcMain.removeHandler('terminalPreview:ack')
  ipcMain.removeHandler('terminalPreview:fit')

  const subscriptionsByContents = new Map<number, Map<string, TerminalPreviewOutputStream>>()
  // Why: the preview dialog claims the PTY grid through the remote-desktop
  // viewer registry so the main-window pane parks and later reclaims its own
  // geometry. Claims are tracked per viewer webContents so an explicit
  // unsubscribe or a destroyed window always releases the size floor.
  const fitClaimsByContents = new Map<number, Map<string, TerminalPreviewFitClaim>>()

  const previewViewerKey = (contentsId: number, previewId?: string): string =>
    previewId ? `dashboard-popout:${contentsId}:${previewId}` : `dashboard-popout:${contentsId}`

  const releaseFitClaim = (contentsId: number, subscriptionKey: string): void => {
    const claimed = fitClaimsByContents.get(contentsId)
    if (!claimed) {
      return
    }
    const claim = claimed.get(subscriptionKey)
    if (!claim || !claimed.delete(subscriptionKey)) {
      return
    }
    if (claimed.size === 0) {
      fitClaimsByContents.delete(contentsId)
    }
    void runtime.unregisterRemoteDesktopViewer(claim.ptyId, claim.viewerKey).catch(() => undefined)
  }

  const removeSubscription = (subscription: TerminalPreviewOutputStream): void => {
    const perPreview = subscriptionsByContents.get(subscription.contents.id)
    const key = previewSubscriptionKey(subscription.ptyId, subscription.previewId)
    if (perPreview?.get(key) === subscription) {
      perPreview.delete(key)
    }
  }

  const disposeContents = (contentsId: number): void => {
    const perPreview = subscriptionsByContents.get(contentsId)
    if (perPreview) {
      for (const subscription of perPreview.values()) {
        subscription.dispose()
      }
      subscriptionsByContents.delete(contentsId)
    }
    // Why: releasing one claim mutates this map while the remaining claims still need teardown.
    for (const subscriptionKey of fitClaimsByContents.get(contentsId)?.keys() ?? []) {
      releaseFitClaim(contentsId, subscriptionKey)
    }
  }

  const subscriptionsFor = (contents: WebContents): Map<string, TerminalPreviewOutputStream> => {
    let perPreview = subscriptionsByContents.get(contents.id)
    if (!perPreview) {
      perPreview = new Map()
      subscriptionsByContents.set(contents.id, perPreview)
      contents.once('destroyed', () => disposeContents(contents.id))
    }
    return perPreview
  }

  ipcMain.handle(
    'terminalPreview:connect',
    async (
      event,
      args: { ptyId?: unknown; opts?: { scrollbackRows?: unknown; previewId?: unknown } }
    ): Promise<TerminalPreviewConnectResult> => {
      if (
        !isTerminalPreviewRenderer(event.sender) ||
        !isValidPtyId(args?.ptyId) ||
        !isValidOptionalPreviewId(args.opts?.previewId)
      ) {
        return { snapshot: null, replay: [] }
      }
      const ptyId = args.ptyId
      const previewId = args.opts?.previewId
      const subscriptionKey = previewSubscriptionKey(ptyId, previewId)
      const perPreview = subscriptionsFor(event.sender)
      perPreview.get(subscriptionKey)?.dispose()

      const subscription = new TerminalPreviewOutputStream(
        event.sender,
        ptyId,
        runtime.registerRawTerminalViewSubscriber(ptyId),
        removeSubscription,
        previewId
      )
      const unsubscribeData = runtime.subscribeToTerminalData(ptyId, (data, meta) =>
        subscription.append(data, meta)
      )
      let previewSize = runtime.getTerminalSize(ptyId)
      // Why: any grid change (dialog fit landing, host reclaim, phone takeover)
      // invalidates bytes parsed at the old width — push a resync so the
      // renderer reconnects and repaints from a snapshot at the new grid.
      const unsubscribeResize = runtime.subscribeToTerminalResize(ptyId, (event) => {
        if (previewSize?.cols === event.cols && previewSize.rows === event.rows) {
          return
        }
        previewSize = { cols: event.cols, rows: event.rows }
        subscription.requestResync()
      })
      subscription.setDataSubscription(() => {
        unsubscribeData()
        unsubscribeResize()
      })
      perPreview.set(subscriptionKey, subscription)

      const requestedRows = args.opts?.scrollbackRows
      const scrollbackRows =
        typeof requestedRows === 'number' && Number.isFinite(requestedRows)
          ? Math.max(0, Math.min(1000, Math.floor(requestedRows)))
          : undefined
      let snapshot: TerminalPreviewSnapshot | null
      let resyncRequired = false
      try {
        snapshot = await runtime.serializeTerminalBuffer(ptyId, { scrollbackRows })
        if (subscription.consumeInitialOverflow() && !subscription.disposed) {
          snapshot = await runtime.serializeTerminalBuffer(ptyId, { scrollbackRows })
          if (subscription.consumeInitialOverflow()) {
            // Why: never replay a tail with a silently missing middle; the renderer keeps its old frame while reconnecting.
            resyncRequired = true
          }
        }
      } catch {
        subscription.dispose()
        return { snapshot: null, replay: [] }
      }
      if (subscription.disposed) {
        return { snapshot: null, replay: [] }
      }
      if (!snapshot) {
        // Why: a failed lookup has no future live boundary; release raw presence even if the renderer never invokes unsubscribe.
        subscription.dispose()
        return { snapshot: null, replay: [] }
      }
      previewSize = { cols: snapshot.cols, rows: snapshot.rows }

      const replay = subscription.completeSnapshot(snapshot.seq)
      if (resyncRequired) {
        // Why: no live writes may outlive this stream and acknowledge bytes against its replacement.
        subscription.pauseForReconnect()
      }
      return { snapshot, replay, ...(resyncRequired ? { resyncRequired: true } : {}) }
    }
  )

  ipcMain.handle(
    'terminalPreview:input',
    (event, args: { ptyId?: unknown; data?: unknown }): Promise<boolean> => {
      if (
        !isTerminalPreviewRenderer(event.sender) ||
        !isValidPtyId(args?.ptyId) ||
        typeof args.data !== 'string'
      ) {
        return Promise.resolve(false)
      }
      return runtime.writeTerminalPreviewInput(args.ptyId, args.data)
    }
  )

  ipcMain.handle(
    'terminalPreview:ack',
    (event, args: { ptyId?: unknown; bytes?: unknown; previewId?: unknown }): void => {
      if (
        !isTerminalPreviewRenderer(event.sender) ||
        !isValidPtyId(args?.ptyId) ||
        !isValidOptionalPreviewId(args.previewId) ||
        typeof args.bytes !== 'number' ||
        !Number.isFinite(args.bytes) ||
        args.bytes <= 0 ||
        args.bytes > TERMINAL_PREVIEW_OUTPUT_BATCH_MAX_BYTES
      ) {
        return
      }
      const subscription = subscriptionsByContents
        .get(event.sender.id)
        ?.get(previewSubscriptionKey(args.ptyId, args.previewId))
      if (subscription?.ptyId === args.ptyId) {
        subscription.acknowledge(args.bytes)
      }
    }
  )

  // Why: the dialog asks for a grid matching its own box; the PTY resizes to
  // it through the remote-desktop viewer registry (host pane parks, phone
  // still wins). Returns the size actually in effect so the renderer can keep
  // its scale-to-fit fallback when the claim did not land.
  ipcMain.handle(
    'terminalPreview:fit',
    async (
      event,
      args: { ptyId?: unknown; cols?: unknown; rows?: unknown; previewId?: unknown }
    ): Promise<{ cols: number; rows: number } | null> => {
      if (
        !isTerminalPreviewRenderer(event.sender) ||
        !isValidPtyId(args?.ptyId) ||
        !isValidOptionalPreviewId(args.previewId) ||
        typeof args.cols !== 'number' ||
        typeof args.rows !== 'number' ||
        !Number.isFinite(args.cols) ||
        !Number.isFinite(args.rows)
      ) {
        return null
      }
      const ptyId = args.ptyId
      const previewId = args.previewId
      const subscriptionKey = previewSubscriptionKey(ptyId, previewId)
      // Why: guarantees the destroyed hook exists even if this claim outlives
      // the current output stream across a resync reconnect.
      subscriptionsFor(event.sender)
      let claimed = fitClaimsByContents.get(event.sender.id)
      if (!claimed) {
        claimed = new Map()
        fitClaimsByContents.set(event.sender.id, claimed)
      }
      const claimToken = Symbol('terminal-preview-fit')
      const viewerKey = previewViewerKey(event.sender.id, previewId)
      claimed.set(subscriptionKey, { token: claimToken, ptyId, viewerKey })
      try {
        const applied = await runtime.updateRemoteDesktopViewer(
          ptyId,
          viewerKey,
          viewerKey,
          args.cols,
          args.rows
        )
        if (fitClaimsByContents.get(event.sender.id)?.get(subscriptionKey)?.token !== claimToken) {
          return null
        }
        if (!applied) {
          releaseFitClaim(event.sender.id, subscriptionKey)
          return null
        }
      } catch {
        if (fitClaimsByContents.get(event.sender.id)?.get(subscriptionKey)?.token === claimToken) {
          releaseFitClaim(event.sender.id, subscriptionKey)
        }
        return null
      }
      return runtime.getTerminalSize(ptyId)
    }
  )

  ipcMain.handle(
    'terminalPreview:unsubscribe',
    (event, args: { ptyId?: unknown; previewId?: unknown }): void => {
      if (
        !isTerminalPreviewRenderer(event.sender) ||
        !isValidPtyId(args?.ptyId) ||
        !isValidOptionalPreviewId(args.previewId)
      ) {
        return
      }
      const subscriptionKey = previewSubscriptionKey(args.ptyId, args.previewId)
      const subscription = subscriptionsByContents.get(event.sender.id)?.get(subscriptionKey)
      if (subscription?.ptyId === args.ptyId) {
        subscription.dispose()
      }
      const claim = fitClaimsByContents.get(event.sender.id)?.get(subscriptionKey)
      if (claim?.ptyId === args.ptyId) {
        releaseFitClaim(event.sender.id, subscriptionKey)
      }
    }
  )
}
