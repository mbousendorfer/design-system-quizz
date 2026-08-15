'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { FeedbackPanel, verdictAnnouncement } from '@/components/game/feedback-panel'
import { QuestionOptions, QuestionPrompt } from '@/components/game/question-view'
import { Results } from '@/components/game/results'
import { TimerBar } from '@/components/game/timer-bar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { copy } from '@/lib/copy'
import { warmStyleSheets } from '@/lib/render/stylesheets'
import { QUESTIONS_PER_RUN, difficultyForPosition, type RunDifficulty } from '@/lib/difficulty'
import type {
  FinishRunResponse,
  ServedQuestionResponse,
  SubmitAnswerResponse,
} from '@/lib/game/contracts'

type Phase = 'loading' | 'question' | 'feedback' | 'finished' | 'error'

export function QuizEngine({
  runId,
  startPosition,
  totalQuestions,
  runDifficulty,
  alreadyFinished,
}: {
  runId: string
  startPosition: number
  totalQuestions: number
  runDifficulty: RunDifficulty
  alreadyFinished: boolean
}) {
  const [phase, setPhase] = useState<Phase>(alreadyFinished ? 'loading' : 'loading')
  const [position, setPosition] = useState(startPosition)
  const [question, setQuestion] = useState<ServedQuestionResponse | null>(null)
  const [result, setResult] = useState<SubmitAnswerResponse | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [summary, setSummary] = useState<FinishRunResponse | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)

  // The server's clock, not ours. Everything is judged against `served_at`, so a
  // client whose clock is minutes off must still see an honest countdown.
  const clockOffset = useRef(0)
  const submitting = useRef(false)

  const finish = useCallback(async () => {
    const response = await fetch(`/api/runs/${runId}/finish`, { method: 'POST' })
    if (!response.ok) {
      setMessage(copy.errors.generic)
      setPhase('error')
      return
    }
    setSummary((await response.json()) as FinishRunResponse)
    setPhase('finished')
  }, [runId])

  /**
   * Fetches and shows a question. Deliberately touches no state before the first
   * await: the mount effect calls this, and a synchronous setState there would
   * cascade a second render before the first has painted. Clearing the previous
   * question is the caller's job, in the event handler that decided to move on.
   */
  const load = useCallback(
    async (nextPosition: number) => {
      const response = await fetch(`/api/runs/${runId}/items/${nextPosition}`)
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setMessage(body?.error ?? copy.errors.generic)
        setPhase('error')
        return
      }

      const served = (await response.json()) as ServedQuestionResponse
      clockOffset.current = served.now - Date.now()
      setQuestion(served)
      setRemainingMs(served.deadline - (Date.now() + clockOffset.current))
      setPhase('question')
    },
    [runId],
  )

  const submit = useCallback(
    async (optionId: string | null) => {
      if (submitting.current) return
      submitting.current = true
      setChosen(optionId)

      const response = await fetch(`/api/runs/${runId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position, chosenOptionId: optionId }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setMessage(body?.error ?? copy.errors.generic)
        setPhase('error')
        return
      }

      setResult((await response.json()) as SubmitAnswerResponse)
      setPhase('feedback')
    },
    [position, runId],
  )

  const advance = useCallback(() => {
    if (!result) return

    // A long explanation leaves the page scrolled down, and the next question
    // would otherwise open halfway through itself — with a timer already running.
    window.scrollTo({ top: 0, behavior: 'instant' })

    setPhase('loading')
    setQuestion(null)
    setResult(null)
    setChosen(null)
    submitting.current = false

    if (result.nextPosition === null) {
      void finish()
      return
    }
    setPosition(result.nextPosition)
    void load(result.nextPosition)
  }, [finish, load, result])

  // Kick off: either the run is already over, or we pick up where it left off.
  //
  // Both disables are deliberate and checkable. `set-state-in-effect`: `finish`
  // and `load` each await a fetch before touching any state, so nothing here is
  // synchronous — the rule cannot see through the call, but both functions are
  // a few lines above and short enough to confirm by eye. `exhaustive-deps`:
  // this runs once on mount, and every later load goes through `advance`, an
  // event handler.
  //
  // The question is fetched from the client rather than server-rendered on
  // purpose: the countdown needs the clock offset measured when the response
  // actually arrives. Server-rendering it would leave the client lenient by the
  // whole transfer time, and on a slow connection a player could be timed out
  // while their screen still showed a second left.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    // Start fetching the design system sheets now: the question request is in
    // flight at the same moment, so they are usually parsed before the first
    // option paints, and questions 2 to 5 cost nothing.
    warmStyleSheets()
    if (alreadyFinished) void finish()
    else void load(startPosition)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  // Countdown. When it reaches zero the client posts a null answer, but the
  // server is what decides whether that really was a timeout.
  useEffect(() => {
    if (phase !== 'question' || !question) return

    // No leading synchronous tick: `load` already set the initial remaining time,
    // and calling it here would be a setState in an effect body.
    const interval = setInterval(() => {
      const left = question.deadline - (Date.now() + clockOffset.current)
      setRemainingMs(left)
      if (left <= 0) void submit(null)
    }, 200)

    return () => clearInterval(interval)
  }, [phase, question, submit])

  // 1-6 to answer, Enter to move on. The whole game is playable without a mouse.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return

      if (phase === 'question' && question) {
        const index = Number(event.key) - 1
        if (Number.isInteger(index) && index >= 0 && index < question.options.length) {
          event.preventDefault()
          void submit(question.options[index].id)
        }
        return
      }

      if (phase === 'feedback' && event.key === 'Enter') {
        event.preventDefault()
        advance()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [advance, phase, question, submit])

  if (phase === 'finished' && summary) return <Results summary={summary} />

  if (phase === 'error') {
    return (
      <Alert variant="destructive">
        <AlertTitle>{copy.errors.generic}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    )
  }

  if (!question || (phase === 'loading' && !result)) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="aspect-[16/10] w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  const expected = difficultyForPosition(runDifficulty, position)
  const substituted = question.difficulty !== expected

  return (
    <div className="flex flex-col gap-4">
      {/* Mounted empty and filled when the answer lands. A live region that
          appears already holding its text is not reliably announced, and the
          verdict never triggers a navigation for a screen reader to notice. */}
      <div aria-live="polite" className="sr-only">
        {result ? verdictAnnouncement(result) : ''}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{copy.game.questionOf(position, totalQuestions)}</CardTitle>
          <TimerBar
            remainingMs={remainingMs}
            timerSeconds={question.timerSeconds}
            frozen={phase !== 'question'}
          />
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {/* A mode with only three published questions gives a three-question
              run. The header already says "of 3", but saying it outright once
              stops it reading like something broke. */}
          {position === 1 && totalQuestions < QUESTIONS_PER_RUN ? (
            <Alert>
              <AlertTitle>{copy.errors.shortRun(totalQuestions, QUESTIONS_PER_RUN)}</AlertTitle>
            </Alert>
          ) : null}

          {substituted ? (
            <Alert>
              <AlertTitle>
                {copy.errors.poolTooThin(
                  copy.difficulties[expected].name.toLowerCase(),
                  copy.difficulties[question.difficulty].name.toLowerCase(),
                )}
              </AlertTitle>
            </Alert>
          ) : null}

          <QuestionPrompt question={question} />

          <QuestionOptions
            question={question}
            chosen={chosen}
            verdict={
              result
                ? { correctOptionId: result.correctOptionId, chosenOptionId: chosen }
                : null
            }
            onChoose={(optionId) => void submit(optionId)}
            disabled={phase !== 'question'}
          />
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-4">
          {result ? <FeedbackPanel result={result} /> : null}

          <div className="flex items-center justify-between gap-4">
            {/* Pointer-coarse devices have no keyboard to press 1-6 on, and the
                hint is just noise next to the answer they are trying to tap. */}
            <span className="hidden text-sm text-muted-foreground pointer-fine:inline">
              {copy.game.keyboardHint}
            </span>
            {result ? (
              <Button onClick={advance} autoFocus>
                {result.nextPosition === null ? copy.game.finish : copy.game.next}
              </Button>
            ) : null}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
