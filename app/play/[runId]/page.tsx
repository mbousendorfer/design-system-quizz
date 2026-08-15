import { notFound } from 'next/navigation'

import { QuizEngine } from '@/components/game/quiz-engine'
import { GameError, loadRun } from '@/lib/game/repository'

export const dynamic = 'force-dynamic'

export default async function PlayPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params

  let run
  try {
    run = await loadRun(runId)
  } catch (error) {
    if (error instanceof GameError && error.status === 404) notFound()
    throw error
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <QuizEngine
        runId={run.id}
        // Resuming mid-run after a refresh picks up at the first unanswered
        // question rather than starting over.
        startPosition={run.nextPosition ?? run.totalQuestions}
        totalQuestions={run.totalQuestions}
        runDifficulty={run.difficulty}
        alreadyFinished={run.finishedAt !== null || run.nextPosition === null}
      />
    </main>
  )
}
