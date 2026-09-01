import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { PromptLibraryDrawer } from '@/components/prompt-library/PromptLibraryDrawer'

type PromptLibrarySidebarHostProps = {
  sidebarOpen: boolean
  workspaceBoardOpen: boolean
  closeWorkspaceBoard: () => void
  leftSidebarStyle?: React.CSSProperties
  statusBarVisible: boolean
}

export default function PromptLibrarySidebarHost({
  sidebarOpen,
  workspaceBoardOpen,
  closeWorkspaceBoard,
  leftSidebarStyle,
  statusBarVisible
}: PromptLibrarySidebarHostProps): React.JSX.Element | null {
  const open = useAppStore((state) => state.promptLibraryDrawerOpen)
  const setOpen = useAppStore((state) => state.setPromptLibraryDrawerOpen)
  const setAgentDashboardOpen = useAppStore((state) => state.setAgentDashboardDrawerOpen)

  useEffect(() => {
    if (!sidebarOpen && open) {
      setOpen(false)
    }
  }, [open, setOpen, sidebarOpen])

  useEffect(() => {
    if (open) {
      closeWorkspaceBoard()
      setAgentDashboardOpen(false)
    }
  }, [closeWorkspaceBoard, open, setAgentDashboardOpen])

  useEffect(() => {
    if (workspaceBoardOpen) {
      setOpen(false)
    }
  }, [setOpen, workspaceBoardOpen])

  return sidebarOpen ? (
    <PromptLibraryDrawer leftSidebarStyle={leftSidebarStyle} statusBarVisible={statusBarVisible} />
  ) : null
}
