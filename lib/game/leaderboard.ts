'use client'

/**
 * The leaderboard, spoken to directly from the browser.
 *
 * This is the one thing a static site cannot do alone, and the only place a
 * network call survives. It uses the **publishable** Supabase key, which is
 * meant to be public: what an anonymous visitor may do is decided by the row
 * level security policies on `public_scores`, not by keeping a key secret.
 *
 * The secret key is not here and must never be. It bypasses row level security
 * entirely, and anything in a `NEXT_PUBLIC_` variable is inlined into the
 * bundle and served to everyone.
 *
 * Failures are swallowed on the write path on purpose. A player who has just
 * finished five questions should see their score whether or not the board
 * accepted it; losing a leaderboard entry is a smaller harm than replacing the
 * results screen with an error.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { FinishRunResponse } from '@/lib/game/contracts'
import type { RunDifficulty, RunMode } from '@/lib/difficulty'
import type { Team } from '@/lib/schema/question'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''

/** Null when the build had no credentials — the game still plays, solo. */
let client: SupabaseClient | null | undefined

function db(): SupabaseClient | null {
  if (client !== undefined) return client
  client = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: false } }) : null
  return client
}

export const LEADERBOARD_AVAILABLE = Boolean(URL && KEY)

export type BoardRow = {
  position: number
  pseudo: string
  team: Team
  bestScore: number
  runsPlayed: number
}

/** Writes the score, then reads back where it landed. Never throws. */
export async function publishScore(
  summary: FinishRunResponse,
): Promise<{ averageScore: number | null; rank: number | null } | null> {
  const supabase = db()
  if (!supabase) return null

  try {
    await supabase.from('public_scores').insert({
      pseudo: summary.pseudo,
      team: summary.team,
      mode: summary.mode,
      difficulty: summary.difficulty,
      score: summary.score,
      correct_count: summary.correctCount,
      total_questions: summary.totalQuestions,
    })

    const { data } = await supabase
      .from('public_scores')
      .select('pseudo, score')
      .eq('difficulty', summary.difficulty)

    if (!data || data.length === 0) return null

    // Rank is by best score per player, so playing ten times does not outrank
    // playing well once — the same rule the server-side board used.
    const best = new Map<string, number>()
    for (const row of data) {
      const key = row.pseudo.trim().toLowerCase()
      best.set(key, Math.max(best.get(key) ?? 0, row.score))
    }

    const scores = [...best.values()].sort((a, b) => b - a)
    const average = Math.round(data.reduce((sum, row) => sum + row.score, 0) / data.length)
    const rank = scores.findIndex((score) => score <= summary.score) + 1

    return { averageScore: average, rank: rank > 0 ? rank : null }
  } catch {
    return null
  }
}

export type BoardFilters = {
  difficulty: RunDifficulty
  team: Team | 'all'
  mode: RunMode | 'all'
  window: 'all' | 'week'
}

/** Reads a board. Returns an empty list rather than throwing, for the same reason. */
export async function fetchBoard(filters: BoardFilters): Promise<BoardRow[]> {
  const supabase = db()
  if (!supabase) return []

  try {
    let query = supabase
      .from('public_scores')
      .select('pseudo, team, score')
      .eq('difficulty', filters.difficulty)

    if (filters.team !== 'all') query = query.eq('team', filters.team)
    if (filters.mode !== 'all') query = query.eq('mode', filters.mode)
    if (filters.window === 'week') {
      query = query.gte('created_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
    }

    const { data } = await query
    if (!data) return []

    // Grouped in the browser: PostgREST has aggregates disabled on this project,
    // and a board is small enough that the difference is not measurable.
    const players = new Map<string, { pseudo: string; team: Team; best: number; runs: number }>()
    for (const row of data) {
      const key = row.pseudo.trim().toLowerCase()
      const current = players.get(key)
      if (current) {
        current.best = Math.max(current.best, row.score)
        current.runs += 1
      } else {
        players.set(key, { pseudo: row.pseudo, team: row.team as Team, best: row.score, runs: 1 })
      }
    }

    return [...players.values()]
      .sort((a, b) => b.best - a.best || a.pseudo.localeCompare(b.pseudo))
      .map((player, index) => ({
        position: index + 1,
        pseudo: player.pseudo,
        team: player.team,
        bestScore: player.best,
        runsPlayed: player.runs,
      }))
  } catch {
    return []
  }
}
