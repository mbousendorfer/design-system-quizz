'use client'

import { copy } from '@/lib/copy'
import { cn } from '@/lib/utils'

/** Fractions of the allowed time at which the clock changes what it is saying. */
const CAUTION_AT = 0.5
const URGENT_AT = 0.2

/**
 * The countdown.
 *
 * Only ever a display: the run is played in the browser, so the clock is the
 * player's own and a debugger pauses it. It is a rule of the game rather than
 * something enforced — see `lib/game/local-run.ts`.
 *
 * It went through two wrong versions before this one. First a shadcn `Progress`
 * plus the text "25s left", which is the same widget as a file upload and made
 * the screen read as a form. Then a one-pixel hairline, which was quiet enough
 * to be honest about how little the timer now enforces — and far too quiet for
 * the thing a player is actually racing.
 *
 * So: a real bar, and colour that carries meaning rather than decoration. Green
 * while there is time, the design system's warning yellow past halfway, its
 * error red in the last fifth. Those are the same three semantic families the
 * rest of the app uses for the same three ideas, so nobody has to learn a second
 * vocabulary for the clock.
 *
 * `transform: scaleX` rather than `width`, so a countdown ticking every second
 * never triggers layout.
 */
export function TimerBar({
  remainingMs,
  timerSeconds,
  frozen,
}: {
  remainingMs: number
  timerSeconds: number
  frozen: boolean
}) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const fraction = Math.max(0, Math.min(1, remainingMs / (timerSeconds * 1000)))
  const expired = frozen && seconds === 0

  const level = expired || fraction <= URGENT_AT ? 'urgent' : fraction <= CAUTION_AT ? 'caution' : 'calm'

  return (
    <div className="flex items-center gap-3">
      <div
        className="bg-muted relative h-2 flex-1 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={timerSeconds}
        aria-valuenow={seconds}
        aria-label={copy.game.timeLeft(seconds)}
      >
        <div
          className={cn(
            'absolute inset-0 origin-left rounded-full transition-transform duration-1000 ease-linear',
            level === 'calm' && 'bg-success',
            level === 'caution' && 'bg-warning',
            level === 'urgent' && 'bg-destructive',
            // Freezing mid-answer must not animate the bar to its final width;
            // the position it stopped at is the information.
            frozen && 'transition-none',
          )}
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>

      <span
        // Tabular figures and a fixed minimum width: without them the whole row
        // shifts every time the count drops from a two-digit number to one.
        className={cn(
          'min-w-14 text-right font-mono text-sm font-semibold tabular-nums transition-colors',
          level === 'calm' && 'text-text-secondary',
          level === 'caution' && 'text-warning',
          level === 'urgent' && 'text-destructive',
        )}
        // The engine owns the one live region on this screen; a clock that
        // announced itself every second would bury the explanation under it.
        aria-hidden
      >
        {expired ? copy.game.timeUp : copy.game.timeLeft(seconds)}
      </span>
    </div>
  )
}
