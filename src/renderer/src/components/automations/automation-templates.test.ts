import { describe, expect, it } from 'vitest'
import { getAutomationTemplates } from './automation-templates'

describe('automation templates', () => {
  it('includes the task assistant and daily review templates', () => {
    const templates = getAutomationTemplates()
    const advisorTemplates = templates.filter(
      (template) =>
        template.id.startsWith('kanban-') && template.id !== 'kanban-open-local-tasks-daily'
    )

    expect(advisorTemplates.map((template) => template.id)).toEqual([
      'kanban-inbox-clarification-hourly',
      'kanban-stale-task-review-daily',
      'kanban-workflow-review-daily',
      'kanban-knowledge-review-daily',
      'kanban-daily-progress-report',
      'kanban-automation-health-daily'
    ])
    expect(
      advisorTemplates
        .filter((template) => template.id.includes('inbox') || template.id.includes('stale'))
        .every((template) => template.prompt.includes('automation:'))
    ).toBe(true)
    expect(
      advisorTemplates.find((template) => template.id === 'kanban-inbox-clarification-hourly')
    ).toMatchObject({
      eventType: 'local_task.intake_changed',
      version: '2026-09-15'
    })
    expect(
      advisorTemplates.every((template) => !template.prompt.includes('kanban-result.mjs'))
    ).toBe(true)
  })

  it('configures the Open task template for existing-workspace execution', () => {
    const template = getAutomationTemplates().find(
      (entry) => entry.id === 'kanban-open-local-tasks-daily'
    )

    expect(template).toMatchObject({
      executionMode: 'prompt',
      localTaskScope: 'all_local_projects',
      preset: 'daily',
      time: '09:30'
    })
    expect(template?.prompt).toContain('Open')
    expect(template?.prompt).toContain('主动拆解目标')
  })

  it('provides editable schedule defaults for the existing automation draft', () => {
    const templates = getAutomationTemplates()

    expect(
      templates.find((template) => template.id === 'kanban-inbox-clarification-hourly')
    ).toMatchObject({ preset: 'hourly', time: '00:05' })
    expect(
      templates.find((template) => template.id === 'kanban-stale-task-review-daily')
    ).toMatchObject({
      preset: 'daily',
      time: '10:00'
    })
    expect(
      templates.find((template) => template.id === 'kanban-workflow-review-daily')
    ).toMatchObject({ preset: 'daily', time: '18:00' })
    expect(
      templates.find((template) => template.id === 'kanban-knowledge-review-daily')
    ).toMatchObject({ preset: 'daily', time: '19:00' })
    expect(
      templates.find((template) => template.id === 'kanban-daily-progress-report')
    ).toMatchObject({ preset: 'daily', time: '09:00' })
    expect(
      templates.find((template) => template.id === 'kanban-automation-health-daily')
    ).toMatchObject({ preset: 'daily', time: '08:30', localTaskScope: 'all_local_projects' })
  })
})
