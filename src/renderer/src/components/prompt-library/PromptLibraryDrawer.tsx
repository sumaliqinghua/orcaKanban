import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { translate } from '@/i18n/i18n'
import { useWorkspaceKanbanOutsideDismiss } from '@/components/sidebar/use-workspace-kanban-outside-dismiss'
import {
  STATUS_BAR_RESERVE_HEIGHT,
  WORKSPACE_TOP_CHROME_HEIGHT
} from '@/components/sidebar/workspace-chrome-metrics'
import { PromptLibraryPanel } from './PromptLibraryPanel'

const PROMPT_LIBRARY_ESCAPE_BLOCKING_OVERLAY_SELECTOR = [
  '[data-slot="dropdown-menu-content"][data-state="open"]',
  '[data-slot="popover-content"][data-state="open"]',
  '[role="dialog"][data-state="open"]:not([data-prompt-library-sheet])',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]'
].join(', ')

type PromptLibraryDrawerProps = {
  leftSidebarStyle?: React.CSSProperties
  statusBarVisible: boolean
}

export function PromptLibraryDrawer({
  leftSidebarStyle,
  statusBarVisible
}: PromptLibraryDrawerProps): React.JSX.Element {
  const open = useAppStore((state) => state.promptLibraryDrawerOpen)
  const setOpen = useAppStore((state) => state.setPromptLibraryDrawerOpen)
  const sidebarOpen = useAppStore((state) => state.sidebarOpen)
  const sidebarWidth = useAppStore((state) => state.sidebarWidth)
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const close = useCallback(() => setOpen(false), [setOpen])

  useWorkspaceKanbanOutsideDismiss({
    open,
    boardRef: drawerRef,
    preserveOpenForMenu: false,
    onOpenChange: setOpen
  })

  useEffect(() => {
    if (!open) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.key !== 'Escape' ||
        document.querySelector(PROMPT_LIBRARY_ESCAPE_BLOCKING_OVERLAY_SELECTOR)
      ) {
        return
      }
      event.preventDefault()
      close()
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [close, open])

  const drawerLeftCss = sidebarOpen
    ? `var(--workspace-sidebar-live-width, ${sidebarWidth}px)`
    : '0px'
  const drawerBottom = `${statusBarVisible ? STATUS_BAR_RESERVE_HEIGHT : 0}px`

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => nextOpen && setOpen(true)} modal={false}>
      <SheetContent
        id="prompt-library-drawer"
        side="left"
        showCloseButton={false}
        aria-describedby={undefined}
        className="bg-background p-0 sm:max-w-none"
        overlayStyle={{
          top: WORKSPACE_TOP_CHROME_HEIGHT,
          bottom: drawerBottom,
          left: drawerLeftCss,
          pointerEvents: 'none'
        }}
        style={{
          ...leftSidebarStyle,
          left: drawerLeftCss,
          top: WORKSPACE_TOP_CHROME_HEIGHT,
          bottom: drawerBottom,
          height: 'auto',
          width: `min(calc(100vw - ${drawerLeftCss}), 760px)`
        }}
        data-prompt-library-sheet=""
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetTitle className="sr-only">
          {translate('promptLibrary.title', 'Prompt Library')}
        </SheetTitle>
        <div ref={drawerRef} className="flex min-h-0 flex-1 flex-col">
          <PromptLibraryPanel onClose={close} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
