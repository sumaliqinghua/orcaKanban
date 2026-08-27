// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  terminals: [] as { write: ReturnType<typeof vi.fn> }[],
  dataListeners: [] as ((payload: unknown) => void)[]
}))

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80
    rows = 24
    options = {}
    buffer = { active: { cursorY: 0 } }
    modes = { bracketedPasteMode: false }
    element = document.createElement('div')
    unicode = { activeVersion: '6', versions: ['6'], register: vi.fn() }
    write = vi.fn((_data: string, callback?: () => void) => callback?.())
    open = vi.fn()
    focus = vi.fn()
    dispose = vi.fn()
    resize = vi.fn()
    reset = vi.fn()
    input = vi.fn()
    onData = vi.fn(() => ({ dispose: vi.fn() }))
    attachCustomKeyEventHandler = vi.fn()
    loadAddon = vi.fn()

    constructor() {
      harness.terminals.push(this)
    }
  }
}))
vi.mock('@/store', () => {
  const state = { settings: null, keybindings: {} }
  const useAppStore = (selector: (value: typeof state) => unknown): unknown => selector(state)
  useAppStore.getState = (): typeof state => state
  return { useAppStore }
})
vi.mock('@/components/terminal-pane/use-system-prefers-dark', () => ({
  useSystemPrefersDark: () => false
}))
vi.mock('@/lib/keyboard-layout/use-effective-mac-option-as-alt', () => ({
  useEffectiveMacOptionAsAlt: () => 'false'
}))
vi.mock('@/components/terminal-pane/terminal-user-input-signal', () => ({
  subscribeToTerminalUserInput: () => ({ dispose: vi.fn() })
}))
vi.mock('./preview-grid-claim', () => ({
  createPreviewGridClaim: () => ({ schedule: vi.fn(), dispose: vi.fn() })
}))
vi.mock('./preview-terminal-compatibility', () => ({
  installPreviewTerminalCompatibility: () => vi.fn()
}))
vi.mock('./preview-terminal-ime-bridge', () => ({
  installPreviewImeBridge: () => ({ claimKeyEvent: () => false, dispose: vi.fn() })
}))
vi.mock('./preview-terminal-key-handler', () => ({
  installPreviewTerminalKeyHandler: () => vi.fn()
}))
vi.mock('./preview-terminal-app-menu-clipboard', () => ({
  installPreviewTerminalAppMenuClipboard: () => vi.fn()
}))
vi.mock('./preview-terminal-ligatures', () => ({ syncPreviewTerminalLigatures: vi.fn() }))

import { AgentTerminalPreview } from './AgentTerminalPreview'

describe('AgentTerminalPreview subscription isolation', () => {
  const connect = vi.fn(
    async (_ptyId: string, _opts?: { scrollbackRows?: number; previewId?: string }) => ({
      snapshot: { data: '', cols: 80, rows: 24, seq: 1 },
      replay: []
    })
  )
  const ack = vi.fn(async () => {})

  beforeEach(() => {
    harness.terminals.length = 0
    harness.dataListeners.length = 0
    Object.assign(window, {
      api: {
        terminalPreview: {
          connect,
          input: vi.fn(async () => true),
          fit: vi.fn(async () => ({ cols: 80, rows: 24 })),
          ack,
          unsubscribe: vi.fn(async () => {}),
          onData: (listener: (payload: unknown) => void) => {
            harness.dataListeners.push(listener)
            return vi.fn()
          }
        },
        ui: {
          onAppMenuPaste: () => vi.fn(),
          onAppMenuSelectionAction: () => vi.fn()
        }
      }
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('uses distinct identities for simultaneous previews of one pty', async () => {
    render(
      <>
        <AgentTerminalPreview ptyId="pty-1" />
        <AgentTerminalPreview ptyId="pty-1" />
      </>
    )

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(2))
    const previewIds = connect.mock.calls.map((call) => call[1]?.previewId as string)
    expect(new Set(previewIds).size).toBe(2)
  })

  it('ignores output addressed to another preview instance', async () => {
    render(<AgentTerminalPreview ptyId="pty-1" />)
    await waitFor(() => expect(harness.terminals).toHaveLength(1))
    const terminal = harness.terminals[0]!
    const previewId = connect.mock.calls[0]?.[1]?.previewId as string

    act(() => {
      harness.dataListeners[0]?.({
        type: 'data',
        ptyId: 'pty-1',
        previewId: 'another-preview',
        data: 'wrong',
        bytes: 5
      })
    })
    expect(terminal.write).not.toHaveBeenCalledWith('wrong', expect.any(Function))

    act(() => {
      harness.dataListeners[0]?.({
        type: 'data',
        ptyId: 'pty-1',
        previewId,
        data: 'right',
        bytes: 5
      })
    })
    expect(terminal.write).toHaveBeenCalledWith('right', expect.any(Function))
    expect(ack).toHaveBeenCalledWith('pty-1', 5, previewId)
  })
})
