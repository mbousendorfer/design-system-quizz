'use client'

import { useEffect, useState } from 'react'
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
                {rows.map((row) => (
                  <TableRow key={row.pseudo}>
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
      )}
    </main>
  )
}
