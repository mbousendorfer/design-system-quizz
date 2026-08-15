import 'server-only'

import type { RunDifficulty, RunMode } from '@/lib/difficulty'
import type { Team } from '@/lib/schema/question'
import { serviceClient } from '@/lib/supabase/service'

/**
 * The leaderboard.
 *
 * Ranked per level and never globally: the score multiplier alone would not stop
 * somebody camping the top of the table by grinding easy runs, and a single
 * table would quietly reward that.
 *
 * Team, mode and time window are facets on top of the level, not separate boards.
 *
 * Unlike the stats views, the grouping happens here rather than in SQL. The
 * filters are chosen at request time, and the input is one row per finished run
 * — a few hundred, not the answer-by-answer history the stats aggregate over.
 */

export type LeaderboardRow = {
  position: number
  playerId: string
  pseudo: string
  team: Team
  bestScore: number
  runsPlayed: number
  lastPlayed: string
}

export type LeaderboardFilters = {
  difficulty: RunDifficulty
  team?: Team | 'all'
  mode?: RunMode | 'all'
  window?: 'all' | 'week'
}

export async function fetchLeaderboard({
  difficulty,
  team = 'all',
  mode = 'all',
  window = 'all',
}: LeaderboardFilters): Promise<LeaderboardRow[]> {
  let query = serviceClient()
    .from('runs')
    .select('player_id, mode, score, finished_at, players!inner(pseudo, team)')
    .eq('difficulty', difficulty)
    .not('finished_at', 'is', null)

  if (mode !== 'all') query = query.eq('mode', mode)
  if (team !== 'all') query = query.eq('players.team', team)
  if (window === 'week') {
    query = query.gte('finished_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
  }

  const { data, error } = await query
  if (error) throw new Error(`leaderboard: ${error.message}`)

  const byPlayer = new Map<string, LeaderboardRow>()

  for (const row of data ?? []) {
    const player = row.players as unknown as { pseudo: string; team: Team }
    const playerId = row.player_id as string
    const score = row.score as number
    const finishedAt = row.finished_at as string

    const existing = byPlayer.get(playerId)
    if (!existing) {
      byPlayer.set(playerId, {
        position: 0,
        playerId,
        pseudo: player.pseudo,
        team: player.team,
        bestScore: score,
        runsPlayed: 1,
        lastPlayed: finishedAt,
      })
      continue
    }

    existing.runsPlayed += 1
    existing.bestScore = Math.max(existing.bestScore, score)
    if (finishedAt > existing.lastPlayed) existing.lastPlayed = finishedAt
  }

  const ranked = [...byPlayer.values()].sort(
    (a, b) => b.bestScore - a.bestScore || a.lastPlayed.localeCompare(b.lastPlayed),
  )

  // Ties share a position and the next player skips ahead: two firsts, then a
  // third. Written as a loop rather than inside a map, because each position
  // depends on the one already assigned above it.
  ranked.forEach((row, index) => {
    const previous = ranked[index - 1]
    row.position = previous && previous.bestScore === row.bestScore ? previous.position : index + 1
  })

  return ranked
}
