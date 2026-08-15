#!/usr/bin/env node
/**
 * Vendors the design system stylesheets, with every class and custom property
 * renamed, so a component can be rendered live without handing the player the answer.
 *
 * Usage: npm run ds:css
 *
 * ## Why rename anything
 *
 * `<span class="ap-badge blue">` names the component in `name-that-component`, and
 * `ap-button ghost` names the variant in `which-variant` — in both modes the class
 * *is* the answer, readable by anyone who opens the inspector. The custom properties
 * leak just as loudly: `var(--comp-button-height)` says "button" whatever the class
 * says. Both namespaces are renamed together, or neither is worth renaming.
 *
 * ## What this is and is not
 *
 * A structural diff between the vendored sheet and the public one on the CDN
 * recovers this map mechanically. It raises cheating from *five seconds and no
 * skill* to *an afternoon of scripting*, which is the right amount of defence for an
 * internal quiz. It is obfuscation, not security, and the code says so.
 *
 * ## Why vendor rather than link the CDN
 *
 * Pinning means the design system can no longer change under a published question
 * and silently invalidate its answer; the quiz stops depending on someone else's
 * uptime inside a timed question; and the app can carry a real content security
 * policy instead of having to allow a third-party stylesheet host.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Pinned, never @latest: a silent DS upgrade would invalidate published answers.
const THEME_VERSION = process.env.DS_THEME_VERSION ?? '22.0.7'
const SYMBOL_VERSION = process.env.DS_SYMBOL_VERSION ?? '22.0.0'
const CDN = 'https://cdn.jsdelivr.net/npm'

/**
 * Salt for the class hash. Rotating it invalidates every stored `compiled` markup,
 * so it lives in the repo rather than the environment — a value that changes per
 * deploy would silently break every live question.
 */
const SALT = 'ds-quiz/2026-08'

const ROOT = resolve(import.meta.dirname, '..')
const OUT_CSS = join(ROOT, 'public', 'ds')
const OUT_FONTS = join(OUT_CSS, 'fonts')
const OUT_MAP = join(ROOT, 'content', 'ds-classmap.json')

const SOURCES = {
  tokens: `${CDN}/@agorapulse/ui-theme@${THEME_VERSION}/assets/desktop_variables.css`,
  fonts: `${CDN}/@agorapulse/ui-theme@${THEME_VERSION}/assets/style/css-ui/font-face.css`,
  ui: `${CDN}/@agorapulse/ui-theme@${THEME_VERSION}/assets/style/css-ui/index.css`,
  icons: `${CDN}/@agorapulse/ui-symbol@${SYMBOL_VERSION}/icons/ap-icons.css`,
}

function fail(message) {
  console.error(`ds:css — ${message}`)
  process.exit(1)
}

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) fail(`${url} returned HTTP ${response.status}`)
  return response.text()
}

// ---------------------------------------------------------------------------
// The rename
// ---------------------------------------------------------------------------

function fnv1a(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

/**
 * Icons keep a shared `i` prefix and everything else takes `c`.
 *
 * `ap-icons.css` selects with `[class^="ap-icon-"]` and `[class*=" ap-icon-"]`, so
 * a rename that scattered the icon names across the alphabet would break every
 * icon in the design system. Those two attribute selectors are rewritten to match
 * the new prefix below.
 */
const renameClass = (name) => (name.startsWith('ap-icon-') ? `i${fnv1a(SALT + name)}` : `c${fnv1a(SALT + name)}`)
const renameProperty = (name) => `--v${fnv1a(SALT + name)}`

/**
 * Comments are stripped before anything else, and never reach the output.
 *
 * They are a leak in their own right — the upstream sheets carry section headers
 * naming each component — and they are what made a bare `.css` from `index.css`
 * look like a class name.
 */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Class tokens as they appear in selectors: `.ap-button`, `.primary`, `.truncate`. */
function collectClasses(css) {
  const names = new Set()
  // Strip declaration blocks too, so `.5rem` and `url(.foo)` cannot be mistaken
  // for selectors.
  const selectorsOnly = css.replace(/\{[^{}]*\}/g, '{}')
  for (const match of selectorsOnly.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) names.add(match[1])
  return names
}

function collectProperties(css) {
  const names = new Set()
  for (const match of css.matchAll(/(--[\w-]+)\s*:/g)) names.add(match[1])
  for (const match of css.matchAll(/var\(\s*(--[\w-]+)/g)) names.add(match[1])
  return names
}

function applyRenames(css, classMap, propertyMap) {
  let out = css

  // Properties first: a class rename could otherwise land inside a var() name.
  for (const [from, to] of propertyMap) {
    out = out.replaceAll(from, to)
  }

  // Classes, longest first, so `.ap-button-icon` is not half-rewritten by `.ap-button`.
  const ordered = [...classMap.entries()].sort((a, b) => b[0].length - a[0].length)
  for (const [from, to] of ordered) {
    // Only in selector position: a bare `.`-prefixed token, not inside a string or
    // a url().
    out = out.replace(new RegExp(`\\.${from.replace(/[-]/g, '\\-')}(?![\\w-])`, 'g'), `.${to}`)
  }

  return out
}

// ---------------------------------------------------------------------------

console.log(`\nVendoring ui-theme@${THEME_VERSION} and ui-symbol@${SYMBOL_VERSION}\n`)

const [rawTokens, rawFonts, rawUi, rawIcons] = await Promise.all([
  fetchText(SOURCES.tokens),
  fetchText(SOURCES.fonts),
  fetchText(SOURCES.ui),
  fetchText(SOURCES.icons),
])

const tokensCss = stripComments(rawTokens)
const uiCss = stripComments(rawUi)
const iconsCss = stripComments(rawIcons)
// The font sheet keeps its comments: it never reaches a shadow root and names no
// component.
const fontsCss = rawFonts
console.log(
  `  ok  fetched ${[tokensCss, fontsCss, uiCss, iconsCss]
    .map((css) => `${Math.round(css.length / 1024)}KB`)
    .join(', ')}`,
)

// The tokens file is a single :root block, and :root matches nothing inside a shadow
// tree — a DocumentFragment is not an element, so all 815 custom properties would
// simply vanish.
if (!/^\s*:root\s*\{/.test(tokensCss)) {
  fail('desktop_variables.css no longer starts with a single :root block — check the upstream file.')
}

const classNames = new Set([...collectClasses(uiCss), ...collectClasses(iconsCss)])
const propertyNames = new Set([
  ...collectProperties(tokensCss),
  ...collectProperties(uiCss),
  ...collectProperties(iconsCss),
])

const classMap = new Map([...classNames].map((name) => [name, renameClass(name)]))
const propertyMap = new Map([...propertyNames].map((name) => [name, renameProperty(name)]))

const collisions = new Set(classMap.values()).size !== classMap.size
if (collisions) fail('two class names hashed to the same value — change SALT.')

console.log(`  ok  ${classMap.size} classes and ${propertyMap.size} custom properties renamed`)

// --- tokens: :root -> :host, plus a reset for what crosses the shadow boundary ---

let tokens = applyRenames(tokensCss, classMap, propertyMap).replace(/^\s*:root\s*\{/, ':host {')

// Shadow DOM isolates rules, not inheritance. Font, colour and line-height cross the
// boundary from the host, so a component would otherwise inherit the quiz's own
// typography and render subtly wrong — which is the one thing a design system quiz
// cannot afford.
tokens += `
/* Added by ds:css — inherited properties cross the shadow boundary, so the host
   element pins them back to the design system's own defaults. */
:host {
  display: block;
  width: max-content;
  contain: layout style;
  font-family: 'Averta', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: 1.4;
  letter-spacing: normal;
  text-align: left;
  text-transform: none;
  color: ${propertyMap.has('--sys-text-color-default') ? `var(${propertyMap.get('--sys-text-color-default')})` : '#27272a'};
}
`

// --- ui ---------------------------------------------------------------------

const ui = applyRenames(uiCss, classMap, propertyMap)

// --- icons: rewrite the two prefix selectors to match the renamed icons ---------

let icons = applyRenames(iconsCss, classMap, propertyMap)
const beforePrefixFix = icons
icons = icons
  .replaceAll('[class^="ap-icon-"]', '[class^="i"]')
  .replaceAll('[class*=" ap-icon-"]', '[class*=" i"]')
if (icons === beforePrefixFix && /\[class[\^*]=/.test(iconsCss)) {
  fail(
    'ap-icons.css still carries [class^=] selectors this script did not rewrite.\n' +
      'Every icon would render blank. Check the upstream selectors and update ds:css.',
  )
}

// --- fonts: rewrite the relative url() and vendor the files --------------------

mkdirSync(OUT_FONTS, { recursive: true })

// Read the file list out of the stylesheet rather than hardcoding it: the design
// system ships Regular, Semibold, Bold, Extrabold and Black today, and a hardcoded
// list would go stale the moment that changes.
const fontFiles = [...fontsCss.matchAll(/url\((['"]?)[^'")]*\/([^/'")]+\.otf)\1\)/g)].map(
  (match) => match[2],
)
if (fontFiles.length === 0) fail('font-face.css referenced no .otf files — check the upstream file.')

for (const file of fontFiles) {
  const response = await fetch(
    `${CDN}/@agorapulse/ui-theme@${THEME_VERSION}/assets/fonts/averta/${file}`,
  )
  if (!response.ok) fail(`font ${file} returned HTTP ${response.status}`)
  writeFileSync(join(OUT_FONTS, file), Buffer.from(await response.arrayBuffer()))
}
// `@font-face` is ignored inside adoptedStyleSheets — font registration is
// document-scoped — so this one sheet is linked from the document instead. It
// declares nothing but @font-face, so it cannot restyle the quiz's own UI.
const fonts = fontsCss.replaceAll('../../fonts/averta/', '/ds/fonts/')
console.log(`  ok  ${fontFiles.length} font files vendored (${fontFiles.join(", ")})`)

// ---------------------------------------------------------------------------

writeFileSync(join(OUT_CSS, 'tokens.css'), tokens, 'utf8')
writeFileSync(join(OUT_CSS, 'ui.css'), ui, 'utf8')
writeFileSync(join(OUT_CSS, 'icons.css'), icons, 'utf8')
writeFileSync(join(OUT_CSS, 'fonts.css'), fonts, 'utf8')

const checksum = createHash('sha256')
  .update([tokensCss, fontsCss, uiCss, iconsCss].join('\0'))
  .digest('hex')
  .slice(0, 16)

writeFileSync(
  OUT_MAP,
  `${JSON.stringify(
    {
      checksum,
      themeVersion: THEME_VERSION,
      symbolVersion: SYMBOL_VERSION,
      classes: Object.fromEntries([...classMap].sort()),
      properties: Object.fromEntries([...propertyMap].sort()),
    },
    null,
    2,
  )}\n`,
  'utf8',
)

// The check that matters: nothing recognisably from the design system survives in
// the shipped sheets. A leftover `ap-badge` or `ghost` would hand over the answer.
const leaked = [...classMap.keys()].filter(
  (name) => ui.includes(`.${name}`) || icons.includes(`.${name}`),
)
if (leaked.length > 0) {
  fail(`these class names survived the rename and would leak: ${leaked.slice(0, 8).join(', ')}`)
}
for (const marker of ['ap-badge', 'ap-button', 'ap-icon-', '--comp-', '--sys-', '--ref-']) {
  for (const [label, sheet] of [['tokens', tokens], ['ui', ui], ['icons', icons]]) {
    if (sheet.includes(marker)) fail(`"${marker}" still appears in ${label}.css after the rename.`)
  }
}

console.log(
  `  ok  wrote public/ds/{tokens,ui,icons,fonts}.css and content/ds-classmap.json\n` +
    `      checksum ${checksum}\n`,
)
