/**
 * Picking the five questions for a run.
 *
 * A pure function, so the rules that matter can be tested without a database.
 * The caller fetches the pool and the player's history and hands them over.
 *
 * The priority order, per position:
 *   1. unseen, at the level asked for
 *   2. unseen, at the nearest other level
 *   3. seen, at the level asked for, longest ago first
 *   4. seen, at the nearest other level
 *
 * Unseen-at-another-level beats seen-at-the-right-level on purpose. With runs of
 * five questions people replay immediately, and meeting the same question three
 * times in a row kills the game faster than a slightly-too-easy one does.
 */
import {
  QUESTIONS_PER_RUN,
  adjacentDifficulties,
  difficultyForPosition,
  timerSecondsFor,
  type Difficulty,
  type Mode,
  type RunDifficulty,
  type RunMode,
} from '@/lib/difficulty'

export type PoolQuestion = {
  id: string
  version: number
  mode: Mode
  difficulty: Difficulty
  /** Per-question override; null means use the level default. */
  timerSeconds: number | null
}

export type DrawnItem = {
  position: number
  questionId: string
  questionVersion: number
  mode: Mode
  difficulty: Difficulty
  /** Frozen now, so re-calibrating the question mid-run cannot move the goalposts. */
  timerSeconds: number
}

export type DrawResult = {
  items: DrawnItem[]
  /** Levels that had to be substituted, so the player can be told. */
  substitutedFrom: Difficulty[]
  /** How many of the drawn questions this player has already seen. */
  repeats: number
  /** True when the pool could not fill the run at all. */
  short: boolean
}

export type DrawInput = {
  pool: readonly PoolQuestion[]
  /** questionId -> when this player last saw it, in ms. */
  seen: ReadonlyMap<string, number>
  mode: RunMode
  difficulty: RunDifficulty
  count?: number
  /** Injectable for tests. */
  random?: () => number
}

/** 0 for the level itself, 1 for a neighbour, 2 for the far end. */
function levelDistance(candidate: Difficulty, target: Difficulty): number {
  if (candidate === target) return 0
  return adjacentDifficulties(target).indexOf(candidate) + 1
}

export function drawRun({
  pool,
  seen,
  mode,
  difficulty,
  count = QUESTIONS_PER_RUN,
  random = Math.random,
}: DrawInput): DrawResult {
  const eligible = mode === 'mixed' ? pool : pool.filter((question) => question.mode === mode)

  // Assigned once so the sort stays a total order: two questions that are equal
  // on every real criterion still get a stable, arbitrary winner.
  const jitter = new Map(eligible.map((question) => [question.id, random()]))

  const taken = new Set<string>()
  const items: DrawnItem[] = []
  const substitutedFrom = new Set<Difficulty>()
  let repeats = 0

  for (let position = 1; position <= count; position += 1) {
    const target = difficultyForPosition(difficulty, position)

    const best = eligible
      .filter((question) => !taken.has(question.id))
      .map((question) => ({
        question,
        seenAt: seen.get(question.id) ?? null,
        distance: levelDistance(question.difficulty, target),
      }))
      .sort(
        (a, b) =>
          Number(a.seenAt !== null) - Number(b.seenAt !== null) ||
          a.distance - b.distance ||
          (a.seenAt ?? 0) - (b.seenAt ?? 0) ||
          (jitter.get(a.question.id) as number) - (jitter.get(b.question.id) as number),
      )
      .at(0)

    // The pool is exhausted. Better a three-question run than a crash.
    if (!best) break

    taken.add(best.question.id)
    if (best.seenAt !== null) repeats += 1
    if (best.question.difficulty !== target) substitutedFrom.add(target)

    items.push({
      position,
      questionId: best.question.id,
      questionVersion: best.question.version,
      mode: best.question.mode,
      difficulty: best.question.difficulty,
      timerSeconds: timerSecondsFor(best.question.difficulty, best.question.timerSeconds),
    })
  }

  return {
    items,
    substitutedFrom: [...substitutedFrom],
    repeats,
    short: items.length < count,
  }
}
