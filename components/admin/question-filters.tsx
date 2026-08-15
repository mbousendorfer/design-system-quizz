'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { SearchIcon } from 'lucide-react'

import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { copy } from '@/lib/copy'
import { MODES } from '@/lib/difficulty'
import { STATUSES } from '@/lib/schema/question'

/**
 * Filters live in the URL rather than in component state, so a filtered list is
 * a link you can keep — and so the server can do the filtering.
 */
export function QuestionFilters({ components }: { components: string[] }) {
  const router = useRouter()
  const params = useSearchParams()

  function apply(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    router.replace(`/admin/questions?${next.toString()}`)
  }

  return (
    <FieldGroup className="sm:grid sm:grid-cols-2 lg:grid-cols-4">
      <Field>
        <FieldLabel htmlFor="search">{copy.questions.searchPlaceholder}</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            id="search"
            defaultValue={params.get('search') ?? ''}
            placeholder={copy.questions.searchPlaceholder}
            onChange={(event) => apply('search', event.target.value)}
          />
        </InputGroup>
      </Field>

      <Field>
        <FieldLabel htmlFor="mode">{copy.questions.filterMode}</FieldLabel>
        <Select
          value={params.get('mode') ?? 'all'}
          items={{ all: 'All modes', ...Object.fromEntries(MODES.map((m) => [m, copy.modes[m].name])) }}
          onValueChange={(value) => apply('mode', String(value))}
        >
          <SelectTrigger id="mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            {MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {copy.modes[mode].name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="status">{copy.questions.filterStatus}</FieldLabel>
        <Select
          value={params.get('status') ?? 'all'}
          items={{ all: 'Live only', draft: 'Draft', published: 'Published', archived: 'Archived' }}
          onValueChange={(value) => apply('status', String(value))}
        >
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Live only</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status[0].toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="component">{copy.questions.filterComponent}</FieldLabel>
        <Select
          value={params.get('component') ?? 'all'}
          items={{ all: 'All components', ...Object.fromEntries(components.map((c) => [c, c])) }}
          onValueChange={(value) => apply('component', String(value))}
        >
          <SelectTrigger id="component">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All components</SelectItem>
            {components.map((component) => (
              <SelectItem key={component} value={component}>
                {component}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  )
}
