import { Check, Copy, FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { PromptLibraryCategory, PromptLibraryPrompt } from '../../../../shared/prompt-library'

type PromptLibraryPromptListProps = {
  prompts: readonly PromptLibraryPrompt[]
  categories: readonly PromptLibraryCategory[]
  copiedPromptId: string | null
  hasLibraryPrompts: boolean
  onAdd: () => void
  onCopy: (prompt: PromptLibraryPrompt) => void
  onEdit: (prompt: PromptLibraryPrompt) => void
  onDelete: (prompt: PromptLibraryPrompt) => void
}

function IconAction({
  label,
  destructive = false,
  onClick,
  children
}: {
  label: string
  destructive?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={destructive ? 'hover:text-destructive' : undefined}
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function PromptLibraryPromptList({
  prompts,
  categories,
  copiedPromptId,
  hasLibraryPrompts,
  onAdd,
  onCopy,
  onEdit,
  onDelete
}: PromptLibraryPromptListProps): React.JSX.Element {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))

  if (prompts.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <FileText className="size-8 text-muted-foreground/50" />
        <div className="text-sm font-medium">
          {hasLibraryPrompts
            ? translate('promptLibrary.empty.filtered', 'No matching prompts')
            : translate('promptLibrary.empty.library', 'No prompts yet')}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus />
          {translate('promptLibrary.prompt.addTitle', 'New prompt')}
        </Button>
      </div>
    )
  }

  return (
    <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
      {prompts.map((prompt) => {
        const categoryName = prompt.categoryId ? categoryNames.get(prompt.categoryId) : null
        return (
          <article key={prompt.id} className="group border-b px-4 py-3 last:border-b-0">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="min-w-0 truncate text-sm font-medium">{prompt.title}</h3>
                  <span className="shrink-0 truncate text-[11px] text-muted-foreground">
                    {categoryName ??
                      translate('promptLibrary.category.uncategorized', 'Uncategorized')}
                  </span>
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-muted-foreground">
                  {prompt.content}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-70 group-hover:opacity-100 group-focus-within:opacity-100">
                <IconAction
                  label={
                    copiedPromptId === prompt.id
                      ? translate('promptLibrary.copy.copied', 'Copied')
                      : translate('promptLibrary.copy.action', 'Copy prompt')
                  }
                  onClick={() => onCopy(prompt)}
                >
                  {copiedPromptId === prompt.id ? (
                    <Check className="text-status-success" />
                  ) : (
                    <Copy />
                  )}
                </IconAction>
                <IconAction
                  label={translate('promptLibrary.prompt.editTitle', 'Edit prompt')}
                  onClick={() => onEdit(prompt)}
                >
                  <Pencil />
                </IconAction>
                <IconAction
                  label={translate('promptLibrary.prompt.delete', 'Delete prompt')}
                  destructive
                  onClick={() => onDelete(prompt)}
                >
                  <Trash2 />
                </IconAction>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
