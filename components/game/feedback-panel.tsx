'use client'

import { BookOpenIcon, CheckCircle2Icon, ClockIcon, XCircleIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { copy } from '@/lib/copy'
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
      <Alert variant={result.correct ? 'default' : 'destructive'}>
        {result.timedOut ? (
          <ClockIcon />
        ) : result.correct ? (
          <CheckCircle2Icon />
        ) : (
          <XCircleIcon />
        )}
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{result.explanation}</AlertDescription>
      </Alert>

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
