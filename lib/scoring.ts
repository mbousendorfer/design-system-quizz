/**
 * Scoring. Computed on the server only — the client never adds up its own points.
 *
 *   base   100 × the level multiplier (easy ×1, medium ×1.5, hard ×2)
 *   speed  up to 50, decaying linearly across the time allowed
 *   streak +25 per consecutive correct answer beyond the first, cumulative
 *
 * A wrong answer or a timeout scores 0 and resets the streak.
 */
import { DIFFICULTY_RULES, type Difficulty } from '@/lib/difficulty'

export const BASE_POINTS = 100
export const MAX_SPEED_BONUS = 50
export const STREAK_BONUS_STEP = 25
/** Consecutive correct answers needed before the streak starts paying. */
export const STREAK_STARTS_AT = 2

export type ScoreInput = {
  correct: boolean
  difficulty: Difficulty
  /** Server-measured time to answer. */
  timeMs: number
  timerSeconds: number
  /** Consecutive correct answers *including* this one. 0 when this one is wrong. */
  streak: number
}

export type ScoreBreakdown = {
  base: number
  speed: number
  streak: number
  total: number
}

export function scoreAnswer({
  correct,
  difficulty,
  timeMs,
  timerSeconds,
  streak,
}: ScoreInput): ScoreBreakdown {
  if (!correct) return { base: 0, speed: 0, streak: 0, total: 0 }

  const base = Math.round(BASE_POINTS * DIFFICULTY_RULES[difficulty].scoreMultiplier)

  const allowedMs = timerSeconds * 1000
  const remaining = Math.max(0, 1 - Math.min(timeMs, allowedMs) / allowedMs)
  const speed = Math.round(MAX_SPEED_BONUS * remaining)

  const streakBonus =
    streak >= STREAK_STARTS_AT ? (streak - STREAK_STARTS_AT + 1) * STREAK_BONUS_STEP : 0

  return { base, speed, streak: streakBonus, total: base + speed + streakBonus }
}

/** Highest reachable score for a flawless run — used to frame the end screen. */
export function perfectRunScore(difficulties: readonly Difficulty[]): number {
  return difficulties.reduce((total, difficulty, index) => {
    const { total: points } = scoreAnswer({
      correct: true,
      difficulty,
      timeMs: 0,
      timerSeconds: DIFFICULTY_RULES[difficulty].timerSeconds,
      streak: index + 1,
    })
    return total + points
  }, 0)
}
