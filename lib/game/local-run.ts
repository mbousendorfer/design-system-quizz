'use client'

/**
 * A run, played entirely in the browser.
 *
 * On a server build this logic lived behind four API routes, and the point of
 * that was that the answer key and the clock stayed out of the player's reach.
 * A static host cannot offer that, so the honest thing is to say what changed
 * rather than to pretend the shape is the same:
 *
 * - **The answer key is in the bundle.** It has to be; there is nothing else to
 *   ask. It is also already in the public repository, so this concedes less
 *   than it would have a week ago.
 * - **The clock is the player's.** `performance.now()` in their own tab, which
 *   they can pause in a debugger. The timer is now a rule of the game rather
 *   than something enforced.
 *
 * What is kept is the shape. Every function here returns the same contract type
 * the API route returned, so the engine component reads identically and the
 * drawing, scoring and projection code — the parts that were tested — are the
 * same code, not a re-implementation of it.
 */
import { POOL, questionById, type BankQuestion } from '@/lib/game/question-bank'
import { drawRun, type DrawnItem } from '@/lib/game/draw'
import { timerSecondsFor, type RunDifficulty, type RunMode } from '@/lib/difficulty'
import { scoreAnswer } from '@/lib/scoring'
import { buildPlayerQuestion } from '@/lib/schema/question'
import type {
  FinishRunResponse,
  RunReviewAnswer,
  ServedQuestionResponse,
  StartRunResponse,
  SubmitAnswerResponse,
} from '@/lib/game/contracts'
import type { Team } from '@/lib/schema/question'

const SEEN_KEY = 'ds-quiz:seen'
const RUN_KEY = 'ds-quiz:run'

/** questionId -> when this player last saw it. Keeps a re-run from repeating. */
function readSeen(): Map<string, number> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY)
    return new Map(raw ? (JSON.parse(raw) as [string, number][]) : [])
  } catch {
    return new Map()
  }
}

function rememberSeen(ids: string[]): void {
  try {
    const seen = readSeen()
    const now = Date.now()
    for (const id of ids) seen.set(id, now)
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    // A browser with storage disabled just repeats questions more often.
  }
}

type StoredAnswer = {
  position: number
  chosenOptionId: string | null
  correct: boolean
  points: number
  timeMs: number
}

export type LocalRun = {
  runId: string
  pseudo: string
  team: Team
  mode: RunMode
  difficulty: RunDifficulty
  items: DrawnItem[]
  answers: StoredAnswer[]
  /** When the current question was handed over, in epoch ms. */
  servedAt: Record<number, number>
}

/**
 * The parsed run, cached.
 *
 * Two reasons, and the second is the one that matters. `loadRun` is called on
 * every serve and every answer, so re-parsing the JSON each time is waste. More
 * importantly it makes the run a *stable reference*, which is what lets the play
 * page read it through `useSyncExternalStore` instead of copying it into state
 * inside an effect — a fresh object on every call would loop React forever.
 */
let cached: LocalRun | null | undefined
const listeners = new Set<() => void>()

function publish(): void {
  for (const listener of listeners) listener()
}

/** Survives a refresh, so reloading mid-run does not lose the run. */
function save(run: LocalRun): void {
  cached = run
  try {
    window.sessionStorage.setItem(RUN_KEY, JSON.stringify(run))
  } catch {
    // Nothing to do: the run simply will not survive a reload.
  }
  publish()
}

export function loadRun(): LocalRun | null {
  if (cached !== undefined) return cached
  try {
    const raw = window.sessionStorage.getItem(RUN_KEY)
    cached = raw ? (JSON.parse(raw) as LocalRun) : null
  } catch {
    cached = null
  }
  return cached
}

export function clearRun(): void {
  cached = null
  try {
    window.sessionStorage.removeItem(RUN_KEY)
  } catch {
    // Ignored for the same reason as above.
  }
  publish()
}

export function subscribeToRun(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Prerendering has no tab, so there is no run — the browser fills it in. */
export function runOnServer(): LocalRun | null {
  return null
}

export function startRun(input: {
  pseudo: string
  team: Team
  mode: RunMode
  difficulty: RunDifficulty
}): StartRunResponse & { run: LocalRun } {
  const drawn = drawRun({ pool: POOL, seen: readSeen(), mode: input.mode, difficulty: input.difficulty })

  const run: LocalRun = {
    runId: crypto.randomUUID(),
    pseudo: input.pseudo,
    team: input.team,
    mode: input.mode,
    difficulty: input.difficulty,
    items: drawn.items,
    answers: [],
    servedAt: {},
  }
  save(run)
  rememberSeen(drawn.items.map((item) => item.questionId))

  return {
    runId: run.runId,
    totalQuestions: drawn.items.length,
    substitutedFrom: drawn.substitutedFrom,
    repeats: drawn.repeats,
    run,
  }
}

/** The stamp is kept on re-serve, so a refresh is not a second chance. */
export function serveQuestion(run: LocalRun, position: number): ServedQuestionResponse | null {
  const item = run.items.find((candidate) => candidate.position === position)
  if (!item) return null

  const question = questionById(item.questionId)
  if (!question) return null

  const now = Date.now()
  if (!run.servedAt[position]) {
    run.servedAt[position] = now
    save(run)
  }

  const timerSeconds = timerSecondsFor(item.difficulty, question.timerSeconds)

  return {
    ...buildPlayerQuestion(
      {
        mode: question.mode,
        difficulty: question.difficulty,
        prompt: question.prompt,
        stimulus: question.stimulus,
        imageKey: question.imageKey,
        component: question.component,
        options: question.options,
        timerSeconds,
      },
      { runId: run.runId, position },
    ),
    deadline: run.servedAt[position] + timerSeconds * 1000,
    now,
  }
}

export function submitAnswer(
  run: LocalRun,
  position: number,
  chosenOptionId: string | null,
): SubmitAnswerResponse | null {
  const item = run.items.find((candidate) => candidate.position === position)
  const question = item ? questionById(item.questionId) : null
  if (!item || !question) return null

  const timerSeconds = timerSecondsFor(item.difficulty, question.timerSeconds)
  const timeMs = Math.max(0, Date.now() - (run.servedAt[position] ?? Date.now()))
  const timedOut = chosenOptionId === null || timeMs > timerSeconds * 1000
  const correct = !timedOut && chosenOptionId === question.correctOptionId

  // The streak is the tail of consecutive correct answers, recomputed rather
  // than carried: a resumed run has to arrive at the same number.
  let streak = 0
  for (const answer of [...run.answers].sort((a, b) => a.position - b.position)) {
    streak = answer.correct ? streak + 1 : 0
  }
  const nextStreak = correct ? streak + 1 : 0

  const score = scoreAnswer({
    correct,
    difficulty: item.difficulty,
    timeMs,
    timerSeconds,
    streak: nextStreak,
  })

  run.answers = [
    ...run.answers.filter((answer) => answer.position !== position),
    { position, chosenOptionId, correct, points: score.total, timeMs },
  ]
  save(run)

  const runScore = run.answers.reduce((total, answer) => total + answer.points, 0)
  const last = run.items.length

  return {
    correct,
    correctOptionId: question.correctOptionId,
    explanation: question.explanation,
    docUrl: question.docUrl,
    component: question.component,
    timedOut,
    timeMs,
    streak: nextStreak,
    score,
    runScore,
    nextPosition: position < last ? position + 1 : null,
  }
}

function reviewOf(run: LocalRun, item: DrawnItem, question: BankQuestion): RunReviewAnswer {
  const answer = run.answers.find((candidate) => candidate.position === item.position)
  return {
    position: item.position,
    mode: question.mode,
    difficulty: item.difficulty,
    component: question.component,
    prompt: question.prompt,
    correct: answer?.correct ?? false,
    points: answer?.points ?? 0,
    timeMs: answer?.timeMs ?? 0,
    chosenOptionId: answer?.chosenOptionId ?? null,
    correctOptionId: question.correctOptionId,
    explanation: question.explanation,
    docUrl: question.docUrl,
    options: question.options,
  }
}

/**
 * The run is over. `averageScore` and `rank` come from the leaderboard, which is
 * a network call, so they are filled in by the caller rather than here.
 */
export function finishRun(run: LocalRun): FinishRunResponse {
  const answers = run.items
    .map((item) => {
      const question = questionById(item.questionId)
      return question ? reviewOf(run, item, question) : null
    })
    .filter((answer): answer is RunReviewAnswer => answer !== null)

  let streak = 0
  let bestStreak = 0
  for (const answer of answers) {
    streak = answer.correct ? streak + 1 : 0
    bestStreak = Math.max(bestStreak, streak)
  }

  const correctCount = answers.filter((answer) => answer.correct).length

  return {
    runId: run.runId,
    pseudo: run.pseudo,
    team: run.team,
    mode: run.mode,
    difficulty: run.difficulty,
    score: answers.reduce((total, answer) => total + answer.points, 0),
    bestStreak,
    correctCount,
    totalQuestions: run.items.length,
    perfect: correctCount === run.items.length && run.items.length > 0,
    averageScore: null,
    rank: null,
    answers,
  }
}
