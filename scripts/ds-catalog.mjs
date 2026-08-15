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

const STORYBOOK_ORIGIN = 'https://design.agorapulse.com'
/** A URL or a local path. Override for CI and offline work. */
const STORYBOOK_INDEX = process.env.DS_STORYBOOK_INDEX ?? `${STORYBOOK_ORIGIN}/index.json`

/**
 * Components whose story is published under a different title than the specs claim.
 *
 * The specs only emit a `Storybook:` line when their generator matched a story, and
 * it matches by name — so a component the design system renamed on one side and not
 * the other silently loses its documentation link. Every title here is checked
 * against the live index below, so this map cannot rot in silence either.
 */
const STORYBOOK_ALIASES = {
  Popmenu: 'Display/PopMenu',
  'Snackbars Thread': 'Feedback/Snackbar',
  Paginator: 'Navigation/Pagination',
  'Media Display Overlay': 'Display/MediaOverlay',
  Datepicker: 'Utils/Datepicker',
  Labels: 'Display/Label',
}

/**
 * Components the Storybook documents but `design-specs/` does not. They are real,
 * living and quizzable — the specs generator simply never covered them.
 *
 * Only the seven that also carry a design-guidelines file are listed: a component
 * with a story but no written guidance has nothing to write a question about.
 * `CSS UI/*` is deliberately excluded — those are the same components again in CSS
 * form, and adding them would create duplicate names that poison distractor
 * suggestion.
 */
const STORY_ONLY_COMPONENTS = [
  { name: 'Link', category: 'actions', storybookTitle: 'Actions/Link' },
  { name: 'Input', category: 'forms', storybookTitle: 'Forms/Input' },
  { name: 'Textarea', category: 'forms', storybookTitle: 'Forms/Textarea' },
  { name: 'Table', category: 'display', storybookTitle: 'Display/Table' },
  { name: 'Ellipsis', category: 'display', storybookTitle: 'Display/Ellipsis' },
  { name: 'Menu', category: 'display', storybookTitle: 'Display/Menu' },
  { name: 'Loader', category: 'feedback', storybookTitle: 'Feedback/Loader' },
]

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

/**
 * The CSS-UI example each spec ships, turned into a render template.
 *
 * The example is a demo, not a usable snippet: it chains every modifier at once
 * (`ap-badge blue orange`, which is not a real combination) and writes the icon as
 * a literal `ap-icon-…`. What survives is the element structure and the base
 * classes, which is exactly what a template needs — the modifiers become the thing
 * the author picks per option.
 *
 * Extracting beats hand-writing 34 templates: they cannot drift from the design
 * system, and a component that gains an element gains it here too.
 */
function cssUiTemplateFrom(source, modifiers) {
  const block = source.match(
    /\*\*CSS-UI \(framework-agnostic classes\)\*\*\s*\n+```html\n([\s\S]*?)\n```/,
  )?.[1]
  if (!block) return null

  const demoModifiers = new Set(modifiers)
  let markup = block
    // The ellipsis is a placeholder for "any icon", not a class. Dropping the icon
    // keeps the template renderable; an author who wants one picks it explicitly.
    .replace(/\s*<i class="ap-icon-…"><\/i>\n?/g, '')
    // `Label` is where the author's text goes.
    .replace(/(^|>)(\s*)Label(\s*)(<|$)/g, '$1$2{{label}}$3$4')

  // Strip the demo modifiers from every class attribute, keeping the base classes.
  markup = markup.replace(/class="([^"]+)"/g, (whole, classes) => {
    const kept = classes.split(/\s+/).filter((name) => !demoModifiers.has(name))
    return `class="${kept.join(' ')}{{modifiers}}"`
  })

  return markup.trim()
}

function parseComponent(path) {
  const source = readFileSync(path, 'utf8')

  const name = source.match(/^# (.+)$/m)?.[1]?.trim()
  if (!name) fail(`no H1 title in ${path}`)

  const category = metaField(source, 'Category')
  if (!category) fail(`no Category in ${path}`)

  // "Display/Badge — https://design.agorapulse.com". Only the title is worth keeping:
  // the URL is the same bare root for every component, which is exactly why every
  // documentation link used to land on the homepage. The real link is resolved from
  // the live story index further down.
  const [storyTitle] = (metaField(source, 'Storybook') ?? '').split('—').map((s) => s?.trim())

  const anatomy = section(source, 'Anatomy')
  const cssClasses = [
    ...(anatomy.match(/^- CSS-UI classes: (.+)$/m)?.[1] ?? '').matchAll(/`([^`]+)`/g),
  ].map((m) => m[1])

  const modifiers = modifiersFrom(section(source, 'States'))

  return {
    name,
    slug: path.split('/').pop().replace(/\.md$/, ''),
    category,
    source: 'specs',
    selectors: backtickedTags(metaField(source, 'Selectors')),
    cssClasses,
    modifiers,
    /** Markup for a live render, or null when the component has no CSS-UI layer. */
    cssUiTemplate: cssUiTemplateFrom(source, modifiers),
    specPath: relative(SPECS_DIR, path),
    // Resolved into the `storybook` object once the live index is in hand.
    storybookTitle: storyTitle ?? null,
    intents: [],
    confusableWith: [],
  }
}

/**
 * The live Storybook's own story index, which is the only authority on what is
 * actually published and under which id. Runs in Node, so the CDN's browser CORS
 * policy does not apply.
 */
async function readStorybookIndex() {
  let raw
  try {
    if (/^https?:/.test(STORYBOOK_INDEX)) {
      const response = await fetch(STORYBOOK_INDEX)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      raw = await response.text()
    } else {
      raw = readFileSync(STORYBOOK_INDEX, 'utf8')
    }
  } catch (error) {
    fail(
      `cannot read the Storybook index at ${STORYBOOK_INDEX} (${error.message}).\n` +
        `Set DS_STORYBOOK_INDEX to a URL or a saved copy. Failing rather than nulling\n` +
        `every documentation link because the network blipped.`,
    )
  }

  const { entries } = JSON.parse(raw)
  // One `docs` entry per title, which is what makes the resolution unambiguous.
  return new Map(
    Object.values(entries)
      .filter((entry) => entry.type === 'docs')
      .map((entry) => [entry.title, entry.id]),
  )
}

function storybookFor(title, docsByTitle) {
  if (!title) return null
  const docsId = docsByTitle.get(title)
  if (!docsId) return null
  return { title, docsId, url: `${STORYBOOK_ORIGIN}/?path=/docs/${docsId}` }
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

// --- resolve the documentation links against the live Storybook ---------------

const docsByTitle = await readStorybookIndex()

for (const [name, title] of Object.entries(STORYBOOK_ALIASES)) {
  if (!byName.has(name)) {
    fail(`STORYBOOK_ALIASES names "${name}", which is not in the design specs.`)
  }
  if (!docsByTitle.has(title)) {
    fail(
      `STORYBOOK_ALIASES maps "${name}" to "${title}", which the Storybook no longer\n` +
        `publishes. Check the current title and update the map in scripts/ds-catalog.mjs.`,
    )
  }
  byName.get(name).storybookTitle = title
}

for (const spec of STORY_ONLY_COMPONENTS) {
  if (byName.has(spec.name)) {
    fail(`STORY_ONLY_COMPONENTS lists "${spec.name}", which the specs already cover.`)
  }
  if (!docsByTitle.has(spec.storybookTitle)) {
    fail(`STORY_ONLY_COMPONENTS maps "${spec.name}" to a title the Storybook no longer has.`)
  }
  const component = {
    ...spec,
    slug: spec.name.toLowerCase().replace(/\s+/g, '-'),
    source: 'storybook',
    selectors: [],
    cssClasses: [],
    modifiers: [],
    cssUiTemplate: null,
    specPath: null,
    intents: [],
    confusableWith: [],
  }
  components.push(component)
  byName.set(component.name, component)
}

// `storybook: null` is itself the "not in the living Storybook" flag — no separate
// boolean to keep in step with it.
for (const component of components) {
  component.storybook = storybookFor(component.storybookTitle, docsByTitle)
  if (component.storybook && component.source === 'specs') component.source = 'both'
  delete component.storybookTitle
}

components.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))

// A checksum instead of a timestamp: re-running the script on an unchanged design
// system produces a byte-identical file, so git only shows a diff when the DS moved.
// The story ids are folded in, so a Storybook rename shows up as a diff too.
const checksum = createHash('sha256')
  .update(specFiles.map((f) => readFileSync(f, 'utf8')).join('\0'))
  .update(
    [...docsByTitle.entries()]
      .sort()
      .map(([title, id]) => `${title}=${id}`)
      .join('\0'),
  )
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
const storyless = components.filter((c) => !c.storybook)

console.log(
  `ds:catalog — ${components.length} components (${perCategory})\n` +
    `             ${components.length - storyless.length} have a Storybook story, ` +
    `${components.filter((c) => c.source === 'storybook').length} come from it alone\n` +
    `             ${intents.size} components carry intents, checksum ${checksum}\n` +
    `             written to ${relative(process.cwd(), OUT_FILE)}`,
)

if (storyless.length > 0) {
  // Kept in the catalog on purpose: existing questions name several of them, and
  // dropping them would make those questions unvalidatable. Flagged so the admin can
  // warn when one is picked.
  console.log(
    `\n             no Storybook story (${storyless.length}), questions naming these get a warning:\n` +
      storyless.map((c) => `               ${c.name}`).join('\n'),
  )
}
