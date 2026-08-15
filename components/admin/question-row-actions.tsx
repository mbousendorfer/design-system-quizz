'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArchiveIcon, CopyIcon, EyeIcon, EyeOffIcon, MoreHorizontalIcon, PencilIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toast'
import { duplicateQuestionAction, setStatusAction } from '@/lib/admin/actions'
import { copy } from '@/lib/copy'
import type { Status } from '@/lib/schema/question'

/**
 * There is no delete. Past answers reference every version of every question, so
 * removing one would make the statistics lie about what people were actually asked.
 * Archive is the way out.
 */
export function QuestionRowActions({
  id,
  version,
  status,
}: {
  id: string
  version: number
  status: Status
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  function run(work: () => Promise<{ ok: boolean; errors?: string[] }>, success: string) {
    setOpen(false)
    startTransition(async () => {
      const result = await work()
      if (result.ok) {
        // Base UI's toast manager takes `add({ title, type })` — `toast.success()`
        // is the sonner API, which this project is not on.
        toast.add({ title: success, type: 'success' })
        router.refresh()
      } else {
        // Publishing can be refused — the blocking rules are the same here as in
        // the form, so the list cannot be used to sidestep them.
        toast.add({
          title: copy.questions.publishRefused,
          description: result.errors?.join(' · ') ?? copy.errors.generic,
          type: 'error',
        })
      }
    })
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" disabled={pending} aria-label={copy.questions.rowActions} />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/admin/questions/${id}/edit`)}>
          <PencilIcon />
          {copy.questions.edit}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() =>
            run(async () => {
              const result = await duplicateQuestionAction(id)
              if (result.ok) router.push(`/admin/questions/${result.data.id}/edit`)
              return result
            }, copy.questions.duplicated)
          }
        >
          <CopyIcon />
          {copy.questions.duplicate}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {status === 'published' ? (
          <DropdownMenuItem
            onClick={() => run(() => setStatusAction(id, version, 'draft'), copy.questions.unpublished)}
          >
            <EyeOffIcon />
            {copy.questions.unpublish}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => run(() => setStatusAction(id, version, 'published'), copy.questions.published)}
          >
            <EyeIcon />
            {copy.questions.publish}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => run(() => setStatusAction(id, version, 'archived'), copy.questions.archived)}
        >
          <ArchiveIcon />
          {copy.questions.archive}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
