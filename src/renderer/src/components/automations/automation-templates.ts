import type {
  AutomationExecutionMode,
  AutomationLocalTaskScope,
  AutomationSchedulePreset
} from '../../../../shared/automations-types'
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
  executionMode?: AutomationExecutionMode
  localTaskScope?: AutomationLocalTaskScope
  time?: string
  dayOfWeek?: string
  agentId?: TuiAgent
  missedRunGraceMinutes?: string
}

export const getAutomationTemplates = createLocalizedCatalog((): AutomationTemplate[] => [
  {
    id: 'kanban-open-local-tasks-daily',
    category: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.openLocalTasks.category',
      'Kanban advisor'
    ),
    label: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.openLocalTasks.label',
      'Daily Open task execution'
    ),
    description: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.openLocalTasks.description',
      'Run all ready, unstarted Open local tasks in this workspace in sequence.'
    ),
    name: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.openLocalTasks.name',
      'Daily Open task execution'
    ),
    prompt:
      '你只负责派发。执行 orca local-task list --scope all-local-projects --json，读取任务和关联会话。对符合条件的任务调用 orca local-task dispatch --task <任务ID> --worktree id:<任务workspaceId> --agent {{automation.agentId}} --purpose execution --tag automation:open-execution --prompt <交给工作Agent的请求> --json。命令负责按任务内标签选择最近会话，忙碌或不可确认时跳过。派发完成就结束，不等待工作结果，不写AI记录，不自行修改代码。仅处理 ready 且 Open 的任务。请求为执行主任务，任务描述由接口附带。',
    preset: 'daily',
    time: '09:30',
    executionMode: 'prompt',
    localTaskScope: 'all_local_projects',
    missedRunGraceMinutes: '180'
  },
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
    id: 'kanban-inbox-clarification-hourly',
    category: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.requirementClarification.category',
      'Kanban advisor'
    ),
    label: translate(
      'auto.components.automations.automation.templates.taskAssistant.inboxClarification.label',
      'Inbox requirement clarification'
    ),
    description: translate(
      'auto.components.automations.automation.templates.taskAssistant.inboxClarification.description',
      'Read Inbox tasks and continue tagged requirement conversations to clarify them.'
    ),
    name: translate(
      'auto.components.automations.automation.templates.taskAssistant.inboxClarification.name',
      'Inbox requirement clarification'
    ),
    executionMode: 'prompt',
    prompt:
      '你只负责派发。执行 orca local-task list --scope all-local-projects --json，读取任务和关联会话。对符合条件的任务调用 orca local-task dispatch --task <任务ID> --worktree id:<任务workspaceId> --agent {{automation.agentId}} --purpose clarification --tag automation:inbox-clarification --prompt <交给工作Agent的请求> --json。命令负责按任务内标签选择最近会话，忙碌或不可确认时跳过。派发完成就结束，不等待工作结果，不写AI记录，不自行修改代码。仅处理Inbox任务。交给工作Agent：使用适用skills阅读代码现状和历史问答，帮助用户梳理需求；等待用户回答，不重复已有问题；建议描述经用户确认后再写回，不改ready状态，不执行代码修改。',
    preset: 'hourly',
    time: '00:05',
    missedRunGraceMinutes: '30'
  },
  {
    id: 'kanban-stale-task-review-daily',
    category: translate(
      'auto.components.automations.automation.templates.kanbanAdvisor.candidateTask.category',
      'Kanban advisor'
    ),
    label: translate(
      'auto.components.automations.automation.templates.taskAssistant.staleReview.label',
      'Stale task explanation'
    ),
    description: translate(
      'auto.components.automations.automation.templates.taskAssistant.staleReview.description',
      'Explain long-unreviewed tasks in simpler terms so the next decision is easier.'
    ),
    name: translate(
      'auto.components.automations.automation.templates.taskAssistant.staleReview.name',
      'Daily stale task explanation'
    ),
    executionMode: 'prompt',
    prompt:
      '你只负责派发。执行 orca local-task list --scope all-local-projects --json，读取任务和关联会话。对符合条件的任务调用 orca local-task dispatch --task <任务ID> --worktree id:<任务workspaceId> --agent {{automation.agentId}} --purpose task-report --tag automation:stale-review --prompt <交给工作Agent的请求> --json。命令负责按任务内标签选择最近会话，忙碌或不可确认时跳过。派发完成就结束，不等待工作结果，不写AI记录，不自行修改代码。仅处理Needs review且最近相关活动超过7天的任务。交给工作Agent：读取历史会话和代码现状，直白解释已完成内容、剩余问题、最小决策与下一步，不替用户验收，不修改任务状态或代码。',
    preset: 'daily',
    time: '10:00',
    missedRunGraceMinutes: '180'
  }
])
