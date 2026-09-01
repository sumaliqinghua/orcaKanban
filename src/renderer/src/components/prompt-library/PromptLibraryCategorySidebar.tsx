import { Ellipsis, Folder, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { PromptLibraryCategory, PromptLibraryPrompt } from '../../../../shared/prompt-library'

type PromptLibraryCategorySidebarProps = {
  categories: readonly PromptLibraryCategory[]
  prompts: readonly PromptLibraryPrompt[]
  selectedCategoryId: string | null | undefined
  onSelect: (categoryId: string | null | undefined) => void
  onAdd: () => void
  onRename: (category: PromptLibraryCategory) => void
  onDelete: (category: PromptLibraryCategory) => void
}

function CategoryRow({
  label,
  count,
  selected,
  onSelect,
  category,
  onRename,
  onDelete
}: {
  label: string
  count: number
  selected: boolean
  onSelect: () => void
  category?: PromptLibraryCategory
  onRename?: () => void
  onDelete?: () => void
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'group flex min-w-0 items-center rounded-md text-xs transition-colors',
        selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
      >
        {selected ? <FolderOpen className="size-3.5" /> : <Folder className="size-3.5" />}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="tabular-nums text-muted-foreground">{count}</span>
      </button>
      {category ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="mr-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label={translate('promptLibrary.category.actions', 'Category actions')}
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={onRename}>
              <Pencil />
              {translate('promptLibrary.rename', 'Rename')}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              {translate('promptLibrary.delete', 'Delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

export function PromptLibraryCategorySidebar({
  categories,
  prompts,
  selectedCategoryId,
  onSelect,
  onAdd,
  onRename,
  onDelete
}: PromptLibraryCategorySidebarProps): React.JSX.Element {
  const countFor = (categoryId: string | null): number =>
    prompts.filter((prompt) => prompt.categoryId === categoryId).length

  return (
    <aside className="flex min-h-0 flex-col border-b bg-muted/20 sm:border-r sm:border-b-0">
      <div className="flex h-10 shrink-0 items-center gap-2 px-3">
        <span className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {translate('promptLibrary.category.plural', 'Categories')}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onAdd}
              aria-label={translate('promptLibrary.category.addTitle', 'New category')}
            >
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {translate('promptLibrary.category.addTitle', 'New category')}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="scrollbar-sleek flex max-h-40 min-h-0 flex-col gap-0.5 overflow-y-auto px-2 pb-2 sm:max-h-none sm:flex-1">
        <CategoryRow
          label={translate('promptLibrary.category.all', 'All prompts')}
          count={prompts.length}
          selected={selectedCategoryId === undefined}
          onSelect={() => onSelect(undefined)}
        />
        <CategoryRow
          label={translate('promptLibrary.category.uncategorized', 'Uncategorized')}
          count={countFor(null)}
          selected={selectedCategoryId === null}
          onSelect={() => onSelect(null)}
        />
        {categories.map((category) => (
          <CategoryRow
            key={category.id}
            label={category.name}
            count={countFor(category.id)}
            selected={selectedCategoryId === category.id}
            onSelect={() => onSelect(category.id)}
            category={category}
            onRename={() => onRename(category)}
            onDelete={() => onDelete(category)}
          />
        ))}
      </div>
    </aside>
  )
}
