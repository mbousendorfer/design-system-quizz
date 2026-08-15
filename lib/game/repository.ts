import 'server-only'

import {
  QUESTIONS_PER_RUN,
  type Difficulty,
  type Mode,
  type RunDifficulty,
  type RunMode,
} from '@/lib/difficulty'
import { drawRun, type DrawResult, type PoolQuestion } from '@/lib/game/draw'
import type { StoredOption, Team } from '@/lib/schema/question'
import type { StoredRender } from '@/lib/schema/render'
import { serviceClient } from '@/lib/supabase/service'

/**
 * Every database access the game makes.
 *
 * All of it runs through the service key, which is the only role the tables let
 * in. Nothing here is importable from a client component — `server-only` above
 * turns that into a build error.
 */

export class GameError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'GameError'
  }
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export type Player = { id: string; pseudo: string; team: Team }

/**
 * One player per name, case-insensitively. An existing player who picks a
 * different team keeps their history and moves team.
 */
export async function upsertPlayer(pseudo: string, team: Team): Promise<Player> {
  const supabase = serviceClient()
  const trimmed = pseudo.trim()

  const { data: existing, error: lookupError } = await supabase
    .from('players')
    .select('id, pseudo, team')
    .eq('pseudo_key', trimmed.toLowerCase())
    .maybeSingle()

  if (lookupError) throw new GameError(lookupError.message, 500)

  if (existing) {
    if (existing.team !== team) {
      const { error } = await supabase.from('players').update({ team }).eq('id', existing.id)
      if (error) throw new GameError(error.message, 500)
    }
    return { id: existing.id, pseudo: existing.pseudo, team }
  }

  const { data: created, error: insertError } = await supabase
    .from('players')
    .insert({ pseudo: trimmed, team })
    .select('id, pseudo, team')
    .single()

  // Two runs started at once by the same new player: the loser of the race reads
  // the row the winner just wrote.
  if (insertError?.code === '23505') return upsertPlayer(pseudo, team)
  if (insertError) throw new GameError(insertError.message, 500)

  return created as Player
}

// ---------------------------------------------------------------------------
// Drawing a run
// ---------------------------------------------------------------------------

/**
 * The whole published pool, in one query.
 *
 * Deliberately not filtered in SQL: the draw has to weigh level against how long
 * ago the player last saw each question, which is a ranking rather than a filter.
 * At a few hundred questions this is one small round trip; past a few thousand it
 * would want to move into Postgres.
 */
async function fetchPool(): Promise<PoolQuestion[]> {
  const { data, error } = await serviceClient()
    .from('questions')
    .select('id, version, mode, difficulty, timer_seconds')
    .eq('status', 'published')

  if (error) throw new GameError(error.message, 500)

  return (data ?? []).map((row) => ({
    id: row.id as string,
    version: row.version as number,
    mode: row.mode as Mode,
    difficulty: row.difficulty as Difficulty,
    timerSeconds: row.timer_seconds as number | null,
  }))
}

/**
 * When this player last *saw* each question — served, not answered. Abandoning a
 * run therefore does not recycle its questions.
 */
async function fetchSeen(playerId: string): Promise<Map<string, number>> {
  const { data, error } = await serviceClient()
    .from('run_items')
    .select('question_id, served_at, runs!inner(player_id)')
    .eq('runs.player_id', playerId)
    .not('served_at', 'is', null)

  if (error) throw new GameError(error.message, 500)

  const seen = new Map<string, number>()
  for (const row of data ?? []) {
    const at = new Date(row.served_at as string).getTime()
    const questionId = row.question_id as string
    seen.set(questionId, Math.max(seen.get(questionId) ?? 0, at))
  }
  return seen
}

export type StartedRun = {
  runId: string
  totalQuestions: number
  draw: DrawResult
}

export async function startRun(input: {
  player: Player
  mode: RunMode
  difficulty: RunDifficulty
}): Promise<StartedRun> {
  const supabase = serviceClient()

  const [pool, seen] = await Promise.all([fetchPool(), fetchSeen(input.player.id)])

  const draw = drawRun({
    pool,
    seen,
    mode: input.mode,
    difficulty: input.difficulty,
    count: QUESTIONS_PER_RUN,
  })

  if (draw.items.length === 0) throw new GameError('No published questions for this mode', 409)

  const { data: run, error: runError } = await supabase
    .from('runs')
    .insert({ player_id: input.player.id, mode: input.mode, difficulty: input.difficulty })
    .select('id')
    .single()

  if (runError) throw new GameError(runError.message, 500)

  const { error: itemsError } = await supabase.from('run_items').insert(
    draw.items.map((item) => ({
      run_id: run.id,
      position: item.position,
      question_id: item.questionId,
      question_version: item.questionVersion,
      timer_seconds: item.timerSeconds,
    })),
  )

  if (itemsError) throw new GameError(itemsError.message, 500)

  return { runId: run.id as string, totalQuestions: draw.items.length, draw }
}

// ---------------------------------------------------------------------------
// Run state
// ---------------------------------------------------------------------------

export type RunState = {
  id: string
  playerId: string
  pseudo: string
  team: Team
  mode: RunMode
  difficulty: RunDifficulty
  score: number
  bestStreak: number
  finishedAt: string | null
  totalQuestions: number
  answeredPositions: number[]
  /** First position with no answer yet, or null when the run is complete. */
  nextPosition: number | null
}

export async function loadRun(runId: string): Promise<RunState> {
  const supabase = serviceClient()

  const { data: run, error } = await supabase
    .from('runs')
    .select('id, player_id, mode, difficulty, score, best_streak, finished_at, players(pseudo, team)')
    .eq('id', runId)
    .maybeSingle()

  if (error) throw new GameError(error.message, 500)
  if (!run) throw new GameError('Run not found', 404)

  const [{ data: items }, { data: answers }] = await Promise.all([
    supabase.from('run_items').select('position').eq('run_id', runId),
    supabase.from('answers').select('position').eq('run_id', runId),
  ])

  const answeredPositions = (answers ?? []).map((row) => row.position as number).sort((a, b) => a - b)
  const positions = (items ?? []).map((row) => row.position as number).sort((a, b) => a - b)
  const player = run.players as unknown as { pseudo: string; team: Team }

  return {
    id: run.id as string,
    playerId: run.player_id as string,
    pseudo: player.pseudo,
    team: player.team,
    mode: run.mode as RunMode,
    difficulty: run.difficulty as RunDifficulty,
    score: run.score as number,
    bestStreak: run.best_streak as number,
    finishedAt: run.finished_at as string | null,
    totalQuestions: positions.length,
    answeredPositions,
    nextPosition: positions.find((position) => !answeredPositions.includes(position)) ?? null,
  }
}

// ---------------------------------------------------------------------------
// Serving a question
// ---------------------------------------------------------------------------

export type ServedQuestion = {
  mode: Mode
  difficulty: Difficulty
  prompt: string
  /** Either shape: `stimulus` is the current one, `imageKey` the older. */
  stimulus: StoredRender | null
  imageKey: string | null
  component: string | null
  options: StoredOption[]
  timerSeconds: number
  /** Server clock. The client counts down to this, the server judges against it. */
  servedAt: number
  deadline: number
}

/**
 * Reads the question through `questions_public`, which does not carry
 * `correct_option_id` or `explanation` at all. Stamping `served_at` here — and
 * only here — is what makes the timing the server's to measure.
 */
export async function serveQuestion(runId: string, position: number): Promise<ServedQuestion> {
  const supabase = serviceClient()

  const { data: item, error } = await supabase
    .from('run_items')
    .select('question_id, question_version, timer_seconds, served_at')
    .eq('run_id', runId)
    .eq('position', position)
    .maybeSingle()

  if (error) throw new GameError(error.message, 500)
  if (!item) throw new GameError('No such question in this run', 404)

  const { data: existingAnswer } = await supabase
    .from('answers')
    .select('id')
    .eq('run_id', runId)
    .eq('position', position)
    .maybeSingle()

  if (existingAnswer) throw new GameError('That question has already been answered', 409)

  // Re-serving after a refresh keeps the original stamp: the clock does not
  // restart because the page did.
  let servedAt = item.served_at as string | null
  if (!servedAt) {
    servedAt = new Date().toISOString()
    const { error: stampError } = await supabase
      .from('run_items')
      .update({ served_at: servedAt })
      .eq('run_id', runId)
      .eq('position', position)
    if (stampError) throw new GameError(stampError.message, 500)
  }

  const { data: question, error: questionError } = await supabase
    .from('questions_public')
    .select('mode, difficulty, prompt, options, image_key, component, stimulus')
    .eq('id', item.question_id)
    .eq('version', item.question_version)
    .maybeSingle()

  if (questionError) throw new GameError(questionError.message, 500)
  if (!question) throw new GameError('That question is no longer published', 410)

  const servedAtMs = new Date(servedAt).getTime()
  const timerSeconds = item.timer_seconds as number

  return {
    mode: question.mode as Mode,
    difficulty: question.difficulty as Difficulty,
    prompt: question.prompt as string,
    stimulus: (question.stimulus ?? null) as StoredRender | null,
    imageKey: question.image_key as string | null,
    component: question.component as string | null,
    options: question.options as StoredOption[],
    timerSeconds,
    servedAt: servedAtMs,
    deadline: servedAtMs + timerSeconds * 1000,
  }
}

// ---------------------------------------------------------------------------
// The answer key — read here and nowhere else
// ---------------------------------------------------------------------------

export type AnswerKey = {
  correctOptionId: string
  explanation: string
  docUrl: string | null
  component: string
  mode: Mode
  difficulty: Difficulty
  optionIds: string[]
}

export async function loadAnswerKey(questionId: string, version: number): Promise<AnswerKey> {
  const { data, error } = await serviceClient()
    .from('questions')
    .select('correct_option_id, explanation, doc_url, component, mode, difficulty, options')
    .eq('id', questionId)
    .eq('version', version)
    .maybeSingle()

  if (error) throw new GameError(error.message, 500)
  if (!data) throw new GameError('Question not found', 404)

  return {
    correctOptionId: data.correct_option_id as string,
    explanation: data.explanation as string,
    docUrl: data.doc_url as string | null,
    component: data.component as string,
    mode: data.mode as Mode,
    difficulty: data.difficulty as Difficulty,
    optionIds: (data.options as StoredOption[]).map((option) => option.id),
  }
}

export type PendingItem = {
  questionId: string
  questionVersion: number
  timerSeconds: number
  servedAt: number
}

export async function loadPendingItem(runId: string, position: number): Promise<PendingItem> {
  const { data, error } = await serviceClient()
    .from('run_items')
    .select('question_id, question_version, timer_seconds, served_at')
    .eq('run_id', runId)
    .eq('position', position)
    .maybeSingle()

  if (error) throw new GameError(error.message, 500)
  if (!data) throw new GameError('No such question in this run', 404)
  if (!data.served_at) throw new GameError('That question was never served', 409)

  return {
    questionId: data.question_id as string,
    questionVersion: data.question_version as number,
    timerSeconds: data.timer_seconds as number,
    servedAt: new Date(data.served_at as string).getTime(),
  }
}

/** Consecutive correct answers immediately before `position`. */
export async function currentStreak(runId: string, position: number): Promise<number> {
  const { data, error } = await serviceClient()
    .from('answers')
    .select('position, correct')
    .eq('run_id', runId)
    .lt('position', position)
    .order('position', { ascending: false })

  if (error) throw new GameError(error.message, 500)

  let streak = 0
  for (const row of data ?? []) {
    if (!row.correct) break
    streak += 1
  }
  return streak
}

export async function recordAnswer(input: {
  runId: string
  position: number
  questionId: string
  questionVersion: number
  component: string
  mode: Mode
  difficulty: Difficulty
  chosenOptionId: string | null
  correct: boolean
  timeMs: number
  points: number
  streak: number
}): Promise<void> {
  const supabase = serviceClient()

  const { error } = await supabase.from('answers').insert({
    run_id: input.runId,
    position: input.position,
    question_id: input.questionId,
    question_version: input.questionVersion,
    component: input.component,
    mode: input.mode,
    difficulty: input.difficulty,
    chosen_option_id: input.chosenOptionId,
    correct: input.correct,
    time_ms: input.timeMs,
    points: input.points,
  })

  // The unique key on (run_id, position) is what stops an answer being posted
  // twice for the same question.
  if (error?.code === '23505') throw new GameError('That question has already been answered', 409)
  if (error) throw new GameError(error.message, 500)

  const { data: run } = await supabase
    .from('runs')
    .select('score, best_streak')
    .eq('id', input.runId)
    .single()

  await supabase
    .from('runs')
    .update({
      score: ((run?.score as number) ?? 0) + input.points,
      best_streak: Math.max((run?.best_streak as number) ?? 0, input.streak),
    })
    .eq('id', input.runId)
}

// ---------------------------------------------------------------------------
// Finishing
// ---------------------------------------------------------------------------

export type ReviewedAnswer = {
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
  options: StoredOption[]
}

export type RunSummary = {
  runId: string
  pseudo: string
  difficulty: RunDifficulty
  mode: RunMode
  score: number
  bestStreak: number
  correctCount: number
  totalQuestions: number
  perfect: boolean
  averageScore: number | null
  rank: number | null
  answers: ReviewedAnswer[]
}

export async function finishRun(runId: string): Promise<RunSummary> {
  const supabase = serviceClient()
  const run = await loadRun(runId)

  if (!run.finishedAt) {
    const { error } = await supabase
      .from('runs')
      .update({ finished_at: new Date().toISOString() })
      .eq('id', runId)
    if (error) throw new GameError(error.message, 500)
  }

  const { data: answerRows, error: answersError } = await supabase
    .from('answers')
    .select('position, mode, difficulty, component, correct, points, time_ms, chosen_option_id, question_id, question_version')
    .eq('run_id', runId)
    .order('position')

  if (answersError) throw new GameError(answersError.message, 500)

  const answers: ReviewedAnswer[] = []
  for (const row of answerRows ?? []) {
    // The run is over, so the answer key is no longer a secret.
    const { data: question } = await supabase
      .from('questions')
      .select('prompt, options, correct_option_id, explanation, doc_url')
      .eq('id', row.question_id)
      .eq('version', row.question_version)
      .maybeSingle()

    answers.push({
      position: row.position as number,
      mode: row.mode as Mode,
      difficulty: row.difficulty as Difficulty,
      component: row.component as string,
      prompt: (question?.prompt as string) ?? '',
      correct: row.correct as boolean,
      points: row.points as number,
      timeMs: row.time_ms as number,
      chosenOptionId: row.chosen_option_id as string | null,
      correctOptionId: (question?.correct_option_id as string) ?? '',
      explanation: (question?.explanation as string) ?? '',
      docUrl: (question?.doc_url as string | null) ?? null,
      options: (question?.options as StoredOption[]) ?? [],
    })
  }

  const correctCount = answers.filter((answer) => answer.correct).length
  const score = answers.reduce((total, answer) => total + answer.points, 0)

  const [{ data: peers }, { data: board }] = await Promise.all([
    supabase.from('runs').select('score').eq('difficulty', run.difficulty).not('finished_at', 'is', null),
    supabase
      .from('leaderboard_by_difficulty')
      .select('player_id, position')
      .eq('difficulty', run.difficulty),
  ])

  const peerScores = (peers ?? []).map((row) => row.score as number)
  const averageScore =
    peerScores.length > 0
      ? Math.round(peerScores.reduce((total, value) => total + value, 0) / peerScores.length)
      : null

  const rank =
    (board ?? []).find((row) => row.player_id === run.playerId)?.position ?? null

  return {
    runId,
    pseudo: run.pseudo,
    difficulty: run.difficulty,
    mode: run.mode,
    score,
    bestStreak: run.bestStreak,
    correctCount,
    totalQuestions: run.totalQuestions,
    perfect: run.totalQuestions > 0 && correctCount === run.totalQuestions,
    averageScore,
    rank: rank as number | null,
    answers,
  }
}
