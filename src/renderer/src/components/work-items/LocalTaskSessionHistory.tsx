import { useEffect, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { LocalTaskSessionTurnHistory } from './LocalTaskSessionTurnHistory'

export function LocalTaskSessionHistory({
  session,
  onManualNotesChange
}: {
  session: {
    currentPrompt?: string | null
    latestOutput?: string | null
    manualNotes?: string | null
    turns?: {
      id: string
      prompt: string
      summary: string | null
      createdAt: number
      updatedAt: number
    }[]
  }
  onManualNotesChange?: (manualNotes: string) => Promise<void>
}): React.JSX.Element {
  const [manualNotes, setManualNotes] = useState(session.manualNotes ?? '')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setManualNotes(session.manualNotes ?? '')
  }, [session.manualNotes])
  const saveManualNotes = (): void => {
    if (!onManualNotesChange || manualNotes === (session.manualNotes ?? '') || saving) {
      return
    }
    setSaving(true)
    void onManualNotesChange(manualNotes)
      .catch(() => {})
      .finally(() => setSaving(false))
  }
  return (
    <div className="space-y-3">
      {onManualNotesChange ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="session-manual-notes" className="text-[10px] font-medium text-muted-foreground">
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
      {session.latestOutput ? (
        <div className="rounded-md border border-sky-500/25 bg-sky-500/10 p-2.5 text-xs">
          <div className="mb-1 text-[10px] font-medium text-sky-700 dark:text-sky-300">
            本会话执行摘要
          </div>
          <div className="whitespace-pre-wrap leading-relaxed text-foreground">
            {session.latestOutput}
          </div>
        </div>
      ) : null}
      <LocalTaskSessionTurnHistory currentPrompt={session.currentPrompt} turns={session.turns} />
    </div>
  )
}
