import { NextResponse } from 'next/server'

import type { FinishRunResponse } from '@/lib/game/contracts'
import { GameError, finishRun, loadRun } from '@/lib/game/repository'

export async function POST(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params

  try {
    const summary = await finishRun(runId)
    const run = await loadRun(runId)

    return NextResponse.json<FinishRunResponse>(
      {
        runId: summary.runId,
        pseudo: summary.pseudo,
        team: run.team,
        mode: summary.mode,
        difficulty: summary.difficulty,
        score: summary.score,
        bestStreak: summary.bestStreak,
        correctCount: summary.correctCount,
        totalQuestions: summary.totalQuestions,
        perfect: summary.perfect,
        averageScore: summary.averageScore,
        rank: summary.rank,
        answers: summary.answers,
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
