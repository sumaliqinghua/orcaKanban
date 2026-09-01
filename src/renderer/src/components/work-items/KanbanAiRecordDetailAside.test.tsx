import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { KanbanAiRecord } from '../../../../shared/kanban-ai-record'
import { KanbanAiRecordDetailAside } from './KanbanAiRecordDetailAside'

function record(taskId: string | null): KanbanAiRecord {
  return {
    schemaVersion: 1,
    id: 'air_1',
    kind: 'task_simplification',
    seriesKey: 'task_simplification:lt_1',
    createdAt: 1,
    source: { automationId: null, automationRunId: null, agentId: 'codex' },
    target: { projectId: 'project-1', projectPath: '/project', workspaceId: null, taskId },
    title: '缩小构建管线任务',
    summary: '先固定一次失败复现。',
    body: { format: 'markdown', content: '## 最小可决策问题\n\n选择一个失败用例。' },
    basis: {},
    inputFingerprint: `sha256:${'a'.repeat(64)}`,
    readAt: 2
  }
}

describe('KanbanAiRecordDetailAside', () => {
  it('renders Markdown and a task action only for task-linked records', () => {
    const markup = renderToStaticMarkup(
      <KanbanAiRecordDetailAside
        record={record('lt_1')}
        open
        projectLabel="Orca"
        notice={null}
        onClose={() => {}}
        onOpenTask={() => {}}
      />
    )

    expect(markup).toContain('最小可决策问题')
    expect(markup).toContain('查看任务')
  })

  it('keeps project-only records read-only', () => {
    expect(
      renderToStaticMarkup(
        <KanbanAiRecordDetailAside
          record={record(null)}
          open
          projectLabel="Orca"
          notice={null}
          onClose={() => {}}
          onOpenTask={() => {}}
        />
      )
    ).not.toContain('查看任务')
  })
})
