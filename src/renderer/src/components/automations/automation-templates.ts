import type {
  AutomationEventType,
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
  eventType?: AutomationEventType | null
  eventStatus?: 'Open' | 'In progress' | 'Needs review' | 'Done'
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
      '你是本地任务执行调度员。执行 `orca local-task list --scope all-local-projects --json`，读取任务、关联会话和工作区。只处理 intakeState=ready 且 status=Open 的任务；对每个任务调用 `orca local-task dispatch --task <任务ID> --worktree id:<任务workspaceId> --agent {{automation.agentId}} --purpose execution --tag automation:open-execution --prompt "请直接处理这个任务：先阅读任务描述、当前 workspace 和已有关联会话；主动拆解目标，补齐能从代码确认的细节；只在真正影响产品行为或范围时向用户提问；信息足够后直接实现、验证并把完整结果写回原关联会话。不要只给方案后结束。" --json`。命令会按任务标签选择最近会话，忙碌或不可确认时跳过。你负责筛选和派发，不要自行修改代码；派发完成即结束，不把派发成功写成任务完成。',
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
      '你是本地任务收件箱调度员。执行 `orca local-task list --scope all-local-projects --json`，只处理 intakeState=inbox 的任务。对符合条件的任务调用 `orca local-task dispatch --task <任务ID> --worktree id:<任务workspaceId> --agent {{automation.agentId}} --purpose clarification --tag automation:inbox-clarification --prompt "请主动梳理这个收件箱任务。先阅读任务描述、项目代码、已有关联会话和历史问答；能从代码确认的内容直接补齐。使用 grilling skill 的轮次规则：把已确认事实和仍影响方向的决策分开，每轮一次性提出当前可回答的问题，每个问题给推荐答案和选项；不要重复已回答的问题，也不要一次问无关的全部细节。先帮助用户形成清晰描述、范围和验收方式，等待用户决定；用户确认后再把确认后的描述写回任务。写回内容只包含用户确认的目标、范围、需求约束和验收标准，必须与确认稿一致，确认后不得自行追加章节。本轮澄清的操作限制、状态管理要求和执行承诺仅留在会话中，不得写入任务描述；例如不要把本轮不改代码、不改收件箱状态或尚未实施的声明追加为本次澄清边界等章节，以免后续执行会话误认为任务禁止实施。本轮仍不得修改业务代码，也不得把 inbox 改成 ready。" --json`。命令会按任务标签选择最近会话，忙碌或不可确认时跳过。',
    preset: 'hourly',
    time: '00:05',
    missedRunGraceMinutes: '30',
    eventType: 'local_task.intake_changed'
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
      '你是长期未处理任务的主动整理调度员。执行 `orca local-task list --scope all-local-projects --json`，只处理 status=Needs review 且最近相关活动超过 7 天的任务。对符合条件的任务调用 `orca local-task dispatch --task <任务ID> --worktree id:<任务workspaceId> --agent {{automation.agentId}} --purpose task-report --tag automation:stale-review --prompt "请主动降低这个任务的重新启动成本。阅读完整关联会话、当前代码和验证记录，先判断原目标是否仍成立；用直白语言说明已完成、没有改变、剩余问题、修改前后行为差异、风险、已验证和未验证部分；如果信息不全，先从代码补齐，再只提出最重要的一个决策问题并给推荐答案；给出一个 5～15 分钟可开始的最小下一步。把完整说明写回原关联会话，不修改业务代码、不替用户验收、不把报告写成任务完成。" --json`。命令负责按任务标签选择最近会话，忙碌或不可确认时跳过。',
    preset: 'daily',
    time: '10:00',
    missedRunGraceMinutes: '180'
  },
  {
    id: 'kanban-workflow-review-daily',
    category: 'Kanban advisor',
    label: '每日工作流复盘',
    description: '回顾昨日用户与 Agent 的协作，提出最多三条工作流改进建议。',
    name: '每日工作流复盘',
    prompt:
      '回顾最近24小时内纳入范围的本地任务、关联会话和自动化运行记录。分析用户与 Agent 的协作流程：任务是否启动困难、报告是否支持决策、是否发生重复确认、服务失败后是否无效继续、已确认边界是否被遗漏、验证范围是否清楚。只引用可以定位的事实，不评价用户能力，不把用户沉默当作同意。最多输出三条建议，每条包含现象、证据、对用户的影响和可以直接改动的提示词/Skill/自动化规则。将结果追加到当前项目 `assistant/workflow-reviews/YYYY-MM.md`，当天重复运行时更新同一日期章节，不创建任务，不修改代码、任务状态或自动化配置。',
    preset: 'daily',
    time: '18:00',
    localTaskScope: 'all_local_projects',
    missedRunGraceMinutes: '180'
  },
  {
    id: 'kanban-knowledge-review-daily',
    category: 'Kanban advisor',
    label: '每日知识梳理',
    description: '整理昨日用户问过、Agent 实现过和实际使用到的知识，生成针对性教程。',
    name: '每日知识梳理',
    prompt:
      '整理最近24小时内用户和 Agent 在本地任务关联会话中的知识内容。范围包括：用户问过的问题、用户做出的关键选择、Agent 实现或验证时使用的新概念、反复出现的术语和容易混淆的边界。不要只记录用户明确说“不懂”的内容，也不要把所有技术细节都写成课程。每个知识单元只包含：一句话定义、当前项目例子、一个常见误解、它对当前任务的影响、一个后续可复用的判断。按用户可能已掌握、正在熟悉、容易混淆和暂不需要学习整理。将结果追加到当前项目 `assistant/workflow-reviews/knowledge-YYYY-MM.md`，当天重复运行时去重更新；不要修改代码、任务状态或用户资料，不生成大而全教程。',
    preset: 'daily',
    time: '19:00',
    localTaskScope: 'all_local_projects',
    missedRunGraceMinutes: '180'
  },
  {
    id: 'kanban-daily-progress-report',
    category: 'Kanban advisor',
    label: '每日任务进展汇报',
    description: '汇总昨日完成、进行中、风险、卡点和下一步。',
    name: '每日任务进展汇报',
    prompt:
      '汇总最近24小时内本地任务和关联会话的实际进展。按任务列出：昨日完成了什么、当前进展、未完成事项、风险、阻塞原因、已验证与未验证内容、建议下一步。区分代码实现、方案讨论、用户等待、服务失败和任务回写失败；不要把 Agent 派发成功写成任务完成，也不要把编译通过写成真机验证通过。只引用已有任务、会话和运行记录的事实。将报告追加到当前项目 `assistant/workflow-reviews/daily-YYYY-MM.md`，当天重复运行时更新同一日期章节；不修改代码、任务状态或自动化配置。',
    preset: 'daily',
    time: '09:00',
    localTaskScope: 'all_local_projects',
    missedRunGraceMinutes: '180'
  },
  {
    id: 'kanban-automation-health-daily',
    category: 'Kanban advisor',
    label: '每日自动化健康检查',
    description: '检查自动化是否正常触发、失败、错过运行或绑定了失效目标。',
    name: '每日自动化健康检查',
    prompt:
      '检查当前项目和本地任务范围内所有 Orca 自动化及最近运行记录。汇总：连续失败、连续跳过、错过运行宽限期、没有匹配任务、项目或 workspace 已失效、事件触发器未保存、运行记录没有目标会话、同一任务被重复派发。区分自动化没有触发、触发后 Agent 失败、Agent 已派发但目标会话未开始三种情况。每条问题给出证据、影响和最小修复建议。没有问题时写“今日自动化运行正常”。将结果追加到 `assistant/workflow-reviews/automation-health-YYYY-MM.md`，当天重复运行时更新同一日期章节；不要修改自动化配置、任务、代码或运行结果。',
    preset: 'daily',
    time: '08:30',
    localTaskScope: 'all_local_projects',
    missedRunGraceMinutes: '180'
  }
])
