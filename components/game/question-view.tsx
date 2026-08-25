'use client'

import { useCallback, useMemo, useState } from 'react'
import { CheckIcon, XIcon } from 'lucide-react'

import { RenderBox } from '@/components/game/render-box'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { copy } from '@/lib/copy'
import { hasImageOptions } from '@/lib/difficulty'
import type { PlayerOption, PlayerQuestion } from '@/lib/schema/question'
import { cn } from '@/lib/utils'

/** A / B / C … for image options, which have no name of their own to show. */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

/**
 * The four modes differ in exactly two places: whether the question shows a
 * screenshot, and whether the options are component names or more screenshots.
 * Everything else — the framing, the keyboard handling, the verdict badges — is
 * shared, so it lives here once rather than in four near-identical renderers.
 */
export function QuestionPrompt({ question }: { question: PlayerQuestion }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{copy.modes[question.mode].name}</Badge>
        <Badge variant="outline">{copy.difficulties[question.difficulty].name}</Badge>
        {/* Only present on the modes where naming the component is not the answer. */}
        {question.component ? <Badge variant="ghost">{question.component}</Badge> : null}
      </div>

      <p className="text-lg font-medium text-balance">{question.prompt}</p>

      {question.stimulus ? (
        <RenderBox render={question.stimulus} alt={copy.modes[question.mode].short} priority />
      ) : null}
    </div>
  )
}

export type OptionVerdict = {
  correctOptionId: string
  chosenOptionId: string | null
}

export function QuestionOptions({
  question,
  chosen,
  verdict,
  onChoose,
  disabled,
}: {
  question: PlayerQuestion
  chosen: string | null
  /** Set once the answer is in; until then the options carry no verdict. */
  verdict: OptionVerdict | null
  onChoose: (optionId: string) => void
  disabled: boolean
}) {
  const images = hasImageOptions(question.mode)

  /**
   * One zoom for the whole group, never one per option.
   *
   * A component has an intrinsic size and the box does not, so live renders need
   * scaling to fill it. Scaling each option to its own box would be a tell: an
   * option drawn at 2.4x next to one at 1.0x announces that they are different
   * components. The smallest fit across every option is used for all of them.
   *
   * `transform: scale()` and not width/height, because a transform is not a layout
   * property — changing it reflows nothing and contributes no layout shift.
   */
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({})

  const zoom = useMemo(() => {
    const measured = Object.values(sizes).filter((size) => size.width > 0 && size.height > 0)
    if (measured.length === 0) return 1
    // The box is 16:10 with padding; these are the usable inner bounds at the
    // narrowest column the grid produces.
    const fits = measured.map((size) => Math.min(280 / size.width, 175 / size.height))
    return Math.max(0.5, Math.min(4, Math.min(...fits)))
  }, [sizes])

  const measure = useCallback(
    (id: string) => (size: { width: number; height: number }) =>
      setSizes((current) =>
        current[id]?.width === size.width && current[id]?.height === size.height
          ? current
          : { ...current, [id]: size },
      ),
    [],
  )

  return (
    <ToggleGroup
      aria-label={copy.game.optionsLabel}
      value={chosen ? [chosen] : []}
      disabled={disabled}
      orientation={images ? 'horizontal' : 'vertical'}
      onValueChange={(next) => {
        const picked = next[0]
        if (picked && !disabled) onChoose(picked)
      }}
      variant="outline"
      className={cn(
        'w-full',
        images ? 'grid grid-cols-1 sm:grid-cols-2' : 'flex flex-col items-stretch',
      )}
    >
      {question.options.map((option, index) => {
        const outcome = verdictFor(option, verdict)
        return (
        <ToggleGroupItem
          key={option.id}
          value={option.id}
          // An option whose whole content is a screenshot has no accessible name
          // of its own, so it is spelled out here rather than left as an unlabelled
          // button. The number matches the keyboard shortcut that picks it.
          aria-label={copy.game.optionName(
            index + 1,
            option.component ?? option.label ?? optionLetter(index),
          )}
          // Layout only: the toggle is a single-line control by default and these
          // options are a full-width row, or a card holding a screenshot.
          className={cn(
            'h-auto justify-start gap-3 whitespace-normal p-3 text-left transition-colors',
            images && 'flex-col items-stretch',
            // Blue border on hover, which is the house rule for a hoverable
            // card — never a lift, never a coloured edge, never green. Only
            // while the question is live: once a verdict is on the row, the
            // verdict owns its border.
            !verdict && 'hover:border-ring',
            // The verdict is carried by the whole row, not by a chip at its far
            // edge. Before this, the single most important thing on the screen —
            // which one was right — was the least visible thing on it.
            //
            // Colour is never the only signal: the number chip becomes a tick or
            // a cross, and the row keeps its label. Colour, shape and text all
            // say the same thing.
            outcome === 'correct' &&
              'border-success bg-success/12 text-foreground hover:bg-success/12 data-[selected]:bg-success/12',
            outcome === 'wrong' &&
              'border-destructive bg-destructive/12 text-foreground hover:bg-destructive/12 data-[selected]:bg-destructive/12',
            // The rest step back so the two that matter carry the eye. Only once
            // the answer is in — while the question is live every option has to
            // look equally plausible.
            outcome === 'other' && 'opacity-45',
          )}
        >
          <OptionBody
            option={option}
            index={index}
            images={images}
            zoom={zoom}
            outcome={outcome}
            onMeasure={measure(option.id)}
          />
          <OptionVerdictLabel outcome={outcome} />
        </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}

/** What this option turned out to be, once the answer is in. */
type Outcome = 'pending' | 'correct' | 'wrong' | 'other'

function verdictFor(option: PlayerOption, verdict: OptionVerdict | null): Outcome {
  if (!verdict) return 'pending'
  if (option.id === verdict.correctOptionId) return 'correct'
  if (option.id === verdict.chosenOptionId) return 'wrong'
  return 'other'
}

/**
 * The marker at the head of a row: the keyboard number while the question is
 * live, the verdict once it is over. One slot, so nothing shifts when the answer
 * lands and the eye already knows where to look.
 */
function OptionMarker({ index, outcome }: { index: number; outcome: Outcome }) {
  if (outcome === 'correct') {
    return (
      <span className="bg-success text-success-foreground flex size-6 shrink-0 items-center justify-center rounded-full">
        <CheckIcon className="size-3.5" aria-hidden />
      </span>
    )
  }
  if (outcome === 'wrong') {
    return (
      <span className="bg-destructive text-background flex size-6 shrink-0 items-center justify-center rounded-full">
        <XIcon className="size-3.5" aria-hidden />
      </span>
    )
  }
  return (
    <span className="bg-muted text-text-tertiary flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs tabular-nums">
      {index + 1}
    </span>
  )
}

function OptionBody({
  option,
  index,
  images,
  zoom,
  outcome,
  onMeasure,
}: {
  option: PlayerOption
  index: number
  images: boolean
  zoom: number
  outcome: Outcome
  onMeasure: (size: { width: number; height: number }) => void
}) {
  if (images && option.render) {
    return (
      <>
        <div className="flex items-center gap-2">
          <OptionMarker index={index} outcome={outcome} />
          <span className="text-text-secondary text-sm font-medium">
            {option.label ?? optionLetter(index)}
          </span>
        </div>
        <RenderBox
          render={option.render}
          alt={copy.game.optionScreenshot(option.label ?? optionLetter(index))}
          zoom={zoom}
          onMeasure={onMeasure}
          priority
        />
      </>
    )
  }

  return (
    <span className="flex items-center gap-3">
      <OptionMarker index={index} outcome={outcome} />
      <span className="font-medium">{option.component ?? option.label ?? optionLetter(index)}</span>
    </span>
  )
}

/** The word, so the verdict never rests on colour alone. */
function OptionVerdictLabel({ outcome }: { outcome: Outcome }) {
  if (outcome === 'correct') {
    return (
      <span className="text-success ml-auto shrink-0 text-sm font-semibold">
        {copy.game.correct}
      </span>
    )
  }
  if (outcome === 'wrong') {
    return (
      <span className="text-destructive ml-auto shrink-0 text-sm font-semibold">
        {copy.game.incorrect}
      </span>
    )
  }
  return null
}
