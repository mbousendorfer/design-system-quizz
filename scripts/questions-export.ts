/**
 * Dumps every published question to `content/questions.json`.
 *
 *   npm run questions:export
 *
 * One way only. The database stays the source of truth; this is a readable,
 * diffable backup that shows in a pull request what actually changed in the
 * question bank. There is deliberately no import counterpart — a round trip
 * through a file is how two sources of truth get started.
 */
import { writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { readSupabaseEnv } from '@/lib/supabase/env'

const OUT_FILE = join(import.meta.dirname, '..', 'content', 'questions.json')

const { url, secretKey } = readSupabaseEnv()
const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data, error } = await supabase
  .from('questions')
  .select(
    'id, version, mode, difficulty, component, prompt, options, correct_option_id, explanation, doc_url, image_key, timer_seconds',
  )
  .eq('status', 'published')

if (error) {
  console.error(`questions:export — ${error.message}`)
  process.exit(1)
}

// Sorted, and with no exported-at timestamp: re-running against an unchanged
// question bank produces a byte-identical file, so git only shows a diff when the
// content actually moved.
const questions = (data ?? [])
  .map((row) => ({
    id: row.id,
    version: row.version,
    mode: row.mode,
    difficulty: row.difficulty,
    component: row.component,
    prompt: row.prompt,
    options: row.options,
    correctOptionId: row.correct_option_id,
    explanation: row.explanation,
    docUrl: row.doc_url,
    imageKey: row.image_key,
    timerSeconds: row.timer_seconds,
  }))
  .sort((a, b) =>
    a.mode.localeCompare(b.mode) ||
    a.difficulty.localeCompare(b.difficulty) ||
    a.component.localeCompare(b.component) ||
    String(a.id).localeCompare(String(b.id)),
  )

writeFileSync(OUT_FILE, `${JSON.stringify({ questions }, null, 2)}\n`, 'utf8')

const perMode = [...new Set(questions.map((q) => q.mode))]
  .sort()
  .map((mode) => `${mode} ${questions.filter((q) => q.mode === mode).length}`)
  .join(', ')

console.log(
  `questions:export — ${questions.length} published questions (${perMode})\n` +
    `                   written to ${relative(process.cwd(), OUT_FILE)}`,
)
