/**
 * Typed access to the generated design system catalog.
 *
 * Regenerate with `npm run ds:catalog` whenever the design system moves.
 * This module is safe to import from client components: it holds no answers,
 * only the list of components that exist.
 */
import catalog from '@/content/ds-catalog.json'

export type DsComponent = {
  name: string
  slug: string
  category: string
  selectors: string[]
  cssClasses: string[]
  modifiers: string[]
  specPath: string
  storybookTitle: string | null
  storybookUrl: string | null
  intents: string[]
  /** Components genuinely easy to mistake for this one — the best distractors. */
  confusableWith: string[]
}

export const DS_CHECKSUM: string = catalog.checksum
export const DS_CATEGORIES: readonly string[] = catalog.categories
export const DS_COMPONENTS: readonly DsComponent[] = catalog.components

const byName = new Map(DS_COMPONENTS.map((component) => [component.name, component]))

export function isKnownComponent(name: string): boolean {
  return byName.has(name)
}

export function getComponent(name: string): DsComponent | null {
  return byName.get(name) ?? null
}

export function componentsInCategory(category: string): DsComponent[] {
  return DS_COMPONENTS.filter((component) => component.category === category)
}

/**
 * Plausible wrong answers for a question whose answer is `answer`.
 *
 * Ranked by how convincing the mistake would be: components curated as genuinely
 * confusable come first, then the rest of the answer's own category, then anything
 * else. The last tier only ever gets used because some categories are too small to
 * fill a 6-option hard question on their own — `actions` holds 5 components total.
 *
 * Deterministic on purpose: pressing the button twice gives the same three
 * suggestions, which are the best three rather than a fresh sample.
 */
export function suggestDistractors(answer: string, count = 3, exclude: string[] = []): string[] {
  const target = getComponent(answer)
  if (!target) return []

  const skip = new Set([answer, ...exclude])
  const tierOf = (component: DsComponent): number => {
    const confusable = target.confusableWith.includes(component.name)
    const sameCategory = component.category === target.category
    if (confusable && sameCategory) return 0
    if (confusable) return 1
    if (sameCategory) return 2
    return 3
  }

  return DS_COMPONENTS.filter((component) => !skip.has(component.name))
    .map((component) => ({ component, tier: tierOf(component) }))
    .sort((a, b) => a.tier - b.tier || a.component.name.localeCompare(b.component.name))
    .slice(0, count)
    .map(({ component }) => component.name)
}

/**
 * How many distractors the answer's own category can supply. The admin form uses
 * this to say so up front rather than silently returning too few suggestions.
 */
export function distractorsAvailableInCategory(answer: string): number {
  const target = getComponent(answer)
  if (!target) return 0
  return componentsInCategory(target.category).length - 1
}
