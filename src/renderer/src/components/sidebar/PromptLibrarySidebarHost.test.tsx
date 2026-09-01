// @vitest-environment happy-dom

import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import PromptLibrarySidebarHost from './PromptLibrarySidebarHost'

vi.mock('@/components/prompt-library/PromptLibraryDrawer', () => ({
  PromptLibraryDrawer: () => null
}))

const initialState = useAppStore.getInitialState()

beforeEach(() => {
  useAppStore.setState({ promptLibraryDrawerOpen: false, agentDashboardDrawerOpen: false }, false)
})

afterEach(() => {
  cleanup()
  useAppStore.setState(initialState, true)
})

describe('PromptLibrarySidebarHost', () => {
  it('closes the prompt library when the workspace board opens', async () => {
    useAppStore.setState({ promptLibraryDrawerOpen: true })
    render(
      <PromptLibrarySidebarHost
        sidebarOpen
        workspaceBoardOpen
        closeWorkspaceBoard={vi.fn()}
        statusBarVisible
      />
    )

    await waitFor(() => expect(useAppStore.getState().promptLibraryDrawerOpen).toBe(false))
  })

  it('closes the other companion panels when the prompt library opens', async () => {
    const closeWorkspaceBoard = vi.fn()
    useAppStore.setState({ agentDashboardDrawerOpen: true })
    const view = render(
      <PromptLibrarySidebarHost
        sidebarOpen
        workspaceBoardOpen={false}
        closeWorkspaceBoard={closeWorkspaceBoard}
        statusBarVisible
      />
    )

    act(() => useAppStore.setState({ promptLibraryDrawerOpen: true }))
    view.rerender(
      <PromptLibrarySidebarHost
        sidebarOpen
        workspaceBoardOpen={false}
        closeWorkspaceBoard={closeWorkspaceBoard}
        statusBarVisible
      />
    )

    await waitFor(() => expect(closeWorkspaceBoard).toHaveBeenCalledOnce())
    expect(useAppStore.getState().agentDashboardDrawerOpen).toBe(false)
  })

  it('clears an open prompt library when the sidebar closes', async () => {
    useAppStore.setState({ promptLibraryDrawerOpen: true })
    render(
      <PromptLibrarySidebarHost
        sidebarOpen={false}
        workspaceBoardOpen={false}
        closeWorkspaceBoard={vi.fn()}
        statusBarVisible
      />
    )

    await waitFor(() => expect(useAppStore.getState().promptLibraryDrawerOpen).toBe(false))
  })
})
