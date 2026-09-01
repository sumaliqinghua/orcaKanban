import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import { MAX_PROMPT_LIBRARY_CATEGORY_NAME_LENGTH } from '../../../../shared/prompt-library'

type PromptLibraryCategoryDialogProps = {
  open: boolean
  initialName: string
  existingNames: readonly string[]
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => Promise<void>
}

export function PromptLibraryCategoryDialog({
  open,
  initialName,
  existingNames,
  onOpenChange,
  onSave
}: PromptLibraryCategoryDialogProps): React.JSX.Element {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const normalizedName = name.trim().replace(/\s+/g, ' ')
  const duplicate = existingNames.some(
    (existing) => existing.trim().toLowerCase() === normalizedName.toLowerCase()
  )

  const handleSave = async (): Promise<void> => {
    if (!normalizedName || duplicate || saving) {
      return
    }
    setSaving(true)
    try {
      await onSave(normalizedName)
      onOpenChange(false)
    } catch {
      // 保存方负责显示具体失败原因；保留表单供用户重试。
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initialName
              ? translate('promptLibrary.category.renameTitle', 'Rename category')
              : translate('promptLibrary.category.addTitle', 'New category')}
          </DialogTitle>
          <DialogDescription>
            {translate('promptLibrary.category.description', 'Categories group related prompts.')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="prompt-library-category-name">
            {translate('promptLibrary.category.name', 'Name')}
          </Label>
          <Input
            id="prompt-library-category-name"
            value={name}
            maxLength={MAX_PROMPT_LIBRARY_CATEGORY_NAME_LENGTH}
            aria-invalid={duplicate || undefined}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleSave()
              }
            }}
          />
          {duplicate ? (
            <p className="text-xs text-destructive">
              {translate('promptLibrary.category.duplicate', 'A category with this name exists.')}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {translate('promptLibrary.cancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            disabled={!normalizedName || duplicate || saving}
            onClick={() => void handleSave()}
          >
            {translate('promptLibrary.save', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
