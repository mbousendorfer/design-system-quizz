'use client'

import { RotateCcwIcon, TriangleAlertIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { copy } from '@/lib/copy'

/**
 * The catch-all for anything that throws while rendering.
 *
 * It shows the digest rather than the message: Next.js replaces server error
 * messages with an opaque digest in production precisely so they do not leak,
 * and the digest is what makes a report findable in the logs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main id="content" className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-16">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>{copy.errors.generic}</EmptyTitle>
          <EmptyDescription>
            {error.digest ? copy.errors.withDigest(error.digest) : copy.errors.noDigest}
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={reset}>
          <RotateCcwIcon data-icon="inline-start" />
          {copy.errors.retry}
        </Button>
      </Empty>
    </main>
  )
}
