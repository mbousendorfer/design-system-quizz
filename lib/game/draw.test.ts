import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Difficulty, Mode } from '@/lib/difficulty'
import { drawRun, type PoolQuestion } from '@/lib/game/draw'

let counter = 0
function question(
  difficulty: Difficulty,
  mode: Mode = 'name-that-component',
  id = `q${(counter += 1)}`,
): PoolQuestion {
  return { id, version: 1, mode, difficulty, timerSeconds: null }
}

function poolOf(difficulty: Difficulty, howMany: number, mode: Mode = 'name-that-component') {
  return Array.from({ length: howMany }, () => question(difficulty, mode))
}

/** Deterministic stand-in for Math.random. */
const fixedRandom = () => {
  let seed = 1
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
}

test('draws five distinct questions', () => {
  const result = drawRun({
    pool: poolOf('easy', 20),
    seen: new Map(),
    mode: 'name-that-component',
    difficulty: 'easy',
    random: fixedRandom(),
  })

  assert.equal(result.items.length, 5)
  assert.equal(new Set(result.items.map((item) => item.questionId)).size, 5)
  assert.equal(result.short, false)
  assert.equal(result.repeats, 0)
})

test('a progressive run walks easy, easy, medium, medium, hard', () => {
  const result = drawRun({
    pool: [...poolOf('easy', 5), ...poolOf('medium', 5), ...poolOf('hard', 5)],
    seen: new Map(),
    mode: 'mixed',
    difficulty: 'progressive',
    random: fixedRandom(),
  })

  assert.deepEqual(
    result.items.map((item) => item.difficulty),
    ['easy', 'easy', 'medium', 'medium', 'hard'],
  )
  assert.deepEqual(result.substitutedFrom, [])
})

test('a single-mode run never draws another mode', () => {
  const result = drawRun({
    pool: [...poolOf('easy', 10, 'spot-the-drift'), ...poolOf('easy', 10, 'which-component')],
    seen: new Map(),
    mode: 'spot-the-drift',
    difficulty: 'easy',
    random: fixedRandom(),
  })

  assert.ok(result.items.every((item) => item.mode === 'spot-the-drift'))
})

test('unseen questions are preferred over seen ones', () => {
  const pool = [...poolOf('easy', 5)]
  // Every question but the last three has been played before.
  const seen = new Map(pool.slice(0, 2).map((q, index) => [q.id, 1000 + index]))

  const result = drawRun({
    pool,
    seen,
    mode: 'name-that-component',
    difficulty: 'easy',
    count: 3,
    random: fixedRandom(),
  })

  assert.equal(result.repeats, 0)
  assert.ok(result.items.every((item) => !seen.has(item.questionId)))
})

test('an unseen question at a neighbouring level beats a seen one at the right level', () => {
  const easySeen = question('easy', 'name-that-component', 'easy-seen')
  const mediumFresh = question('medium', 'name-that-component', 'medium-fresh')

  const result = drawRun({
    pool: [easySeen, mediumFresh],
    seen: new Map([['easy-seen', 1000]]),
    mode: 'name-that-component',
    difficulty: 'easy',
    count: 1,
    random: fixedRandom(),
  })

  assert.equal(result.items[0].questionId, 'medium-fresh')
  assert.deepEqual(result.substitutedFrom, ['easy'])
  assert.equal(result.repeats, 0)
})

test('once everything has been seen, the longest-ago question comes back first', () => {
  const pool = [
    question('easy', 'name-that-component', 'oldest'),
    question('easy', 'name-that-component', 'newest'),
  ]

  const result = drawRun({
    pool,
    seen: new Map([
      ['oldest', 1_000],
      ['newest', 9_000],
    ]),
    mode: 'name-that-component',
    difficulty: 'easy',
    count: 1,
    random: fixedRandom(),
  })

  assert.equal(result.items[0].questionId, 'oldest')
  assert.equal(result.repeats, 1)
})

test('a thin level pool is topped up from the neighbouring level and reported', () => {
  const result = drawRun({
    pool: [...poolOf('hard', 2), ...poolOf('medium', 10)],
    seen: new Map(),
    mode: 'mixed',
    difficulty: 'hard',
    random: fixedRandom(),
  })

  assert.equal(result.items.length, 5)
  assert.equal(result.items.filter((item) => item.difficulty === 'hard').length, 2)
  assert.deepEqual(result.substitutedFrom, ['hard'])
})

test('a pool smaller than a run yields a short run rather than a crash', () => {
  const result = drawRun({
    pool: poolOf('easy', 2),
    seen: new Map(),
    mode: 'name-that-component',
    difficulty: 'easy',
    random: fixedRandom(),
  })

  assert.equal(result.items.length, 2)
  assert.equal(result.short, true)
})

test('an empty pool yields an empty run', () => {
  const result = drawRun({
    pool: [],
    seen: new Map(),
    mode: 'which-variant',
    difficulty: 'easy',
    random: fixedRandom(),
  })

  assert.deepEqual(result.items, [])
  assert.equal(result.short, true)
})

test('the timer is frozen from the level default, or the question override', () => {
  const result = drawRun({
    pool: [
      { id: 'default', version: 1, mode: 'which-component', difficulty: 'hard', timerSeconds: null },
      { id: 'override', version: 1, mode: 'which-component', difficulty: 'hard', timerSeconds: 45 },
    ],
    seen: new Map(),
    mode: 'which-component',
    difficulty: 'hard',
    count: 2,
    random: fixedRandom(),
  })

  const byId = new Map(result.items.map((item) => [item.questionId, item.timerSeconds]))
  assert.equal(byId.get('default'), 15)
  assert.equal(byId.get('override'), 45)
})

test('two runs over the same pool do not draw the same five in the same order', () => {
  const pool = poolOf('easy', 40)
  const first = drawRun({ pool, seen: new Map(), mode: 'name-that-component', difficulty: 'easy' })
  const second = drawRun({ pool, seen: new Map(), mode: 'name-that-component', difficulty: 'easy' })

  assert.notDeepEqual(
    first.items.map((item) => item.questionId),
    second.items.map((item) => item.questionId),
  )
})
