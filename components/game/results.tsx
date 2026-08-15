'use client'

import Link from 'next/link'
import { CheckCircle2Icon, RotateCcwIcon, SparklesIcon, TrophyIcon, XCircleIcon } from 'lucide-react'

import { optionLetter } from '@/components/game/question-view'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { copy } from '@/lib/copy'
import type { FinishRunResponse, RunReviewAnswer } from '@/lib/game/contracts'
import type { PlayerOption } from '@/lib/schema/question'

export function Results({ summary }: { summary: FinishRunResponse }) {
  const delta = summary.averageScore === null ? null : summary.score - summary.averageScore

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{copy.results.title}</CardTitle>
          <CardDescription>
            {copy.results.correctCount(summary.correctCount, summary.totalQuestions)}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* A clean sweep of five is reachable, and it is the thing that makes
              people press replay. Say so loudly. */}
          {summary.perfect ? (
            <Alert>
              <SparklesIcon />
              <AlertTitle>{copy.results.perfect}</AlertTitle>
              <AlertDescription>{copy.results.score(summary.score)}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{copy.results.score(summary.score)}</Badge>
            {summary.bestStreak >= 2 ? (
              <Badge variant="secondary">{copy.game.streak(summary.bestStreak)}</Badge>
            ) : null}
            {delta !== null ? (
              <Badge variant="outline">{copy.results.versusAverage(delta)}</Badge>
            ) : null}
            {summary.rank !== null ? (
              <Badge variant="outline">
                {copy.results.rank(summary.rank, copy.difficulties[
                  summary.difficulty as keyof typeof copy.difficulties
                ].name)}
              </Badge>
            ) : null}
          </div>
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
              <ReviewRow answer={answer} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function labelFor(options: PlayerOption[], optionId: string | null): string | null {
  if (!optionId) return null
  const index = options.findIndex((option) => option.id === optionId)
  if (index < 0) return null
  const option = options[index]
  return option.component ?? option.label ?? optionLetter(index)
}

function ReviewRow({ answer }: { answer: RunReviewAnswer }) {
  const correctLabel = labelFor(answer.options, answer.correctOptionId)
  const chosenLabel = labelFor(answer.options, answer.chosenOptionId)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {answer.correct ? <CheckCircle2Icon className="size-4" /> : <XCircleIcon className="size-4" />}
        <span className="font-medium">{copy.game.questionOf(answer.position, 5)}</span>
        <Badge variant="secondary">{copy.modes[answer.mode].name}</Badge>
        <Badge variant="outline">{copy.difficulties[answer.difficulty].name}</Badge>
        {answer.points > 0 ? (
          <Badge variant="default" className="ml-auto">
            {copy.game.pointsEarned(answer.points)}
          </Badge>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">{answer.prompt}</p>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {correctLabel ? <Badge variant="outline">{copy.game.answerWas(correctLabel)}</Badge> : null}
        {!answer.correct && chosenLabel ? (
          <Badge variant="destructive">{chosenLabel}</Badge>
        ) : null}
        {!answer.correct && !chosenLabel ? (
          <Badge variant="destructive">{copy.game.timeUp}</Badge>
        ) : null}
      </div>

      <p className="text-sm">{answer.explanation}</p>

      {answer.docUrl ? (
        <Button
          variant="link"
          size="sm"
          className="self-start"
          nativeButton={false}
          render={<a href={answer.docUrl} target="_blank" rel="noreferrer" />}
        >
          {copy.game.readTheDocs}
        </Button>
      ) : null}
    </div>
  )
}
