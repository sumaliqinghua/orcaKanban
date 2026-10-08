import { useAppStore } from '@/store'
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { normalizeSidebarWorkspaceContent } from '../../../../shared/sidebar-workspace-content'

export function SidebarWorkspaceContentMenu(): React.JSX.Element {
  const content = useAppStore((s) => s.sidebarWorkspaceContent ?? 'sessions')
  const setContent = useAppStore((s) => s.setSidebarWorkspaceContent)
  return (
    <>
      <DropdownMenuLabel>工作区下显示内容</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={content}
        onValueChange={(value) => setContent(normalizeSidebarWorkspaceContent(value))}
      >
        <DropdownMenuRadioItem value="sessions">会话</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="tasks">任务</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
    </>
  )
}
