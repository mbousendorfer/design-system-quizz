/**
 * The question bank, baked into the bundle.
 *
 * On a static host there is no database to ask at play time, so the questions
 * ship with the build. `npm run questions:export` writes the file this reads.
 *
 * Only published questions are playable. Drafts live in the same file on purpose
 * — they are the work in progress, reviewed in pull requests — and are filtered
 * out here rather than at export time, so a draft is one field away from being
 * live and nobody has to remember a second command.
 */
import bank from '@/content/questions.json'
import type { PoolQuestion } from '@/lib/game/draw'
import type { Difficulty, Mode } from '@/lib/difficulty'
import type { StoredOption } from '@/lib/schema/question'
import type { StoredRender } from '@/lib/schema/render'

type BankRow = {
  id: string
  version: number
  status: string
  mode: string
  difficulty: string
  component: string
  prompt: string
  options: StoredOption[]
  correctOptionId: string | null
  explanation: string
  docUrl: string | null
  imageKey: string | null
  stimulus: unknown
  timerSeconds: number | null
}

const rows = (bank as { questions: BankRow[] }).questions

/**
 * A question as the bank holds it — everything, answer and explanation included.
 * `buildPlayerQuestion` is what turns one of these into something a player may
 * see, and it is still the only place that projection happens.
 */
export type BankQuestion = {
  id: string
  version: number
  mode: Mode
  difficulty: Difficulty
  component: string
  prompt: string
  options: StoredOption[]
  correctOptionId: string
  explanation: string
  docUrl: string | null
  imageKey: string | null
  stimulus: StoredRender | null
  timerSeconds: number | null
}

/** Published only: a draft has no explanation yet, and is not a fair question. */
export const PLAYABLE: readonly BankQuestion[] = rows
  .filter((row) => row.status === 'published')
  .map((row) => ({
    id: row.id,
    version: row.version,
    mode: row.mode as Mode,
    difficulty: row.difficulty as Difficulty,
    component: row.component,
    prompt: row.prompt,
    options: row.options,
    correctOptionId: row.correctOptionId ?? '',
    explanation: row.explanation,
    docUrl: row.docUrl,
    imageKey: row.imageKey,
    stimulus: (row.stimulus ?? null) as StoredRender | null,
    timerSeconds: row.timerSeconds,
  }))

export const POOL: readonly PoolQuestion[] = PLAYABLE.map((question) => ({
  id: question.id,
  version: question.version,
  mode: question.mode,
  difficulty: question.difficulty,
  timerSeconds: question.timerSeconds ?? null,
}))

const byId = new Map(PLAYABLE.map((question) => [question.id, question]))

export function questionById(id: string): BankQuestion | null {
  return byId.get(id) ?? null
}

/** How many published questions a mode has, for the "this run is short" notice. */
export function publishedCount(mode: Mode | 'mixed'): number {
  return mode === 'mixed' ? PLAYABLE.length : PLAYABLE.filter((q) => q.mode === mode).length
}
