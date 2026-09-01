import { describe, expect, it } from 'vitest'
import type { PromptLibrary } from '../../../shared/prompt-library'
import { filterPromptLibraryPrompts } from './prompt-library-filter'

const library: PromptLibrary = {
  categories: [
    { id: 'planning', name: 'Project Planning' },
    { id: 'review', name: 'Code Review' }
  ],
  prompts: [
    {
      id: 'older',
      title: 'Draft plan',
      content: 'Break the work into steps.',
      categoryId: 'planning',
      createdAt: 1,
      updatedAt: 2
    },
    {
      id: 'newer',
      title: 'Review diff',
      content: 'Check all changed files.',
      categoryId: 'review',
      createdAt: 3,
      updatedAt: 5
    },
    {
      id: 'uncategorized',
      title: 'Explain',
      content: 'Explain this in plain language.',
      categoryId: null,
      createdAt: 4,
      updatedAt: 4
    }
  ]
}

describe('filterPromptLibraryPrompts', () => {
  it('sorts the full library by most recent update', () => {
    expect(filterPromptLibraryPrompts(library, '', undefined).map((prompt) => prompt.id)).toEqual([
      'newer',
      'uncategorized',
      'older'
    ])
  })

  it('combines one category filter with normalized text search', () => {
    expect(
      filterPromptLibraryPrompts(library, '  break\nTHE   work ', 'planning').map(
        (prompt) => prompt.id
      )
    ).toEqual(['older'])
    expect(filterPromptLibraryPrompts(library, 'review', 'planning')).toEqual([])
  })

  it('matches category names and uncategorized prompts', () => {
    expect(
      filterPromptLibraryPrompts(library, 'project planning', undefined).map((prompt) => prompt.id)
    ).toEqual(['older'])
    expect(filterPromptLibraryPrompts(library, '', null).map((prompt) => prompt.id)).toEqual([
      'uncategorized'
    ])
  })
})
