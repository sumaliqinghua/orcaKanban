// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ListView } from './work-item-views'
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
