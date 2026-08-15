import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { DS_COMPONENTS } from '@/lib/catalog'

/**
 * The vendored stylesheets are the largest thing a player can read, so this is
 * where a leak hides best.
 *
 * Three passes of `ds:css` each missed a different category — class names first,
 * then comments (which name components in prose), then animation names, where
 * `ap-snackbar-slide-in` spelled out its component in an `animation:` shorthand
 * nobody thinks to look at. Grepping the built artefact catches the next one
 * without anyone having to predict which syntax it hides in.
 */
const SHEETS = ['tokens', 'ui', 'icons'].map((name) => ({
  name,
  css: readFileSync(`public/ds/${name}.css`, 'utf8'),
}))

test('no design system class or element name survives in the vendored sheets', () => {
  for (const { name, css } of SHEETS) {
    // The icon prefix is deliberately kept: `[class^="ap-icon-"]` is how every
    // icon is selected, and it names no component.
    const found = [...new Set([...css.matchAll(/\bap-(?!icon-)[a-z][\w-]*/g)].map((m) => m[0]))]
    assert.deepEqual(found, [], `${name}.css still spells out: ${found.join(', ')}`)
  }
})

test('no component name survives in the vendored sheets', () => {
  // Single English words like "Card", "Input" or "Table" appear in CSS for reasons
  // that have nothing to do with the design system, so the test asks only about
  // names specific enough to be evidence.
  const telling = DS_COMPONENTS.map((component) => component.name)
    .filter((name) => name.includes(' ') || name.length > 8)
    .map((name) => name.toLowerCase().replace(/\s+/g, '-'))

  for (const { name, css } of SHEETS) {
    const lower = css.toLowerCase()
    const found = telling.filter((component) => lower.includes(component))
    assert.deepEqual(found, [], `${name}.css names: ${found.join(', ')}`)
  }
})

/**
 * Modifiers that share their spelling with a CSS value keyword, so they appear in
 * any stylesheet regardless of what it styles. Excluding them costs nothing: none
 * names a component, which is what the test is actually looking for.
 */
const CSS_KEYWORD_MODIFIERS = new Set(['normal', 'bottom', 'right', 'transparent'])

test('no modifier that is also an answer survives in the vendored sheets', () => {
  // Every modifier of every component, which is what `which-variant` asks about.
  // `primary`, `ghost` and `mermaid` are as much the answer as the class is. The
  // search covers declarations too, not just selectors — the worst leak found so
  // far was `--v1ecpnc9-feature-lock-hover` inside a var(), where a rename had
  // matched a prefix and left the variant spelled out in the tail.
  const modifiers = new Set(
    DS_COMPONENTS.flatMap((component) => component.modifiers).filter(
      (m) => m.length > 4 && !CSS_KEYWORD_MODIFIERS.has(m),
    ),
  )

  for (const { name, css } of SHEETS) {
    const found = [...modifiers].filter((modifier) =>
      // Not after a colon: the design system names several modifiers after the
      // state they mirror, so `disabled`, `invalid` and `valid` are also real
      // pseudo-classes. A leaked modifier is a class or a token fragment and is
      // never written `:disabled`.
      new RegExp(`(?<![\\w:-])${modifier}(?![\\w-])`).test(css),
    )
    assert.deepEqual(found, [], `${name}.css names: ${found.join(', ')}`)
  }
})

test('the templates emit no custom element, which is what makes renaming tags safe', () => {
  // `ds:css` renames `ap-symbol` and friends in type-selector position. That is
  // only safe while no template produces such an element — this is the check the
  // script's comment points at.
  const offenders = DS_COMPONENTS.filter((component) => /<ap-[a-z]/.test(component.cssUiTemplate ?? ''))
  assert.deepEqual(
    offenders.map((component) => component.name),
    [],
    'a template emits a custom element, so ds:css must stop renaming tag selectors',
  )
})
