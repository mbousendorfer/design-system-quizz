'use client'

import Link from 'next/link'
import { CheckCircle2Icon, RotateCcwIcon, SparklesIcon, TrophyIcon, XCircleIcon } from 'lucide-react'

import { optionLetter } from '@/components/game/question-view'
import { ScoreDisplay } from '@/components/game/score-display'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { copy } from '@/lib/copy'
import type { FinishRunResponse, RunReviewAnswer } from '@/lib/game/contracts'
import type { StoredOption } from '@/lib/schema/question'

export function Results({ summary }: { summary: FinishRunResponse }) {
  const delta = summary.averageScore === null ? null : summary.score - summary.averageScore

  const facts = [
    summary.bestStreak >= 2 ? copy.game.streak(summary.bestStreak) : null,
    delta === null ? null : copy.results.versusAverage(delta),
    summary.rank === null
      ? null
      : copy.results.rank(
          summary.rank,
          copy.difficulties[summary.difficulty as keyof typeof copy.difficulties].name,
        ),
  ].filter((fact): fact is string => fact !== null)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{copy.results.title}</CardTitle>
          <CardDescription>
            {copy.results.correctCount(summary.correctCount, summary.totalQuestions)}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <ScoreDisplay score={summary.score} label={copy.results.scoreLabel} />

            {/* A clean sweep is what makes people press replay, so it marks the
                score itself rather than arriving in an Alert above it — a box
                that said "perfect" and then repeated the number now standing
                three times its size beside it. */}
            {summary.perfect ? (
              <span className="text-text-secondary flex items-center gap-1.5 pb-1 text-sm font-medium">
                <SparklesIcon className="size-4" aria-hidden />
                {copy.results.perfect}
              </span>
            ) : null}
          </div>

          {/* Metadata reads as metadata: one quiet line under the figure, not
              four badges competing with it. */}
          {facts.length > 0 ? (
            <p className="text-text-tertiary flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {facts.map((fact, index) => (
                <span key={fact} className="flex items-center gap-3">
                  {index > 0 ? <span aria-hidden className="text-foreground/20">/</span> : null}
                  {fact}
                </span>
              ))}
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="gap-2">
          <Button nativeButton={false} render={<Link href="/" />}>
            <RotateCcwIcon data-icon="inline-start" />
            {copy.results.playAgain}
          </Button>
          {/* Straight to the board for the level just played, rather than a
              default one where this run does not appear. */}
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/leaderboard?difficulty=${summary.difficulty}`} />}
          >
            <TrophyIcon data-icon="inline-start" />
            {copy.home.seeLeaderboard}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.results.reviewTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {summary.answers.map((answer, index) => (
            <div key={answer.position} className="flex flex-col gap-3">
              {index > 0 ? <Separator /> : null}
              <ReviewRow answer={answer} total={summary.totalQuestions} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function labelFor(options: StoredOption[], optionId: string | null): string | null {
  if (!optionId) return null
  const index = options.findIndex((option) => option.id === optionId)
  if (index < 0) return null
  const option = options[index]
  return option.component ?? option.label ?? optionLetter(index)
}

function ReviewRow({ answer, total }: { answer: RunReviewAnswer; total: number }) {
  const correctLabel = labelFor(answer.options, answer.correctOptionId)
  const chosenLabel = labelFor(answer.options, answer.chosenOptionId)

  return (
    <div className="flex flex-col gap-2.5">
      {/* Metadata line. It used to hold five badges of equal weight, which made
          the mode name compete with the verdict — and pushed the explanation,
          the only part that teaches anything, to the bottom in the same size as
          everything else. */}
      <div className="text-text-tertiary flex flex-wrap items-center gap-2 text-xs">
        {answer.correct ? (
          <CheckCircle2Icon className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <XCircleIcon className="text-destructive size-3.5 shrink-0" aria-hidden />
        )}
        {/* The run length, not a hardcoded five: a mode with three published
            questions gives a three-question run. */}
        <span className="font-medium">{copy.game.questionOf(answer.position, total)}</span>
        <span aria-hidden className="text-foreground/20">/</span>
        <span>{copy.modes[answer.mode].name}</span>
        <span aria-hidden className="text-foreground/20">/</span>
        <span>{copy.difficulties[answer.difficulty].name}</span>
        {answer.points > 0 ? (
          <span className="ml-auto font-mono tabular-nums">
            {copy.game.pointsEarned(answer.points)}
          </span>
        ) : null}
      </div>

      <p className="font-medium text-balance">{answer.prompt}</p>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {correctLabel ? <Badge variant="outline">{copy.game.answerWas(correctLabel)}</Badge> : null}
        {/* Named, not bare. On an image question the label is just a letter, so
            a lone red "C" said nothing about what it was. */}
        {!answer.correct && chosenLabel ? (
          <Badge variant="destructive">{copy.game.youChose(chosenLabel)}</Badge>
        ) : null}
        {!answer.correct && !chosenLabel ? (
          <Badge variant="destructive">{copy.game.timeUp}</Badge>
        ) : null}
      </div>

      {/* The payload. Set as body copy, with the line height of something meant
          to be read rather than scanned — people come back to this screen for
          the explanations, not for the score. */}
      <p className="text-text-secondary text-sm leading-relaxed">{answer.explanation}</p>

      {answer.docUrl ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto self-start p-0"
          nativeButton={false}
          render={<a href={answer.docUrl} target="_blank" rel="noreferrer" />}
        >
          {copy.game.readTheDocs}
        </Button>
      ) : null}
    </div>
  )
}
