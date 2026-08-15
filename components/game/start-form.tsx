'use client'

import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { PlayIcon } from 'lucide-react'

import { ChoiceGroup } from '@/components/game/choice-group'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { copy } from '@/lib/copy'
import { DIFFICULTIES, MODES, type RunDifficulty, type RunMode } from '@/lib/difficulty'
import { pseudoSchema, type StartRunResponse } from '@/lib/game/contracts'
import {
  getRememberedPlayer,
  getRememberedPlayerOnServer,
  rememberPlayer,
  subscribeToRememberedPlayer,
  type RememberedPlayer,
} from '@/lib/game/remembered-player'
import { TEAMS, type Team } from '@/lib/schema/question'

const MODE_CHOICES = [...MODES, 'mixed' as const].map((mode) => ({
  value: mode,
  label: copy.modes[mode].name,
}))

const DIFFICULTY_CHOICES = [...DIFFICULTIES, 'progressive' as const].map((difficulty) => ({
  value: difficulty,
  label: copy.difficulties[difficulty].name,
}))

export function StartForm() {
  const router = useRouter()

  // The stored values are the starting point; anything typed since overrides them.
  const remembered = useSyncExternalStore(
    subscribeToRememberedPlayer,
    getRememberedPlayer,
    getRememberedPlayerOnServer,
  )
  const [edited, setEdited] = useState<Partial<RememberedPlayer>>({})
  const current: RememberedPlayer = { ...remembered, ...edited }
  const { pseudo, team, mode, difficulty } = current

  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const setPseudo = (value: string) => setEdited((draft) => ({ ...draft, pseudo: value }))
  const setTeam = (value: Team) => setEdited((draft) => ({ ...draft, team: value }))
  const setMode = (value: RunMode) => setEdited((draft) => ({ ...draft, mode: value }))
  const setDifficulty = (value: RunDifficulty) =>
    setEdited((draft) => ({ ...draft, difficulty: value }))

  async function start(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const valid = pseudoSchema.safeParse(pseudo)
    if (!valid.success) {
      setError(valid.error.issues[0]?.message ?? copy.home.pseudoRequired)
      return
    }

    setStarting(true)
    rememberPlayer({ pseudo: valid.data, team, mode, difficulty })

    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: valid.data, team, mode, difficulty }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? copy.errors.generic)
        setStarting(false)
        return
      }

      const run = (await response.json()) as StartRunResponse
      router.push(`/play/${run.runId}`)
    } catch {
      setError(copy.errors.generic)
      setStarting(false)
    }
  }

  return (
    <form onSubmit={start} className="flex flex-col gap-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="pseudo">{copy.home.pseudoLabel}</FieldLabel>
          <Input
            id="pseudo"
            name="pseudo"
            value={pseudo}
            autoComplete="nickname"
            maxLength={32}
            placeholder={copy.home.pseudoPlaceholder}
            onChange={(event) => setPseudo(event.target.value)}
          />
          <FieldDescription>{copy.home.pseudoHint}</FieldDescription>
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="team">{copy.home.teamLabel}</FieldLabel>
          {/* `items` maps the stored value onto its label, so the trigger shows
              "Engineering" rather than the raw `engineering`. */}
          <Select value={team} items={copy.teams} onValueChange={(next) => setTeam(next as Team)}>
            <SelectTrigger id="team">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEAMS.map((value) => (
                <SelectItem key={value} value={value}>
                  {copy.teams[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <FieldSet>
          <FieldLegend variant="label">{copy.home.modeLabel}</FieldLegend>
          <ChoiceGroup
            label={copy.home.modeLabel}
            value={mode}
            onChange={setMode}
            choices={MODE_CHOICES}
          />
          <FieldDescription>{copy.modes[mode].help}</FieldDescription>
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">{copy.home.difficultyLabel}</FieldLegend>
          <ChoiceGroup
            label={copy.home.difficultyLabel}
            value={difficulty}
            onChange={setDifficulty}
            choices={DIFFICULTY_CHOICES}
          />
          <FieldDescription>{copy.difficulties[difficulty].help}</FieldDescription>
        </FieldSet>
      </FieldGroup>

      <Button type="submit" size="lg" disabled={starting}>
        <PlayIcon data-icon="inline-start" />
        {starting ? copy.loading.question : copy.home.start}
      </Button>

      <Alert>
        <AlertTitle>{copy.game.keyboardHint}</AlertTitle>
        <AlertDescription>{copy.app.tagline}</AlertDescription>
      </Alert>
    </form>
  )
}
