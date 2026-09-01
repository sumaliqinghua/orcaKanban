import type { PromptLibrary, PromptLibraryPrompt } from '../../../shared/prompt-library'

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function filterPromptLibraryPrompts(
  library: PromptLibrary,
  rawQuery: string,
  categoryId: string | null | undefined
): PromptLibraryPrompt[] {
  const query = normalizeSearchText(rawQuery)
  const categoryNames = new Map(
    library.categories.map((category) => [category.id, normalizeSearchText(category.name)])
  )

  return library.prompts
    .filter((prompt) => {
      if (categoryId !== undefined && prompt.categoryId !== categoryId) {
        return false
      }
      if (!query) {
        return true
      }
      return [prompt.title, prompt.content, categoryNames.get(prompt.categoryId ?? '') ?? ''].some(
        (value) => normalizeSearchText(value).includes(query)
      )
    })
    .sort(
      (left, right) =>
        right.updatedAt - left.updatedAt ||
        right.createdAt - left.createdAt ||
        left.id.localeCompare(right.id)
    )
}
