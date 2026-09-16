import { useRef, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type {
  LocalTask,
  LocalTaskChecklistChange,
  LocalTaskChecklistItem
} from '../../../../shared/local-task-types'
import type { WorkItem } from './mock-data'
import { LocalTaskSubtaskCreateDialog } from './LocalTaskSubtaskCreateDialog'

export function LocalTaskChecklist({
  item,
  onTaskChanged
}: {
  item: WorkItem
  onTaskChanged: (task: LocalTask) => void
}): React.JSX.Element {
  const [converting, setConverting] = useState<LocalTaskChecklistItem | null>(null)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  const dismissingEditor = useRef(false)
  const checklist = item.checklist ?? []
  const save = async (change: LocalTaskChecklistChange): Promise<void> => {
    if (pending.current) {
      return
    }
    pending.current = true
    setSaving(true)
    setError(null)
    try {
      const task = await window.api.localTasks.update({
        taskId: item.id,
        projectPath: item.projectPath,
        updates: { checklistChange: change }
      })
      onTaskChanged(task)
      if (change.action === 'add' || (change.action === 'update' && change.title !== undefined)) {
        setDraft('')
        setEditorOpen(false)
        setEditingId(null)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '待办保存失败')
    } finally {
      pending.current = false
      setSaving(false)
    }
  }
  const submitDraft = (): void => {
    if (!draft.trim() || dismissingEditor.current) {
      return
    }
    void save(
      editingId
        ? { action: 'update', itemId: editingId, title: draft.trim() }
        : { action: 'add', title: draft.trim() }
    )
  }
  return (
    <section className="mt-6" aria-label="待办事项">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold">
          待办事项{' '}
          <span className="ml-1 font-normal text-muted-foreground">
            {checklist.filter((entry) => entry.completed).length}/{checklist.length}
          </span>
        </h3>
        <Button
          variant="ghost"
          size="xs"
          disabled={saving}
          onClick={() => {
            dismissingEditor.current = false
            setDraft('')
            setEditingId(null)
            setEditorOpen(true)
          }}
        >
          <Plus className="size-3" />
          新增待办
        </Button>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">独立勾选，需要执行时可转为子任务。</p>
      {checklist.length ? (
        <div className="divide-y divide-border rounded-md border border-border">
          {checklist.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 px-2.5 py-2">
              <Checkbox
                className="mt-1"
                checked={entry.completed}
                disabled={saving}
                aria-label={`${entry.completed ? '取消完成' : '完成'}待办：${entry.title}`}
                onCheckedChange={(checked) =>
                  void save({ action: 'update', itemId: entry.id, completed: checked === true })
                }
              />
              <span
                className={cn(
                  'min-w-0 flex-1 break-words py-1 text-xs',
                  entry.completed && 'text-muted-foreground line-through'
                )}
              >
                {entry.title}
              </span>
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0"
                disabled={saving || entry.completed}
                title={entry.completed ? '先取消完成，再转为子任务' : undefined}
                onClick={() => setConverting(entry)}
              >
                转为子任务
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={saving}
                aria-label={`编辑待办：${entry.title}`}
                onClick={() => {
                  dismissingEditor.current = false
                  setDraft(entry.title)
                  setEditingId(entry.id)
                  setEditorOpen(true)
                }}
              >
                <Pencil className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={saving}
                aria-label={`删除待办：${entry.title}`}
                onClick={() => void save({ action: 'delete', itemId: entry.id })}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border px-2 py-4 text-center text-xs text-muted-foreground">
          暂无待办，点击“新增待办”记录一件小事。
        </p>
      )}
      {editorOpen ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            submitDraft()
          }}
        >
          <Input
            autoFocus
            aria-label="待办内容"
            maxLength={500}
            value={draft}
            disabled={saving}
            placeholder="记录一件待办事项"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (!editingId) {
                submitDraft()
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !saving) {
                dismissingEditor.current = true
                setEditorOpen(false)
              }
              if (event.key === 'Enter' && event.nativeEvent.isComposing) {
                event.preventDefault()
              }
            }}
          />
          {editingId ? (
            <>
              <Button type="submit" size="sm" disabled={saving || !draft.trim()}>
                {saving ? '保存中…' : '保存'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => setEditorOpen(false)}
              >
                取消
              </Button>
            </>
          ) : null}
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {converting ? (
        <LocalTaskSubtaskCreateDialog
          item={item}
          checklistItem={converting}
          initiallyOpen
          onClosed={() => setConverting(null)}
          onTaskChanged={onTaskChanged}
        />
      ) : null}
    </section>
  )
}
