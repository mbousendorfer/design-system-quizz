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
      {question.options.map((option, index) => (
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
            'h-auto justify-start gap-3 whitespace-normal p-3 text-left',
            images && 'flex-col items-stretch',
          )}
        >
          <OptionBody
            option={option}
            index={index}
            images={images}
            zoom={zoom}
            onMeasure={measure(option.id)}
          />
          <OptionVerdictBadge option={option} verdict={verdict} />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function OptionBody({
  option,
  index,
  images,
  zoom,
  onMeasure,
}: {
  option: PlayerOption
  index: number
  images: boolean
  zoom: number
  onMeasure: (size: { width: number; height: number }) => void
}) {
  if (images && option.render) {
    return (
      <>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{option.label ?? optionLetter(index)}</Badge>
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
      <Badge variant="secondary">{index + 1}</Badge>
      <span className="font-medium">{option.component ?? option.label ?? optionLetter(index)}</span>
    </span>
  )
}

/**
 * The verdict is carried by a labelled badge rather than by recolouring the
 * option: it survives being colour-blind, and it keeps the toggle's own styling
 * out of this file.
 */
function OptionVerdictBadge({
  option,
  verdict,
}: {
  option: PlayerOption
  verdict: OptionVerdict | null
}) {
  if (!verdict) return null

  if (option.id === verdict.correctOptionId) {
    return (
      <Badge variant="default" className="ml-auto">
        <CheckIcon data-icon="inline-start" />
        {copy.game.correct}
      </Badge>
    )
  }

  if (option.id === verdict.chosenOptionId) {
    return (
      <Badge variant="destructive" className="ml-auto">
        <XIcon data-icon="inline-start" />
        {copy.game.incorrect}
      </Badge>
    )
  }

  return null
}
