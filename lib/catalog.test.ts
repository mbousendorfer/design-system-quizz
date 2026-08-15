import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DS_COMPONENTS,
  docUrlFor,
  getComponent,
  hasLivingStory,
  isKnownComponent,
  suggestDistractors,
} from '@/lib/catalog'
import { lintQuestion } from '@/lib/schema/question'

test('the catalog is the union of the specs and the Storybook', () => {
  const sources = new Set(DS_COMPONENTS.map((component) => component.source))
  assert.deepEqual([...sources].sort(), ['both', 'specs', 'storybook'])

  // Documented in the Storybook but absent from design-specs, which is why they
  // were unquizzable before.
  assert.equal(getComponent('Link')?.source, 'storybook')
  assert.equal(getComponent('Link')?.specPath, null)
})

test('a documentation link points at the component page, not the homepage', () => {
  assert.equal(docUrlFor('Badge'), 'https://design.agorapulse.com/?path=/docs/display-badge--docs')
})

test('a component whose story is published under another name still resolves', () => {
  // The specs call it Snackbars Thread; the Storybook publishes Feedback/Snackbar.
  assert.equal(
    docUrlFor('Snackbars Thread'),
    'https://design.agorapulse.com/?path=/docs/feedback-snackbar--docs',
  )
})

test('a component with no story has no link rather than a wrong one', () => {
  assert.equal(hasLivingStory('Modal'), false)
  assert.equal(docUrlFor('Modal'), null)
  // Still in the catalog: existing questions name it, and dropping it would make
  // them unvalidatable.
  assert.equal(isKnownComponent('Modal'), true)
})

test('an unknown component has no link and is not known', () => {
  assert.equal(docUrlFor('Chip'), null)
  assert.equal(hasLivingStory('Chip'), false)
})

test('naming a component with no Storybook story warns without blocking', () => {
  const warnings = lintQuestion({
    mode: 'which-component',
    difficulty: 'easy',
    component: 'Infobox',
    docUrl: 'https://design.agorapulse.com/?path=/docs/feedback-infobox--docs',
    correctOptionId: 'a',
    options: [
      { id: 'a', component: 'Infobox' },
      { id: 'b', component: 'Notification' },
      { id: 'c', component: 'Tooltip' },
      { id: 'd', component: 'Modal' },
    ],
  })

  // Notification and Modal have no story; Infobox and Tooltip do.
  const storyWarnings = warnings.filter((warning) => warning.includes('no Storybook story'))
  assert.equal(storyWarnings.length, 2)
  assert.ok(storyWarnings.some((warning) => warning.includes('Notification')))
  assert.ok(storyWarnings.some((warning) => warning.includes('Modal')))
})

test('a clean question produces no advice at all', () => {
  const warnings = lintQuestion({
    mode: 'which-component',
    difficulty: 'easy',
    component: 'Infobox',
    docUrl: 'https://design.agorapulse.com/?path=/docs/feedback-infobox--docs',
    correctOptionId: 'a',
    options: [
      { id: 'a', component: 'Infobox' },
      { id: 'b', component: 'Tooltip' },
      { id: 'c', component: 'Badge' },
      { id: 'd', component: 'Tag' },
    ],
  })
  assert.deepEqual(warnings, [])
})

test('the distractor suggester still prefers genuinely confusable components', () => {
  // The seven new Storybook-only components must not have displaced the curated
  // groups by widening the categories.
  assert.deepEqual(suggestDistractors('Infobox', 3), ['Notification', 'Snackbars Thread', 'Tooltip'])
})
