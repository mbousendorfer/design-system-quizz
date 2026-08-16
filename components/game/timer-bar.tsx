'use client'

import { copy } from '@/lib/copy'
import { cn } from '@/lib/utils'

/** Below this, the clock stops being information and starts being pressure. */
const URGENT_SECONDS = 5

/**
 * The countdown.
 *
 * Only ever a display: the server measures real elapsed time from its own
 * `served_at` stamp, so slowing this down in the console buys nothing.
 *
 * It was a shadcn `Progress` plus the text "25s left" — the same widget as a file
 * upload, and the reason the screen read as a form rather than a game. What
 * replaces it is a single hairline rule spanning the full width of the question,
 * with the seconds set in tabular figures beside it so the number does not jitter
 * as it counts down. Under five seconds the rule takes the destructive colour and
 * breathes; that is the whole animation budget, because a quiz that flashes at you
 * is harder to think in, not more exciting.
 *
 * `transform: scaleX` rather than `width`, so the countdown never triggers layout.
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
  const urgent = seconds <= URGENT_SECONDS && !frozen
  const expired = frozen && seconds === 0

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-px flex-1 overflow-hidden bg-border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={timerSeconds}
        aria-valuenow={seconds}
        aria-label={copy.game.timeLeft(seconds)}
      >
        <div
          className={cn(
            'absolute inset-0 origin-left transition-transform duration-1000 ease-linear',
            urgent ? 'bg-destructive' : 'bg-foreground/40',
            frozen && 'transition-none',
          )}
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>

      <span
        // Tabular figures: without them the whole row shifts left every time the
        // count drops from a wide digit to a narrow one.
        className={cn(
          'font-mono text-xs tabular-nums transition-colors',
          expired ? 'text-destructive' : urgent ? 'text-destructive' : 'text-text-tertiary',
          urgent && 'motion-safe:animate-pulse',
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
