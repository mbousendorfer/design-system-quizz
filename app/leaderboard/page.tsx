import Link from 'next/link'
import { ArrowLeftIcon, TrophyIcon } from 'lucide-react'

import { LeaderboardFilters } from '@/components/game/leaderboard-filters'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { copy } from '@/lib/copy'
import { RUN_DIFFICULTIES, RUN_MODES, type RunDifficulty, type RunMode } from '@/lib/difficulty'
import { TEAMS, type Team } from '@/lib/schema/question'
import { fetchLeaderboard } from '@/lib/stats/leaderboard'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ difficulty?: string; team?: string; mode?: string; window?: string }>
}) {
  const params = await searchParams

  // The board defaults to the level the player just finished, handed over in the
  // link from the results screen.
  const difficulty = (
    RUN_DIFFICULTIES.includes(params.difficulty as RunDifficulty) ? params.difficulty : 'progressive'
  ) as RunDifficulty

  const team = (TEAMS.includes(params.team as Team) ? params.team : 'all') as Team | 'all'
  const mode = (RUN_MODES.includes(params.mode as RunMode) ? params.mode : 'all') as RunMode | 'all'
  const timeWindow = params.window === 'week' ? 'week' : 'all'

  const rows = await fetchLeaderboard({ difficulty, team, mode, window: timeWindow })

  return (
    <main id="content" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:py-14">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {copy.leaderboard.title}
            {/* The level was the card title over the filters, which put the
                subject of the page inside the controls that narrow it. */}
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

      {/* Filters are a toolbar, not a section. They used to sit in a Card with
          its own title and description, which made the controls that narrow the
          board heavier than the board itself. */}
      <LeaderboardFilters />

      {rows.length === 0 ? (
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
                <TableRow key={row.playerId}>
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
                  {/* The column people actually scan, so it is set in figures
                      that line up rather than in the body face. */}
                  <TableCell className="font-mono font-medium tabular-nums">{row.bestScore}</TableCell>
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
