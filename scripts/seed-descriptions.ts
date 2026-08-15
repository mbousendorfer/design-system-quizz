/**
 * Generates a draft `name-from-description` question for every component the design
 * guidelines describe usably.
 *
 *   npm run db:drafts -- --dry-run   report what it would write
 *   npm run db:drafts                write the drafts
 *
 * Drafts, never published. The redaction leaves rough edges — "keep to ≤6 this
 * component" is typical — so every one of these needs a read before it goes live.
 * The point is to replace a blank page with something to correct.
 *
 * Idempotent: ids derive from the component name, so re-running updates in place.
 */
import { createHash } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'

import { describeComponent } from '@/lib/admin/descriptions'
import { suggestDistractors } from '@/lib/catalog'
import { DIFFICULTY_RULES } from '@/lib/difficulty'
import { readSupabaseEnv } from '@/lib/supabase/env'

const DRY_RUN = process.argv.includes('--dry-run')
const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

/** Same v5-shaped derivation the seed uses, so re-running updates rather than duplicates. */
function draftId(component: string, tier: string): string {
  const buffer = Buffer.from(
    createHash('sha1').update(`ds-quiz:description:${component}:${tier}`).digest().subarray(0, 16),
  )
  buffer[6] = (buffer[6] & 0x0f) | 0x50
  buffer[8] = (buffer[8] & 0x3f) | 0x80
  const hex = buffer.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const drafts: {
  id: string
  component: string
  tier: string
  difficulty: 'easy' | 'medium' | 'hard'
  prompt: string
  options: { id: string; component: string }[]
  correctOptionId: string
}[] = []

const { componentsWithDescriptions } = await import('@/lib/admin/descriptions')

for (const component of componentsWithDescriptions()) {
  for (const candidate of describeComponent(component)) {
    // `thin` candidates do not identify one component, so they would be broken
    // questions rather than rough ones.
    if (candidate.status !== 'ready') continue

    const wanted = DIFFICULTY_RULES[candidate.suggestedDifficulty].optionCount
    const distractors = suggestDistractors(component, wanted - 1)
    if (distractors.length < 3) continue

    const names = [component, ...distractors]
    const options = names.map((name, index) => ({ id: OPTION_IDS[index], component: name }))

    drafts.push({
      id: draftId(component, candidate.tier),
      component,
      tier: candidate.tier,
      difficulty: candidate.suggestedDifficulty,
      prompt: candidate.text,
      options,
      correctOptionId: 'a',
    })
  }
}

console.log(`\n${drafts.length} drafts from ${componentsWithDescriptions().length} components\n`)

const perTier = new Map<string, number>()
for (const draft of drafts) perTier.set(draft.tier, (perTier.get(draft.tier) ?? 0) + 1)
for (const [tier, count] of [...perTier].sort()) console.log(`  ${tier.padEnd(12)} ${count}`)

if (DRY_RUN) {
  console.log('\nExamples:\n')
  for (const draft of drafts.slice(0, 3)) {
    console.log(`  ${draft.component} (${draft.tier}, ${draft.difficulty})`)
    console.log(`    ${draft.prompt.slice(0, 150)}…`)
    console.log(`    options: ${draft.options.map((o) => o.component).join(', ')}\n`)
  }
  console.log('Dry run: nothing was written.\n')
  process.exit(0)
}

const { url, secretKey } = readSupabaseEnv()
const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

for (const draft of drafts) {
  const { error } = await supabase.rpc('save_question_version', {
    payload: {
      id: draft.id,
      mode: 'name-from-description',
      difficulty: draft.difficulty,
      // Draft, deliberately: these need reading before anyone is scored on them.
      status: 'draft',
      component: draft.component,
      prompt: draft.prompt,
      options: draft.options,
      correct_option_id: draft.correctOptionId,
      explanation: '',
      doc_url: null,
      image_key: null,
      stimulus: null,
      timer_seconds: null,
    },
  })
  if (error) {
    console.error(`  failed on ${draft.component} (${draft.tier}): ${error.message}`)
    process.exit(1)
  }
}

console.log(
  `\nWrote ${drafts.length} drafts. Each needs an explanation and a read-back before\n` +
    `publishing — the redaction leaves rough edges the author has to smooth.\n`,
)
