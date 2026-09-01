import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { KanbanAiRecord } from '../../../../shared/kanban-ai-record'
import { KanbanAiRecordList } from './KanbanAiRecordList'

function record(readAt: number | null): KanbanAiRecord {
  return {
    schemaVersion: 1,
    id: 'air_1',
    kind: 'requirement_clarification',
    seriesKey: 'requirement_clarification:lt_1',
    createdAt: 1,
    source: { automationId: null, automationRunId: null, agentId: 'codex' },
    target: {
      projectId: 'project-1',
      projectPath: '/project',
      workspaceId: null,
      taskId: 'lt_1'
    },
    title: '资源加载缺少目标平台',
    summary: '需要先确定 Android 或 Windows。',
    body: { format: 'markdown', content: '## 需要确认' },
    basis: {},
    inputFingerprint: `sha256:${'a'.repeat(64)}`,
    readAt
  }
}

describe('KanbanAiRecordList', () => {
  it('renders unread state, type, project label and task id', () => {
    const markup = renderToStaticMarkup(
      <KanbanAiRecordList
        records={[record(null)]}
        selectedId="air_1"
        projectLabels={new Map([['project-1', 'Orca']])}
        onSelect={() => {}}
      />
    )

    expect(markup).toContain('aria-label="未读"')
    expect(markup).toContain('需求澄清')
    expect(markup).toContain('Orca')
    expect(markup).toContain('lt_1')
  })

  it('does not render the unread marker after the record was opened', () => {
    expect(
      renderToStaticMarkup(
        <KanbanAiRecordList
          records={[record(10)]}
          selectedId={null}
          projectLabels={new Map()}
          onSelect={() => {}}
        />
      )
    ).not.toContain('aria-label="未读"')
  })
})
