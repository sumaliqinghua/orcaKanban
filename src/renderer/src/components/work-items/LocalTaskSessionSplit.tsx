import { useRef, useState, type ReactNode } from 'react'

export function LocalTaskSessionSplit({
  history,
  children
}: {
  history: ReactNode
  children: ReactNode
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<{ y: number; percent: number; height: number } | null>(null)
  const [historyPercent, setHistoryPercent] = useState(30)
  const resize = (percent: number): void => setHistoryPercent(Math.min(75, Math.max(10, percent)))
  return (
    <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div
        className="scrollbar-sleek min-h-0 shrink-0 overflow-y-auto p-3"
        style={{ height: `${historyPercent}%` }}
      >
        {history}
      </div>
      <div
        role="separator"
        tabIndex={0}
        aria-label="调整 Agent 会话高度"
        aria-orientation="horizontal"
        aria-valuemin={10}
        aria-valuemax={75}
        aria-valuenow={Math.round(historyPercent)}
        className="group z-10 flex h-1.5 shrink-0 touch-none cursor-ns-resize items-center justify-center bg-muted/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return
          }
          const height = containerRef.current?.getBoundingClientRect().height
          if (!height) {
            return
          }
          event.preventDefault()
          event.currentTarget.focus()
          event.currentTarget.setPointerCapture(event.pointerId)
          dragStart.current = { y: event.clientY, percent: historyPercent, height }
        }}
        onPointerMove={(event) => {
          const start = dragStart.current
          if (start) {
            resize(start.percent + ((event.clientY - start.y) / start.height) * 100)
          }
        }}
        onPointerUp={(event) => {
          dragStart.current = null
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onPointerCancel={() => {
          dragStart.current = null
        }}
        onLostPointerCapture={() => {
          dragStart.current = null
        }}
        onKeyDown={(event) => {
          const next = {
            ArrowUp: historyPercent - 5,
            ArrowDown: historyPercent + 5,
            Home: 10,
            End: 75
          }[event.key]
          if (next === undefined) {
            return
          }
          event.preventDefault()
          resize(next)
        }}
      >
        <span className="h-0.5 w-8 rounded-full bg-border group-hover:bg-muted-foreground" />
      </div>
      {children}
    </div>
  )
}
