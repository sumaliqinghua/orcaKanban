import AgentCombobox from '@/components/agent/AgentCombobox'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  isValidAutomationCronSchedule,
  isValidAutomationSchedule
} from '../../../../shared/automation-schedule-parsing'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { OrcaHooks } from '../../../../shared/orca-yaml-hook-types'
import type { ProjectHostSetup } from '../../../../shared/project-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { AgentCatalogEntry } from '@/lib/agent-catalog'
import { AUTOMATION_EDITOR_SECTION_LABEL_CLASS, Field } from './automation-page-parts'
import { AutomationMissedRunGraceField } from './AutomationMissedRunGraceField'
import { AutomationPrecheckFields } from './AutomationPrecheckFields'
import AutomationProjectCombobox from './AutomationProjectCombobox'
import { AutomationSchedulePicker } from './AutomationSchedulePicker'
import { AutomationSessionField } from './AutomationSessionField'
import { AutomationSetupDecisionField } from './AutomationSetupDecisionField'
import { AutomationWorkspaceField } from './AutomationWorkspaceField'
import { AutomationLocalTaskScopeField } from './AutomationLocalTaskScopeField'
import { AutomationDestinationField } from './AutomationDestinationField'
import type { AutomationEventType } from '../../../../shared/automations-types'
import type { AutomationCreateDestinationControl } from './use-automation-create-destination'
import type { AutomationDraft } from './AutomationEditorDialog'

type AutomationEditorSettingsSidebarProps = {
  /** The host picker: where a create lands, or the host an edit can move the record to. */
  destination?: AutomationCreateDestinationControl
  isHermesTarget: boolean
  isHermesCreate: boolean
  repos: readonly Repo[]
  projectHostSetups: readonly ProjectHostSetup[]
  automationYamlHooksByRepoKey: Record<string, OrcaHooks | null>
  getAutomationHooksCacheKey: (repoId: string) => string
  repoMap: Map<string, Repo>
  worktrees: Worktree[]
  settings: GlobalSettings | null
  draft: AutomationDraft
  visibleAgents: AgentCatalogEntry[]
  pickerTriggerClassName: string
  segmentedGroupClassName: string
  segmentedItemClassName: string
  onProjectChange: (projectId: string) => void
  getRepoHostLabel?: (repo: Repo) => string | null | undefined
  allowAddProject?: boolean
  onDraftChange: (updater: (current: AutomationDraft) => AutomationDraft) => void
  onSetupDecisionTouched: () => void
}

export function AutomationEditorSettingsSidebar({
  destination,
  isHermesTarget,
  isHermesCreate,
  repos,
  projectHostSetups,
  automationYamlHooksByRepoKey,
  getAutomationHooksCacheKey,
  repoMap,
  worktrees,
  settings,
  draft,
  visibleAgents,
  pickerTriggerClassName,
  segmentedGroupClassName,
  segmentedItemClassName,
  onProjectChange,
  getRepoHostLabel,
  allowAddProject,
  onDraftChange,
  onSetupDecisionTouched
}: AutomationEditorSettingsSidebarProps): React.JSX.Element {
  return (
    <aside className="flex w-[320px] shrink-0 flex-col overflow-auto border-l border-border/50 bg-muted/20 px-5 py-5 scrollbar-sleek">
      <div className="flex flex-col">
        <Field
          className="mb-4"
          labelClassName={AUTOMATION_EDITOR_SECTION_LABEL_CLASS}
          label="执行内容"
        >
          <ToggleGroup
            type="single"
            value={draft.executionMode ?? 'prompt'}
            onValueChange={(value) =>
              value &&
              onDraftChange((current) => ({
                ...current,
                executionMode: value as AutomationDraft['executionMode'],
                prompt:
                  value === 'open_local_tasks' && !current.prompt.trim()
                    ? '执行当前项目与 workspace 中所有可执行的 Open 本地任务。'
                    : current.prompt,
                workspaceMode: value === 'open_local_tasks' ? 'existing' : current.workspaceMode,
                reuseSession: value === 'open_local_tasks' ? false : current.reuseSession
              }))
            }
            size="sm"
            className={segmentedGroupClassName}
          >
            <ToggleGroupItem value="prompt" className={segmentedItemClassName}>
              Prompt
            </ToggleGroupItem>
            <ToggleGroupItem value="open_local_tasks" className={segmentedItemClassName}>
              Open 本地任务
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
        {draft.executionMode === 'open_local_tasks' ? (
          <AutomationLocalTaskScopeField
            draft={draft}
            segmentedGroupClassName={segmentedGroupClassName}
            segmentedItemClassName={segmentedItemClassName}
            onDraftChange={onDraftChange}
          />
        ) : null}
        {/* Why: Hermes keeps project/workspace/schedule only. Collapse the
            Orca-only knobs so switching the create target does not jump. */}
        <div
          className={cn(
            'grid overflow-hidden transition-[grid-template-rows,margin] duration-200 ease-out',
            isHermesTarget ? 'mb-0 grid-rows-[0fr]' : 'mb-4 grid-rows-[1fr]'
          )}
          aria-hidden={isHermesTarget}
          inert={isHermesTarget}
        >
          <div className="min-h-0">
            <div
              className={cn(
                'flex flex-col gap-5 transition-[opacity,transform] duration-150 ease-out',
                isHermesTarget
                  ? '-translate-y-1 opacity-0 delay-0'
                  : 'translate-y-0 opacity-100 delay-200'
              )}
            >
              <Field
                labelClassName={AUTOMATION_EDITOR_SECTION_LABEL_CLASS}
                label={translate(
                  'auto.components.automations.AutomationEditorDialog.57b722cbba',
                  'Agent'
                )}
              >
                <AgentCombobox
                  agents={visibleAgents}
                  value={draft.agentId}
                  onValueChange={(agentId) =>
                    agentId && onDraftChange((current) => ({ ...current, agentId }))
                  }
                  defaultAgent={settings?.defaultTuiAgent ?? null}
                  triggerClassName={`h-9 w-full min-w-0 ${pickerTriggerClassName}`}
                  allowNarrowTrigger
                />
              </Field>
            </div>
          </div>
        </div>
        {destination && !isHermesTarget ? (
          <div className="mb-4">
            <AutomationDestinationField
              control={destination}
              labelClassName={AUTOMATION_EDITOR_SECTION_LABEL_CLASS}
            />
          </div>
        ) : null}
        <Field
          className="mb-4"
          labelClassName={AUTOMATION_EDITOR_SECTION_LABEL_CLASS}
          label={translate(
            'auto.components.automations.AutomationEditorDialog.02d351877e',
            'Project'
          )}
        >
          <AutomationProjectCombobox
            repos={repos}
            value={draft.projectId}
            onValueChange={onProjectChange}
            placeholder={translate(
              'auto.components.automations.AutomationEditorDialog.0d17f4ca8f',
              'Select project'
            )}
            triggerClassName={`h-9 w-full min-w-0 ${pickerTriggerClassName}`}
            getRepoHostLabel={getRepoHostLabel}
            allowAddProject={allowAddProject}
          />
        </Field>
        <div className="mb-4">
          <AutomationWorkspaceField
            draft={draft}
            isHermesTarget={isHermesTarget}
            worktrees={worktrees}
            repoMap={repoMap}
            pickerTriggerClassName={pickerTriggerClassName}
            segmentedGroupClassName={segmentedGroupClassName}
            segmentedItemClassName={segmentedItemClassName}
            onDraftChange={onDraftChange}
          />
        </div>
        <div
          className={cn(
            'grid overflow-hidden transition-[grid-template-rows,margin] duration-200 ease-out',
            isHermesTarget ? 'mb-0 grid-rows-[0fr]' : 'mb-4 grid-rows-[1fr]'
          )}
          aria-hidden={isHermesTarget}
          inert={isHermesTarget}
        >
          <div className="min-h-0">
            <AutomationSessionField
              draft={draft}
              toggleGroupClassName={segmentedGroupClassName}
              toggleItemClassName={segmentedItemClassName}
              onDraftChange={onDraftChange}
            />
          </div>
        </div>
        {!isHermesTarget ? (
          <Field
            className="mb-4"
            labelClassName={AUTOMATION_EDITOR_SECTION_LABEL_CLASS}
            label="事件触发（可选）"
          >
            <select
              value={draft.eventType ?? ''}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  eventType: (event.target.value || null) as AutomationEventType | null
                }))
              }
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">仅按定时或手动运行</option>
              <option value="local_task.intake_changed">任务进入收件箱</option>
              <option value="local_task.status_changed">任务变为待审阅</option>
              <option value="local_task.reopened">任务重新打开</option>
              <option value="agent_session.completed">Agent 会话完成</option>
            </select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              事件自动化仍使用下方提示词；只在状态真正变化时运行。
            </p>
            {draft.eventType === 'local_task.status_changed' ? (
              <select
                value={draft.eventStatus ?? 'Needs review'}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    eventStatus: event.target.value as AutomationDraft['eventStatus']
                  }))
                }
                className="mt-2 h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                aria-label="目标任务状态"
              >
                <option value="Open">Open</option>
                <option value="In progress">In progress</option>
                <option value="Needs review">Needs review</option>
                <option value="Done">Done</option>
              </select>
            ) : null}
          </Field>
        ) : null}
        <Field
          className="mb-4"
          labelClassName={AUTOMATION_EDITOR_SECTION_LABEL_CLASS}
          label={translate(
            'auto.components.automations.AutomationEditorDialog.c4b19094c2',
            draft.eventType ? '日程（事件触发时不使用）' : 'Schedule'
          )}
        >
          <AutomationSchedulePicker
            draft={draft}
            validateAdvancedSchedule={
              isHermesTarget ? isValidAutomationCronSchedule : isValidAutomationSchedule
            }
            onDraftChange={onDraftChange}
          />
        </Field>
        <div
          className={cn(
            'grid overflow-hidden transition-[grid-template-rows,margin] duration-200 ease-out',
            isHermesTarget ? 'mb-0 grid-rows-[0fr]' : 'mb-4 grid-rows-[1fr]'
          )}
          aria-hidden={isHermesTarget}
          inert={isHermesTarget}
        >
          <div className="min-h-0">
            <AutomationMissedRunGraceField
              draft={draft}
              disabled={isHermesTarget}
              pickerTriggerClassName={pickerTriggerClassName}
              onDraftChange={onDraftChange}
            />
          </div>
        </div>
        <div
          className={cn(
            'grid overflow-hidden transition-[grid-template-rows,margin] duration-200 ease-out',
            isHermesCreate ? 'mb-0 grid-rows-[0fr]' : 'mb-4 grid-rows-[1fr]'
          )}
          aria-hidden={isHermesCreate}
          inert={isHermesCreate}
        >
          <div className="min-h-0">
            <div className="flex flex-col gap-5">
              <AutomationPrecheckFields
                draft={draft}
                disabled={isHermesCreate}
                pickerTriggerClassName={pickerTriggerClassName}
                onDraftChange={onDraftChange}
              />
            </div>
          </div>
        </div>
        <AutomationSetupDecisionField
          createTarget={isHermesTarget ? 'hermes' : 'orca'}
          draft={draft}
          repos={repos}
          projectHostSetups={projectHostSetups}
          yamlHooks={automationYamlHooksByRepoKey[getAutomationHooksCacheKey(draft.projectId)]}
          onDraftChange={onDraftChange}
          onSetupDecisionTouched={onSetupDecisionTouched}
        />
      </div>
    </aside>
  )
}
