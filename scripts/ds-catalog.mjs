#!/usr/bin/env node
/**
 * Generates `content/ds-catalog.json` from the Agorapulse design system specs.
 *
 * The design system repo is READ-ONLY here. We only extract what the quiz needs:
 * the list of real components (to validate questions), their category (to suggest
 * distractors) and their intents (to write `which-component` scenarios).
 *
 * Usage: npm run ds:catalog
 * Override the source with DS_SPECS_DIR=/path/to/design-specs
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const SPECS_DIR =
  process.env.DS_SPECS_DIR ?? join(homedir(), 'code', 'design-system', 'design-specs')
const OUT_FILE = resolve(import.meta.dirname, '..', 'content', 'ds-catalog.json')

/**
 * Components that are genuinely easy to confuse with one another, across
 * categories. The distractor suggester falls back to these when the answer's own
 * category cannot supply enough plausible wrong answers — `actions` only holds 5
 * components, so a 6-option `hard` question cannot be built from it alone.
 * Every name is checked against the parsed catalog below, so this list cannot rot
 * silently when the design system changes.
 */
const CONFUSABLE_GROUPS = [
  ['Badge', 'Tag', 'Status', 'Counter', 'Labels'],
  ['Button', 'Icon Button', 'Split Button', 'Social Button', 'Close Button'],
  ['Toggle', 'Slide Toggle', 'Checkbox', 'Radio'],
  ['Select', 'Autocomplete', 'Selection Dropdown', 'Filter Dropdown', 'Action Dropdown', 'Popmenu'],
  ['Modal', 'Confirm Modal', 'Media Display Overlay'],
  ['Infobox', 'Notification', 'Snackbars Thread', 'Tooltip', 'Form Message'],
  ['Tabs', 'Segmented Control', 'Nav Selector'],
  ['Stepper', 'Dot Stepper', 'Paginator'],
  ['Form Field', 'Input Group', 'Input Search', 'Password Input', 'Phone Number Input'],
  ['Status Card', 'Radio Button Card'],
  ['Avatar', 'Avatar Group'],
  ['Datepicker', 'Neo Datepicker'],
  ['Labels', 'Labels Selector', 'Filter Chips List'],
]

function fail(message) {
  console.error(`ds:catalog — ${message}`)
  process.exit(1)
}

function readSpecFiles(dir) {
  const files = []
  for (const category of readdirSync(dir)) {
    const categoryDir = join(dir, category)
    if (!statSync(categoryDir).isDirectory()) continue
    for (const file of readdirSync(categoryDir)) {
      if (file.endsWith('.md')) files.push(join(categoryDir, file))
    }
  }
  return files.sort()
}

/** Pulls `- **Key:** value` out of the `## Metadata` block. */
function metaField(source, key) {
  const match = source.match(new RegExp(`^- \\*\\*${key}:\\*\\* (.+)$`, 'm'))
  return match?.[1]?.trim()
}

/** Every `` `<thing>` `` in a line — selectors are listed that way, comma separated. */
function backtickedTags(line = '') {
  return [...line.matchAll(/`<([^`>]+)>`/g)].map((m) => m[1])
}

/**
 * Returns the body of a `## Heading` section, up to the next `## `.
 * The tail anchor is `(?![\s\S])` and not `$`: the `m` flag is needed to find the
 * heading, and under it `$` would match the very first line break.
 */
function section(source, heading) {
  const match = source.match(
    new RegExp(`^## ${heading}\\n([\\s\\S]*?)(?=\\n## |(?![\\s\\S]))`, 'm'),
  )
  return match?.[1] ?? ''
}

/**
 * Modifiers live on a line made only of comma-separated backticked words. Matching
 * the shape rather than the position keeps us clear of the surrounding prose, which
 * also contains backticks (the "never BEM `--`" warning).
 */
function modifiersFrom(statesSection) {
  const line = statesSection
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^`[^`]+`(, `[^`]+`)*$/.test(l))
  return line ? [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]) : []
}

function parseComponent(path) {
  const source = readFileSync(path, 'utf8')

  const name = source.match(/^# (.+)$/m)?.[1]?.trim()
  if (!name) fail(`no H1 title in ${path}`)

  const category = metaField(source, 'Category')
  if (!category) fail(`no Category in ${path}`)

  // "Display/Badge — https://design.agorapulse.com" — the URL is the same for every
  // component, only the story title varies, so both are kept separately.
  const [storyTitle, storyUrl] = (metaField(source, 'Storybook') ?? '').split('—').map((s) => s?.trim())

  const anatomy = section(source, 'Anatomy')
  const cssClasses = [
    ...(anatomy.match(/^- CSS-UI classes: (.+)$/m)?.[1] ?? '').matchAll(/`([^`]+)`/g),
  ].map((m) => m[1])

  return {
    name,
    slug: path.split('/').pop().replace(/\.md$/, ''),
    category,
    selectors: backtickedTags(metaField(source, 'Selectors')),
    cssClasses,
    modifiers: modifiersFrom(section(source, 'States')),
    specPath: relative(SPECS_DIR, path),
    storybookTitle: storyTitle ?? null,
    storybookUrl: storyUrl ?? null,
    intents: [],
    confusableWith: [],
  }
}

/** `| callout | [Infobox](components/feedback/infobox.md) |` → { Infobox: ['callout'] } */
function parseIntents(readme) {
  const intents = new Map()
  for (const line of readme.split('\n')) {
    const match = line.match(/^\|\s*(.+?)\s*\|\s*\[(.+?)\]\((.+?)\)\s*\|$/)
    if (!match) continue
    const [, intent, component] = match
    if (intent === 'I need…') continue
    if (!intents.has(component)) intents.set(component, [])
    intents.get(component).push(intent)
  }
  return intents
}

// ---------------------------------------------------------------------------

let specFiles
try {
  specFiles = readSpecFiles(join(SPECS_DIR, 'components'))
} catch (error) {
  fail(
    `cannot read ${SPECS_DIR}/components — is the design system checked out?\n` +
      `Set DS_SPECS_DIR to point at it. (${error.message})`,
  )
}
if (specFiles.length === 0) fail(`no component specs found under ${SPECS_DIR}/components`)

const components = specFiles.map(parseComponent)
const byName = new Map(components.map((c) => [c.name, c]))

const intents = parseIntents(readFileSync(join(SPECS_DIR, 'README.md'), 'utf8'))
for (const [name, list] of intents) {
  if (!byName.has(name)) fail(`README intent table points at unknown component "${name}"`)
  byName.get(name).intents = list.sort()
}

for (const group of CONFUSABLE_GROUPS) {
  for (const name of group) {
    if (!byName.has(name)) {
      fail(
        `CONFUSABLE_GROUPS references "${name}", which no longer exists in the design system.\n` +
          `Update the group list in scripts/ds-catalog.mjs.`,
      )
    }
  }
  for (const name of group) {
    const target = byName.get(name)
    for (const other of group) {
      if (other !== name && !target.confusableWith.includes(other)) {
        target.confusableWith.push(other)
      }
    }
  }
}
for (const component of components) component.confusableWith.sort()

// A checksum instead of a timestamp: re-running the script on an unchanged design
// system produces a byte-identical file, so git only shows a diff when the DS moved.
const checksum = createHash('sha256')
  .update(specFiles.map((f) => readFileSync(f, 'utf8')).join('\0'))
  .digest('hex')
  .slice(0, 16)

const categories = [...new Set(components.map((c) => c.category))].sort()

writeFileSync(
  OUT_FILE,
  `${JSON.stringify({ checksum, categories, components }, null, 2)}\n`,
  'utf8',
)

const perCategory = categories
  .map((c) => `${c} ${components.filter((x) => x.category === c).length}`)
  .join(', ')
console.log(
  `ds:catalog — ${components.length} components (${perCategory})\n` +
    `             ${intents.size} components carry intents, checksum ${checksum}\n` +
    `             written to ${relative(process.cwd(), OUT_FILE)}`,
)
