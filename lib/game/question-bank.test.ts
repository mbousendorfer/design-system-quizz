import assert from 'node:assert/strict'
import test from 'node:test'

import { PLAYABLE } from '@/lib/game/question-bank'
import { MODE_SPEC, isComponentAnswerMode } from '@/lib/difficulty'
import { isKnownComponent } from '@/lib/catalog'

/**
 * What the database used to enforce.
 *
 * The question bank was a table with CHECK constraints: an explanation of a
 * certain length, exactly one correct option that exists, an option count
 * within the mode's bounds. Moving the bank into a file removed all of that,
 * and nothing replaced it — a malformed question would ship silently and only
 * show up as a broken question mid-run.
 *
 * These run on every build, which is the point: the constraints are back, they
 * just live here now.
 */
test('every published question is complete', () => {
  for (const question of PLAYABLE) {
    const where = `${question.mode}/${question.component} (${question.id.slice(0, 8)})`

    assert.ok(question.prompt.trim().length > 0, `${where}: empty prompt`)
    assert.ok(
      question.explanation.trim().length >= 20,
      `${where}: the explanation is what teaches — it cannot be a stub`,
    )
    assert.ok(isKnownComponent(question.component), `${where}: not a design system component`)
  }
})

test('every published question has exactly one answer, and it is on the question', () => {
  for (const question of PLAYABLE) {
    const where = `${question.mode}/${question.component} (${question.id.slice(0, 8)})`
    const ids = question.options.map((option) => option.id)

    assert.equal(new Set(ids).size, ids.length, `${where}: duplicate option ids`)
    assert.ok(
      ids.includes(question.correctOptionId),
      `${where}: the correct option id is not one of the options`,
    )
  }
})

test('every published question offers the number of options its level calls for', () => {
  for (const question of PLAYABLE) {
    const where = `${question.mode}/${question.component} (${question.id.slice(0, 8)})`
    const [min, max] = MODE_SPEC[question.mode].options
    assert.ok(
      question.options.length >= min && question.options.length <= max,
      `${where}: ${question.options.length} options, expected between ${min} and ${max}`,
    )
  }
})

test('a question that shows something has something to show', () => {
  for (const question of PLAYABLE) {
    const where = `${question.mode}/${question.component} (${question.id.slice(0, 8)})`
    if (MODE_SPEC[question.mode].answers !== 'image') continue

    for (const option of question.options) {
      assert.ok(
        option.render != null || option.imageKey != null,
        `${where}: option ${option.id} is an image option with nothing to render`,
      )
    }
  }
})

/**
 * The rule the writing guide states and nothing enforced: a prompt that names a
 * component which is also on the answer list gives the answer away, or worse,
 * names a distractor and makes the question wrong.
 */
test('no prompt names a component that is one of its own options', () => {
  for (const question of PLAYABLE) {
    if (!isComponentAnswerMode(question.mode)) continue
    const where = `${question.mode}/${question.component} (${question.id.slice(0, 8)})`

    for (const option of question.options) {
      if (!option.component) continue
      const named = new RegExp(`(?<![\\w-])${option.component}s?(?![\\w-])`, 'i').test(question.prompt)
      assert.ok(
        !named,
        `${where}: the prompt names "${option.component}", which is one of its options`,
      )
    }
  }
})
