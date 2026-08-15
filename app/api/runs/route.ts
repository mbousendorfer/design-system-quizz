import { NextResponse } from 'next/server'

import { startRunSchema, type StartRunResponse } from '@/lib/game/contracts'
import { GameError, startRun, upsertPlayer } from '@/lib/game/repository'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 })
  }

  const parsed = startRunSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  try {
    const player = await upsertPlayer(parsed.data.pseudo, parsed.data.team)
    const { runId, totalQuestions, draw } = await startRun({
      player,
      mode: parsed.data.mode,
      difficulty: parsed.data.difficulty,
    })

    return NextResponse.json<StartRunResponse>({
      runId,
      totalQuestions,
      substitutedFrom: draw.substitutedFrom,
      repeats: draw.repeats,
    })
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }
}
