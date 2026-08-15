'use client'

import { useState } from 'react'
import { LayersIcon } from 'lucide-react'

import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getComponent, variantsFor, type DsVariant } from '@/lib/catalog'
import { copy } from '@/lib/copy'

/**
 * Turns a component's modifier list into one option per modifier.
 *
 * This is what makes a `which-variant` question four clicks instead of four
 * screenshots: pick the component, tick the variants worth comparing, done. The
 * What it offers is `variantsFor`, not the raw modifier list: a colour that only
 * exists as half of a compound would otherwise produce options that render
 * identically. Everything on offer comes from the catalog, so an option can only
 * name something the design system actually ships — and every option shares the same
 * template, which is what stops the markup differing structurally between options.
 */
export function ModifierFanout({
  component,
  onGenerate,
}: {
  component: string
  onGenerate: (variants: DsVariant[]) => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const spec = component ? getComponent(component) : null
  const variants = component ? variantsFor(component) : []

  if (!component) {
    return <FieldDescription>{copy.questions.form.pickComponentFirst}</FieldDescription>
  }

  if (!spec?.cssUiTemplate) {
    return (
      <Alert>
        <AlertTitle>{copy.questions.form.noLiveRender(component)}</AlertTitle>
      </Alert>
    )
  }

  if (variants.length === 0) {
    return <FieldDescription>{copy.questions.form.noModifiers(component)}</FieldDescription>
  }

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        aria-label={copy.questions.form.fanoutLabel}
        multiple
        value={picked}
        onValueChange={(next) => setPicked(next)}
        variant="outline"
        className="flex-wrap"
      >
        {variants.map((variant) => (
          <ToggleGroupItem key={variant.label} value={variant.label}>
            {variant.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={picked.length < 2}
          onClick={() => {
            onGenerate(picked.map((label) => variants.find((v) => v.label === label)!))
            setPicked([])
          }}
        >
          <LayersIcon data-icon="inline-start" />
          {copy.questions.form.fanout(picked.length)}
        </Button>
        <FieldDescription>{copy.questions.form.fanoutHint}</FieldDescription>
      </div>
    </div>
  )
}
