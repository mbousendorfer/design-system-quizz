'use client'

import { TrendingUpIcon } from 'lucide-react'

import { copy } from '@/lib/copy'
import { DIFFICULTY_RULES, PROGRESSIVE_LADDER, type RunDifficulty } from '@/lib/difficulty'
import { cn } from '@/lib/utils'

const CHOICES: RunDifficulty[] = ['easy', 'medium', 'hard', 'progressive']
const LEVEL: Record<RunDifficulty, number> = { easy: 1, medium: 2, hard: 3, progressive: 3 }

/**
 * Choosing a level, with the terms of the deal on the card.
 *
 * This was four chips carrying a three-bar meter, and the meter was decoration:
 * it ranked the levels without saying what changed between them. The levels
 * already hold real numbers — how many options you get, how many seconds, what
 * the score is multiplied by — and those are exactly what someone is trying to
 * weigh when they pick one. Printing them turns a decorative scale into the
 * thing you actually decide on, and lets all four be compared without clicking
 * each in turn to read a sentence.
 *
 * The meter stays, larger and always in the same corner, because a shape ranks
 * faster than a number does. Progressive has no single figure to rank, so it
 * gets the climbing arrow in the same slot rather than an empty one.
 */
export function DifficultyPicker({
  value,
  onChange,
  label,
}: {
  value: RunDifficulty
  onChange: (value: RunDifficulty) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {CHOICES.map((choice) => {
        const selected = choice === value
        const rule = choice === 'progressive' ? null : DIFFICULTY_RULES[choice]

        return (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(choice)}
            className={cn(
              'focus-visible:ring-ring group flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all',
              'focus-visible:ring-2 focus-visible:outline-none',
              selected
                ? 'border-ring bg-ring/12'
                : 'border-border hover:border-ring hover:bg-accent/40',
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className={cn('text-sm', selected ? 'font-semibold' : 'font-medium')}>
                {copy.difficulties[choice].name}
              </span>
              <Meter level={LEVEL[choice]} climbing={choice === 'progressive'} />
            </span>

            <span className="text-text-tertiary flex flex-col font-mono text-[0.7rem] leading-relaxed tabular-nums">
              {(rule
                ? copy.difficulties.terms(rule.optionCount, rule.timerSeconds, rule.scoreMultiplier)
                : copy.difficulties.ladderTerms(PROGRESSIVE_LADDER.length)
              ).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Three rising bars. Ranks at a glance, without colour, which the clock owns. */
function Meter({ level, climbing }: { level: number; climbing: boolean }) {
  if (climbing) {
    return <TrendingUpIcon className="text-text-tertiary size-4 shrink-0" aria-hidden />
  }

  return (
    <span className="flex h-4 shrink-0 items-end gap-[3px]" aria-hidden>
      {[0, 1, 2].map((step) => (
        <span
          key={step}
          className={cn(
            'w-[3px] rounded-full transition-all',
            step < level ? 'bg-foreground' : 'bg-foreground/20',
            step === 0 ? 'h-1.5' : step === 1 ? 'h-2.5' : 'h-3.5',
          )}
        />
      ))}
    </span>
  )
}
