/**
 * The wire contract between the game client and the server.
 *
 * Request bodies are zod schemas, validated server-side; responses are types.
 * Both sides import from here so a rename cannot drift.
 */
import { z } from 'zod'

import { DIFFICULTIES, MODES, type Difficulty, type Mode } from '@/lib/difficulty'
import type { PlayerQuestion, StoredOption, Team } from '@/lib/schema/question'
import { TEAMS } from '@/lib/schema/question'
import type { ScoreBreakdown } from '@/lib/scoring'

/**
 * Grace for the round trip. The server judges the timer, but a player who clicked
 * with half a second left should not lose to their own latency.
 */
export const NETWORK_TOLERANCE_MS = 1500

/** Letters, digits, spaces and a few separators. No control characters. */
export const pseudoSchema = z
  .string()
  .trim()
  .min(1, 'Pick a name first.')
  .max(32, 'Keep it under 32 characters.')
  .regex(/^[\p{L}\p{N} ._'-]+$/u, 'Letters, digits, spaces, and . _ - only.')

export const startRunSchema = z.object({
  pseudo: pseudoSchema,
  team: z.enum(TEAMS),
  mode: z.enum([...MODES, 'mixed']),
  difficulty: z.enum([...DIFFICULTIES, 'progressive']),
})

export type StartRunBody = z.infer<typeof startRunSchema>

export type StartRunResponse = {
  runId: string
  totalQuestions: number
  /** Levels that had to be topped up from a neighbour, so the player is told. */
  substitutedFrom: Difficulty[]
  repeats: number
}

export type ServedQuestionResponse = PlayerQuestion & {
  /** Server clock, in ms. The countdown runs against this, not against a local start. */
  deadline: number
  now: number
}

export const submitAnswerSchema = z.object({
  position: z.number().int().min(1).max(20),
  /** Null means the timer ran out without a choice. */
  chosenOptionId: z.string().max(16).nullable(),
})

export type SubmitAnswerBody = z.infer<typeof submitAnswerSchema>

export type SubmitAnswerResponse = {
  correct: boolean
  /** Revealed only now, with the answer already recorded. */
  correctOptionId: string
  explanation: string
  docUrl: string | null
  component: string
  timedOut: boolean
  timeMs: number
  streak: number
  score: ScoreBreakdown
  runScore: number
  nextPosition: number | null
}

export type RunReviewAnswer = {
  position: number
  mode: Mode
  difficulty: Difficulty
  component: string
  prompt: string
  correct: boolean
  points: number
  timeMs: number
  chosenOptionId: string | null
  correctOptionId: string
  explanation: string
  docUrl: string | null
  /** Stored shape, not the player projection: the run is over, nothing is hidden. */
  options: StoredOption[]
}

export type FinishRunResponse = {
  runId: string
  pseudo: string
  team: Team
  mode: string
  difficulty: string
  score: number
  bestStreak: number
  correctCount: number
  totalQuestions: number
  perfect: boolean
  averageScore: number | null
  rank: number | null
  answers: RunReviewAnswer[]
}
