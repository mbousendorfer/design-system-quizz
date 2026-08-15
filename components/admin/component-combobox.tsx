'use client'

import { useState } from 'react'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { DS_COMPONENTS, getComponent } from '@/lib/catalog'
import { copy } from '@/lib/copy'

const NAMES = DS_COMPONENTS.map((component) => component.name)

/**
 * Picking a design system component.
 *
 * A combobox over the generated catalog rather than a text field: a question that
 * names a component which does not exist is a question that can never be right,
 * and catching that at save time is far too late to be useful.
 *
 * `items` takes plain strings so Base UI's own filtering works untouched; the
 * category is looked up per row for display only.
 *
 * Both `value` and `inputValue` are controlled, which Base UI requires together:
 * controlling the selection alone leaves the component unable to update the text
 * it shows, and selecting an item then appears to do nothing at all.
 */
export function ComponentCombobox({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [inputValue, setInputValue] = useState(value)
  const [lastValue, setLastValue] = useState(value)

  // Adjusting state during render rather than in an effect, so that a value set
  // from outside — "suggest distractors" filling three of these at once — shows up
  // without a second render pass.
  if (value !== lastValue) {
    setLastValue(value)
    setInputValue(value)
  }

  return (
    <Combobox
      items={NAMES}
      value={value || null}
      onValueChange={(next) => onChange((next as string | null) ?? '')}
      inputValue={inputValue}
      onInputValueChange={(next) => setInputValue(next)}
    >
      <ComboboxInput id={id} placeholder={placeholder ?? copy.questions.form.componentLabel} />
      <ComboboxContent>
        <ComboboxEmpty>{copy.questions.form.noComponentFound}</ComboboxEmpty>
        <ComboboxList>
          {(name: string) => (
            <ComboboxItem key={name} value={name}>
              <span className="flex w-full items-center justify-between gap-3">
                <span>{name}</span>
                <span className="text-xs text-muted-foreground">
                  {getComponent(name)?.category}
                </span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
