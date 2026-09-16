import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export function LocalTaskSessionDisclosure({
  title,
  preview,
  children,
  className
}: {
  title: string
  preview?: string
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <Collapsible
      defaultOpen
      className={cn('rounded-md border border-border/70 bg-muted/20', className)}
    >
      <CollapsibleTrigger className="group flex w-full min-w-0 items-center gap-2 rounded-md p-2.5 text-left text-[10px] font-medium text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown className="size-3.5 shrink-0 -rotate-90 transition-transform group-data-[state=open]:rotate-0 motion-reduce:transition-none" />
        <span className="shrink-0">{title}</span>
        {preview ? (
          <span className="truncate font-normal group-data-[state=open]:hidden">{preview}</span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2.5 pb-2.5">{children}</CollapsibleContent>
    </Collapsible>
  )
}
