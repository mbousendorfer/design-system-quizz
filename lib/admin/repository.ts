import 'server-only'

import type { Difficulty, Mode } from '@/lib/difficulty'
import type { StoredOption, Status } from '@/lib/schema/question'
import { SHOTS_BUCKET } from '@/lib/supabase/env'
import { serviceClient } from '@/lib/supabase/service'

/** Every admin read and write. Service key only; nothing here reaches a browser. */

export class AdminError extends Error {}

export type QuestionRow = {
  id: string
  version: number
  mode: Mode
  difficulty: Difficulty
  status: Status
  component: string
  prompt: string
  options: StoredOption[]
  correctOptionId: string | null
  explanation: string
  docUrl: string | null
  imageKey: string | null
  timerSeconds: number | null
  updatedAt: string
}

export type QuestionWithStats = QuestionRow & {
  plays: number
  successRate: number | null
  medianTimeMs: number | null
  /** True once anyone has answered this exact version — editing then cuts a new one. */
  answered: boolean
}

export type QuestionFilters = {
  mode?: Mode | 'all'
  status?: Status | 'all'
  component?: string | 'all'
  search?: string
}

const SELECT =
  'id, version, mode, difficulty, status, component, prompt, options, correct_option_id, explanation, doc_url, image_key, timer_seconds, updated_at'

function toRow(row: Record<string, unknown>): QuestionRow {
  return {
    id: row.id as string,
    version: row.version as number,
    mode: row.mode as Mode,
    difficulty: row.difficulty as Difficulty,
    status: row.status as Status,
    component: row.component as string,
    prompt: row.prompt as string,
    options: (row.options ?? []) as StoredOption[],
    correctOptionId: (row.correct_option_id ?? null) as string | null,
    explanation: (row.explanation ?? '') as string,
    docUrl: (row.doc_url ?? null) as string | null,
    imageKey: (row.image_key ?? null) as string | null,
    timerSeconds: (row.timer_seconds ?? null) as number | null,
    updatedAt: row.updated_at as string,
  }
}

/**
 * The question list, with each row's measured success rate beside its declared
 * level. Questions and stats are fetched separately and joined here: `question_stats`
 * is a view over `answers` with no foreign key for PostgREST to follow, and at a
 * few hundred questions two small queries beat teaching it the relationship.
 */
export async function listQuestions(filters: QuestionFilters = {}): Promise<QuestionWithStats[]> {
  const supabase = serviceClient()

  let query = supabase.from('questions').select(SELECT).order('updated_at', { ascending: false })

  if (filters.mode && filters.mode !== 'all') query = query.eq('mode', filters.mode)
  if (filters.component && filters.component !== 'all') {
    query = query.eq('component', filters.component)
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  } else {
    // Archived versions are history, not content. They only show when asked for.
    query = query.neq('status', 'archived')
  }
  if (filters.search?.trim()) {
    query = query.ilike('prompt', `%${filters.search.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw new AdminError(error.message)

  const rows = (data ?? []).map(toRow)
  if (rows.length === 0) return []

  const { data: stats, error: statsError } = await supabase
    .from('question_stats')
    .select('question_id, question_version, plays, success_rate, median_time_ms')
    .in('question_id', [...new Set(rows.map((row) => row.id))])

  if (statsError) throw new AdminError(statsError.message)

  const byVersion = new Map(
    (stats ?? []).map((row) => [`${row.question_id}:${row.question_version}`, row]),
  )

  return rows.map((row) => {
    const stat = byVersion.get(`${row.id}:${row.version}`)
    return {
      ...row,
      plays: (stat?.plays as number) ?? 0,
      successRate: stat ? Number(stat.success_rate) : null,
      medianTimeMs: (stat?.median_time_ms as number) ?? null,
      answered: ((stat?.plays as number) ?? 0) > 0,
    }
  })
}

export async function loadQuestion(id: string): Promise<QuestionWithStats | null> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('questions')
    .select(SELECT)
    .eq('id', id)
    .neq('status', 'archived')
    .maybeSingle()

  if (error) throw new AdminError(error.message)
  if (!data) return null

  const row = toRow(data)
  const { data: stat } = await supabase
    .from('question_stats')
    .select('plays, success_rate, median_time_ms')
    .eq('question_id', row.id)
    .eq('question_version', row.version)
    .maybeSingle()

  return {
    ...row,
    plays: (stat?.plays as number) ?? 0,
    successRate: stat ? Number(stat.success_rate) : null,
    medianTimeMs: (stat?.median_time_ms as number) ?? null,
    answered: ((stat?.plays as number) ?? 0) > 0,
  }
}

/** Which components questions have actually been written about, for the filter. */
export async function usedComponents(): Promise<string[]> {
  const { data, error } = await serviceClient().from('questions').select('component')
  if (error) throw new AdminError(error.message)
  return [...new Set((data ?? []).map((row) => row.component as string))].sort()
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export type SavePayload = {
  id?: string | null
  mode: Mode
  difficulty: Difficulty
  status: Status
  component: string
  prompt: string
  options: StoredOption[]
  correctOptionId: string | null
  explanation: string
  docUrl: string | null
  imageKey: string | null
  timerSeconds: number | null
}

export type SaveResult = { id: string; version: number; createdNewVersion: boolean }

/**
 * Saving goes through the `save_question_version` function rather than a plain
 * update, so archiving the old version and inserting the new one happen in one
 * statement. Doing it as two round trips from here would leave a window with no
 * live version, or with two.
 */
export async function saveQuestion(payload: SavePayload): Promise<SaveResult> {
  const { data, error } = await serviceClient()
    .rpc('save_question_version', {
      payload: {
        id: payload.id ?? null,
        mode: payload.mode,
        difficulty: payload.difficulty,
        status: payload.status,
        component: payload.component,
        prompt: payload.prompt,
        options: payload.options,
        correct_option_id: payload.correctOptionId,
        explanation: payload.explanation,
        doc_url: payload.docUrl,
        image_key: payload.imageKey,
        timer_seconds: payload.timerSeconds,
      },
    })
    .single()

  if (error) throw new AdminError(error.message)

  return {
    id: (data as Record<string, unknown>).saved_id as string,
    version: (data as Record<string, unknown>).saved_version as number,
    createdNewVersion: (data as Record<string, unknown>).created_new_version as boolean,
  }
}

/**
 * A batch, in one transaction. The database loops, not the application: thirty
 * separate round trips would be thirty separate transactions, and a spreadsheet
 * whose twenty-ninth row is malformed would leave twenty-eight questions behind.
 */
export async function saveQuestionBatch(payloads: SavePayload[]): Promise<SaveResult[]> {
  const { data, error } = await serviceClient().rpc('save_question_versions', {
    payloads: payloads.map((payload) => ({
      id: payload.id ?? null,
      mode: payload.mode,
      difficulty: payload.difficulty,
      status: payload.status,
      component: payload.component,
      prompt: payload.prompt,
      options: payload.options,
      correct_option_id: payload.correctOptionId,
      explanation: payload.explanation,
      doc_url: payload.docUrl,
      image_key: payload.imageKey,
      timer_seconds: payload.timerSeconds,
    })),
  })

  if (error) throw new AdminError(error.message)

  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.saved_id as string,
    version: row.saved_version as number,
    createdNewVersion: row.created_new_version as boolean,
  }))
}

export async function setStatus(id: string, version: number, status: Status): Promise<void> {
  const { error } = await serviceClient()
    .from('questions')
    .update({ status })
    .eq('id', id)
    .eq('version', version)

  if (error) throw new AdminError(error.message)
}

// ---------------------------------------------------------------------------
// Screenshots
// ---------------------------------------------------------------------------

/**
 * Raster only from the admin form. SVG is allowed in the bucket because the seeded
 * placeholders are SVG, but an uploaded SVG is markup that a browser might execute,
 * and there is no reason for a screenshot to be one.
 */
const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

export async function uploadShot(file: File): Promise<string> {
  const extension = ALLOWED_UPLOAD_TYPES[file.type]
  if (!extension) throw new AdminError('Only PNG, JPEG and WebP screenshots are accepted.')
  if (file.size > MAX_UPLOAD_BYTES) throw new AdminError('That file is larger than 2 MB.')
  if (file.size === 0) throw new AdminError('That file is empty.')

  // The opaque name is assigned here, on the way in, so a file called
  // `badge-orange-wrong.png` on the designer's disk never becomes a hint in the
  // network tab. Nothing upstream has to remember to rename anything.
  const key = `${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}.${extension}`

  const { error } = await serviceClient()
    .storage.from(SHOTS_BUCKET)
    .upload(key, await file.arrayBuffer(), { contentType: file.type, upsert: false })

  if (error) throw new AdminError(error.message)
  return key
}
