import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import { filterPromptLibraryPrompts } from '@/lib/prompt-library-filter'
import {
  MAX_PROMPT_LIBRARY_CATEGORIES,
  MAX_PROMPT_LIBRARY_PROMPTS,
  deletePromptLibraryCategory,
  normalizePromptLibrary,
  type PromptLibrary,
  type PromptLibraryCategory,
  type PromptLibraryPrompt
} from '../../../../shared/prompt-library'
import { PromptLibraryCategoryDialog } from './PromptLibraryCategoryDialog'
import { PromptLibraryCategorySidebar } from './PromptLibraryCategorySidebar'
import {
  PromptLibraryPromptDialog,
  type PromptLibraryPromptDraft
} from './PromptLibraryPromptDialog'
import { PromptLibraryPromptList } from './PromptLibraryPromptList'

type CategoryEditor = { category: PromptLibraryCategory | null } | null
type PromptEditor = { prompt: PromptLibraryPrompt | null } | null

function createLibraryId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function PromptLibraryPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const settingsLibrary = useAppStore((state) => state.settings?.promptLibrary)
  const updateSettingsOrThrow = useAppStore((state) => state.updateSettingsOrThrow)
  const library = useMemo(() => normalizePromptLibrary(settingsLibrary), [settingsLibrary])
  const [query, setQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | undefined>(undefined)
  const [categoryEditor, setCategoryEditor] = useState<CategoryEditor>(null)
  const [promptEditor, setPromptEditor] = useState<PromptEditor>(null)
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)
  const copiedTimerRef = useRef<number | null>(null)
  const confirm = useConfirmationDialog()

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (
      typeof selectedCategoryId === 'string' &&
      !library.categories.some((category) => category.id === selectedCategoryId)
    ) {
      setSelectedCategoryId(null)
    }
  }, [library.categories, selectedCategoryId])

  const visiblePrompts = useMemo(
    () => filterPromptLibraryPrompts(library, query, selectedCategoryId),
    [library, query, selectedCategoryId]
  )

  const persist = async (next: PromptLibrary): Promise<void> => {
    try {
      await updateSettingsOrThrow({ promptLibrary: normalizePromptLibrary(next) })
    } catch {
      toast.error(translate('promptLibrary.saveFailed', 'Could not save the prompt library.'))
      throw new Error('prompt_library_save_failed')
    }
  }

  const saveCategory = async (name: string): Promise<void> => {
    const editing = categoryEditor?.category ?? null
    if (!editing && library.categories.length >= MAX_PROMPT_LIBRARY_CATEGORIES) {
      toast.error(translate('promptLibrary.category.limit', 'Category limit reached.'))
      throw new Error('prompt_library_category_limit')
    }
    await persist({
      ...library,
      categories: editing
        ? library.categories.map((category) =>
            category.id === editing.id ? { ...category, name } : category
          )
        : [...library.categories, { id: createLibraryId('category'), name }]
    })
  }

  const deleteCategory = async (category: PromptLibraryCategory): Promise<void> => {
    const promptCount = library.prompts.filter((prompt) => prompt.categoryId === category.id).length
    const confirmed = await confirm({
      title: translate('promptLibrary.category.deleteTitle', 'Delete "{{value0}}"?', {
        value0: category.name
      }),
      description: translate(
        'promptLibrary.category.deleteDescription',
        '{{value0}} prompts will move to Uncategorized.',
        { value0: promptCount }
      ),
      confirmLabel: translate('promptLibrary.delete', 'Delete'),
      confirmVariant: 'destructive'
    })
    if (confirmed) {
      await persist(deletePromptLibraryCategory(library, category.id, Date.now()))
    }
  }

  const savePrompt = async (draft: PromptLibraryPromptDraft): Promise<void> => {
    const editing = promptEditor?.prompt ?? null
    if (!editing && library.prompts.length >= MAX_PROMPT_LIBRARY_PROMPTS) {
      toast.error(translate('promptLibrary.prompt.limit', 'Prompt limit reached.'))
      throw new Error('prompt_library_prompt_limit')
    }
    const now = Date.now()
    const nextPrompt: PromptLibraryPrompt = editing
      ? { ...editing, ...draft, updatedAt: now }
      : {
          id: createLibraryId('prompt'),
          ...draft,
          createdAt: now,
          updatedAt: now
        }
    await persist({
      ...library,
      prompts: editing
        ? library.prompts.map((prompt) => (prompt.id === editing.id ? nextPrompt : prompt))
        : [...library.prompts, nextPrompt]
    })
  }

  const deletePrompt = async (prompt: PromptLibraryPrompt): Promise<void> => {
    const confirmed = await confirm({
      title: translate('promptLibrary.prompt.deleteTitle', 'Delete "{{value0}}"?', {
        value0: prompt.title
      }),
      description: translate(
        'promptLibrary.prompt.deleteDescription',
        'This prompt will be permanently removed.'
      ),
      confirmLabel: translate('promptLibrary.delete', 'Delete'),
      confirmVariant: 'destructive'
    })
    if (confirmed) {
      await persist({
        ...library,
        prompts: library.prompts.filter((candidate) => candidate.id !== prompt.id)
      })
    }
  }

  const copyPrompt = async (prompt: PromptLibraryPrompt): Promise<void> => {
    try {
      await window.api.ui.writeClipboardText(prompt.content)
      setCopiedPromptId(prompt.id)
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current)
      }
      copiedTimerRef.current = window.setTimeout(() => {
        copiedTimerRef.current = null
        setCopiedPromptId(null)
      }, 1500)
    } catch {
      toast.error(translate('promptLibrary.copy.failed', 'Could not copy the prompt.'))
    }
  }

  const defaultCategoryId = selectedCategoryId === undefined ? null : selectedCategoryId
  const editingCategory = categoryEditor?.category ?? null

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">
            {translate('promptLibrary.title', 'Prompt Library')}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {translate('promptLibrary.promptCount', '{{value0}} prompts', {
              value0: library.prompts.length
            })}
          </p>
        </div>
        <Button type="button" size="xs" onClick={() => setPromptEditor({ prompt: null })}>
          <Plus />
          {translate('promptLibrary.prompt.addTitle', 'New prompt')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label={translate('promptLibrary.close', 'Close prompt library')}
        >
          <X />
        </Button>
      </header>
      <div className="relative shrink-0 border-b p-3">
        <Search className="pointer-events-none absolute top-1/2 left-6 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          className="h-8 pl-8 text-xs"
          placeholder={translate('promptLibrary.search.placeholder', 'Search prompts...')}
          aria-label={translate('promptLibrary.search.label', 'Search prompts')}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[180px_minmax(0,1fr)] sm:grid-rows-1">
        <PromptLibraryCategorySidebar
          categories={library.categories}
          prompts={library.prompts}
          selectedCategoryId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
          onAdd={() => setCategoryEditor({ category: null })}
          onRename={(category) => setCategoryEditor({ category })}
          onDelete={(category) => void deleteCategory(category)}
        />
        <PromptLibraryPromptList
          prompts={visiblePrompts}
          categories={library.categories}
          copiedPromptId={copiedPromptId}
          hasLibraryPrompts={library.prompts.length > 0}
          onAdd={() => setPromptEditor({ prompt: null })}
          onCopy={(prompt) => void copyPrompt(prompt)}
          onEdit={(prompt) => setPromptEditor({ prompt })}
          onDelete={(prompt) => void deletePrompt(prompt)}
        />
      </div>
      {categoryEditor ? (
        <PromptLibraryCategoryDialog
          open
          initialName={editingCategory?.name ?? ''}
          existingNames={library.categories
            .filter((category) => category.id !== editingCategory?.id)
            .map((category) => category.name)}
          onOpenChange={(open) => !open && setCategoryEditor(null)}
          onSave={saveCategory}
        />
      ) : null}
      {promptEditor ? (
        <PromptLibraryPromptDialog
          open
          prompt={promptEditor.prompt}
          defaultCategoryId={defaultCategoryId}
          categories={library.categories}
          onOpenChange={(open) => !open && setPromptEditor(null)}
          onSave={savePrompt}
        />
      ) : null}
    </>
  )
}
