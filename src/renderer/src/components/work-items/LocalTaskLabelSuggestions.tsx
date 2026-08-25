import { Button } from '@/components/ui/button'

export function LocalTaskLabelSuggestions({
  labels,
  onSelect
}: {
  labels: string[]
  onSelect: (label: string) => void
}): React.JSX.Element | null {
  if (labels.length === 0) {
    return null
  }
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="标签候选">
      {labels.map((label) => (
        <Button
          key={label}
          type="button"
          variant="secondary"
          size="xs"
          className="h-6 px-2 text-[10px]"
          onClick={() => onSelect(label)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}
