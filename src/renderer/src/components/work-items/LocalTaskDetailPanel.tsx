import { useState } from 'react'
import { ArrowUpRight, Bot, ChevronDown, GitBranch, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { WorkItem } from './mock-data'
import type { LocalTask } from '../../../../shared/local-task-types'
import { LocalTaskAgentPicker } from './LocalTaskAgentPicker'
import { LocalTaskLabelSuggestions } from './LocalTaskLabelSuggestions'
import { LocalTaskSessionTurnHistory } from './LocalTaskSessionTurnHistory'
import { LocalTaskSubtaskCreateDialog } from './LocalTaskSubtaskCreateDialog'
import { LocalTaskSubtaskBlock } from './LocalTaskSubtaskBlock'
import { LocalTaskReportButton } from './LocalTaskReportButton'
import type { TuiAgent } from '../../../../shared/tui-agent'

export function DetailPanel({
  item,
  onCompleteSubtask,
  onEditTitle,
  onEditDescription,
  onEditLabels,
  labelSuggestions,
  onEditStep,
  onOpenSession,
  onOpenWorkspace,
  onSessionStarted,
  onReportSessionStarted,
  onTaskChanged
}: {
  item: WorkItem
  onCompleteSubtask: (subtaskId: string) => void
  onEditTitle: (title: string) => void
  onEditDescription: (description: string) => void
  onEditLabels: (labels: string[]) => void
  labelSuggestions: string[]
  onEditStep: (subtaskId: string, stepId: string) => void
  onOpenSession: (sessionId: string) => void
  onOpenWorkspace: () => void
  onSessionStarted: (tabId: string, request: string) => void
  onReportSessionStarted: (tabId: string, request: string, agent: TuiAgent) => Promise<void>
  onTaskChanged: (task: LocalTask) => void
}): React.JSX.Element {
  const [titleDialogOpen, setTitleDialogOpen] = useState(false)
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false)
  const [labelsDialogOpen, setLabelsDialogOpen] = useState(false)
  const [expandedSessionHistoryId, setExpandedSessionHistoryId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState(item.title)
  const [descriptionDraft, setDescriptionDraft] = useState(item.description)
  const [labelsDraft, setLabelsDraft] = useState((item.labels ?? []).join(', '))
  const openTitleDialog = (): void => {
    setTitleDraft(item.title)
    setTitleDialogOpen(true)
  }
  const openDescriptionDialog = (): void => {
    setDescriptionDraft(item.description)
    setDescriptionDialogOpen(true)
  }
  const openLabelsDialog = (): void => {
    setLabelsDraft((item.labels ?? []).join(', '))
    setLabelsDialogOpen(true)
  }
  const saveLabels = (): void => {
    const labels = [
      ...new Set(
        labelsDraft
          .split(',')
          .map((label) => label.trim())
          .filter(Boolean)
      )
    ].slice(0, 20)
    onEditLabels(labels)
    setLabelsDialogOpen(false)
  }
  const labelQuery = labelsDraft.split(',').at(-1)?.trim().toLowerCase() ?? ''
  const selectedLabels = new Set(
    labelsDraft
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean)
  )
  const matchingLabelSuggestions = labelSuggestions
    .filter((label) => !selectedLabels.has(label))
    .filter((label) => !labelQuery || label.toLowerCase().includes(labelQuery))
    .slice(0, 8)
  const addLabelSuggestion = (label: string): void => {
    const parts = labelsDraft.split(',')
    parts.pop()
    setLabelsDraft(`${[...parts.map((part) => part.trim()).filter(Boolean), label].join(', ')}, `)
  }
  return (
    <>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-lg font-semibold leading-tight tracking-tight">
            {item.title}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-2 -mt-1 text-muted-foreground"
            onClick={openTitleDialog}
            aria-label="编辑任务标题"
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
        {item.titleSource === 'ai-suggestion' ? (
          <p className="mt-1 text-[10px] text-muted-foreground">
            标题由 AI 在首次执行后生成，后续由你编辑
          </p>
        ) : null}
        <div className="mt-2 flex items-start gap-2">
          <p className="flex-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-2 -mt-1 text-muted-foreground"
            onClick={openDescriptionDialog}
            aria-label="编辑任务描述"
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
        <div className="mt-3 flex justify-end">
          <LocalTaskReportButton
            item={item}
            onOpenSession={onOpenSession}
            onStarted={onReportSessionStarted}
          />
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          {(item.labels ?? []).map((label) => (
            <span
              key={label}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {label}
            </span>
          ))}
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-5"
            onClick={openLabelsDialog}
            aria-label="编辑任务标签"
          >
            <Pencil className="size-3" />
          </Button>
        </div>
        <div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5">{item.project}</span>
          <span>·</span>
          <span>{item.workspace}</span>
        </div>
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold">
              子任务{' '}
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                {item.subtasks.filter((subtask) => subtask.status === 'done').length}/
                {item.subtasks.length}
              </span>
            </h3>
            <LocalTaskSubtaskCreateDialog item={item} onTaskChanged={onTaskChanged} />
          </div>
          <div className="space-y-2">
            {item.subtasks.length ? (
              item.subtasks.map((subtask) => (
                <LocalTaskSubtaskBlock
                  key={subtask.id}
                  subtask={subtask}
                  sessions={item.sessionsList}
                  onComplete={() => onCompleteSubtask(subtask.id)}
                  onEditStep={(stepId) => onEditStep(subtask.id, stepId)}
                  onTaskChanged={onTaskChanged}
                />
              ))
            ) : (
              <div className="rounded-md border border-dashed border-border px-2 py-4 text-center text-[11px] text-muted-foreground">
                会话执行后会在这里生成子任务
              </div>
            )}
          </div>
        </section>
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold">
              关联会话{' '}
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                {item.sessions}
              </span>
            </h3>
            <span className="text-[10px] text-muted-foreground">仅从任务中心关联</span>
          </div>
          <div className="space-y-1">
            {item.sessionsList.map((session) => {
              const sessionId = session.id ?? session.title
              const historyExpanded = expandedSessionHistoryId === sessionId
              return (
                <div key={sessionId} className="rounded-md border border-border/70">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenSession(sessionId)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left hover:bg-accent"
                    >
                      <Bot className="size-3.5 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-[11px]">{session.title}</span>
                      <span className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
                        {session.associationSource === 'automation'
                          ? '自动化'
                          : session.associationSource === 'clarification'
                            ? '任务澄清'
                            : session.associationSource === 'task-report'
                              ? '任务报告'
                              : '手动'}
                      </span>
                      <span
                        className={cn(
                          'size-1.5 rounded-full',
                          session.status === 'working'
                            ? 'bg-sky-500'
                            : session.status === 'done'
                              ? 'bg-emerald-500'
                              : 'bg-muted-foreground/40'
                        )}
                      />
                      <span className="text-[10px] text-muted-foreground">{session.time}</span>
                      <ArrowUpRight className="size-3 text-muted-foreground" />
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="mr-1 size-6"
                      aria-label={historyExpanded ? '收起会话历史' : '展开会话历史'}
                      onClick={() =>
                        setExpandedSessionHistoryId(historyExpanded ? null : sessionId)
                      }
                    >
                      <ChevronDown
                        className={cn(
                          'size-3.5 transition-transform',
                          historyExpanded && 'rotate-180'
                        )}
                      />
                    </Button>
                  </div>
                  {session.currentPrompt ? (
                    <div className="border-t border-border/50 px-2.5 py-1.5 text-[10px] leading-relaxed text-muted-foreground line-clamp-2">
                      当前：{session.currentPrompt}
                    </div>
                  ) : null}
                  {historyExpanded ? (
                    <div className="border-t border-border/60 p-2">
                      <LocalTaskSessionTurnHistory
                        currentPrompt={session.currentPrompt}
                        turns={session.turns}
                        compact
                      />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          <LocalTaskAgentPicker item={item} onStarted={onSessionStarted} />
        </section>
        <section className="mt-6">
          <h3 className="mb-2 text-xs font-semibold">Workspace</h3>
          <div className="rounded-md border border-border p-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <GitBranch className="size-3.5 text-muted-foreground" />
              {item.workspace}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-6 gap-1 px-0 text-[10px]"
              onClick={onOpenWorkspace}
            >
              <ArrowUpRight className="size-3" />
              打开 workspace 查看对话
            </Button>
          </div>
        </section>
      </div>
      <Dialog open={titleDialogOpen} onOpenChange={setTitleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑任务标题</DialogTitle>
            <DialogDescription>修改后会写入当前任务的 task.json。</DialogDescription>
          </DialogHeader>
          <Input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTitleDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                onEditTitle(titleDraft)
                setTitleDialogOpen(false)
              }}
              disabled={!titleDraft.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={descriptionDialogOpen} onOpenChange={setDescriptionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑任务描述</DialogTitle>
            <DialogDescription>修改后会写入当前任务的 task.json。</DialogDescription>
          </DialogHeader>
          <Textarea
            value={descriptionDraft}
            onChange={(event) => setDescriptionDraft(event.target.value)}
            aria-label="任务描述"
            rows={6}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDescriptionDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                onEditDescription(descriptionDraft.trim())
                setDescriptionDialogOpen(false)
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={labelsDialogOpen} onOpenChange={setLabelsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑任务标签</DialogTitle>
            <DialogDescription>用逗号分隔多个标签，最多保留 20 个。</DialogDescription>
          </DialogHeader>
          <Input
            value={labelsDraft}
            onChange={(event) => setLabelsDraft(event.target.value)}
            placeholder="例如：性能, Unity, 待验证"
            autoFocus
          />
          <LocalTaskLabelSuggestions
            labels={matchingLabelSuggestions}
            onSelect={addLabelSuggestion}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={saveLabels}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
