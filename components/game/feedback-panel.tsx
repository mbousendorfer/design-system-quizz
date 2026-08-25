'use client'

import { BookOpenIcon, CheckCircle2Icon, ClockIcon, XCircleIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { copy } from '@/lib/copy'
import { cn } from '@/lib/utils'
import type { SubmitAnswerResponse } from '@/lib/game/contracts'

/** The verdict, spoken by the live region the engine keeps mounted for it. */
export function verdictAnnouncement(result: SubmitAnswerResponse): string {
  const verdict = result.timedOut
    ? copy.game.timeUp
    : result.correct
      ? copy.game.correct
      : copy.game.incorrect
  return `${verdict}. ${result.explanation}`
}

/**
 * The verdict and, more importantly, the explanation.
 *
 * No `aria-live` here on purpose. This panel does not exist until there is a
 * result, and a live region that appears with its content already inside it is
 * not reliably announced. The engine keeps an empty one mounted instead, and
 * fills it when the answer lands.
 */
export function FeedbackPanel({ result }: { result: SubmitAnswerResponse }) {
  const title = result.timedOut
    ? copy.game.timeUp
    : result.correct
      ? copy.game.correct
      : copy.game.incorrect

  return (
    <div className="flex flex-col gap-3">
      {/* The verdict carries the colour; the explanation does not.
          It used to be an Alert that tinted its whole body, so the paragraph
          people come back for — the only part that teaches anything — was set in
          red on a dark ground and was the hardest thing on the page to read. */}
      <div
        className={cn(
          'flex flex-col gap-2 rounded-lg border p-4',
          result.correct ? 'border-success/35 bg-success/8' : 'border-destructive/35 bg-destructive/8',
        )}
      >
        {/* Written out rather than composed: Tailwind scans source text, so a
            class built from a variable is never generated and the colour
            silently does not exist. */}
        <p
          className={cn(
            'flex items-center gap-2 font-semibold',
            result.correct ? 'text-success' : 'text-destructive',
          )}
        >
          {result.timedOut ? (
            <ClockIcon className="size-4 shrink-0" aria-hidden />
          ) : result.correct ? (
            <CheckCircle2Icon className="size-4 shrink-0" aria-hidden />
          ) : (
            <XCircleIcon className="size-4 shrink-0" aria-hidden />
          )}
          {title}
        </p>

        <p className="text-foreground/90 text-sm leading-relaxed">{result.explanation}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {result.score.total > 0 ? (
          <Badge variant="default">{copy.game.pointsEarned(result.score.total)}</Badge>
        ) : null}
        {result.score.speed > 0 ? (
          <Badge variant="secondary">
            {copy.game.speedBonus} {copy.game.pointsEarned(result.score.speed)}
          </Badge>
        ) : null}
        {result.score.streak > 0 ? (
          <Badge variant="secondary">
            {copy.game.streakBonus} {copy.game.pointsEarned(result.score.streak)}
          </Badge>
        ) : null}
        {result.streak >= 2 ? <Badge variant="outline">{copy.game.streak(result.streak)}</Badge> : null}

        {result.docUrl ? (
          <Button
            variant="link"
            size="sm"
            // Rendered as an anchor, so Base UI has to be told this is not a
            // native button — otherwise it warns and applies button semantics
            // on top of a link.
            nativeButton={false}
            render={<a href={result.docUrl} target="_blank" rel="noreferrer" />}
          >
            <BookOpenIcon data-icon="inline-start" />
            {copy.game.readTheDocs}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
