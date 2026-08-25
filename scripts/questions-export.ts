/**
 * Pulls the question bank out of Supabase and into the repository.
 *
 *   npm run questions:export
 *
 * This used to be a one-way backup, with a comment explaining that the database
 * stayed the source of truth and that a round trip through a file is how two
 * sources of truth get started. That was right while there was a server to run
 * the admin on. On a static build there is no admin, so the direction reverses:
 * these files *are* the question bank, edited in pull requests, and Supabase is
 * where they happen to have been written first.
 *
 * Three things come out, and all three matter:
 *
 * - every question, drafts included, so nothing is stranded in a database
 *   nobody can reach any more;
 * - the `stimulus` column, which carries live renders — omitting it would
 *   silently blank every question that shows a component rather than a picture;
 * - the screenshots themselves, downloaded into `public/shots/`, because Pages
 *   cannot proxy Supabase Storage.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { readSupabaseEnv, SHOTS_BUCKET } from '@/lib/supabase/env'

const ROOT = join(import.meta.dirname, '..')
const OUT_FILE = join(ROOT, 'content', 'questions.json')
const SHOTS_DIR = join(ROOT, 'public', 'shots')

const { url, secretKey } = readSupabaseEnv()
const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data, error } = await supabase
  .from('questions')
  .select(
    'id, version, status, mode, difficulty, component, prompt, options, correct_option_id, ' +
      'explanation, doc_url, image_key, stimulus, timer_seconds',
  )
  // A question is "live" when it is not archived — that is what the partial
  // unique index `questions_single_live` enforces. There is no is_live column.
  .neq('status', 'archived')

if (error) {
  console.error(`questions:export — ${error.message}`)
  process.exit(1)
}

// Sorted, and with no exported-at timestamp: re-running against an unchanged
// question bank produces a byte-identical file, so git only shows a diff when the
// content actually moved.
type Row = Record<string, unknown>

const questions = ((data ?? []) as unknown as Row[])
  .map((row) => ({
    id: row.id as string,
    version: row.version as number,
    status: row.status as string,
    mode: row.mode as string,
    difficulty: row.difficulty as string,
    component: row.component as string,
    prompt: row.prompt as string,
    options: row.options as unknown[],
    correctOptionId: row.correct_option_id as string | null,
    explanation: row.explanation as string,
    docUrl: row.doc_url as string | null,
    imageKey: row.image_key as string | null,
    stimulus: row.stimulus ?? null,
    timerSeconds: row.timer_seconds as number | null,
  }))
  .sort(
    (a, b) =>
      a.mode.localeCompare(b.mode) ||
      a.difficulty.localeCompare(b.difficulty) ||
      a.component.localeCompare(b.component) ||
      String(a.id).localeCompare(String(b.id)),
  )

writeFileSync(OUT_FILE, `${JSON.stringify({ questions }, null, 2)}\n`, 'utf8')

// --- the screenshots ------------------------------------------------------

/** Every image key any question refers to, from the question and from its options. */
const keys = new Set<string>()
for (const question of questions) {
  if (question.imageKey) keys.add(question.imageKey)
  for (const option of (question.options ?? []) as { imageKey?: string }[]) {
    if (option.imageKey) keys.add(option.imageKey)
  }
}

mkdirSync(SHOTS_DIR, { recursive: true })

let downloaded = 0
const missing: string[] = []

for (const key of [...keys].sort()) {
  const { data: blob, error: downloadError } = await supabase.storage.from(SHOTS_BUCKET).download(key)
  if (downloadError || !blob) {
    missing.push(key)
    continue
  }
  writeFileSync(join(SHOTS_DIR, key), Buffer.from(await blob.arrayBuffer()))
  downloaded += 1
}

const perStatus = [...new Set(questions.map((q) => q.status))]
  .sort()
  .map((status) => `${status} ${questions.filter((q) => q.status === status).length}`)
  .join(', ')

console.log(
  `questions:export — ${questions.length} questions (${perStatus})\n` +
    `                   written to ${relative(process.cwd(), OUT_FILE)}\n` +
    `                   ${downloaded} screenshots in ${relative(process.cwd(), SHOTS_DIR)}`,
)

if (missing.length > 0) {
  // Loud, because a question that references a screenshot the build cannot find
  // renders as an empty box rather than as an error.
  console.error(
    `\n${missing.length} screenshots are referenced but not in the bucket:\n` +
      missing.map((key) => `  ${key}`).join('\n') +
      `\nThe questions using them will render an empty plate.`,
  )
  process.exit(1)
}
