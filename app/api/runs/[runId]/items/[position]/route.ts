import { NextResponse } from 'next/server'

import type { ServedQuestionResponse } from '@/lib/game/contracts'
import { GameError, loadRun, serveQuestion } from '@/lib/game/repository'
import { buildPlayerQuestion } from '@/lib/schema/question'

/**
 * Hands the player one question, with the answer key left behind.
 *
 * `serveQuestion` reads through the `questions_public` view, which does not carry
 * `correct_option_id` or `explanation` at all, and `buildPlayerQuestion` drops the
 * component name on the two modes where naming it is the answer.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string; position: string }> },
) {
  const { runId, position: rawPosition } = await params
  const position = Number(rawPosition)

  if (!Number.isInteger(position) || position < 1) {
    return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
  }

  try {
    const run = await loadRun(runId)
    const served = await serveQuestion(runId, position)

    const payload: ServedQuestionResponse = {
      ...buildPlayerQuestion(served, {
        runId,
        position,
        totalQuestions: run.totalQuestions,
      }),
      deadline: served.deadline,
      now: Date.now(),
    }

    return NextResponse.json(payload, {
      // A question is a secret with a clock on it. Never let it sit in a cache.
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }
}
