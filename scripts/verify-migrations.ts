/**
 * Runs the Supabase migrations against an in-memory Postgres (PGlite) and exercises
 * the rules that are easy to get wrong in SQL and expensive to discover in
 * production: the single-live-version index, the publish-time check constraint, the
 * versioning trigger, `save_question_version`, and the stats views.
 *
 * Usage: npm run db:verify
 *
 * What this does not cover: `anon`/`authenticated` grants and the storage bucket
 * are Supabase-specific. The roles are stubbed so the RLS migration parses and
 * runs; the storage migration is skipped and flagged.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'supabase', 'migrations')
/** Needs Supabase's `storage` schema, which PGlite does not have. */
const SUPABASE_ONLY = ['20260815090400_storage.sql']

const db = new PGlite()
const checks: string[] = []

function pass(label: string) {
  checks.push(label)
  console.log(`  ok  ${label}`)
}

async function expectFailure(label: string, run: () => Promise<unknown>, expected: RegExp) {
  try {
    await run()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    assert.match(message, expected, `${label}: unexpected error "${message}"`)
    pass(label)
    return
  }
  throw new Error(`${label}: expected this to be rejected, but it was accepted`)
}

// --- migrations ------------------------------------------------------------

// Supabase provides these; PGlite does not.
await db.exec(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;
`)

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
console.log(`\nApplying ${files.length - SUPABASE_ONLY.length} migrations to an in-memory Postgres\n`)

for (const file of files) {
  if (SUPABASE_ONLY.includes(file)) {
    console.log(`  --  ${file} (skipped: needs Supabase's storage schema)`)
    continue
  }
  try {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
    console.log(`  ok  ${file}`)
  } catch (error) {
    console.error(`\nFAILED in ${file}\n${error instanceof Error ? error.message : error}\n`)
    process.exit(1)
  }
}

console.log('\nChecking the rules\n')

// --- fixtures --------------------------------------------------------------

const { rows: playerRows } = await db.query<{ id: string }>(
  `insert into players (pseudo, team) values ('Sam', 'design') returning id`,
)
const playerId = playerRows[0].id

await expectFailure(
  'a pseudo is unique whatever its casing',
  () => db.query(`insert into players (pseudo) values ('  sam ')`),
  /players_pseudo_key|duplicate key/i,
)

const options = JSON.stringify([
  { id: 'a', component: 'Badge' },
  { id: 'b', component: 'Tag' },
  { id: 'c', component: 'Status' },
  { id: 'd', component: 'Counter' },
])
const explanation = 'A Badge carries a count or a status dot; a Tag carries a removable label.'

// --- publish-time constraint ----------------------------------------------

await expectFailure(
  'a published question cannot have an empty explanation',
  () =>
    db.query(
      `insert into questions (mode, difficulty, status, component, prompt, options, correct_option_id, explanation, image_key)
       values ('name-that-component','hard','published','Badge','Which one?',$1::jsonb,'a','','q1.png')`,
      [options],
    ),
  /questions_published_is_complete/,
)

await expectFailure(
  'a published question cannot point at an option that does not exist',
  () =>
    db.query(
      `insert into questions (mode, difficulty, status, component, prompt, options, correct_option_id, explanation, image_key)
       values ('name-that-component','hard','published','Badge','Which one?',$1::jsonb,'zz',$2,'q1.png')`,
      [options, explanation],
    ),
  /questions_published_is_complete/,
)

await expectFailure(
  'a published name-that-component question needs a screenshot',
  () =>
    db.query(
      `insert into questions (mode, difficulty, status, component, prompt, options, correct_option_id, explanation)
       values ('name-that-component','hard','published','Badge','Which one?',$1::jsonb,'a',$2)`,
      [options, explanation],
    ),
  /questions_published_is_complete/,
)

await db.query(
  `insert into questions (mode, difficulty, status, component, prompt, options, correct_option_id, explanation)
   values ('name-that-component','hard','draft','Badge','',$1::jsonb,null,'')`,
  [options],
)
pass('an incomplete draft saves fine')

// --- save_question_version -------------------------------------------------

const { rows: created } = await db.query<{ saved_id: string; saved_version: number }>(
  `select * from save_question_version($1::jsonb)`,
  [
    JSON.stringify({
      mode: 'name-that-component',
      difficulty: 'hard',
      status: 'published',
      component: 'Badge',
      prompt: 'Which component is this?',
      options: JSON.parse(options),
      correct_option_id: 'a',
      explanation,
      image_key: 'q7f3a91.png',
    }),
  ],
)
const questionId = created[0].saved_id
assert.equal(created[0].saved_version, 1)
pass('save_question_version creates version 1')

// --- one live version at a time -------------------------------------------

await expectFailure(
  'only one non-archived version of a question can exist',
  () =>
    db.query(
      `insert into questions (id, version, mode, difficulty, status, component, prompt, options, correct_option_id, explanation, image_key)
       values ($1, 2, 'name-that-component','hard','published','Badge','Dup',$2::jsonb,'a',$3,'q7f3a91.png')`,
      [questionId, options, explanation],
    ),
  /questions_single_live|duplicate key/i,
)

// --- editing before anyone has answered ------------------------------------

const savePayload = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: questionId,
    mode: 'name-that-component',
    difficulty: 'hard',
    status: 'published',
    component: 'Badge',
    prompt: 'Which component is this?',
    options: JSON.parse(options),
    correct_option_id: 'a',
    explanation,
    image_key: 'q7f3a91.png',
    ...overrides,
  })

const { rows: edited } = await db.query<{ saved_version: number; created_new_version: boolean }>(
  `select * from save_question_version($1::jsonb)`,
  [savePayload({ prompt: 'Name this component.' })],
)
assert.equal(edited[0].saved_version, 1)
assert.equal(edited[0].created_new_version, false)
pass('an unanswered question is edited in place, no new version')

// --- record a run and an answer -------------------------------------------

const { rows: runRows } = await db.query<{ id: string }>(
  `insert into runs (player_id, mode, difficulty) values ($1,'mixed','progressive') returning id`,
  [playerId],
)
const runId = runRows[0].id

await db.query(
  `insert into run_items (run_id, position, question_id, question_version, timer_seconds, served_at)
   values ($1, 1, $2, 1, 15, now())`,
  [runId, questionId],
)
await db.query(
  `insert into answers (run_id, position, question_id, question_version, component, mode, difficulty, chosen_option_id, correct, time_ms, points)
   values ($1, 1, $2, 1, 'Badge', 'name-that-component', 'hard', 'b', false, 4200, 0)`,
  [runId, questionId],
)
pass('a run, a served item and a wrong answer are recorded')

// The run item has to exist first, otherwise the foreign key would reject this row
// before the check constraint ever gets a say, and the test would pass for the
// wrong reason.
await db.query(
  `insert into run_items (run_id, position, question_id, question_version, timer_seconds, served_at)
   values ($1, 2, $2, 1, 15, now())`,
  [runId, questionId],
)
await expectFailure(
  'a timeout can never be marked correct',
  () =>
    db.query(
      `insert into answers (run_id, position, question_id, question_version, component, mode, difficulty, chosen_option_id, correct, time_ms, points)
       values ($1, 2, $2, 1, 'Badge', 'name-that-component', 'hard', null, true, 15000, 100)`,
      [runId, questionId],
    ),
  /answers_timeout_is_never_correct/,
)

await expectFailure(
  'an answer cannot be recorded for a question that was never served',
  () =>
    db.query(
      `insert into answers (run_id, position, question_id, question_version, component, mode, difficulty, chosen_option_id, correct, time_ms, points)
       values ($1, 5, $2, 1, 'Badge', 'name-that-component', 'hard', 'a', true, 1000, 250)`,
      [runId, questionId],
    ),
  /violates foreign key/i,
)

// --- editing after somebody has answered -----------------------------------

await expectFailure(
  'the trigger blocks an in-place edit of what was judged',
  () =>
    db.query(`update questions set correct_option_id = 'b' where id = $1 and version = 1`, [
      questionId,
    ]),
  /already been answered/,
)

await db.query(
  `update questions set explanation = $2, doc_url = 'https://design.agorapulse.com' where id = $1 and version = 1`,
  [questionId, `${explanation} Reach for Status when the state is the message.`],
)
pass('the explanation and doc link stay editable in place after answers exist')

const { rows: versioned } = await db.query<{ saved_version: number; created_new_version: boolean }>(
  `select * from save_question_version($1::jsonb)`,
  [savePayload({ correct_option_id: 'c' })],
)
assert.equal(versioned[0].saved_version, 2)
assert.equal(versioned[0].created_new_version, true)
pass('changing the correct answer cuts version 2')

const { rows: liveRows } = await db.query<{ version: number; status: string }>(
  `select version, status from questions where id = $1 order by version`,
  [questionId],
)
assert.deepEqual(liveRows, [
  { version: 1, status: 'archived' },
  { version: 2, status: 'published' },
])
pass('version 1 is archived and version 2 is live')

// --- the old answer still points at the version it was asked at ------------

const { rows: preserved } = await db.query<{ question_version: number; component: string }>(
  `select question_version, component from answers where run_id = $1`,
  [runId],
)
assert.equal(preserved[0].question_version, 1)
assert.equal(preserved[0].component, 'Badge')
pass('the recorded answer still refers to version 1, so its stats stay true')

// --- the views -------------------------------------------------------------

const { rows: publicRows } = await db.query<Record<string, unknown>>(
  `select * from questions_public where id = $1`,
  [questionId],
)
assert.equal(publicRows.length, 1)
assert.ok(!('correct_option_id' in publicRows[0]), 'questions_public exposes correct_option_id')
assert.ok(!('explanation' in publicRows[0]), 'questions_public exposes explanation')
assert.equal(publicRows[0].component, null, 'questions_public leaks the component answer')
pass('questions_public hides the answer, the explanation and the component')

const { rows: variantRows } = await db.query<{ component: string | null }>(
  `select component from questions_public where mode = 'which-variant'`,
)
await db.query(
  `insert into questions (mode, difficulty, status, component, prompt, options, correct_option_id, explanation)
   values ('which-variant','easy','published','Button','Which variant?',
           '[{"id":"a","imageKey":"aa1111.png"},{"id":"b","imageKey":"bb2222.png"},{"id":"c","imageKey":"cc3333.png"}]'::jsonb,
           'a', $1)`,
  ['Use the primary variant for the single most important action on the screen.'],
)
const { rows: variantAfter } = await db.query<{ component: string | null }>(
  `select component from questions_public where mode = 'which-variant'`,
)
assert.equal(variantRows.length, 0)
assert.equal(variantAfter[0].component, 'Button')
pass('questions_public keeps the component on modes where it is part of the question')

const { rows: stats } = await db.query<{ plays: number; success_rate: string }>(
  `select plays, success_rate from question_stats where question_id = $1`,
  [questionId],
)
assert.equal(stats[0].plays, 1)
assert.equal(Number(stats[0].success_rate), 0)
pass('question_stats counts the play and the failure')

const { rows: confusion } = await db.query<{
  expected_component: string
  chosen_component: string
  occurrences: number
}>(`select * from confusion_matrix`)
assert.deepEqual(confusion, [
  { expected_component: 'Badge', chosen_component: 'Tag', occurrences: 1 },
])
pass('confusion_matrix resolves the chosen option back to the component that was picked')

for (const view of [
  'component_stats',
  'mode_stats',
  'team_stats',
  'run_stats',
  'calibration_candidates',
  'leaderboard_by_difficulty',
]) {
  await db.query(`select * from ${view}`)
  pass(`${view} runs`)
}

// --- calibration threshold -------------------------------------------------

const { rows: belowThreshold } = await db.query(`select * from calibration_candidates`)
assert.equal(belowThreshold.length, 0)
pass('calibration_candidates stays quiet below ten plays')

console.log(`\n${checks.length} checks passed.`)
console.log('Not covered here: the storage bucket and the anon/authenticated grants,')
console.log('which only exist on a real Supabase instance.\n')

await db.close()
