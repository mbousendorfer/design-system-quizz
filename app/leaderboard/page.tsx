import { Suspense } from 'react'

import { LeaderboardView } from '@/components/game/leaderboard-view'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The board reads its filters from the query string, and `useSearchParams` has
 * to sit under a Suspense boundary for a page to be prerendered — a static
 * build has no request to read them from, so the shell is emitted and the
 * filters resolve in the browser.
 *
 * That is why this file exists at all: the boundary cannot be inside the
 * component that calls the hook.
 */
export default function LeaderboardPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:py-14">
          <Skeleton className="h-64 w-full" />
        </main>
      }
    >
      <LeaderboardView />
    </Suspense>
  )
}
