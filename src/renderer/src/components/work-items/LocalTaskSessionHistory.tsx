import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import { LocalTaskSessionTurnHistory } from './LocalTaskSessionTurnHistory'
import { LocalTaskSessionDisclosure } from './LocalTaskSessionDisclosure'

export function LocalTaskSessionHistory({
  session,
  onManualNotesChange,
  onTagsChange
}: {
  session: {
    currentPrompt?: string | null
    latestOutput?: string | null
    manualNotes?: string | null
    tags?: string[]
    turns?: {
      id: string
      prompt: string
      summary: string | null
      createdAt: number
      updatedAt: number
    }[]
  }
  onManualNotesChange?: (manualNotes: string) => Promise<void>
  onTagsChange?: (tags: string[]) => Promise<void>
}): React.JSX.Element {
  const [manualNotes, setManualNotes] = useState(session.manualNotes ?? '')
  const [tagsText, setTagsText] = useState((session.tags ?? []).join(', '))
  const [saving, setSaving] = useState(false)
  const [savingTags, setSavingTags] = useState(false)
  useEffect(() => {
    setManualNotes(session.manualNotes ?? '')
  }, [session.manualNotes])
  useEffect(() => {
    setTagsText((session.tags ?? []).join(', '))
  }, [session.tags])
  const saveManualNotes = (): void => {
    if (!onManualNotesChange || manualNotes === (session.manualNotes ?? '') || saving) {
      return
    }
    setSaving(true)
    void onManualNotesChange(manualNotes)
      .catch(() => {})
      .finally(() => setSaving(false))
  }
  const saveTags = (): void => {
    const tags = [
      ...new Set(
        tagsText
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    ]
    if (!onTagsChange || tags.join('\0') === (session.tags ?? []).join('\0') || savingTags) {
      return
    }
    setSavingTags(true)
    void onTagsChange(tags)
      .catch(() => toast.error('会话标签保存失败'))
      .finally(() => setSavingTags(false))
  }
  return (
    <div className="space-y-3">
      {onManualNotesChange ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="session-manual-notes"
              className="text-[10px] font-medium text-muted-foreground"
            >
              会话备注
            </label>
            {saving ? <span className="text-[10px] text-muted-foreground">保存中…</span> : null}
          </div>
          <Textarea
            id="session-manual-notes"
            aria-label="会话备注"
            value={manualNotes}
            onChange={(event) => setManualNotes(event.target.value)}
            onBlur={saveManualNotes}
            placeholder="记录与当前会话相关的内容…"
            className="min-h-20 resize-y text-xs leading-relaxed"
            maxLength={100_000}
          />
        </div>
      ) : null}
      {onTagsChange ? (
        <div className="space-y-1.5">
          <label htmlFor="session-tags" className="text-[10px] font-medium text-muted-foreground">
            会话标签
          </label>
          <Textarea
            id="session-tags"
            aria-label="会话标签"
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            onBlur={saveTags}
            placeholder="例如：automation:inbox-clarification"
            className="min-h-14 resize-y text-xs leading-relaxed"
            maxLength={10_000}
          />
        </div>
      ) : null}
      {session.latestOutput ? (
        <LocalTaskSessionDisclosure
          title="本会话执行摘要"
          preview={session.latestOutput}
          className="text-xs"
        >
          <div className="whitespace-pre-wrap leading-relaxed text-foreground">
            {session.latestOutput}
          </div>
        </LocalTaskSessionDisclosure>
      ) : null}
      <LocalTaskSessionTurnHistory currentPrompt={session.currentPrompt} turns={session.turns} />
    </div>
  )
}
