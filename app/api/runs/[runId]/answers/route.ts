import { NextResponse } from 'next/server'

import {
  NETWORK_TOLERANCE_MS,
  submitAnswerSchema,
  type SubmitAnswerResponse,
} from '@/lib/game/contracts'
import {
  GameError,
  currentStreak,
  loadAnswerKey,
  loadPendingItem,
  loadRun,
  recordAnswer,
} from '@/lib/game/repository'
import { scoreAnswer } from '@/lib/scoring'

/**
 * Where an answer is judged. Three things happen here and nowhere else:
 *
 *   1. The elapsed time is measured from the server's own `served_at` stamp, so a
 *      client that waits before posting cannot claim to have been quick.
 *   2. The answer key is read server-side and compared server-side.
 *   3. The score is computed from those two, never taken from the request.
 *
 * The answer key travels back in the response — but only after the answer has
 * been recorded, so knowing it is worth nothing.
 */
export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 })
  }

  const parsed = submitAnswerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const { position, chosenOptionId } = parsed.data

  try {
    const run = await loadRun(runId)
    if (run.finishedAt) return NextResponse.json({ error: 'This run is over' }, { status: 409 })

    const item = await loadPendingItem(runId, position)
    const key = await loadAnswerKey(item.questionId, item.questionVersion)

    // An option id that is not on this question is not a wrong answer, it is a
    // malformed request.
    if (chosenOptionId !== null && !key.optionIds.includes(chosenOptionId)) {
      return NextResponse.json({ error: 'No such option on this question' }, { status: 400 })
    }

    const timeMs = Math.max(0, Date.now() - item.servedAt)
    const timedOut = timeMs > item.timerSeconds * 1000 + NETWORK_TOLERANCE_MS
    const correct = !timedOut && chosenOptionId === key.correctOptionId

    const streak = correct ? (await currentStreak(runId, position)) + 1 : 0
    const score = scoreAnswer({
      correct,
      difficulty: key.difficulty,
      timeMs,
      timerSeconds: item.timerSeconds,
      streak,
    })

    await recordAnswer({
      runId,
      position,
      questionId: item.questionId,
      questionVersion: item.questionVersion,
      component: key.component,
      mode: key.mode,
      difficulty: key.difficulty,
      chosenOptionId: timedOut ? null : chosenOptionId,
      correct,
      timeMs,
      points: score.total,
      streak,
    })

    const nextPosition = position < run.totalQuestions ? position + 1 : null

    return NextResponse.json<SubmitAnswerResponse>(
      {
        correct,
        correctOptionId: key.correctOptionId,
        explanation: key.explanation,
        docUrl: key.docUrl,
        component: key.component,
        timedOut,
        timeMs,
        streak,
        score,
        runScore: run.score + score.total,
        nextPosition,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }
}
