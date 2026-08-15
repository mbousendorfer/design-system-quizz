'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { ChoiceGroup } from '@/components/game/choice-group'
import { Field, FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { copy } from '@/lib/copy'
import { DIFFICULTIES, MODES, type RunDifficulty } from '@/lib/difficulty'
import { TEAMS, type Team } from '@/lib/schema/question'

const DIFFICULTY_CHOICES = [...DIFFICULTIES, 'progressive' as const].map((difficulty) => ({
  value: difficulty,
  label: copy.difficulties[difficulty].name,
}))

const WINDOW_CHOICES = [
  { value: 'all' as const, label: copy.leaderboard.allTime },
  { value: 'week' as const, label: copy.leaderboard.lastSevenDays },
]

/**
 * The level is the board, not a filter: a single table across levels would reward
 * grinding the easy one. Team, mode and time window are facets on top of it.
 */
export function LeaderboardFilters() {
  const router = useRouter()
  const params = useSearchParams()

  function apply(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    router.replace(`/leaderboard?${next.toString()}`)
  }

  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend variant="label">{copy.leaderboard.byDifficulty}</FieldLegend>
        <ChoiceGroup
          label={copy.leaderboard.byDifficulty}
          value={(params.get('difficulty') ?? 'progressive') as RunDifficulty}
          onChange={(value) => apply('difficulty', value)}
          choices={DIFFICULTY_CHOICES}
        />
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">{copy.leaderboard.window}</FieldLegend>
        <ChoiceGroup
          label={copy.leaderboard.window}
          value={(params.get('window') ?? 'all') as 'all' | 'week'}
          onChange={(value) => apply('window', value)}
          choices={WINDOW_CHOICES}
        />
      </FieldSet>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLegend variant="label">{copy.leaderboard.byTeam}</FieldLegend>
          <Select
            value={params.get('team') ?? 'all'}
            items={{ all: copy.leaderboard.allTeams, ...copy.teams }}
            onValueChange={(value) => apply('team', String(value))}
          >
            <SelectTrigger aria-label={copy.leaderboard.byTeam}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{copy.leaderboard.allTeams}</SelectItem>
              {TEAMS.map((team: Team) => (
                <SelectItem key={team} value={team}>
                  {copy.teams[team]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLegend variant="label">{copy.home.modeLabel}</FieldLegend>
          <Select
            value={params.get('mode') ?? 'all'}
            items={{
              all: copy.leaderboard.allModes,
              mixed: copy.modes.mixed.name,
              ...Object.fromEntries(MODES.map((mode) => [mode, copy.modes[mode].name])),
            }}
            onValueChange={(value) => apply('mode', String(value))}
          >
            <SelectTrigger aria-label={copy.home.modeLabel}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{copy.leaderboard.allModes}</SelectItem>
              <SelectItem value="mixed">{copy.modes.mixed.name}</SelectItem>
              {MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {copy.modes[mode].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FieldGroup>
  )
}
