'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'

import { QuizEngine } from '@/components/game/quiz-engine'
import { Skeleton } from '@/components/ui/skeleton'
import { copy } from '@/lib/copy'
import { loadRun, runOnServer, subscribeToRun } from '@/lib/game/local-run'

/**
 * The run lives in this tab.
 *
 * It used to be `/play/[runId]`, resolved on the server. A static export cannot
 * pre-render a page per run id — the ids do not exist until someone plays — so
 * the run moves into `sessionStorage` and the route becomes a single page.
 *
 * That is also why it survives a refresh but not a new tab: session storage is
 * per tab, and a run reopened elsewhere with a fresh clock would be a run with
 * no timer at all.
 */
export default function PlayPage() {
  const router = useRouter()
  // Read rather than copied into state: `loadRun` caches its parse, so the
  // reference is stable and this stays a subscription instead of a setState
  // inside an effect.
  const run = useSyncExternalStore(subscribeToRun, loadRun, runOnServer)

  useEffect(() => {
    // Reads storage directly rather than trusting `run` on this pass.
    //
    // `useSyncExternalStore` hands back the *server* snapshot on the hydration
    // render — null, because a prerendered page has no tab to read. Deciding to
    // redirect from that value sent every player straight back to the start
    // screen with their run sitting in sessionStorage, untouched.
    //
    // `loadRun()` only ever runs on the client, so it answers the question the
    // redirect is actually asking: is there a run in this tab, or not?
    if (loadRun() === null) router.replace('/')
  }, [router])

  if (run === null) {
    return (
      <main id="content" className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
        <Skeleton className="h-96 w-full" />
      </main>
    )
  }

  const answered = new Set(run.answers.map((answer) => answer.position))
  const next = run.items.find((item) => !answered.has(item.position))

  return (
    <main id="content" className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      {/* The visible titles live inside Cards, which are divs by design, so the
          page would otherwise have no heading at all for a screen reader. It is
          deliberately not the question number: a heading that changes five times
          during one page is worse than a stable one. */}
      <h1 className="sr-only">{copy.game.runHeading}</h1>

      <QuizEngine
        // Resuming after a refresh picks up at the first unanswered question
        // rather than starting over.
        startPosition={next?.position ?? run.items.length}
        totalQuestions={run.items.length}
        runDifficulty={run.difficulty}
        alreadyFinished={next === undefined}
      />
    </main>
  )
}
