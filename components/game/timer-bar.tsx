'use client'

import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { copy } from '@/lib/copy'

/**
 * The countdown.
 *
 * Only ever a display: the server measures the real elapsed time from its own
 * `served_at` stamp, so slowing this down in the console buys nothing.
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
  const percent = Math.max(0, Math.min(100, (remainingMs / (timerSeconds * 1000)) * 100))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground" aria-live="off">
          {frozen && seconds === 0 ? copy.game.timeUp : copy.game.timeLeft(seconds)}
        </span>
        {seconds <= 5 && !frozen ? (
          <Badge variant="destructive">{copy.game.timeLeft(seconds)}</Badge>
        ) : null}
      </div>
      <Progress value={percent} aria-label={copy.game.timeLeft(seconds)} />
    </div>
  )
}
