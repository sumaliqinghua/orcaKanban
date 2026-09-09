import { describe, expect, it } from 'vitest'
import { getAutomationTemplates } from './automation-templates'

describe('automation templates', () => {
  it('includes only the two prompt-driven task assistant templates', () => {
    const templates = getAutomationTemplates()
    const advisorTemplates = templates.filter(
      (template) =>
        template.id.startsWith('kanban-') && template.id !== 'kanban-open-local-tasks-daily'
    )

    expect(advisorTemplates.map((template) => template.id)).toEqual([
      'kanban-inbox-clarification-hourly',
      'kanban-stale-task-review-daily'
    ])
    expect(advisorTemplates.every((template) => template.prompt.includes('automation:'))).toBe(true)
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
  })
})
