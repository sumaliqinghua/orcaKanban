import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { AutomationLocalTaskScope } from '../../../../shared/automations-types'
import { AUTOMATION_EDITOR_SECTION_LABEL_CLASS, Field } from './automation-page-parts'
import type { AutomationDraft } from './AutomationEditorDialog'

export function AutomationLocalTaskScopeField({
  draft,
  segmentedGroupClassName,
  segmentedItemClassName,
  onDraftChange
}: {
  draft: AutomationDraft
  segmentedGroupClassName: string
  segmentedItemClassName: string
  onDraftChange: (updater: (current: AutomationDraft) => AutomationDraft) => void
}): React.JSX.Element {
  return (
    <Field className="mb-4" labelClassName={AUTOMATION_EDITOR_SECTION_LABEL_CLASS} label="任务范围">
      <ToggleGroup
        type="single"
        value={draft.localTaskScope ?? 'workspace'}
        onValueChange={(value) =>
          value &&
          onDraftChange((current) => ({
            ...current,
            localTaskScope: value as AutomationLocalTaskScope,
            workspaceMode: 'existing'
          }))
        }
        size="sm"
        className={segmentedGroupClassName}
      >
        <ToggleGroupItem value="workspace" className={segmentedItemClassName}>
          当前 workspace
        </ToggleGroupItem>
        <ToggleGroupItem value="all_local_projects" className={segmentedItemClassName}>
          所有本机项目
        </ToggleGroupItem>
      </ToggleGroup>
    </Field>
  )
}
