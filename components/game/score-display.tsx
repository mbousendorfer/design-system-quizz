'use client'

import { useEffect, useReducer, useRef } from 'react'

import { cn } from '@/lib/utils'

const COUNT_MS = 700

/** Decelerating, so the number arrives rather than stopping dead. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * The run's score, as a number you can actually see.
 *
 * It used to be a `Badge` — the same treatment as the mode name and the
 * difficulty, so the one figure the whole run was for competed with its own
 * metadata and lost. Here it is the largest thing on the screen, set in tabular
 * figures so the digits sit on a grid rather than shuffling as they land.
 *
 * The count-up is the only real animation in the app, and it is here because
 * this is the only moment that is a payoff rather than a task. Seven hundred
 * milliseconds, decelerating: long enough to read as an arrival, short enough
 * that nobody waiting to see their score is made to wait for it.
 *
 * Reduced motion gets the final number immediately — `matchMedia` rather than a
 * CSS query, because the animation is in JavaScript and a CSS media query cannot
 * reach it.
 */
export function ScoreDisplay({
  score,
  label,
  className,
}: {
  score: number
  label: string
  className?: string
}) {
  const [shown, tick] = useReducer((_: number, next: number) => next, score)
  const frame = useRef<number | undefined>(undefined)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || score === 0) {
      tick(score)
      return
    }

    const startedAt = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / COUNT_MS)
      tick(Math.round(easeOut(progress) * score))
      if (progress < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)

    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    }
  }, [score])

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-text-tertiary text-xs font-medium">{label}</span>
      {/* The accessible name is the real score, announced once. A screen reader
          following the count-up frame by frame would read seventy numbers. */}
      <span className="sr-only">{score}</span>
      <span
        aria-hidden
        className="font-mono text-5xl leading-none font-semibold tracking-tight tabular-nums"
      >
        {shown.toLocaleString('en-US')}
      </span>
    </div>
  )
}
