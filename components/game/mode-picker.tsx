'use client'

import {
  FileTextIcon,
  GitCompareIcon,
  PaletteIcon,
  PuzzleIcon,
  ScanEyeIcon,
  ShuffleIcon,
} from 'lucide-react'

import { copy } from '@/lib/copy'
import { MODES, type RunMode } from '@/lib/difficulty'
import { publishedCount } from '@/lib/game/question-bank'
import { cn } from '@/lib/utils'

const ICONS = {
  'name-that-component': ScanEyeIcon,
  'which-variant': PaletteIcon,
  'spot-the-drift': GitCompareIcon,
  'which-component': PuzzleIcon,
  'name-from-description': FileTextIcon,
  mixed: ShuffleIcon,
} as const

const CHOICES: RunMode[] = [...MODES, 'mixed']

/**
 * Choosing a mode, with what is in it.
 *
 * Six chips of ragged widths wrapping across two rows told you nothing except
 * their names, and one of them — the fifth — had no published questions at all.
 * Picking it took you to a dead end: press Start, get told there is nothing to
 * play, go back and guess again.
 *
 * So each card carries its count, and a mode with nothing in it says so and
 * cannot be chosen. That is the whole improvement: the picker now describes
 * what you can actually play rather than what modes exist in principle.
 *
 * `aria-disabled` rather than `disabled`, so the empty mode stays reachable by
 * keyboard and a screen reader can announce why it is not available — a
 * disabled button is skipped in the tab order and simply vanishes.
 */
export function ModePicker({
  value,
  onChange,
  label,
}: {
  value: RunMode
  onChange: (value: RunMode) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {CHOICES.map((choice) => {
        const Icon = ICONS[choice]
        const count = publishedCount(choice === 'mixed' ? 'mixed' : choice)
        const empty = count === 0
        const selected = choice === value

        return (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={empty || undefined}
            onClick={() => {
              if (!empty) onChange(choice)
            }}
            className={cn(
              // `h-full` plus `mt-auto` on the count: names wrap to two lines at
              // different points, and without this the counts sat at three
              // different heights across one row.
              'focus-visible:ring-ring flex h-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-all',
              'focus-visible:ring-2 focus-visible:outline-none',
              empty
                ? 'border-border/60 cursor-not-allowed opacity-45'
                : selected
                  ? 'border-ring bg-ring/12'
                  : 'border-border hover:border-ring hover:bg-accent/40',
            )}
          >
            <span className="flex w-full items-center gap-2">
              <Icon className={cn('size-4 shrink-0', selected && 'text-ring')} aria-hidden />
              <span className={cn('text-sm leading-tight', selected ? 'font-semibold' : 'font-medium')}>
                {copy.modes[choice].name}
              </span>
            </span>

            <span className="text-text-tertiary mt-auto font-mono text-[0.7rem] tabular-nums">
              {empty ? copy.modes.noneYet : copy.modes.count(count)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
