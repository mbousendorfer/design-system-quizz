import assert from 'node:assert/strict'
import { test } from 'node:test'

import { scoreAnswer } from '@/lib/scoring'
import {
  questionSchema,
  toPlayerQuestion,
  type Question,
} from '@/lib/schema/question'

const nameThatComponent = {
  id: '11111111-1111-4111-8111-111111111111',
  version: 1,
  status: 'published',
  mode: 'name-that-component',
  difficulty: 'hard',
  component: 'Badge',
  prompt: 'Which component is this?',
  explanation: 'A Badge carries a count or a status dot, a Tag carries a removable label.',
  docUrl: null,
  timerSeconds: null,
  imageKey: 'q7f3a91.png',
  correctOptionId: 'a',
  options: [
    { id: 'a', component: 'Badge' },
    { id: 'b', component: 'Tag' },
    { id: 'c', component: 'Status' },
    { id: 'd', component: 'Counter' },
  ],
}

test('accepts a well-formed question', () => {
  assert.equal(questionSchema.safeParse(nameThatComponent).success, true)
})

test('rejects a component that is not in the design system catalog', () => {
  const result = questionSchema.safeParse({
    ...nameThatComponent,
    options: [...nameThatComponent.options.slice(1), { id: 'z', component: 'Chip' }],
    correctOptionId: 'b',
  })
  assert.equal(result.success, false)
})

test('rejects a correct answer that points at no option', () => {
  const result = questionSchema.safeParse({ ...nameThatComponent, correctOptionId: 'zz' })
  assert.equal(result.success, false)
})

test('rejects duplicate option ids', () => {
  const result = questionSchema.safeParse({
    ...nameThatComponent,
    options: [
      { id: 'a', component: 'Badge' },
      { id: 'a', component: 'Tag' },
      { id: 'c', component: 'Status' },
      { id: 'd', component: 'Counter' },
    ],
  })
  assert.equal(result.success, false)
})

test('rejects an empty explanation', () => {
  const result = questionSchema.safeParse({ ...nameThatComponent, explanation: '' })
  assert.equal(result.success, false)
})

test('spot-the-drift takes exactly two options', () => {
  const twoImages = {
    ...nameThatComponent,
    mode: 'spot-the-drift',
    imageKey: null,
    correctOptionId: 'a',
    options: [
      { id: 'a', imageKey: 'aaa111.png' },
      { id: 'b', imageKey: 'bbb222.png' },
    ],
  }
  assert.equal(questionSchema.safeParse(twoImages).success, true)
  assert.equal(
    questionSchema.safeParse({
      ...twoImages,
      options: [...twoImages.options, { id: 'c', imageKey: 'ccc333.png' }],
    }).success,
    false,
  )
})

test('the player payload leaks neither the answer, the explanation nor the component', () => {
  const question = questionSchema.parse(nameThatComponent) as Question
  const payload = toPlayerQuestion(question, { runId: 'run-1', position: 1 })

  const serialised = JSON.stringify(payload)
  assert.ok(!serialised.includes('correctOptionId'))
  assert.ok(!serialised.includes('explanation'))
  assert.ok(!serialised.includes('Badge carries'))
  // `component` is the answer on this mode, so it must not travel.
  assert.equal(payload.component, null)
  // The options still name components — those are the choices on offer.
  assert.equal(payload.options.length, 4)
})

test('the component travels on modes where it is part of the question', () => {
  const question = questionSchema.parse({
    ...nameThatComponent,
    mode: 'which-variant',
    imageKey: null,
    options: [
      { id: 'a', imageKey: 'aaa111.png' },
      { id: 'b', imageKey: 'bbb222.png' },
      { id: 'c', imageKey: 'ccc333.png' },
      { id: 'd', imageKey: 'ddd444.png' },
    ],
  }) as Question
  const payload = toPlayerQuestion(question, { runId: 'run-1', position: 1 })
  assert.equal(payload.component, 'Badge')
})

test('option order is stable across re-serves but differs between positions', () => {
  const question = questionSchema.parse(nameThatComponent) as Question
  const first = toPlayerQuestion(question, { runId: 'run-1', position: 1 })
  const again = toPlayerQuestion(question, { runId: 'run-1', position: 1 })
  const elsewhere = toPlayerQuestion(question, { runId: 'run-1', position: 4 })

  assert.deepEqual(
    first.options.map((o) => o.id),
    again.options.map((o) => o.id),
  )
  assert.notDeepEqual(
    first.options.map((o) => o.id),
    elsewhere.options.map((o) => o.id),
  )
})

test('the hard timer default applies when the question sets no override', () => {
  const question = questionSchema.parse(nameThatComponent) as Question
  assert.equal(toPlayerQuestion(question, { runId: 'r', position: 1 }).timerSeconds, 15)
})

test('a wrong answer scores nothing', () => {
  const score = scoreAnswer({
    correct: false,
    difficulty: 'hard',
    timeMs: 1000,
    timerSeconds: 15,
    streak: 0,
  })
  assert.equal(score.total, 0)
})

test('an instant hard answer on a 3-streak pays base, speed and streak', () => {
  const score = scoreAnswer({
    correct: true,
    difficulty: 'hard',
    timeMs: 0,
    timerSeconds: 15,
    streak: 3,
  })
  assert.deepEqual(score, { base: 200, speed: 50, streak: 50, total: 300 })
})

test('answering as the timer expires still pays the base', () => {
  const score = scoreAnswer({
    correct: true,
    difficulty: 'easy',
    timeMs: 25_000,
    timerSeconds: 25,
    streak: 1,
  })
  assert.deepEqual(score, { base: 100, speed: 0, streak: 0, total: 100 })
})
