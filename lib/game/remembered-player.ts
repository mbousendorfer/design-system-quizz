/**
 * What the browser remembers between runs: the player's name, team, and last
 * chosen mode and level.
 *
 * Exposed as an external store rather than read in an effect. Reading
 * localStorage during render would not survive server rendering, and reading it
 * in an effect means a setState on mount and a cascading render. `useSyncExternalStore`
 * is the shape React provides for exactly this: the server renders the defaults,
 * the client swaps in the stored values on hydration.
 */
import type { RunDifficulty, RunMode } from '@/lib/difficulty'
import type { Team } from '@/lib/schema/question'

const STORAGE_KEY = 'ds-quiz.player'

export type RememberedPlayer = {
  pseudo: string
  team: Team
  mode: RunMode
  difficulty: RunDifficulty
}

export const REMEMBERED_DEFAULTS: RememberedPlayer = {
  pseudo: '',
  team: 'other',
  mode: 'mixed',
  // Progressive by default: it walks all three levels without asking anyone to
  // rate themselves before they have played once.
  difficulty: 'progressive',
}

const listeners = new Set<() => void>()

// getSnapshot has to return a stable reference or React re-renders forever, so
// the parsed value is cached against the raw string it came from.
let cachedRaw: string | null = null
let cachedValue: RememberedPlayer = REMEMBERED_DEFAULTS

function notify() {
  for (const listener of listeners) listener()
}

export function subscribeToRememberedPlayer(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', notify)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', notify)
  }
}

export function getRememberedPlayer(): RememberedPlayer {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cachedValue

  cachedRaw = raw
  cachedValue = REMEMBERED_DEFAULTS

  if (raw) {
    try {
      cachedValue = { ...REMEMBERED_DEFAULTS, ...(JSON.parse(raw) as Partial<RememberedPlayer>) }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
      cachedRaw = null
    }
  }

  return cachedValue
}

export function getRememberedPlayerOnServer(): RememberedPlayer {
  return REMEMBERED_DEFAULTS
}

export function rememberPlayer(value: RememberedPlayer): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  notify()
}
