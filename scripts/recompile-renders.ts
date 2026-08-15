/**
 * Rebuilds live renders that were compiled against an older stylesheet.
 *
 *   npm run ds:recompile -- --dry-run
 *   npm run ds:recompile
 *
 * Run this after `npm run ds:css`. That script salts every class name, so a fresh
 * run reassigns all six hundred of them and markup compiled against the previous
 * sheet renders as unstyled HTML — right structure, no design system, and no error
 * anywhere to say why. This is the reason a render stores its recipe alongside its
 * markup: the recipe is what makes the markup rebuildable.
 *
 * Editing in place rather than cutting a version is deliberate. The question is
 * unchanged — same component, same modifiers, same right answer — so past answers
 * still describe what they were asked. A new version here would throw away
 * statistics to record a stylesheet regeneration.
 */
import { createClient } from '@supabase/supabase-js'

import { DS_CSS_CHECKSUM } from '@/lib/render/classmap'
import { recompile } from '@/lib/render/compile'
import { renderSchema, type CssUiRender } from '@/lib/schema/render'
import { readSupabaseEnv } from '@/lib/supabase/env'

const DRY_RUN = process.argv.includes('--dry-run')

const { url, secretKey } = readSupabaseEnv()
const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data, error } = await supabase
  .from('questions')
  .select('id, component, stimulus, options, status')
  .eq('is_live', true)

if (error) {
  console.error(`\nCould not read the questions: ${error.message}\n`)
  process.exit(1)
}

/** Returns the rebuilt render, or null when it was already current. */
function refresh(value: unknown): CssUiRender | null {
  const parsed = renderSchema.safeParse(value)
  if (!parsed.success || parsed.data.kind !== 'css-ui') return null
  if (parsed.data.cssChecksum === DS_CSS_CHECKSUM) return null
  return recompile(parsed.data)
}

const stale: { id: string; component: string; status: string; places: string[] }[] = []

for (const question of data ?? []) {
  const places: string[] = []

  const stimulus = refresh(question.stimulus)
  if (stimulus) places.push('stimulus')

  const options = (question.options as { id: string; render?: unknown }[]) ?? []
  const rebuilt = options.map((option) => {
    const render = refresh(option.render)
    if (!render) return option
    places.push(`option ${option.id}`)
    return { ...option, render }
  })

  if (places.length === 0) continue
  stale.push({ id: question.id, component: question.component, status: question.status, places })

  if (DRY_RUN) continue

  const { error: writeError } = await supabase
    .from('questions')
    .update({
      ...(stimulus ? { stimulus } : {}),
      ...(places.some((place) => place.startsWith('option')) ? { options: rebuilt } : {}),
    })
    .eq('id', question.id)

  if (writeError) {
    console.error(`  failed on ${question.id}: ${writeError.message}`)
    process.exit(1)
  }
}

console.log(`\nStylesheet ${DS_CSS_CHECKSUM}\n`)

if (stale.length === 0) {
  console.log('Every live render is already current.\n')
} else {
  for (const question of stale) {
    console.log(`  ${question.component.padEnd(22)} ${question.status.padEnd(10)} ${question.places.join(', ')}`)
  }
  console.log(
    DRY_RUN
      ? `\n${stale.length} questions would be rebuilt. Nothing was written.\n`
      : `\n${stale.length} questions rebuilt in place — no new versions, so the statistics are intact.\n`,
  )
}
