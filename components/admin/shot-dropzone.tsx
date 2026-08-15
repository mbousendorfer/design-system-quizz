'use client'

import { useRef, useState } from 'react'
import { ImageIcon, Loader2Icon, TrashIcon, UploadIcon } from 'lucide-react'

import { Shot } from '@/components/game/shot'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { uploadShotAction } from '@/lib/admin/actions'
import { copy } from '@/lib/copy'
import { cn } from '@/lib/utils'

/**
 * Drag-and-drop upload for a screenshot.
 *
 * The file is renamed to an opaque key on the server, so a screenshot called
 * `badge-orange-wrong.png` can be dropped here without the filename ever becoming
 * a hint in the player's network tab. Nobody has to remember to rename anything.
 */
export function ShotDropzone({
  imageKey,
  onChange,
  label,
}: {
  imageKey: string | null
  onChange: (key: string | null) => void
  label: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File | undefined) {
    if (!file) return
    setError(null)
    setUploading(true)

    const body = new FormData()
    body.set('file', file)
    const result = await uploadShotAction(body)

    setUploading(false)
    if (result.ok) onChange(result.data.key)
    else setError(result.errors.join(' '))
  }

  if (imageKey) {
    return (
      <div className="flex flex-col gap-2">
        <Shot imageKey={imageKey} alt={label} />
        <div className="flex items-center gap-2">
          <code className="text-xs text-muted-foreground">{imageKey}</code>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => onChange(null)}
          >
            <TrashIcon data-icon="inline-start" />
            {copy.questions.form.imageRemove}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void upload(event.dataTransfer.files[0])
        }}
        className={cn('rounded-lg border border-dashed', dragging && 'border-primary')}
      >
        <Empty className="p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {uploading ? <Loader2Icon className="animate-spin" /> : <ImageIcon />}
            </EmptyMedia>
            <EmptyTitle>{label}</EmptyTitle>
            <EmptyDescription>
              {error ?? (uploading ? copy.questions.form.imageUploading : copy.questions.form.imageDrop)}
            </EmptyDescription>
          </EmptyHeader>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => input.current?.click()}
          >
            <UploadIcon data-icon="inline-start" />
            {copy.questions.form.imageChoose}
          </Button>
        </Empty>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label={label}
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <p className="text-xs text-muted-foreground">{copy.questions.form.imageHint}</p>
    </div>
  )
}
