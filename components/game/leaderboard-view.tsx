'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeftIcon, TrophyIcon } from 'lucide-react'

import { LeaderboardFilters } from '@/components/game/leaderboard-filters'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { copy } from '@/lib/copy'
import {
  getRememberedPlayer,
  getRememberedPlayerOnServer,
  subscribeToRememberedPlayer,
} from '@/lib/game/remembered-player'
import { cn } from '@/lib/utils'
import { RUN_MODES, type RunDifficulty, type RunMode } from '@/lib/difficulty'
import { fetchBoard, LEADERBOARD_AVAILABLE, type BoardRow } from '@/lib/game/leaderboard'
import { TEAMS, type Team } from '@/lib/schema/question'

const DIFFICULTIES = ['easy', 'medium', 'hard', 'progressive'] as const

/**
 * The board, read from the browser.
 *
 * This was a server component querying Supabase with the secret key. On a static
 * host there is no server, so it reads `public_scores` with the publishable key
 * instead — what an anonymous visitor may see is decided by row level security
 * rather than by which key we hand out.
 */

/**
 * The top three, treated as the top three.
 *
 * A leaderboard where first place is a row of a table with a small "1" in it is
 * a spreadsheet. The podium is the one place in this app where being ahead of
 * someone is the entire point, so it gets the room.
 *
 * The medal colours are the only hues in the app that are not design system
 * tokens. That is deliberate and it is the exception, not a precedent: gold,
 * silver and bronze mean rank to everyone, and forcing them into the brand
 * palette would produce three oranges that mean nothing.
 */
const MEDALS = [
  { ring: 'border-[oklch(0.78_0.13_85)]', text: 'text-[oklch(0.78_0.13_85)]', glow: 'oklch(0.78 0.13 85 / 12%)' },
  { ring: 'border-[oklch(0.78_0.02_260)]', text: 'text-[oklch(0.78_0.02_260)]', glow: 'oklch(0.78 0.02 260 / 10%)' },
  { ring: 'border-[oklch(0.66_0.09_55)]', text: 'text-[oklch(0.66_0.09_55)]', glow: 'oklch(0.66 0.09 55 / 10%)' },
]

function Podium({ rows, you }: { rows: BoardRow[]; you: string | null }) {
  // Second, first, third — the shape of an actual podium, once there is room for
  // one. Stacked in rank order on a narrow screen, where the shape would be a lie.
  const order = rows.length === 3 ? [1, 0, 2] : rows.map((_, index) => index)

  return (
    <ol
      className="grid gap-3 sm:items-end"
      // Columns match the number of finishers, and the block narrows with them.
      // A three-column grid holding one card stretched that card across the
      // whole page, which read as a layout fault rather than as "one person has
      // played". Centred, because first place is the middle of a podium.
      style={{
        gridTemplateColumns: `repeat(${Math.min(rows.length, 3)}, minmax(0, 1fr))`,
        maxWidth: `${Math.min(rows.length, 3) * 33.34}%`,
        marginInline: 'auto',
      }}
    >
      {order.map((index, slot) => {
        const row = rows[index]
        if (!row) return null
        const medal = MEDALS[index]
        const isYou = you !== null && row.pseudo.trim().toLowerCase() === you
        return (
          <li
            key={row.pseudo}
            className={cn(
              'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex flex-col items-center gap-1 rounded-xl border p-4 text-center duration-500',
              medal.ring,
              // First place stands taller. On one column that would just be
              // padding, so it only applies once the three sit side by side.
              // First place stands taller — enough to read as a step up, which a
              // few pixels of extra padding did not.
              index === 0 ? 'sm:gap-2 sm:pt-10 sm:pb-7' : 'sm:pt-5 sm:pb-4',
              isYou && 'ring-ring/40 ring-2',
            )}
            style={{
              background: `linear-gradient(to bottom, ${medal.glow}, transparent 70%)`,
              animationDelay: `${slot * 80}ms`,
              animationFillMode: 'backwards',
            }}
          >
            <span
              className={cn(
                'font-mono font-bold tabular-nums',
                medal.text,
                index === 0 ? 'text-3xl' : 'text-2xl',
              )}
            >
              {row.position}
            </span>
            <span className={cn('w-full truncate font-semibold', index === 0 && 'text-lg')}>
              {row.pseudo}
            </span>
            <span className="text-text-tertiary text-xs">{copy.teams[row.team]}</span>
            <span
              className={cn(
                'mt-1 font-mono font-semibold tabular-nums',
                index === 0 ? 'text-2xl' : 'text-xl',
              )}
            >
              {row.bestScore}
            </span>
            <span className="text-text-tertiary text-xs">
              {copy.leaderboard.runsPlayed(row.runsPlayed)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function LeaderboardView() {
  const params = useSearchParams()

  const difficulty = (
    DIFFICULTIES.includes(params.get('difficulty') as RunDifficulty)
      ? params.get('difficulty')
      : 'progressive'
  ) as RunDifficulty
  const team = (TEAMS.includes(params.get('team') as Team) ? params.get('team') : 'all') as Team | 'all'
  const mode = (
    RUN_MODES.includes(params.get('mode') as RunMode) ? params.get('mode') : 'all'
  ) as RunMode | 'all'
  const timeWindow = params.get('window') === 'week' ? 'week' : 'all'

  // Keyed by the filters the rows were fetched for, rather than cleared to null
  // when they change. Clearing would be a setState in the effect body, which
  // cascades a render before the first has painted; comparing the key gives the
  // same loading state as a derived value.
  const filterKey = `${difficulty}/${team}/${mode}/${timeWindow}`
  const [loaded, setLoaded] = useState<{ key: string; rows: BoardRow[] } | null>(null)
  // Your own name, so you can find yourself without reading every row.
  const you = useSyncExternalStore(
    subscribeToRememberedPlayer,
    getRememberedPlayer,
    getRememberedPlayerOnServer,
  ).pseudo.trim().toLowerCase() || null
  const rows = loaded?.key === filterKey ? loaded.rows : null

  useEffect(() => {
    let live = true
    void fetchBoard({ difficulty, team, mode, window: timeWindow }).then((next) => {
      // Guarded because changing a filter fires a second read before the first
      // has landed, and the slower one must not overwrite the newer result.
      if (live) setLoaded({ key: filterKey, rows: next })
    })
    return () => {
      live = false
    }
  }, [difficulty, team, mode, timeWindow, filterKey])

  return (
    <main id="content" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:py-14">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {copy.leaderboard.title}
            <span className="text-text-tertiary font-normal">
              {' '}
              / {copy.difficulties[difficulty].name}
            </span>
          </h1>
          <p className="text-text-secondary text-sm">{copy.leaderboard.perLevelHint}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {copy.results.backHome}
        </Button>
      </div>

      <LeaderboardFilters />

      {!LEADERBOARD_AVAILABLE ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrophyIcon />
            </EmptyMedia>
            <EmptyTitle>{copy.leaderboard.unavailable}</EmptyTitle>
            <EmptyDescription>{copy.leaderboard.unavailableHint}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrophyIcon />
            </EmptyMedia>
            <EmptyTitle>{copy.leaderboard.empty}</EmptyTitle>
            <EmptyDescription>{copy.leaderboard.emptyHint}</EmptyDescription>
          </EmptyHeader>
          <Button nativeButton={false} render={<Link href="/" />}>
            {copy.home.start}
          </Button>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <Podium rows={rows.slice(0, 3)} you={you} />

          {rows.length > 3 ? (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.leaderboard.columnRank}</TableHead>
                  <TableHead>{copy.leaderboard.columnPlayer}</TableHead>
                  <TableHead>{copy.leaderboard.columnTeam}</TableHead>
                  <TableHead>{copy.leaderboard.columnScore}</TableHead>
                  <TableHead>{copy.leaderboard.columnRuns}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(3).map((row) => (
                  <TableRow
                    key={row.pseudo}
                    className={cn(
                      you !== null &&
                        row.pseudo.trim().toLowerCase() === you &&
                        'bg-ring/10 hover:bg-ring/15',
                    )}
                  >
                    <TableCell className="w-12">
                      <span
                        className={
                          row.position <= 3
                            ? 'font-mono text-sm font-semibold tabular-nums'
                            : 'text-text-tertiary font-mono text-sm tabular-nums'
                        }
                      >
                        {row.position}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{row.pseudo}</TableCell>
                    <TableCell className="text-text-tertiary">{copy.teams[row.team]}</TableCell>
                    <TableCell className="font-mono font-medium tabular-nums">
                      {row.bestScore}
                    </TableCell>
                    <TableCell className="text-text-tertiary font-mono tabular-nums">
                      {row.runsPlayed}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
          ) : null}
        </div>
      )}
    </main>
  )
}
