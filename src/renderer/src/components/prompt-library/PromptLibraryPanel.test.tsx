// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  writeClipboardText: vi.fn(),
  updateSettingsOrThrow: vi.fn(),
  confirm: vi.fn()
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mocks.state)
}))

vi.mock('@/components/confirmation-dialog-context', () => ({
  useConfirmationDialog: () => mocks.confirm
}))

import { PromptLibraryPanel } from './PromptLibraryPanel'

function renderPanel(): ReturnType<typeof render> {
  return render(
    <TooltipProvider>
      <PromptLibraryPanel onClose={vi.fn()} />
    </TooltipProvider>
  )
}

beforeEach(() => {
  mocks.writeClipboardText.mockReset().mockResolvedValue(undefined)
  mocks.updateSettingsOrThrow.mockReset().mockResolvedValue(undefined)
  mocks.confirm.mockReset().mockResolvedValue(false)
  mocks.state = {
    settings: {
      promptLibrary: {
        categories: [
          { id: 'planning', name: 'Planning' },
          { id: 'review', name: 'Review' }
        ],
        prompts: [
          {
            id: 'plan',
            title: 'Draft plan',
            content: 'Break the work into concrete steps.',
            categoryId: 'planning',
            createdAt: 1,
            updatedAt: 1
          },
          {
            id: 'review',
            title: 'Review changes',
            content: 'Inspect every changed file.',
            categoryId: 'review',
            createdAt: 2,
            updatedAt: 2
          }
        ]
      }
    },
    updateSettingsOrThrow: mocks.updateSettingsOrThrow
  }
  ;(window as unknown as { api: unknown }).api = {
    ui: { writeClipboardText: mocks.writeClipboardText }
  }
})

afterEach(() => cleanup())

describe('PromptLibraryPanel', () => {
  it('searches prompt titles, content, and category names', () => {
    const view = renderPanel()
    const search = view.getByLabelText('Search prompts')

    fireEvent.change(search, { target: { value: 'concrete steps' } })
    expect(view.queryByText('Draft plan')).not.toBeNull()
    expect(view.queryByText('Review changes')).toBeNull()

    fireEvent.change(search, { target: { value: 'review' } })
    expect(view.queryByText('Draft plan')).toBeNull()
    expect(view.queryByText('Review changes')).not.toBeNull()
  })

  it('copies the complete prompt and shows transient success feedback', async () => {
    vi.useFakeTimers()
    try {
      const view = renderPanel()
      fireEvent.click(view.getAllByLabelText('Copy prompt')[0]!)

      await act(() => Promise.resolve())
      expect(mocks.writeClipboardText).toHaveBeenCalledWith('Inspect every changed file.')
      expect(view.queryByLabelText('Copied')).not.toBeNull()

      act(() => vi.advanceTimersByTime(1500))
      expect(view.queryByLabelText('Copied')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps prompt persistence out of search and category selection', async () => {
    const view = renderPanel()

    fireEvent.click(view.getByRole('button', { name: /Planning/ }))
    fireEvent.change(view.getByLabelText('Search prompts'), { target: { value: 'draft' } })

    await waitFor(() => expect(view.queryByText('Review changes')).toBeNull())
    expect(mocks.updateSettingsOrThrow).not.toHaveBeenCalled()
  })
})
