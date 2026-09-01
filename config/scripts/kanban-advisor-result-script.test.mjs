import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const script = resolve('assistant/kanban-advisor/scripts/kanban-result.mjs')
let projectRoot = ''

function run(...args) {
  return JSON.parse(execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' }))
}

function payload(basis) {
  return {
    kind: 'requirement_clarification',
    seriesKey: 'requirement_clarification:lt_1',
    source: { automationId: 'auto-1', automationRunId: 'run-1', agentId: 'codex' },
    target: { projectId: 'project-1', workspaceId: 'workspace-1', taskId: 'lt_1' },
    title: '需求澄清',
    summary: '需要确认目标平台',
    body: '## 需要确认\n\n目标平台是什么？',
    basis
  }
}

describe('Kanban advisor result script', () => {
  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'kanban-advisor-records-'))
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('writes once, refuses an unchanged input, and returns newest history first', () => {
    const input = join(projectRoot, 'payload.json')
    writeFileSync(input, JSON.stringify(payload({ taskUpdatedAt: 1, gitHead: 'abc' })), 'utf8')
    const first = run('write', '--project-root', projectRoot, '--input', input)
    const duplicate = run('write', '--project-root', projectRoot, '--input', input)
    writeFileSync(input, JSON.stringify(payload({ taskUpdatedAt: 2, gitHead: 'def' })), 'utf8')
    const second = run('write', '--project-root', projectRoot, '--input', input)
    const history = run(
      'history',
      '--project-root',
      projectRoot,
      '--series-key',
      'requirement_clarification:lt_1',
      '--limit',
      '5'
    )

    expect(first.outcome).toBe('written')
    expect(duplicate).toMatchObject({ outcome: 'no_change', latestRecordId: first.record.id })
    expect(second.outcome).toBe('written')
    expect(history.map((record) => record.id)).toEqual([second.record.id, first.record.id])
    expect(history[0].target.projectPath).toBe(projectRoot)
    expect(history[0].readAt).toBeNull()
  })
})
