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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import {
  MAX_PROMPT_LIBRARY_CONTENT_LENGTH,
  MAX_PROMPT_LIBRARY_TITLE_LENGTH,
  type PromptLibraryCategory,
  type PromptLibraryPrompt
} from '../../../../shared/prompt-library'

const UNCATEGORIZED_VALUE = '__uncategorized__'

type PromptLibraryPromptDraft = Pick<PromptLibraryPrompt, 'title' | 'content' | 'categoryId'>

type PromptLibraryPromptDialogProps = {
  open: boolean
  prompt: PromptLibraryPrompt | null
  defaultCategoryId: string | null
  categories: readonly PromptLibraryCategory[]
  onOpenChange: (open: boolean) => void
  onSave: (draft: PromptLibraryPromptDraft) => Promise<void>
}

export function PromptLibraryPromptDialog({
  open,
  prompt,
  defaultCategoryId,
  categories,
  onOpenChange,
  onSave
}: PromptLibraryPromptDialogProps): React.JSX.Element {
  const [title, setTitle] = useState(prompt?.title ?? '')
  const [content, setContent] = useState(prompt?.content ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(
    prompt?.categoryId ?? defaultCategoryId
  )
  const [saving, setSaving] = useState(false)

  const normalizedTitle = title.trim().replace(/\s+/g, ' ')
  const normalizedContent = content.trim()
  const canSave = Boolean(normalizedTitle && normalizedContent && !saving)

  const handleSave = async (): Promise<void> => {
    if (!canSave) {
      return
    }
    setSaving(true)
    try {
      await onSave({ title: normalizedTitle, content: normalizedContent, categoryId })
      onOpenChange(false)
    } catch {
      // 保存方负责显示具体失败原因；保留表单供用户重试。
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {prompt
              ? translate('promptLibrary.prompt.editTitle', 'Edit prompt')
              : translate('promptLibrary.prompt.addTitle', 'New prompt')}
          </DialogTitle>
          <DialogDescription>
            {translate('promptLibrary.prompt.description', 'Save reusable prompt text.')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="prompt-library-prompt-title">
              {translate('promptLibrary.prompt.title', 'Title')}
            </Label>
            <Input
              id="prompt-library-prompt-title"
              value={title}
              maxLength={MAX_PROMPT_LIBRARY_TITLE_LENGTH}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prompt-library-prompt-category">
              {translate('promptLibrary.category.label', 'Category')}
            </Label>
            <Select
              value={categoryId ?? UNCATEGORIZED_VALUE}
              onValueChange={(value) => setCategoryId(value === UNCATEGORIZED_VALUE ? null : value)}
            >
              <SelectTrigger id="prompt-library-prompt-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCATEGORIZED_VALUE}>
                  {translate('promptLibrary.category.uncategorized', 'Uncategorized')}
                </SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prompt-library-prompt-content">
              {translate('promptLibrary.prompt.content', 'Prompt')}
            </Label>
            <Textarea
              id="prompt-library-prompt-content"
              value={content}
              maxLength={MAX_PROMPT_LIBRARY_CONTENT_LENGTH}
              rows={10}
              className="resize-y font-mono text-xs leading-relaxed"
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {translate('promptLibrary.cancel', 'Cancel')}
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => void handleSave()}>
            {translate('promptLibrary.save', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type { PromptLibraryPromptDraft }
