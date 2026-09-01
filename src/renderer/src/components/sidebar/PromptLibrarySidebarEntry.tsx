import { NotebookText } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

export default function PromptLibrarySidebarEntry(): React.JSX.Element {
  const open = useAppStore((state) => state.promptLibraryDrawerOpen)
  const setOpen = useAppStore((state) => state.setPromptLibraryDrawerOpen)

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-controls="prompt-library-drawer"
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
        open
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
          : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      <NotebookText
        className={cn('size-4 shrink-0', !open && 'text-worktree-sidebar-foreground/30')}
      />
      <span className="flex-1">{translate('promptLibrary.sidebar.label', 'Prompt Library')}</span>
    </button>
  )
}
