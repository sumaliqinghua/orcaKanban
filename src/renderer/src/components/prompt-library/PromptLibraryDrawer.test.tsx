// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'

const mocks = vi.hoisted(() => ({
  renderCount: 0,
  blockingOverlay: false
}))

vi.mock('./PromptLibraryPanel', () => ({
  PromptLibraryPanel: () => {
    mocks.renderCount += 1
    return mocks.blockingOverlay ? <section role="dialog" data-state="open" /> : null
  }
}))

vi.mock('@/components/sidebar/use-workspace-kanban-outside-dismiss', () => ({
  useWorkspaceKanbanOutsideDismiss: () => undefined
}))

import { PromptLibraryDrawer } from './PromptLibraryDrawer'

const initialState = useAppStore.getInitialState()

beforeEach(() => {
  useAppStore.setState(
    { promptLibraryDrawerOpen: false, sidebarOpen: true, sidebarWidth: 320 },
    false
  )
  mocks.renderCount = 0
  mocks.blockingOverlay = false
})

afterEach(() => {
  cleanup()
  useAppStore.setState(initialState, true)
})

describe('PromptLibraryDrawer', () => {
  it('keeps the prompt library body unmounted while closed', () => {
    render(<PromptLibraryDrawer statusBarVisible />)
    expect(mocks.renderCount).toBe(0)

    act(() => useAppStore.setState({ promptLibraryDrawerOpen: true }))
    expect(mocks.renderCount).toBe(1)
  })

  it('lets a nested dialog handle Escape before closing the drawer', () => {
    mocks.blockingOverlay = true
    const view = render(<PromptLibraryDrawer statusBarVisible />)
    act(() => useAppStore.setState({ promptLibraryDrawerOpen: true }))

    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(useAppStore.getState().promptLibraryDrawerOpen).toBe(true)

    mocks.blockingOverlay = false
    view.rerender(<PromptLibraryDrawer statusBarVisible />)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(useAppStore.getState().promptLibraryDrawerOpen).toBe(false)
  })
})
