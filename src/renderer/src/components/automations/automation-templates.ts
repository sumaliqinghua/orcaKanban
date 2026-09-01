import type { AutomationSchedulePreset } from '../../../../shared/automations-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'

export type AutomationTemplate = {
  id: string
  category: string
  label: string
  description: string
  name: string
  prompt: string
  preset: AutomationSchedulePreset
  time?: string
  dayOfWeek?: string
  agentId?: TuiAgent
  missedRunGraceMinutes?: string
}

export const getAutomationTemplates = createLocalizedCatalog((): AutomationTemplate[] => [
  {
    id: 'repo-health-weekday',
    category: translate(
      'auto.components.automations.automation.templates.repoHealth.category',
      'Repo health'
    ),
    label: translate(
      'auto.components.automations.automation.templates.b84757677d',
      'Weekday repo audit'
    ),
    description: translate(
      'auto.components.automations.automation.templates.a7fbd32ddb',
      'Check dependencies, failing tests, and risky open changes each weekday.'
    ),
    name: translate(
      'auto.components.automations.automation.templates.repoHealth.name',
      'Weekday repo audit'
    ),
    prompt: translate(
      'auto.components.automations.automation.templates.repoHealth.prompt',
      'Review the repository health. Check dependency updates, failing tests, lint/typecheck status, and risky open changes. Summarize findings and suggest the next action.'
    ),
    preset: 'weekdays',
    time: '09:00',
    missedRunGraceMinutes: '720'
  },
  {
    id: 'release-prep-weekly',
    category: translate(
      'auto.components.automations.automation.templates.releasePrep.category',
      'Release prep'
    ),
    label: translate(
      'auto.components.automations.automation.templates.39ed39280a',
      'Release readiness'
    ),
    description: translate(
      'auto.components.automations.automation.templates.513401db93',
      'Prepare a weekly release risk summary from the current project state.'
    ),
    name: translate(
      'auto.components.automations.automation.templates.releasePrep.name',
      'Release readiness review'
    ),
    prompt: translate(
      'auto.components.automations.automation.templates.releasePrep.prompt',
      'Prepare a release readiness summary. Look for blockers, unmerged risky changes, missing validation, and documentation gaps. End with a concise release/no-release recommendation.'
    ),
    preset: 'weekly',
    time: '14:00',
    dayOfWeek: '4',
    missedRunGraceMinutes: '1440'
  },
  {
    id: 'recurring-review-daily',
    category: translate(
      'auto.components.automations.automation.templates.recurringReview.category',
      'Recurring review'
    ),
    label: translate(
      'auto.components.automations.automation.templates.6023075b27',
      'Daily change review'
    ),
    description: translate(
      'auto.components.automations.automation.templates.3b7281c75f',
      'Scan recent work and call out correctness, UX, and test coverage risks.'
    ),
    name: translate(
      'auto.components.automations.automation.templates.recurringReview.name',
      'Daily change review'
    ),
    prompt: translate(
      'auto.components.automations.automation.templates.recurringReview.prompt',
      'Review recent changes in this workspace. Focus on correctness risks, UX regressions, missing tests, and follow-up tasks. Keep the report short and actionable.'
    ),
    preset: 'daily',
    time: '16:30',
    missedRunGraceMinutes: '180'
  },
  {
    id: 'maintenance-hourly',
    category: translate(
      'auto.components.automations.automation.templates.maintenance.category',
      'Maintenance'
    ),
    label: translate(
      'auto.components.automations.automation.templates.8a0228bea3',
      'Hourly queue check'
    ),
    description: translate(
      'auto.components.automations.automation.templates.37571fcb16',
      'Look for stuck work, stale generated files, and failed local validation.'
    ),
    name: translate(
      'auto.components.automations.automation.templates.maintenance.name',
      'Hourly maintenance check'
    ),
    prompt: translate(
      'auto.components.automations.automation.templates.maintenance.prompt',
      'Check for stuck work, stale generated files, failing validation, and anything that needs human attention. Report only actionable issues.'
    ),
    preset: 'hourly',
    time: '00:15',
    missedRunGraceMinutes: '30'
  },
  {
    id: 'kanban-requirement-clarification-hourly',
    category: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.requirementClarification.category',
      'Kanban advisor'
    ),
    label: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.requirementClarification.label',
      'Inbox requirement clarification'
    ),
    description: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.requirementClarification.description',
      'Review Inbox tasks for missing scope, context, or acceptance details without changing them.'
    ),
    name: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.requirementClarification.name',
      'Inbox requirement clarification'
    ),
    prompt: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.requirementClarification.prompt',
      'Read assistant/kanban-advisor/README.md, assistant/kanban-advisor/references/modes.md, and assistant/kanban-advisor/references/result-contract.md. Follow the requirement_clarification mode. Review Inbox local tasks in this workspace. Read each task description, related session summaries, prior AI records for the same seriesKey, and relevant recent Git changes. Write a new AI record only when a new ambiguity, user answer, code constraint, or materially better description appears. Use node assistant/kanban-advisor/scripts/kanban-result.mjs write for the record. If the task and evidence are unchanged, return no_change and do not write a file. Never modify tasks, mark Inbox tasks ready, start project Agents, or change code.'
    ),
    preset: 'hourly',
    time: '00:05',
    missedRunGraceMinutes: '30'
  },
  {
    id: 'kanban-candidate-task-weekly',
    category: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.candidateTask.category',
      'Kanban advisor'
    ),
    label: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.candidateTask.label',
      'Weekly candidate planning'
    ),
    description: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.candidateTask.description',
      'Suggest a small set of forward-looking tasks from goals, decisions, and recent project work.'
    ),
    name: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.candidateTask.name',
      'Weekly candidate task planning'
    ),
    prompt: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.candidateTask.prompt',
      'Read assistant/kanban-advisor/README.md, assistant/kanban-advisor/references/modes.md, and assistant/kanban-advisor/references/result-contract.md. Follow the candidate_task mode. Read the project goals, confirmed decisions, recently completed work, existing local tasks, prior candidate_task records, and relevant Git changes. Suggest only distinct work that is not already a task or prior proposal. Write one AI record with concrete acceptance criteria when a genuinely new candidate exists. Use node assistant/kanban-advisor/scripts/kanban-result.mjs write. If nothing materially changed or no new candidate is justified, return no_change. Do not create tasks, edit priorities, or start project Agents.'
    ),
    preset: 'weekly',
    time: '10:00',
    dayOfWeek: '1',
    missedRunGraceMinutes: '720'
  },
  {
    id: 'kanban-task-simplification-daily',
    category: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.taskSimplification.category',
      'Kanban advisor'
    ),
    label: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.taskSimplification.label',
      'Stale task simplification'
    ),
    description: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.taskSimplification.description',
      'Turn long-stalled tasks into a smaller question that is easier to decide.'
    ),
    name: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.taskSimplification.name',
      'Daily stale task simplification'
    ),
    prompt: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.taskSimplification.prompt',
      'Read assistant/kanban-advisor/README.md, assistant/kanban-advisor/references/modes.md, and assistant/kanban-advisor/references/result-contract.md. Follow the task_simplification mode. Review stale Open, Inbox, and Needs review local tasks, their latest sessions and outputs, prior task_simplification records, and relevant Git changes. Suggest a smaller next decision with a concrete revised description, but do not edit the original task. Use node assistant/kanban-advisor/scripts/kanban-result.mjs write only when the framing or evidence is materially new. If the task, evidence, and prior simplification are unchanged, return no_change. Do not create tasks, change task status, or start Agents.'
    ),
    preset: 'daily',
    time: '11:00',
    missedRunGraceMinutes: '180'
  },
  {
    id: 'kanban-status-report-daily',
    category: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.statusReport.category',
      'Kanban advisor'
    ),
    label: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.statusReport.label',
      'Daily Kanban status report'
    ),
    description: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.statusReport.description',
      'Summarize completed, active, blocked, failed, and review-needed work.'
    ),
    name: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.statusReport.name',
      'Daily Kanban status report'
    ),
    prompt: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.statusReport.prompt',
      'Read assistant/kanban-advisor/README.md, assistant/kanban-advisor/references/modes.md, and assistant/kanban-advisor/references/result-contract.md. Follow the status_report mode. Read local task status changes, recent task runs and failures, Needs review items, project goals, decisions, and relevant Git changes. Write a concise AI record only when at least one reported fact or decision item changed. Use node assistant/kanban-advisor/scripts/kanban-result.mjs write and return no_change otherwise. Do not modify tasks, create work, or start Agents.'
    ),
    preset: 'daily',
    time: '18:00',
    missedRunGraceMinutes: '180'
  }
])
