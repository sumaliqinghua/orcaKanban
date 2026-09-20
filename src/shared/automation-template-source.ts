export type AutomationTemplateSource = {
  templateId: string
  templateVersion: string
  templatePrompt: string
}

import type { Automation } from './automations-types'

export type AutomationTemplateCatalogEntry = {
  id: string
  version?: string
  prompt: string
}

export type AutomationTemplateComparison = {
  templateId: string | null
  savedVersion: string | null
  currentVersion: string | null
  promptMatchesSavedTemplate: boolean | null
  promptMatchesCurrentTemplate: boolean | null
  currentTemplatePrompt: string | null
  status: 'unknown' | 'custom' | 'current' | 'prompt-edited' | 'template-updated'
}

export function compareAutomationTemplateSource(
  automation: Pick<Automation, 'prompt' | 'sourceTemplate'>,
  templates: readonly AutomationTemplateCatalogEntry[]
): AutomationTemplateComparison {
  const source = automation.sourceTemplate ?? null
  if (!source?.templateId) {
    return {
      templateId: null,
      savedVersion: null,
      currentVersion: null,
      promptMatchesSavedTemplate: null,
      promptMatchesCurrentTemplate: null,
      currentTemplatePrompt: null,
      status: 'unknown'
    }
  }
  const current = templates.find((template) => template.id === source.templateId) ?? null
  const promptMatchesSavedTemplate = automation.prompt === source.templatePrompt
  const promptMatchesCurrentTemplate = current ? automation.prompt === current.prompt : null
  const currentVersion = current?.version ?? null
  const status: AutomationTemplateComparison['status'] = current
    ? promptMatchesCurrentTemplate
      ? 'current'
      : promptMatchesSavedTemplate
        ? 'template-updated'
        : 'prompt-edited'
    : 'custom'
  return {
    templateId: source.templateId,
    savedVersion: source.templateVersion,
    currentVersion,
    promptMatchesSavedTemplate,
    promptMatchesCurrentTemplate,
    currentTemplatePrompt: current?.prompt ?? null,
    status
  }
}

export function automationTemplateSourceFromCatalog(
  template: AutomationTemplateCatalogEntry
): AutomationTemplateSource {
  return {
    templateId: template.id,
    templateVersion: template.version ?? 'unversioned',
    templatePrompt: template.prompt
  }
}
