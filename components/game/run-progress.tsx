'use client'

import { copy } from '@/lib/copy'
import { cn } from '@/lib/utils'

/** What we know about a question that has already been answered. */
export type Step = 'correct' | 'wrong' | 'answered' | 'current' | 'upcoming'

/**
 * Where you are in the run, and what it has cost you so far.
 *
 * A run is five questions and the screen used to say so only in words — "Question
 * 3 of 5" as a card title. Words are a poor way to carry position: you have to
 * read them, and you have to remember the previous ones to know how you are
 * doing. Five marks carry both at a glance.
 *
 * `answered` exists because a resumed run is real: the server hands back a
 * position without the outcomes that led to it, and inventing ticks for those
 * would be a lie. They show as answered, without a verdict.
 *
 * The score comes from the server with every answer (`runScore`), so it is right
 * even on a resumed run — it is simply unknown until the first answer of this
 * sitting, and shows nothing rather than a zero that would read as "you have
 * scored nothing".
 */
export function RunProgress({
  position,
  total,
  steps,
  score,
}: {
  position: number
  total: number
  steps: Step[]
  score: number | null
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-text-tertiary text-xs font-medium">
          {copy.game.questionOf(position, total)}
        </span>

        <ol className="flex items-center gap-1.5" aria-hidden>
          {steps.map((step, index) => (
            <li
              key={index}
              className={cn(
                'size-1.5 rounded-full transition-all duration-300',
                step === 'correct' && 'bg-foreground',
                step === 'wrong' && 'bg-destructive',
                step === 'answered' && 'bg-foreground/35',
                // The one you are on is the only mark with a ring, so it reads as
                // a position rather than as another result.
                step === 'current' && 'bg-foreground ring-foreground/25 ring-2 ring-offset-0',
                step === 'upcoming' && 'bg-foreground/15',
              )}
            />
          ))}
        </ol>
      </div>

      {score === null ? null : (
        <span className="font-mono text-xs tabular-nums" aria-live="off">
          {copy.game.pointsEarned(score)}
        </span>
      )}
    </div>
  )
}

/** The marks for a run: what is known, where you are, what is left. */
export function stepsFor({
  total,
  position,
  outcomes,
}: {
  total: number
  position: number
  /** Keyed by 1-based position; missing means answered before this sitting. */
  outcomes: Map<number, boolean>
}): Step[] {
  return Array.from({ length: total }, (_, index) => {
    const at = index + 1
    if (at < position) {
      const outcome = outcomes.get(at)
      return outcome === undefined ? 'answered' : outcome ? 'correct' : 'wrong'
    }
    if (at > position) return 'upcoming'
    // The current question keeps its verdict once it has one, so the mark lands
    // at the same moment the explanation does.
    const outcome = outcomes.get(at)
    return outcome === undefined ? 'current' : outcome ? 'correct' : 'wrong'
  })
}
