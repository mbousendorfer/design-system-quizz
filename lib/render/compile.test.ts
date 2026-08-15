import assert from 'node:assert/strict'
import { test } from 'node:test'

import { compileCssUi } from '@/lib/render/compile'
import { renamedClass } from '@/lib/render/classmap'
import { toPlayerRender, type StoredRender } from '@/lib/schema/render'

test('a compiled render names no design system class', () => {
  const render = compileCssUi({ component: 'Badge', modifiers: ['blue'], label: 'NEW' })

  assert.ok(!render.compiled.includes('ap-badge'), 'the component name survived into the markup')
  assert.ok(!render.compiled.includes('blue'), 'the modifier survived into the markup')
  assert.ok(render.compiled.includes(renamedClass('ap-badge')))
  assert.ok(render.compiled.includes(renamedClass('blue')))
})

test('the recipe is kept beside the markup, for the author to edit', () => {
  const render = compileCssUi({ component: 'Status', modifiers: ['green'], label: 'Published' })
  assert.equal(render.component, 'Status')
  assert.deepEqual(render.modifiers, ['green'])
  assert.equal(render.label, 'Published')
})

test('a modifier the component does not ship is refused', () => {
  assert.throws(
    () => compileCssUi({ component: 'Badge', modifiers: ['ghost'], label: '' }),
    /not a modifier of Badge/,
  )
})

test('a component with no CSS-UI layer is refused rather than rendered blank', () => {
  // Modal has a spec but no CSS-UI partial, so there is nothing to render.
  assert.throws(() => compileCssUi({ component: 'Modal', modifiers: [], label: '' }), /no CSS-UI layer/)
})

test('a label cannot smuggle markup in', () => {
  const render = compileCssUi({
    component: 'Status',
    modifiers: [],
    label: '<script>alert(1)</script>',
  })
  assert.ok(!render.compiled.includes('<script>'))
  assert.ok(render.compiled.includes('&lt;script&gt;'))
})

test('a label cannot smuggle an unrenamed class in', () => {
  // Renaming runs on the template before the label is substituted, so a class
  // attribute typed into a label is inert text rather than a leak.
  const render = compileCssUi({
    component: 'Status',
    modifiers: [],
    label: 'x" class="ap-badge',
  })
  assert.ok(!render.compiled.includes('class="ap-badge"'))
})

test('only the compiled markup reaches the player', () => {
  const stored: StoredRender = compileCssUi({
    component: 'Badge',
    modifiers: ['orange'],
    label: 'BETA',
  })
  const player = toPlayerRender(stored)

  assert.deepEqual(Object.keys(player ?? {}).sort(), ['html', 'kind'])
  const serialised = JSON.stringify(player)
  assert.ok(!serialised.includes('Badge'), 'the component name reached the player')
  assert.ok(!serialised.includes('orange'), 'the modifier reached the player')
})

test('a screenshot passes through unchanged', () => {
  assert.deepEqual(toPlayerRender({ kind: 'shot', imageKey: 'abc123.png' }), {
    kind: 'shot',
    imageKey: 'abc123.png',
  })
})

test('nothing renders as nothing', () => {
  assert.equal(toPlayerRender(null), null)
})
