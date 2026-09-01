import { mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { KanbanAiRecord } from '../../shared/kanban-ai-record'
import {
  listKanbanAiRecords,
  markKanbanAiRecordRead,
  MAX_KANBAN_AI_RECORD_FILE_BYTES
} from './ai-record-file-store'

let projectPath = ''

function makeRecord(
  id: string,
  createdAt: number,
  overrides: Partial<KanbanAiRecord> = {}
): KanbanAiRecord {
  return {
    schemaVersion: 1,
    id,
    kind: 'requirement_clarification',
    seriesKey: 'requirement_clarification:lt_1',
    createdAt,
    source: { automationId: 'auto-1', automationRunId: 'run-1', agentId: 'codex' },
    target: {
      projectId: 'project-1',
      projectPath,
      workspaceId: 'workspace-1',
      taskId: 'lt_1'
    },
    title: '需求澄清',
    summary: '需要补充目标平台',
    body: { format: 'markdown', content: '## 需要确认\n\n目标平台是什么？' },
    basis: { taskUpdatedAt: 10, gitHead: 'abc123' },
    inputFingerprint: `sha256:${'a'.repeat(64)}`,
    readAt: null,
    ...overrides
  }
}

function writeRecord(date: string, record: KanbanAiRecord): string {
  const directory = join(projectPath, 'assistant', 'results', date)
  mkdirSync(directory, { recursive: true })
  const path = join(directory, `${record.id}.json`)
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  return path
}

describe('Kanban AI record file store', () => {
  beforeEach(() => {
    projectPath = mkdtempSync(join(tmpdir(), 'orca-kanban-ai-records-'))
  })

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true })
  })

  it('sorts records newest first and keeps the newest duplicate ID', () => {
    writeRecord('2026-08-30', makeRecord('air_duplicate', 10, { summary: '旧记录' }))
    writeRecord('2026-08-31', makeRecord('air_duplicate', 30, { summary: '新记录' }))
    writeRecord('2026-08-31', makeRecord('air_second', 20))

    expect(listKanbanAiRecords({ projectId: 'project-1', projectPath })).toMatchObject([
      { id: 'air_duplicate', createdAt: 30, summary: '新记录' },
      { id: 'air_second', createdAt: 20 }
    ])
  })

  it('isolates malformed, oversized and foreign-project files', () => {
    const directory = join(projectPath, 'assistant', 'results', '2026-08-31')
    mkdirSync(directory, { recursive: true })
    writeRecord('2026-08-31', makeRecord('air_valid', 30))
    writeRecord(
      '2026-08-31',
      makeRecord('air_foreign', 40, {
        target: {
          projectId: 'project-2',
          projectPath,
          workspaceId: null,
          taskId: null
        }
      })
    )
    writeFileSync(join(directory, 'air_invalid.json'), '{ invalid', 'utf8')
    const oversized = join(directory, 'air_oversized.json')
    writeFileSync(oversized, '{}', 'utf8')
    truncateSync(oversized, MAX_KANBAN_AI_RECORD_FILE_BYTES + 1)

    expect(listKanbanAiRecords({ projectId: 'project-1', projectPath })).toMatchObject([
      { id: 'air_valid' }
    ])
  })

  it('ignores a record whose embedded project path does not match its containing project', () => {
    writeRecord(
      '2026-08-31',
      makeRecord('air_wrong_path', 30, {
        target: {
          projectId: 'project-1',
          projectPath: '/another-project',
          workspaceId: null,
          taskId: null
        }
      })
    )

    expect(listKanbanAiRecords({ projectId: 'project-1', projectPath })).toEqual([])
  })

  it('persists the first read timestamp without rewriting later views', () => {
    const path = writeRecord('2026-08-31', makeRecord('air_read', 30))
    const first = markKanbanAiRecordRead(
      { projectId: 'project-1', projectPath, recordId: 'air_read' },
      100
    )
    const second = markKanbanAiRecordRead(
      { projectId: 'project-1', projectPath, recordId: 'air_read' },
      200
    )

    expect(first.readAt).toBe(100)
    expect(second.readAt).toBe(100)
    expect(JSON.parse(readFileSync(path, 'utf8')).readAt).toBe(100)
  })
})
