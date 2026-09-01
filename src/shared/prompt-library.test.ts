import { describe, expect, it } from 'vitest'
import {
  MAX_PROMPT_LIBRARY_CATEGORIES,
  MAX_PROMPT_LIBRARY_CATEGORY_NAME_LENGTH,
  MAX_PROMPT_LIBRARY_CONTENT_LENGTH,
  MAX_PROMPT_LIBRARY_PROMPTS,
  MAX_PROMPT_LIBRARY_TITLE_LENGTH,
  deletePromptLibraryCategory,
  normalizePromptLibrary
} from './prompt-library'

describe('normalizePromptLibrary', () => {
  it('normalizes valid categories and prompts without losing their relationships', () => {
    expect(
      normalizePromptLibrary({
        categories: [{ id: ' review ', name: ' Code   Review ' }],
        prompts: [
          {
            id: ' prompt-1 ',
            title: ' Review   this ',
            content: 'Inspect the diff.  \n',
            categoryId: 'review',
            createdAt: 10.9,
            updatedAt: 12.4
          }
        ]
      })
    ).toEqual({
      categories: [{ id: 'review', name: 'Code Review' }],
      prompts: [
        {
          id: 'prompt-1',
          title: 'Review this',
          content: 'Inspect the diff.',
          categoryId: 'review',
          createdAt: 10,
          updatedAt: 12
        }
      ]
    })
  })

  it('drops invalid and duplicate rows while moving stale category references to uncategorized', () => {
    expect(
      normalizePromptLibrary({
        categories: [
          { id: 'one', name: 'Planning' },
          { id: 'two', name: ' planning ' },
          { id: 'one', name: 'Duplicate id' },
          { id: '', name: 'Missing id' },
          null
        ],
        prompts: [
          {
            id: 'valid',
            title: 'Valid',
            content: 'Body',
            categoryId: 'missing',
            createdAt: 1,
            updatedAt: 0
          },
          {
            id: 'valid',
            title: 'Duplicate',
            content: 'Body',
            categoryId: null,
            createdAt: 1,
            updatedAt: 1
          },
          { id: 'empty', title: 'Empty', content: '  ', createdAt: 1, updatedAt: 1 },
          { id: 'time', title: 'Bad time', content: 'Body', createdAt: -1, updatedAt: 1 }
        ]
      })
    ).toEqual({
      categories: [{ id: 'one', name: 'Planning' }],
      prompts: [
        {
          id: 'valid',
          title: 'Valid',
          content: 'Body',
          categoryId: null,
          createdAt: 1,
          updatedAt: 1
        }
      ]
    })
  })

  it('bounds collection sizes and text lengths', () => {
    const normalized = normalizePromptLibrary({
      categories: Array.from({ length: MAX_PROMPT_LIBRARY_CATEGORIES + 2 }, (_, index) => ({
        id: `category-${index}`,
        name: `${index}-${'n'.repeat(MAX_PROMPT_LIBRARY_CATEGORY_NAME_LENGTH + 10)}`
      })),
      prompts: Array.from({ length: MAX_PROMPT_LIBRARY_PROMPTS + 2 }, (_, index) => ({
        id: `prompt-${index}`,
        title: `${index}-${'t'.repeat(MAX_PROMPT_LIBRARY_TITLE_LENGTH + 10)}`,
        content: 'c'.repeat(MAX_PROMPT_LIBRARY_CONTENT_LENGTH + 10),
        categoryId: 'category-0',
        createdAt: index,
        updatedAt: index
      }))
    })

    expect(normalized.categories).toHaveLength(MAX_PROMPT_LIBRARY_CATEGORIES)
    expect(normalized.prompts).toHaveLength(MAX_PROMPT_LIBRARY_PROMPTS)
    expect(normalized.categories[0]?.name).toHaveLength(MAX_PROMPT_LIBRARY_CATEGORY_NAME_LENGTH)
    expect(normalized.prompts[0]?.title).toHaveLength(MAX_PROMPT_LIBRARY_TITLE_LENGTH)
    expect(normalized.prompts[0]?.content).toHaveLength(MAX_PROMPT_LIBRARY_CONTENT_LENGTH)
  })

  it('returns an isolated empty value for non-object input', () => {
    const first = normalizePromptLibrary(null)
    first.categories.push({ id: 'mutated', name: 'Mutated' })

    expect(normalizePromptLibrary(null)).toEqual({ categories: [], prompts: [] })
  })

  it('deletes a category without deleting its prompts', () => {
    const library = normalizePromptLibrary({
      categories: [
        { id: 'planning', name: 'Planning' },
        { id: 'review', name: 'Review' }
      ],
      prompts: [
        {
          id: 'prompt-1',
          title: 'Plan',
          content: 'Plan the work.',
          categoryId: 'planning',
          createdAt: 1,
          updatedAt: 2
        },
        {
          id: 'prompt-2',
          title: 'Review',
          content: 'Review the work.',
          categoryId: 'review',
          createdAt: 3,
          updatedAt: 4
        }
      ]
    })

    expect(deletePromptLibraryCategory(library, 'planning', 10)).toEqual({
      categories: [{ id: 'review', name: 'Review' }],
      prompts: [
        {
          id: 'prompt-1',
          title: 'Plan',
          content: 'Plan the work.',
          categoryId: null,
          createdAt: 1,
          updatedAt: 10
        },
        library.prompts[1]
      ]
    })
    expect(deletePromptLibraryCategory(library, 'missing', 10)).toBe(library)
  })
})
