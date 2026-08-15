import Link from 'next/link'
import { CompassIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { copy } from '@/lib/copy'

export default function NotFound() {
  return (
    <main id="content" className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-16">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CompassIcon />
          </EmptyMedia>
          <EmptyTitle>{copy.errors.notFound}</EmptyTitle>
          <EmptyDescription>{copy.errors.notFoundHint}</EmptyDescription>
        </EmptyHeader>
        <Button nativeButton={false} render={<Link href="/" />}>
          {copy.results.backHome}
        </Button>
      </Empty>
    </main>
  )
}
