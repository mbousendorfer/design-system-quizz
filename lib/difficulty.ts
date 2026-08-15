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
  'name-from-description',
] as const
export type Mode = (typeof MODES)[number]

export type ModeSpec = {
  /**
   * `component` means the component name is the answer, so it must never reach the
   * client. `image` means the options are things to look at.
   */
  answers: 'component' | 'image'
  /** [min, max] options. The zod union and the publish blockers both read this. */
  options: readonly [number, number]
}

/**
 * One row per mode, and `satisfies` makes a missing row a compile error naming the
 * mode that is missing.
 *
 * The lists below used to be written out separately, parallel to `MODES` rather
 * than derived from it — so a new mode that appeared in neither silently got the
 * component kept in its payload and its options rendered as names. Plausible, wrong,
 * and no error anywhere.
 */
export const MODE_SPEC = {
  'name-that-component': { answers: 'component', options: [4, 6] },
  'which-variant': { answers: 'image', options: [3, 6] },
  'spot-the-drift': { answers: 'image', options: [2, 2] },
  'which-component': { answers: 'component', options: [4, 6] },
  'name-from-description': { answers: 'component', options: [4, 6] },
} as const satisfies Record<Mode, ModeSpec>

export const RUN_MODES = [...MODES, 'mixed'] as const
export type RunMode = (typeof RUN_MODES)[number]

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const RUN_DIFFICULTIES = [...DIFFICULTIES, 'progressive'] as const
export type RunDifficulty = (typeof RUN_DIFFICULTIES)[number]

export const QUESTIONS_PER_RUN = 5

/** Modes where the component name *is* the answer — it must never reach the client. */
export const MODES_ANSWERING_A_COMPONENT = MODES.filter(
  (mode) => MODE_SPEC[mode].answers === 'component',
)

/** Modes whose options are things to look at rather than component names. */
export const MODES_WITH_IMAGE_OPTIONS = MODES.filter((mode) => MODE_SPEC[mode].answers === 'image')

export function isComponentAnswerMode(mode: Mode): boolean {
  return MODE_SPEC[mode].answers === 'component'
}

export function hasImageOptions(mode: Mode): boolean {
  return MODE_SPEC[mode].answers === 'image'
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
