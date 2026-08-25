'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { CheckIcon, RotateCcwIcon, SparklesIcon, TrophyIcon, XIcon } from 'lucide-react'

import { useConfetti } from '@/components/game/confetti'
import { optionLetter } from '@/components/game/question-view'
import { RenderBox } from '@/components/game/render-box'
import { ScoreDisplay } from '@/components/game/score-display'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { copy } from '@/lib/copy'
import type { FinishRunResponse, RunReviewAnswer } from '@/lib/game/contracts'
import { hasImageOptions } from '@/lib/difficulty'
import type { StoredOption } from '@/lib/schema/question'
import { toPlayerRender, toRender } from '@/lib/schema/render'
import { cn } from '@/lib/utils'

export function Results({ summary }: { summary: FinishRunResponse }) {
  const delta = summary.averageScore === null ? null : summary.score - summary.averageScore
  const confetti = useConfetti()

  useEffect(() => {
    // Only for a run worth celebrating. Confetti for two out of five would be
    // the app being pleased with itself on your behalf.
    if (!summary.perfect) return
    const timer = window.setTimeout(() => confetti.fire(undefined, 140), 350)
    return () => window.clearTimeout(timer)
  }, [summary.perfect, confetti])

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

            {summary.perfect ? (
              <span className="text-success flex items-center gap-1.5 pb-1 text-sm font-semibold">
                <SparklesIcon className="size-4" aria-hidden />
                {copy.results.perfect(summary.totalQuestions)}
              </span>
            ) : null}
          </div>

          {/* The run at a glance, before any of the detail. One cell per
              question, so "which ones did I miss" is answered in a look rather
              than by scrolling five long blocks. */}
          <ol className="flex flex-wrap gap-1.5" aria-label={copy.results.reviewTitle}>
            {summary.answers.map((answer) => (
              <li key={answer.position}>
                <a
                  href={`#q${answer.position}`}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg border font-mono text-xs font-semibold tabular-nums transition-colors',
                    answer.correct
                      ? 'border-success/40 bg-success/12 text-success hover:bg-success/20'
                      : 'border-destructive/40 bg-destructive/12 text-destructive hover:bg-destructive/20',
                  )}
                  aria-label={copy.results.jumpTo(answer.position, answer.correct)}
                >
                  {answer.position}
                </a>
              </li>
            ))}
          </ol>

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
          <CardDescription>{copy.results.reviewHint}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {summary.answers.map((answer) => (
            <ReviewRow key={answer.position} answer={answer} total={summary.totalQuestions} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function optionAt(options: StoredOption[], optionId: string | null) {
  if (!optionId) return null
  const index = options.findIndex((option) => option.id === optionId)
  if (index < 0) return null
  return { option: options[index], index }
}

function labelOf(options: StoredOption[], optionId: string | null): string | null {
  const found = optionAt(options, optionId)
  if (!found) return null
  return found.option.component ?? found.option.label ?? optionLetter(found.index)
}

/**
 * One option, shown rather than referred to.
 *
 * This is the fix the review most needed. On the two image modes it used to say
 * "The answer was A" — and A was a letter on a screen the player had already
 * left, so the sentence carried no information at all. Now the plate comes with
 * it, and a wrong answer sits beside the right one, which is the comparison the
 * question was asking for in the first place.
 */
function AnswerPlate({
  options,
  optionId,
  title,
  tone,
}: {
  options: StoredOption[]
  optionId: string | null
  title: string
  tone: 'correct' | 'wrong'
}) {
  const found = optionAt(options, optionId)
  if (!found) return null

  const render = toPlayerRender(toRender(found.option))
  const label = found.option.component ?? found.option.label ?? optionLetter(found.index)

  return (
    <figure className="flex min-w-0 flex-1 flex-col gap-1.5">
      <figcaption
        className={cn(
          'flex items-center gap-1.5 text-xs font-semibold',
          tone === 'correct' ? 'text-success' : 'text-destructive',
        )}
      >
        {tone === 'correct' ? (
          <CheckIcon className="size-3.5" aria-hidden />
        ) : (
          <XIcon className="size-3.5" aria-hidden />
        )}
        {title}
      </figcaption>
      {render ? (
        <RenderBox
          render={render}
          alt={label}
          className={cn(
            'border-2',
            tone === 'correct' ? 'border-success/50' : 'border-destructive/50',
          )}
        />
      ) : (
        <p className="font-medium">{label}</p>
      )}
    </figure>
  )
}

function ReviewRow({ answer, total }: { answer: RunReviewAnswer; total: number }) {
  const images = hasImageOptions(answer.mode)
  const correctLabel = labelOf(answer.options, answer.correctOptionId)
  const chosenLabel = labelOf(answer.options, answer.chosenOptionId)

  return (
    <div
      id={`q${answer.position}`}
      className={cn(
        'flex scroll-mt-6 flex-col gap-3 rounded-xl border p-4',
        // A missed question is what you came back to read. It gets the weight.
        answer.correct ? 'border-border/60' : 'border-destructive/30 bg-destructive/[0.04]',
      )}
    >
      <div className="text-text-tertiary flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full',
            answer.correct ? 'bg-success text-success-foreground' : 'bg-destructive text-background',
          )}
        >
          {answer.correct ? (
            <CheckIcon className="size-3" aria-hidden />
          ) : (
            <XIcon className="size-3" aria-hidden />
          )}
        </span>
        <span className="font-medium">{copy.game.questionOf(answer.position, total)}</span>
        <span aria-hidden className="text-foreground/20">/</span>
        <span>{copy.modes[answer.mode].name}</span>
        <span aria-hidden className="text-foreground/20">/</span>
        <span>{copy.difficulties[answer.difficulty].name}</span>
        {answer.points > 0 ? (
          <span className="text-success ml-auto font-mono font-semibold tabular-nums">
            {copy.game.pointsEarned(answer.points)}
          </span>
        ) : null}
      </div>

      <p className="font-medium text-balance">{answer.prompt}</p>

      {images ? (
        // Side by side, so the two are compared rather than described.
        <div className="flex flex-col gap-3 sm:flex-row">
          <AnswerPlate
            options={answer.options}
            optionId={answer.correctOptionId}
            title={copy.results.theAnswer}
            tone="correct"
          />
          {!answer.correct ? (
            <AnswerPlate
              options={answer.options}
              optionId={answer.chosenOptionId}
              title={copy.results.yourAnswer}
              tone="wrong"
            />
          ) : null}
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-success font-semibold">{copy.game.answerWas(correctLabel ?? '')}</span>
          {!answer.correct ? (
            <span className="text-destructive">
              {chosenLabel ? copy.game.youChose(chosenLabel) : copy.game.timeUp}
            </span>
          ) : null}
        </p>
      )}

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
