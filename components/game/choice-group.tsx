'use client'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

export type Choice<T extends string> = {
  value: T
  label: string
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
        <ToggleGroupItem key={choice.value} value={choice.value} className={itemClassName}>
          {choice.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
