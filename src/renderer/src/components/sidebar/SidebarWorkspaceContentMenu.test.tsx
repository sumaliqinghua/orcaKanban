// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { SidebarWorkspaceContentMenu } from './SidebarWorkspaceContentMenu'

const setContent = vi.hoisted(() => vi.fn())
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: object) => unknown) =>
    selector({ sidebarWorkspaceContent: 'sessions', setSidebarWorkspaceContent: setContent })
}))
afterEach(cleanup)

it('offers sessions and tasks in the existing workspace menu', () => {
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>显示设置</DropdownMenuTrigger>
      <DropdownMenuContent>
        <SidebarWorkspaceContentMenu />
      </DropdownMenuContent>
    </DropdownMenu>
  )
  expect(screen.getByRole('menuitemradio', { name: '会话' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  fireEvent.click(screen.getByRole('menuitemradio', { name: '任务' }))
  expect(setContent).toHaveBeenCalledWith('tasks')
})
