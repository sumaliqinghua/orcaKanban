import { describe, expect, it } from 'vitest'
import { compareAutomationTemplateSource } from './automation-template-source'

const templates = [
  { id: 'kanban-inbox-clarification-hourly', version: '2026-09-15', prompt: '新模板提示词' }
]

describe('automation template source comparison', () => {
  it('marks automations without a saved source as unknown', () => {
    expect(compareAutomationTemplateSource({ prompt: '任意提示词' }, templates).status).toBe(
      'unknown'
    )
  })

  it('detects a current template, an edited prompt, and a later template update', () => {
    const source = {
      templateId: 'kanban-inbox-clarification-hourly',
      templateVersion: '2026-09-10',
      templatePrompt: '旧模板提示词'
    }
    expect(
      compareAutomationTemplateSource(
        { prompt: '新模板提示词', sourceTemplate: { ...source, templatePrompt: '新模板提示词' } },
        templates
      ).status
    ).toBe('current')
    expect(
      compareAutomationTemplateSource(
        { prompt: '用户改过的提示词', sourceTemplate: source },
        templates
      ).status
    ).toBe('prompt-edited')
    expect(
      compareAutomationTemplateSource({ prompt: '旧模板提示词', sourceTemplate: source }, templates)
        .status
    ).toBe('template-updated')
  })
})
