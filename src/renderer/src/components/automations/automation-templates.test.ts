import { describe, expect, it } from 'vitest'
import { getAutomationTemplates } from './automation-templates'

describe('automation templates', () => {
  it('includes the four Kanban advisor analysis templates', () => {
    const templates = getAutomationTemplates()
    const advisorTemplates = templates.filter((template) => template.id.startsWith('kanban-'))

    expect(advisorTemplates.map((template) => template.id)).toEqual([
      'kanban-requirement-clarification-hourly',
      'kanban-candidate-task-weekly',
      'kanban-task-simplification-daily',
      'kanban-status-report-daily'
    ])
    for (const requiredPath of [
      'assistant/kanban-advisor/README.md',
      'assistant/kanban-advisor/references/modes.md',
      'assistant/kanban-advisor/references/result-contract.md',
      'assistant/kanban-advisor/scripts/kanban-result.mjs'
    ]) {
      expect(advisorTemplates.every((template) => template.prompt.includes(requiredPath))).toBe(
        true
      )
    }
    expect(
      advisorTemplates.every(
        (template) => !template.prompt.includes('Use the kanban-advisor Skill')
      )
    ).toBe(true)
    expect(advisorTemplates.every((template) => template.prompt.includes('no_change'))).toBe(true)
  })

  it('provides editable schedule defaults for the existing automation draft', () => {
    const templates = getAutomationTemplates()

    expect(
      templates.find((template) => template.id === 'kanban-requirement-clarification-hourly')
    ).toMatchObject({ preset: 'hourly', time: '00:05' })
    expect(
      templates.find((template) => template.id === 'kanban-candidate-task-weekly')
    ).toMatchObject({
      preset: 'weekly',
      time: '10:00',
      dayOfWeek: '1'
    })
  })
})
