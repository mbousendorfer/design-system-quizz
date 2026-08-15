#!/usr/bin/env node
/**
 * Extracts quiz prompts from the design-guidelines component files.
 *
 * Usage: npm run ds:descriptions
 * Override the source with DS_GUIDELINES_DIR=/path/to/references/components
 *
 * ## What this is
 *
 * A drafting aid, not a generator. It produces candidate prompts for the
 * `name-from-description` mode, each with a `status` saying how usable it is, and
 * the admin form offers them for editing. Roughly sixty of the hundred-odd
 * candidates are worth publishing as-is; the rest are too short, or were gutted by
 * the redaction below. Trust the status, not the count.
 *
 * ## Why the redaction filters whole sentences instead of masking words
 *
 * Masking every catalog term turns the radio guideline into fourteen holes: Button,
 * Card, Input, Link, Label, Menu, Table, Status, Radio, Select, Toggle and Tag are
 * also ordinary English words. So a unit — a bullet, or a sentence — is either kept
 * whole or thrown away.
 *
 * The single biggest giveaway is a code span: `ap-tag`, `apEllipsis`, `<mat-menu>`
 * all spell the answer outright, so any unit containing one goes.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const GUIDELINES_DIR =
  process.env.DS_GUIDELINES_DIR ??
  join(
    homedir(),
    'sources',
    'claude-marketplace',
    'plugins',
    'design',
    'design-guidelines',
    'references',
    'components',
  )

const CATALOG = resolve(import.meta.dirname, '..', 'content', 'ds-catalog.json')
const OUT_FILE = resolve(import.meta.dirname, '..', 'content', 'component-descriptions.json')

/** Guideline filenames whose H1 does not match the catalog name. */
const ALIASES = {
  'action-dropdown': 'Action Dropdown',
  'avatar-group': 'Avatar Group',
  'close-button': 'Close Button',
  'dot-stepper': 'Dot Stepper',
  'filter-chips-list': 'Filter Chips List',
  'filter-dropdown': 'Filter Dropdown',
  'icon-button': 'Icon Button',
  label: 'Labels',
  'media-display-overlay': 'Media Display Overlay',
  modal: 'Modal',
  'nav-selector': 'Nav Selector',
  pagination: 'Paginator',
  'phone-number-input': 'Phone Number Input',
  'radio-button-card': 'Radio Button Card',
  'segmented-control': 'Segmented Control',
  select: 'Select',
  'snackbars-thread': 'Snackbars Thread',
  'social-button': 'Social Button',
  'split-button': 'Split Button',
  'status-card': 'Status Card',
}

/** Guideline files with no catalog entry — documented, but not in the design system. */
const NOT_IN_CATALOG = new Set(['accordion', 'card', 'list-panel'])

/** Sections worth turning into a prompt, easiest first. */
const TIERS = [
  { section: 'Overview', difficulty: 'easy' },
  { section: 'Usage', difficulty: 'medium' },
  { section: 'Anatomy', difficulty: 'medium' },
  { section: "Do / Don't", difficulty: 'hard' },
]

/** Phrases that mark guidance the skill itself flags as not authoritative. */
const NON_AUTHORITATIVE = ['[design-intent]', 'team-defined', 'undefined in guidelines']

const MAX_PROMPT = 400

function fail(message) {
  console.error(`ds:descriptions — ${message}`)
  process.exit(1)
}

/** Same section slicer as ds:catalog. The heading contains a `/`, so it is escaped. */
function section(source, heading) {
  const escaped = heading.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')
  const match = source.match(new RegExp(`^## ${escaped}\\n([\\s\\S]*?)(?=\\n## |(?![\\s\\S]))`, 'm'))
  return match?.[1] ?? ''
}

/** Bullets stay whole; prose splits on sentence boundaries. */
function toUnits(text) {
  const units = []
  for (const block of text.split('\n')) {
    const line = block.trim()
    if (!line || line.startsWith('#') || line.startsWith('>')) continue
    if (line.startsWith('- ') || line.startsWith('* ')) {
      units.push(line.slice(2).trim())
    } else {
      for (const sentence of line.split(/(?<=[.!?])\s+(?=[A-Z“"])/)) {
        if (sentence.trim()) units.push(sentence.trim())
      }
    }
  }
  return units
}

function buildRedactor(componentNames) {
  const others = [...componentNames].sort((a, b) => b.length - a.length)

  return function redact(units, self, selfAliases) {
    const kept = []

    for (const unit of units) {
      // A code span is the loudest giveaway there is.
      if (/`[^`]+`/.test(unit)) continue
      if (/<[a-z]/i.test(unit)) continue
      if (/\[[^\]]+\]\([^)]+\)/.test(unit)) continue
      if (/ vs /i.test(unit)) continue
      if (NON_AUTHORITATIVE.some((marker) => unit.toLowerCase().includes(marker.toLowerCase()))) {
        continue
      }
      // Naming a sibling hands over the multiple-choice key.
      if (others.some((name) => name !== self && new RegExp(`\\b${name}\\b`).test(unit))) continue

      // Mask the component's own name, case-insensitively — the trap is the
      // lowercase self-reference: "keep at most six tabs".
      let masked = unit
      for (const alias of selfAliases) {
        masked = masked.replace(
          new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'gi'),
          'this component',
        )
      }

      // A mask landing against a hyphen or a word character produces gibberish
      // like "a confirm-this component". Unrecoverable, so drop the sentence.
      if (/[\w-]this component|this component[\w-]/.test(masked)) continue

      kept.push(masked.replace(/\*\*|__|\*/g, '').replace(/\s+/g, ' ').trim())
    }

    return kept
  }
}

/** Trim to the prompt column's limit, on a sentence boundary. */
function fit(text) {
  if (text.length <= MAX_PROMPT) return text
  const cut = text.slice(0, MAX_PROMPT)
  const boundary = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  return boundary > 80 ? cut.slice(0, boundary + 1) : ''
}

// ---------------------------------------------------------------------------

let files
try {
  files = readdirSync(GUIDELINES_DIR).filter((file) => file.endsWith('.md')).sort()
} catch (error) {
  fail(
    `cannot read ${GUIDELINES_DIR} — is the design-guidelines plugin checked out?\n` +
      `Set DS_GUIDELINES_DIR to point at its references/components. (${error.message})`,
  )
}

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8')).components
const catalogNames = new Set(catalog.map((component) => component.name))
const redact = buildRedactor(catalogNames)

const descriptions = []
const unmapped = []

for (const file of files) {
  const slug = file.replace(/\.md$/, '')
  if (NOT_IN_CATALOG.has(slug)) continue

  const source = readFileSync(join(GUIDELINES_DIR, file), 'utf8')
  const heading = source.match(/^# (.+)$/m)?.[1]?.trim() ?? slug

  const name = ALIASES[slug] ?? (catalogNames.has(heading) ? heading : null)
  if (!name) {
    unmapped.push(`${file} (H1 "${heading}")`)
    continue
  }
  if (!catalogNames.has(name)) {
    fail(`ALIASES maps ${file} to "${name}", which is not in the catalog.`)
  }

  // Every way this component refers to itself, so the mask catches all of them —
  // including the singular. "Tabs" masked only the plural, and left "an active tab
  // can be clicked" sitting in the prompt with the answer in it.
  const forms = new Set()
  for (const form of [name, heading, ...heading.split('/'), slug.replace(/-/g, ' ')]) {
    const trimmed = form.trim()
    if (!trimmed) continue
    forms.add(trimmed)
    if (trimmed.endsWith('s')) forms.add(trimmed.slice(0, -1))
  }
  const selfAliases = [...forms].sort((a, b) => b.length - a.length)

  const candidates = []
  for (const { section: sectionName, difficulty } of TIERS) {
    const units = redact(toUnits(section(source, sectionName)), name, selfAliases)
    const text = fit(units.join(' '))
    const status = !text ? 'empty' : text.length < 80 ? 'thin' : 'ready'
    candidates.push({
      tier: sectionName,
      suggestedDifficulty: difficulty,
      status,
      droppedUnits: toUnits(section(source, sectionName)).length - units.length,
      text,
    })
  }

  descriptions.push({ component: name, slug, candidates })
}

if (unmapped.length > 0) {
  fail(
    `these guideline files map to no catalog component:\n  ${unmapped.join('\n  ')}\n` +
      `Add them to ALIASES or NOT_IN_CATALOG in scripts/ds-descriptions.mjs.`,
  )
}

const checksum = createHash('sha256')
  .update(files.map((file) => readFileSync(join(GUIDELINES_DIR, file), 'utf8')).join('\0'))
  .digest('hex')
  .slice(0, 16)

descriptions.sort((a, b) => a.component.localeCompare(b.component))
writeFileSync(OUT_FILE, `${JSON.stringify({ checksum, descriptions }, null, 2)}\n`, 'utf8')

const all = descriptions.flatMap((entry) => entry.candidates)
const count = (status) => all.filter((candidate) => candidate.status === status).length
const withoutGuideline = catalog
  .filter((component) => !descriptions.some((entry) => entry.component === component.name))
  .map((component) => component.name)

console.log(
  `ds:descriptions — ${descriptions.length} components, ${all.length} candidates\n` +
    `                  ${count('ready')} ready, ${count('thin')} too short, ${count('empty')} gutted by redaction\n` +
    `                  checksum ${checksum}`,
)
console.log(
  `\n                  ${withoutGuideline.length} catalog components have no guideline file:\n` +
    `                  ${withoutGuideline.join(', ')}`,
)
