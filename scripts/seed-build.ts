/**
 * Turns the seed data into validated questions and placeholder screenshots.
 *
 * Shared by `seed.ts`, which writes to Supabase, and `verify-migrations.ts`,
 * which replays the exact same payloads against an in-memory Postgres. That is
 * what catches a mismatch between the camelCase the app speaks and the
 * snake_case `save_question_version` expects, before it reaches a real database.
 */
import { createHash } from 'node:crypto'

import { docUrlFor, getComponent } from '@/lib/catalog'
import { questionSchema, type Question } from '@/lib/schema/question'
import { SEED_QUESTIONS, type SeedQuestion } from './seed-data'

export type Shot = { key: string; description: string }

export type BuiltQuestion = {
  seed: SeedQuestion
  question: Question
  shots: Shot[]
}

/** A v5-shaped uuid derived from the slug, so re-seeding updates in place. */
export function questionId(slug: string): string {
  const buffer = Buffer.from(
    createHash('sha1').update(`ds-quiz:question:${slug}`).digest().subarray(0, 16),
  )
  buffer[6] = (buffer[6] & 0x0f) | 0x50
  buffer[8] = (buffer[8] & 0x3f) | 0x80
  const hex = buffer.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Opaque, unguessable, and carrying no hint of what it depicts. */
export function imageKey(slug: string, optionId: string): string {
  return `${createHash('sha256')
    .update(`ds-quiz:shot:${slug}:${optionId}`)
    .digest('hex')
    .slice(0, 8)}.svg`
}

// ---------------------------------------------------------------------------

const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] as string,
  )

function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 9)
}

/**
 * The placeholder carries a description of what should eventually be captured.
 * Two identical grey rectangles would say nothing about whether a side-by-side
 * comparison lays out correctly, which is half the point of a playable seed. The
 * banner is loud so none of these is ever mistaken for a real screenshot.
 */
export function placeholderSvg(key: string, description: string): string {
  const body = wrap(description, 46)
    .map(
      (line, index) =>
        `    <text x="40" y="${150 + index * 26}" class="body">${escapeXml(line)}</text>`,
    )
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" role="img" aria-label="${escapeXml(description)}">
  <style>
    .bg { fill: #f4f4f5 }
    .frame { fill: none; stroke: #d4d4d8; stroke-width: 2; stroke-dasharray: 8 6 }
    .tag { fill: #71717a; font: 600 13px ui-monospace, monospace; letter-spacing: .12em }
    .body { fill: #27272a; font: 15px ui-monospace, monospace }
    .key { fill: #a1a1aa; font: 12px ui-monospace, monospace }
  </style>
  <rect width="640" height="400" class="bg"/>
  <rect x="12" y="12" width="616" height="376" rx="10" class="frame"/>
  <text x="40" y="72" class="tag">PLACEHOLDER — REPLACE WITH A REAL CAPTURE</text>
${body}
  <text x="40" y="360" class="key">${escapeXml(key)}</text>
</svg>
`
}

// ---------------------------------------------------------------------------

function build(seed: SeedQuestion): BuiltQuestion {
  const shots: Shot[] = []

  let mainImageKey: string | null = null
  if (seed.shot) {
    mainImageKey = imageKey(seed.slug, 'main')
    shots.push({ key: mainImageKey, description: seed.shot })
  }

  const options = seed.options.map((option) => {
    if (option.component) return { id: option.id, component: option.component }
    const key = imageKey(seed.slug, option.id)
    shots.push({ key, description: option.shot as string })
    return { id: option.id, imageKey: key, ...(option.label ? { label: option.label } : {}) }
  })

  const parsed = questionSchema.safeParse({
    id: questionId(seed.slug),
    version: 1,
    status: 'published',
    mode: seed.mode,
    difficulty: seed.difficulty,
    component: seed.component,
    prompt: seed.prompt,
    explanation: seed.explanation,
    // Derived rather than hardcoded: every seed used to point at the Storybook
    // homepage, so "Read the component docs" never took anyone anywhere useful.
    // Null when the component has no story — no link beats a wrong one.
    docUrl: seed.docUrl ?? docUrlFor(seed.component),
    timerSeconds: null,
    imageKey: mainImageKey,
    options,
    correctOptionId: seed.correctOptionId,
  })

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`${seed.slug} is not a valid question:\n${detail}`)
  }

  return { seed, question: parsed.data, shots }
}

export function buildSeedQuestions(): BuiltQuestion[] {
  const slugs = new Set<string>()
  for (const seed of SEED_QUESTIONS) {
    if (slugs.has(seed.slug)) {
      throw new Error(`Duplicate slug "${seed.slug}" — ids are derived from it, so it must be unique.`)
    }
    slugs.add(seed.slug)
  }

  const built = SEED_QUESTIONS.map(build)

  // The schema already refuses unknown components; this just says which one.
  for (const { seed } of built) {
    const names = [
      seed.component,
      ...seed.options.flatMap((option) => (option.component ? [option.component] : [])),
    ]
    for (const name of names) {
      if (!getComponent(name)) {
        throw new Error(`${seed.slug}: "${name}" is not in the design system catalog.`)
      }
    }
  }

  return built
}

/** The shape `save_question_version` expects — snake_case, unlike the app. */
export function rpcPayload(question: Question) {
  return {
    id: question.id,
    mode: question.mode,
    difficulty: question.difficulty,
    status: 'published',
    component: question.component,
    prompt: question.prompt,
    options: question.options,
    correct_option_id: question.correctOptionId,
    explanation: question.explanation,
    doc_url: question.docUrl,
    image_key: question.imageKey,
    timer_seconds: question.timerSeconds,
  }
}
