import 'server-only'

import type { Difficulty, Mode } from '@/lib/difficulty'
import type { Team } from '@/lib/schema/question'
import { serviceClient } from '@/lib/supabase/service'

/**
 * The seven stats views.
 *
 * Every aggregate is computed in Postgres and read back already summarised —
 * nothing here pulls the answers table across the wire to add it up in
 * JavaScript, let alone in the browser.
 */

export type Overview = {
  runsPlayed: number
  players: number
  averageScore: number
  bestScore: number
  firstRun: string | null
  lastRun: string | null
}

export type DailyPoint = {
  day: string
  runsPlayed: number
  players: number
  averageScore: number
}

export type QuestionStat = {
  id: string
  version: number
  mode: Mode
  difficulty: Difficulty
  component: string
  prompt: string
  plays: number
  successRate: number
  medianTimeMs: number | null
}

export type ConfusionEntry = {
  expected: string
  chosen: string
  occurrences: number
  /** Share of all wrong answers recorded for `expected`. */
  share: number
}

export type ComponentStat = {
  component: string
  plays: number
  successRate: number
  questionCount: number
}

export type ModeStat = {
  mode: Mode
  difficulty: Difficulty
  plays: number
  successRate: number
  medianTimeMs: number | null
}

export type CalibrationEntry = {
  id: string
  version: number
  mode: Mode
  component: string
  prompt: string
  declared: Difficulty
  suggested: Difficulty
  plays: number
  successRate: number
}

export type TeamStat = {
  team: Team
  difficulty: Difficulty
  plays: number
  successRate: number
  players: number
}

/** Below this, a success rate is noise rather than a signal. */
export const MIN_PLAYS_FOR_CALIBRATION = 10

async function read<T>(table: string, columns: string): Promise<T[]> {
  const { data, error } = await serviceClient().from(table).select(columns)
  if (error) throw new Error(`${table}: ${error.message}`)
  return (data ?? []) as T[]
}

// --- 1. Overview -----------------------------------------------------------

export async function fetchOverview(): Promise<Overview> {
  const { data, error } = await serviceClient().from('overview_stats').select('*').maybeSingle()
  if (error) throw new Error(`overview_stats: ${error.message}`)

  return {
    runsPlayed: (data?.runs_played as number) ?? 0,
    players: (data?.players as number) ?? 0,
    averageScore: data?.average_score ? Math.round(Number(data.average_score)) : 0,
    bestScore: (data?.best_score as number) ?? 0,
    firstRun: (data?.first_run as string) ?? null,
    lastRun: (data?.last_run as string) ?? null,
  }
}

export async function fetchDaily(): Promise<DailyPoint[]> {
  const rows = await read<Record<string, unknown>>(
    'daily_stats',
    'day, runs_played, players, average_score',
  )
  return rows
    .map((row) => ({
      day: row.day as string,
      runsPlayed: row.runs_played as number,
      players: row.players as number,
      averageScore: Math.round(Number(row.average_score ?? 0)),
    }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

// --- 2. Per question -------------------------------------------------------

/**
 * Sorted by success rate ascending: the questions people get wrong most often
 * come first, because those are the ones worth rewriting.
 */
export async function fetchQuestionStats(): Promise<QuestionStat[]> {
  const supabase = serviceClient()

  const [{ data: stats, error }, { data: questions, error: questionsError }] = await Promise.all([
    supabase
      .from('question_stats')
      .select('question_id, question_version, plays, success_rate, median_time_ms'),
    supabase.from('questions').select('id, version, mode, difficulty, component, prompt'),
  ])

  if (error) throw new Error(`question_stats: ${error.message}`)
  if (questionsError) throw new Error(`questions: ${questionsError.message}`)

  const byKey = new Map(
    (questions ?? []).map((row) => [`${row.id}:${row.version}`, row as Record<string, unknown>]),
  )

  return (stats ?? [])
    .map((row) => {
      const question = byKey.get(`${row.question_id}:${row.question_version}`)
      return {
        id: row.question_id as string,
        version: row.question_version as number,
        mode: (question?.mode ?? 'name-that-component') as Mode,
        difficulty: (question?.difficulty ?? 'medium') as Difficulty,
        component: (question?.component ?? '') as string,
        prompt: (question?.prompt ?? '') as string,
        plays: row.plays as number,
        successRate: Number(row.success_rate),
        medianTimeMs: (row.median_time_ms as number) ?? null,
      }
    })
    .sort((a, b) => a.successRate - b.successRate || b.plays - a.plays)
}

// --- 3. Confusion matrix ---------------------------------------------------

/**
 * "When the answer was Badge, what did people pick instead?" — the single most
 * useful signal for finding which parts of the design system are blurry.
 */
export async function fetchConfusion(): Promise<ConfusionEntry[]> {
  const rows = await read<Record<string, unknown>>(
    'confusion_matrix',
    'expected_component, chosen_component, occurrences',
  )

  const totalPerExpected = new Map<string, number>()
  for (const row of rows) {
    const expected = row.expected_component as string
    totalPerExpected.set(
      expected,
      (totalPerExpected.get(expected) ?? 0) + (row.occurrences as number),
    )
  }

  return rows
    .map((row) => {
      const expected = row.expected_component as string
      const occurrences = row.occurrences as number
      return {
        expected,
        chosen: row.chosen_component as string,
        occurrences,
        share: occurrences / (totalPerExpected.get(expected) || 1),
      }
    })
    .sort((a, b) => b.occurrences - a.occurrences)
}

// --- 4. Per component ------------------------------------------------------

export async function fetchComponentStats(): Promise<ComponentStat[]> {
  const rows = await read<Record<string, unknown>>(
    'component_stats',
    'component, plays, success_rate, question_count',
  )
  return rows
    .map((row) => ({
      component: row.component as string,
      plays: row.plays as number,
      successRate: Number(row.success_rate),
      questionCount: row.question_count as number,
    }))
    .sort((a, b) => a.successRate - b.successRate || b.plays - a.plays)
}

// --- 5. Per mode -----------------------------------------------------------

export async function fetchModeStats(): Promise<ModeStat[]> {
  const rows = await read<Record<string, unknown>>(
    'mode_stats',
    'mode, difficulty, plays, success_rate, median_time_ms',
  )
  return rows.map((row) => ({
    mode: row.mode as Mode,
    difficulty: row.difficulty as Difficulty,
    plays: row.plays as number,
    successRate: Number(row.success_rate),
    medianTimeMs: (row.median_time_ms as number) ?? null,
  }))
}

// --- 6. Calibration --------------------------------------------------------

/**
 * Questions whose declared level disagrees with the measured one. The view
 * already hides anything under ten plays, where a rate means nothing.
 */
export async function fetchCalibration(): Promise<CalibrationEntry[]> {
  const rows = await read<Record<string, unknown>>(
    'calibration_candidates',
    'id, version, mode, component, prompt, declared_difficulty, suggested_difficulty, plays, success_rate',
  )
  return rows
    .map((row) => ({
      id: row.id as string,
      version: row.version as number,
      mode: row.mode as Mode,
      component: row.component as string,
      prompt: row.prompt as string,
      declared: row.declared_difficulty as Difficulty,
      suggested: row.suggested_difficulty as Difficulty,
      plays: row.plays as number,
      successRate: Number(row.success_rate),
    }))
    .sort((a, b) => b.plays - a.plays)
}

// --- 7. Per team -----------------------------------------------------------

export async function fetchTeamStats(): Promise<TeamStat[]> {
  const rows = await read<Record<string, unknown>>(
    'team_stats',
    'team, difficulty, plays, success_rate, player_count',
  )
  return rows.map((row) => ({
    team: row.team as Team,
    difficulty: row.difficulty as Difficulty,
    plays: row.plays as number,
    successRate: Number(row.success_rate),
    players: row.player_count as number,
  }))
}
