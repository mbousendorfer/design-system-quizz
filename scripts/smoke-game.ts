/**
 * Plays a whole run against a running dev server and the real Supabase project,
 * asserting the things that would be expensive to find out later: that the answer
 * key never reaches the client, that the clock belongs to the server, and that an
 * answer cannot be replayed.
 *
 *   npm run dev            (in another terminal)
 *   npm run smoke
 *
 * Leaves a player called `smoke-test` and its runs behind, which is what makes the
 * repeat-avoidance visible on a second pass.
 */
import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'

import { startRun, upsertPlayer } from '@/lib/game/repository'
import type {
  FinishRunResponse,
  ServedQuestionResponse,
  SubmitAnswerResponse,
} from '@/lib/game/contracts'
import { serviceClient } from '@/lib/supabase/service'

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
const PSEUDO = 'smoke-test'

let checks = 0
function pass(label: string) {
  checks += 1
  console.log(`  ok  ${label}`)
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`${response.status} ${response.url}: ${await response.text()}`)
  }
  return (await response.json()) as T
}

// --- a player and a run -----------------------------------------------------

console.log(`\nPlaying a run against ${BASE}\n`)

const supabase = serviceClient()

// `upsertPlayer` needs the pseudo_key column; fall back to a plain insert so this
// script still works before that migration is applied.
let playerId: string
try {
  playerId = (await upsertPlayer(PSEUDO, 'design')).id
  pass('upsertPlayer found or created the player')
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  if (!message.includes('pseudo_key')) throw error
  console.log('  --  upsertPlayer skipped: the pseudo_key migration is not applied yet')
  const { data } = await supabase.from('players').select('id').eq('pseudo', PSEUDO).maybeSingle()
  playerId =
    data?.id ??
    (
      await supabase
        .from('players')
        .insert({ pseudo: PSEUDO, team: 'design' })
        .select('id')
        .single()
    ).data!.id
}

const run = await startRun({
  player: { id: playerId, pseudo: PSEUDO, team: 'design' },
  mode: 'mixed',
  difficulty: 'progressive',
})
pass(`started a run of ${run.totalQuestions} questions`)

assert.deepEqual(
  run.draw.items.map((item) => item.difficulty),
  ['easy', 'easy', 'medium', 'medium', 'hard'],
)
pass('the progressive ladder came out easy, easy, medium, medium, hard')

// --- play it ----------------------------------------------------------------

const answerKeys = new Map<number, string>()

for (const item of run.draw.items) {
  const position = item.position

  const served = await json<ServedQuestionResponse>(
    await fetch(`${BASE}/api/runs/${run.runId}/items/${position}`),
  )

  const raw = JSON.stringify(served)
  assert.ok(!raw.includes('correctOptionId'), 'the payload carries the answer')
  assert.ok(!raw.includes('explanation'), 'the payload carries the explanation')
  if (served.mode === 'name-that-component' || served.mode === 'which-component') {
    assert.equal(served.component, null, 'the payload names the component that is the answer')
  }

  // Re-serving must not restart the clock — a refresh is not a second chance.
  const again = await json<ServedQuestionResponse>(
    await fetch(`${BASE}/api/runs/${run.runId}/items/${position}`),
  )
  assert.equal(again.deadline, served.deadline)

  // What the server thinks is right, read straight from the table.
  const { data: key } = await supabase
    .from('questions')
    .select('correct_option_id')
    .eq('id', item.questionId)
    .eq('version', item.questionVersion)
    .single()
  answerKeys.set(position, key!.correct_option_id as string)

  // Deliberately get question 3 wrong, so the run exercises both paths and the
  // streak actually breaks.
  const wrong = served.options.find((option) => option.id !== key!.correct_option_id)
  const chosen = position === 3 ? (wrong?.id ?? null) : (key!.correct_option_id as string)

  if (position === 1) {
    // Long enough to prove the elapsed time is measured server-side rather than
    // taken from the request.
    await sleep(2_000)
  }

  const result = await json<SubmitAnswerResponse>(
    await fetch(`${BASE}/api/runs/${run.runId}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position, chosenOptionId: chosen }),
    }),
  )

  assert.equal(result.correct, position !== 3)
  assert.ok(result.explanation.length > 0, 'the explanation only arrives with the verdict')

  if (position === 1) {
    assert.ok(result.timeMs >= 1_900, `expected ~2000ms measured, got ${result.timeMs}`)
    pass('the elapsed time is measured from the server stamp, not sent by the client')
  }

  if (position === 2) {
    assert.equal(result.streak, 2)
    assert.equal(result.score.streak, 25)
    pass('the streak bonus starts on the second consecutive correct answer')
  }

  if (position === 3) {
    assert.equal(result.score.total, 0)
    assert.equal(result.streak, 0)
    pass('a wrong answer scores nothing and resets the streak')
  }

  // Replaying the same position must be refused.
  const replay = await fetch(`${BASE}/api/runs/${run.runId}/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position, chosenOptionId: chosen }),
  })
  assert.equal(replay.status, 409, `expected 409 on replay of ${position}, got ${replay.status}`)
}

pass('every question hid its answer key until it had been answered')
pass('answering the same question twice is refused')

// --- a made-up option is a bad request, not a wrong answer -------------------

const bogus = await fetch(`${BASE}/api/runs/${run.runId}/answers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ position: 1, chosenOptionId: 'nope' }),
})
assert.equal(bogus.status, 400)
pass('an option id that is not on the question is rejected as malformed')

// --- finish -----------------------------------------------------------------

const summary = await json<FinishRunResponse>(
  await fetch(`${BASE}/api/runs/${run.runId}/finish`, { method: 'POST' }),
)

assert.equal(summary.totalQuestions, 5)
assert.equal(summary.correctCount, 4)
assert.equal(summary.perfect, false)
assert.equal(summary.answers.length, 5)
assert.ok(summary.answers.every((answer) => answer.explanation.length > 0))
pass(`the run finished at ${summary.score} points, 4 of 5 correct`)

const recomputed = summary.answers.reduce((total, answer) => total + answer.points, 0)
assert.equal(recomputed, summary.score)
pass('the final score is the sum of what each answer actually paid')

// --- a second run avoids what was just played -------------------------------

const second = await startRun({
  player: { id: playerId, pseudo: PSEUDO, team: 'design' },
  mode: 'mixed',
  difficulty: 'progressive',
})
const before = new Set(run.draw.items.map((item) => item.questionId))
const overlap = second.draw.items.filter((item) => before.has(item.questionId))
console.log(
  `      second run repeated ${overlap.length} of 5 (the seed only holds 12 questions)`,
)
assert.ok(overlap.length < 5, 'the second run drew exactly the same five questions')
pass('replaying immediately does not serve the same five questions again')

console.log(`\n${checks} checks passed.\n`)
