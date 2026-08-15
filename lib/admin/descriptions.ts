import 'server-only'

import file from '@/content/component-descriptions.json'

/**
 * Candidate prompts for `name-from-description`, extracted from the design
 * guidelines with every component name redacted.
 *
 * `server-only` because a table of component name to description is an answer key
 * for that mode: even after editing, much of the text survives verbatim, so
 * shipping this into a player's bundle would hand over the whole round.
 *
 * Regenerate with `npm run ds:descriptions`.
 */

export type DescriptionStatus = 'ready' | 'thin' | 'empty'

export type DescriptionCandidate = {
  /** Which guideline section it came from. */
  tier: string
  suggestedDifficulty: 'easy' | 'medium' | 'hard'
  status: DescriptionStatus
  /** How many sentences the redaction had to throw away. */
  droppedUnits: number
  text: string
}

const BY_COMPONENT = new Map(
  (file.descriptions as { component: string; candidates: DescriptionCandidate[] }[]).map((entry) => [
    entry.component,
    entry.candidates,
  ]),
)

export const DESCRIPTIONS_CHECKSUM: string = file.checksum

/**
 * Usable candidates for a component, best first.
 *
 * `empty` ones never surface — the redaction ate every sentence, which happens when
 * a component's guidance is written entirely in terms of its siblings. `thin` ones
 * do, flagged, because a 30-character description like "Turn a setting on or off"
 * does not identify a single component and the author needs to see that.
 */
export function describeComponent(component: string): DescriptionCandidate[] {
  return (BY_COMPONENT.get(component) ?? [])
    .filter((candidate) => candidate.status !== 'empty')
    .sort((a, b) => (a.status === 'ready' ? 0 : 1) - (b.status === 'ready' ? 0 : 1))
}

export function componentsWithDescriptions(): string[] {
  return [...BY_COMPONENT.keys()].sort()
}
