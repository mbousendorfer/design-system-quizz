'use client'

import type { ReactNode } from 'react'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

export type Choice<T extends string> = {
  value: T
  label: string
  /** Optional glyph, shown before the label. */
  icon?: ReactNode
  /** Optional trailing mark — a difficulty meter, for instance. */
  meter?: ReactNode
}

/**
 * A single-choice group over ToggleGroup.
 *
 * Base UI's ToggleGroup always speaks in arrays, and clicking the pressed item
 * clears the selection. For a choice that must always have an answer that is a
 * footgun, so this keeps the current value when the group hands back an empty
 * array. Nothing else is added — the keyboard roving focus, the pressed state and
 * the accessibility all come from the primitive.
 */
export function ChoiceGroup<T extends string>({
  value,
  onChange,
  choices,
  label,
  className,
  itemClassName,
  disabled,
}: {
  value: T
  onChange: (value: T) => void
  choices: readonly Choice<T>[]
  label: string
  className?: string
  itemClassName?: string
  disabled?: boolean
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      disabled={disabled}
      onValueChange={(next) => {
        const picked = next[0] as T | undefined
        if (picked) onChange(picked)
      }}
      variant="outline"
      className={cn('flex-wrap', className)}
    >
      {choices.map((choice) => (
        <ToggleGroupItem
          key={choice.value}
          value={choice.value}
          className={cn(
            'gap-2 transition-all',
            // Selected was three percent lighter than unselected, which on a dark
            // ground is no signal at all — you could not tell which mode you were
            // about to play. Blue is the design system's own selected state, and
            // this is a control, which is exactly what blue is for.
            // The primitive marks the pressed item with aria-pressed and
            // data-state=on; there is no data-pressed, and a wrong selector here
            // fails silently as "no selected state at all".
            'aria-pressed:border-ring aria-pressed:bg-ring/12 aria-pressed:text-foreground aria-pressed:font-medium',
            'data-[state=on]:border-ring data-[state=on]:bg-ring/12 data-[state=on]:text-foreground data-[state=on]:font-medium',
            itemClassName,
          )}
        >
          {choice.icon}
          {choice.label}
          {choice.meter}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
