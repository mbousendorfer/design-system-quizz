import Link from 'next/link'
import { ArrowLeftIcon, TrophyIcon } from 'lucide-react'

import { LeaderboardFilters } from '@/components/game/leaderboard-filters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{copy.leaderboard.title}</h1>
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

      <Card>
        <CardHeader>
          <CardTitle>{copy.difficulties[difficulty].name}</CardTitle>
          <CardDescription>{copy.leaderboard.perLevelHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <LeaderboardFilters />
        </CardContent>
      </Card>

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
                  <TableCell>
                    <Badge variant={row.position <= 3 ? 'default' : 'ghost'}>{row.position}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.pseudo}</TableCell>
                  <TableCell className="text-muted-foreground">{copy.teams[row.team]}</TableCell>
                  <TableCell>{row.bestScore}</TableCell>
                  <TableCell className="text-muted-foreground">{row.runsPlayed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  )
}
