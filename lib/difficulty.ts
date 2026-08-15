/**
 * Game modes, difficulty levels, and the per-level defaults.
 *
 * A question always carries one of the three real levels. A *run* can also be
 * played in `mixed` mode or at `progressive` difficulty, which is why runs use
 * their own wider unions — and their own Postgres enums.
 */

export const MODES = [
  'name-that-component',
  'which-variant',
  'spot-the-drift',
  'which-component',
] as const
export type Mode = (typeof MODES)[number]

export const RUN_MODES = [...MODES, 'mixed'] as const
export type RunMode = (typeof RUN_MODES)[number]

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const RUN_DIFFICULTIES = [...DIFFICULTIES, 'progressive'] as const
export type RunDifficulty = (typeof RUN_DIFFICULTIES)[number]

export const QUESTIONS_PER_RUN = 5

/** Modes where the component name *is* the answer — it must never reach the client. */
export const MODES_ANSWERING_A_COMPONENT = ['name-that-component', 'which-component'] as const

/** Modes whose options are screenshots rather than component names. */
export const MODES_WITH_IMAGE_OPTIONS = ['which-variant', 'spot-the-drift'] as const

export function isComponentAnswerMode(mode: Mode): boolean {
  return (MODES_ANSWERING_A_COMPONENT as readonly string[]).includes(mode)
}

export function hasImageOptions(mode: Mode): boolean {
  return (MODES_WITH_IMAGE_OPTIONS as readonly string[]).includes(mode)
}

export type DifficultyRule = {
  /** Default number of options. `spot-the-drift` ignores it — it is always A vs B. */
  optionCount: number
  timerSeconds: number
  scoreMultiplier: number
}

export const DIFFICULTY_RULES: Record<Difficulty, DifficultyRule> = {
  easy: { optionCount: 4, timerSeconds: 25, scoreMultiplier: 1 },
  medium: { optionCount: 5, timerSeconds: 20, scoreMultiplier: 1.5 },
  hard: { optionCount: 6, timerSeconds: 15, scoreMultiplier: 2 },
}

/** Progressive runs walk the three levels: two easy, two medium, one hard. */
export const PROGRESSIVE_LADDER: readonly Difficulty[] = ['easy', 'easy', 'medium', 'medium', 'hard']

/** Which level question `position` (1-based) should be drawn at. */
export function difficultyForPosition(run: RunDifficulty, position: number): Difficulty {
  if (run !== 'progressive') return run
  return PROGRESSIVE_LADDER[position - 1] ?? PROGRESSIVE_LADDER[PROGRESSIVE_LADDER.length - 1]
}

/** The level default, unless the question overrides it. */
export function timerSecondsFor(difficulty: Difficulty, override?: number | null): number {
  return override ?? DIFFICULTY_RULES[difficulty].timerSeconds
}

/** Levels to fall back on, nearest first, when a pool is too thin. */
export function adjacentDifficulties(difficulty: Difficulty): Difficulty[] {
  return { easy: ['medium', 'hard'], medium: ['easy', 'hard'], hard: ['medium', 'easy'] }[
    difficulty
  ] as Difficulty[]
}
