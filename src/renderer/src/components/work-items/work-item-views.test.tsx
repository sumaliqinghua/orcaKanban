// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BoardView, ListView } from './work-item-views'
import { WorkItemCard } from './work-item-pieces'
import type { WorkItem } from './mock-data'

function item(): WorkItem {
  return {
    id: 'task-1',
    title: '任务标题',
    description: '任务描述',
    status: 'In progress',
    workspace: 'workspace',
    project: 'Orca',
    updated: '现在',
    sessions: 1,
    activeSessions: 1,
    subtasks: [
      {
        id: 'subtask-1',
        title: '实现子任务',
        status: 'doing',
        session: '执行会话',
        steps: []
      },
      {
        id: 'subtask-2',
        title: '验证子任务',
        status: 'todo',
        session: '执行会话',
        steps: []
      }
    ],
    latestOutput: { session: '执行会话', text: '处理中' },
    sessionsList: []
  }
}

afterEach(() => cleanup())

describe('work item project and subtask summaries', () => {
  it('groups projects inside status columns and keeps collapse and creation scoped', async () => {
    const user = userEvent.setup()
    const onCreateProjectTask = vi.fn()
    const onSelect = vi.fn()
    const tasks: WorkItem[] = [
      item(),
      { ...item(), id: 'task-2', title: '另一个任务', project: 'DropCat' },
      { ...item(), id: 'task-3', title: '待处理任务', status: 'Open' },
      { ...item(), id: 'task-4', title: '已完成任务', status: 'Done' }
    ]
    render(
      <BoardView
        items={tasks}
        selected={null}
        onSelect={onSelect}
        groupByProject
        onCreateProjectTask={onCreateProjectTask}
        projectOptions={[
          { id: 'all', label: '全部项目' },
          { id: 'Orca', label: 'orcaKanban' },
          { id: 'DropCat', label: 'DropCat' },
          { id: 'empty', label: '空项目' }
        ]}
      />
    )

    expect(screen.getAllByRole('region')).toHaveLength(4)
    const open = within(screen.getByRole('region', { name: 'Open' }))
    const active = within(screen.getByRole('region', { name: 'In progress' }))
    const done = within(screen.getByRole('region', { name: 'Done' }))
    expect(open.getByText('待处理任务')).toBeInTheDocument()
    expect(active.getByText('任务标题')).toBeInTheDocument()
    expect(active.getByText('另一个任务')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /空项目/ })).not.toBeInTheDocument()
    expect(open.queryByRole('button', { name: /DropCat/ })).not.toBeInTheDocument()
    const review = within(screen.getByRole('region', { name: 'Needs review' }))
    expect(review.queryByRole('button')).not.toBeInTheDocument()
    expect(review.getByText('暂无本地任务')).toBeInTheDocument()
    expect(done.getByRole('button', { name: /orcaKanban/, expanded: false })).toBeInTheDocument()
    expect(screen.queryByText('已完成任务')).not.toBeInTheDocument()
    await user.click(done.getByRole('button', { name: /orcaKanban/, expanded: false }))
    expect(done.getByText('已完成任务')).toBeInTheDocument()

    await user.click(open.getByRole('button', { name: '新建 orcaKanban 的任务' }))
    expect(onCreateProjectTask).toHaveBeenLastCalledWith('Orca')
    expect(active.queryByRole('button', { name: /^新建/ })).not.toBeInTheDocument()

    await user.click(active.getByRole('button', { name: /orcaKanban/, expanded: true }))
    expect(screen.queryByText('任务标题')).not.toBeInTheDocument()
    expect(active.getByText('另一个任务')).toBeInTheDocument()
    expect(open.getByText('待处理任务')).toBeInTheDocument()
    await user.click(open.getByText('待处理任务'))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('task-3')
  })

  it('shows the owning project and subtasks on a board task card', () => {
    render(<WorkItemCard item={item()} selected={false} onSelect={() => {}} />)

    expect(screen.getByText('Orca')).toBeInTheDocument()
    expect(screen.getByText('实现子任务')).toBeInTheDocument()
    expect(screen.getByText('验证子任务')).toBeInTheDocument()
  })

  it('shows the owning project as a column in the task list', () => {
    render(
      <ListView
        items={[item()]}
        selected={item()}
        onSelect={() => {}}
        expandedIds={new Set()}
        onToggleExpanded={() => {}}
        onQuickCreate={() => {}}
      />
    )

    expect(screen.getByText('所属项目')).toBeInTheDocument()
    expect(screen.getAllByText('Orca')).toHaveLength(1)
  })
})
