export const MAX_PROMPT_LIBRARY_CATEGORIES = 100
export const MAX_PROMPT_LIBRARY_PROMPTS = 500
export const MAX_PROMPT_LIBRARY_ID_LENGTH = 80
export const MAX_PROMPT_LIBRARY_CATEGORY_NAME_LENGTH = 80
export const MAX_PROMPT_LIBRARY_TITLE_LENGTH = 120
export const MAX_PROMPT_LIBRARY_CONTENT_LENGTH = 20_000

export type PromptLibraryCategory = {
  id: string
  name: string
}

export type PromptLibraryPrompt = {
  id: string
  title: string
  content: string
  categoryId: string | null
  createdAt: number
  updatedAt: number
}

export type PromptLibrary = {
  categories: PromptLibraryCategory[]
  prompts: PromptLibraryPrompt[]
}

export const EMPTY_PROMPT_LIBRARY: PromptLibrary = {
  categories: [],
  prompts: []
}

function normalizeSingleLine(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized.length > 0 ? normalized.slice(0, maxLength) : null
}

function normalizeContent(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized.slice(0, MAX_PROMPT_LIBRARY_CONTENT_LENGTH) : null
}

function normalizeTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function normalizePromptLibrary(input: unknown): PromptLibrary {
  const record = asRecord(input)
  if (!record) {
    return { categories: [], prompts: [] }
  }

  const categories: PromptLibraryCategory[] = []
  const categoryIds = new Set<string>()
  const categoryNames = new Set<string>()
  const rawCategories = Array.isArray(record.categories) ? record.categories : []

  for (const value of rawCategories) {
    if (categories.length >= MAX_PROMPT_LIBRARY_CATEGORIES) {
      break
    }
    const category = asRecord(value)
    const id = normalizeSingleLine(category?.id, MAX_PROMPT_LIBRARY_ID_LENGTH)
    const name = normalizeSingleLine(category?.name, MAX_PROMPT_LIBRARY_CATEGORY_NAME_LENGTH)
    const nameKey = name?.toLowerCase()
    if (!id || !name || !nameKey || categoryIds.has(id) || categoryNames.has(nameKey)) {
      continue
    }
    categoryIds.add(id)
    categoryNames.add(nameKey)
    categories.push({ id, name })
  }

  const prompts: PromptLibraryPrompt[] = []
  const promptIds = new Set<string>()
  const rawPrompts = Array.isArray(record.prompts) ? record.prompts : []

  for (const value of rawPrompts) {
    if (prompts.length >= MAX_PROMPT_LIBRARY_PROMPTS) {
      break
    }
    const prompt = asRecord(value)
    const id = normalizeSingleLine(prompt?.id, MAX_PROMPT_LIBRARY_ID_LENGTH)
    const title = normalizeSingleLine(prompt?.title, MAX_PROMPT_LIBRARY_TITLE_LENGTH)
    const content = normalizeContent(prompt?.content)
    const createdAt = normalizeTimestamp(prompt?.createdAt)
    const updatedAt = normalizeTimestamp(prompt?.updatedAt)
    if (
      !id ||
      !title ||
      !content ||
      createdAt === null ||
      updatedAt === null ||
      promptIds.has(id)
    ) {
      continue
    }
    promptIds.add(id)
    const categoryId =
      typeof prompt?.categoryId === 'string' && categoryIds.has(prompt.categoryId)
        ? prompt.categoryId
        : null
    prompts.push({
      id,
      title,
      content,
      categoryId,
      createdAt,
      updatedAt: Math.max(createdAt, updatedAt)
    })
  }

  return { categories, prompts }
}

export function deletePromptLibraryCategory(
  library: PromptLibrary,
  categoryId: string,
  updatedAt: number
): PromptLibrary {
  if (!library.categories.some((category) => category.id === categoryId)) {
    return library
  }
  return normalizePromptLibrary({
    categories: library.categories.filter((category) => category.id !== categoryId),
    prompts: library.prompts.map((prompt) =>
      prompt.categoryId === categoryId
        ? { ...prompt, categoryId: null, updatedAt: Math.max(prompt.updatedAt, updatedAt) }
        : prompt
    )
  })
}
