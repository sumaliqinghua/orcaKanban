// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PromptLibraryCategoryDialog } from './PromptLibraryCategoryDialog'
import { PromptLibraryPromptDialog } from './PromptLibraryPromptDialog'

afterEach(() => cleanup())

describe('prompt library dialogs', () => {
  it('blocks an empty prompt until both required fields have values', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const view = render(
      <PromptLibraryPromptDialog
        open
        prompt={null}
        defaultCategoryId={null}
        categories={[]}
        onOpenChange={vi.fn()}
        onSave={onSave}
      />
    )
    const save = view.getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)

    fireEvent.change(view.getByLabelText('Title'), { target: { value: 'Explain' } })
    fireEvent.change(view.getByLabelText('Prompt'), { target: { value: 'Explain this clearly.' } })
    expect(save.disabled).toBe(false)
  })

  it('blocks category names that differ only by case and whitespace', () => {
    const view = render(
      <PromptLibraryCategoryDialog
        open
        initialName=""
        existingNames={['Code Review']}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    )

    fireEvent.change(view.getByLabelText('Name'), { target: { value: ' code   review ' } })

    expect(view.queryByText('A category with this name exists.')).not.toBeNull()
    expect((view.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
