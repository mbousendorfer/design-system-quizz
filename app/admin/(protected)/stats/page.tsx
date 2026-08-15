import Link from 'next/link'
import { BarChart3Icon, DownloadIcon, PencilIcon } from 'lucide-react'

import { ActivityChart, ModeChart } from '@/components/admin/stats-charts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { copy } from '@/lib/copy'
import {
  fetchCalibration,
  fetchComponentStats,
  fetchConfusion,
  fetchDaily,
  fetchModeStats,
  fetchOverview,
  fetchQuestionStats,
  fetchTeamStats,
} from '@/lib/stats/queries'

export const dynamic = 'force-dynamic'

const percent = (rate: number) => `${Math.round(rate * 100)}%`
const seconds = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)}s`)

export default async function StatsPage() {
  const [overview, daily, questions, confusion, components, modes, calibration, teams] =
    await Promise.all([
      fetchOverview(),
      fetchDaily(),
      fetchQuestionStats(),
      fetchConfusion(),
      fetchComponentStats(),
      fetchModeStats(),
      fetchCalibration(),
      fetchTeamStats(),
    ])

  if (overview.runsPlayed === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BarChart3Icon />
          </EmptyMedia>
          <EmptyTitle>{copy.stats.empty}</EmptyTitle>
          <EmptyDescription>{copy.stats.emptyHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{copy.stats.title}</h1>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          nativeButton={false}
          render={<a href="/api/admin/export" download />}
        >
          <DownloadIcon data-icon="inline-start" />
          {copy.stats.exportCsv}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={copy.stats.runs} value={String(overview.runsPlayed)} />
        <Metric label={copy.stats.players} value={String(overview.players)} />
        <Metric label={copy.stats.averageScore} value={String(overview.averageScore)} />
        <Metric label={copy.stats.bestScore} value={String(overview.bestScore)} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{copy.stats.overview}</TabsTrigger>
          <TabsTrigger value="questions">{copy.stats.byQuestion}</TabsTrigger>
          <TabsTrigger value="confusion">{copy.stats.confusion}</TabsTrigger>
          <TabsTrigger value="components">{copy.stats.byComponent}</TabsTrigger>
          <TabsTrigger value="modes">{copy.stats.byMode}</TabsTrigger>
          <TabsTrigger value="calibration">{copy.stats.calibration}</TabsTrigger>
          <TabsTrigger value="teams">{copy.stats.byTeam}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>{copy.stats.overTime}</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityChart points={daily} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <CardTitle>{copy.stats.byQuestion}</CardTitle>
              <CardDescription>{copy.stats.byQuestionHint}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.questions.columnPrompt}</TableHead>
                    <TableHead>{copy.questions.columnDifficulty}</TableHead>
                    <TableHead>{copy.stats.successRate}</TableHead>
                    <TableHead>{copy.stats.medianTime}</TableHead>
                    <TableHead>{copy.stats.plays}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((question) => (
                    <TableRow key={`${question.id}:${question.version}`}>
                      <TableCell className="max-w-md whitespace-normal">
                        <Link
                          href={`/admin/questions/${question.id}/edit`}
                          className="flex flex-col gap-1 hover:underline"
                        >
                          <span className="line-clamp-2">{question.prompt}</span>
                          <span className="text-xs text-muted-foreground">{question.component}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {copy.difficulties[question.difficulty].name}
                        </Badge>
                      </TableCell>
                      <TableCell>{percent(question.successRate)}</TableCell>
                      <TableCell>{seconds(question.medianTimeMs)}</TableCell>
                      <TableCell className="text-muted-foreground">{question.plays}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="confusion">
          <Card>
            <CardHeader>
              <CardTitle>{copy.stats.confusion}</CardTitle>
              <CardDescription>{copy.stats.confusionHint}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {confusion.length === 0 ? (
                <p className="text-sm text-muted-foreground">{copy.stats.noConfusionYet}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{copy.stats.expected}</TableHead>
                      <TableHead>{copy.stats.chosenInstead}</TableHead>
                      <TableHead>{copy.stats.shareOfErrors}</TableHead>
                      <TableHead>{copy.stats.occurrences}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {confusion.map((entry) => (
                      <TableRow key={`${entry.expected}:${entry.chosen}`}>
                        <TableCell>{entry.expected}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{entry.chosen}</Badge>
                        </TableCell>
                        <TableCell>{percent(entry.share)}</TableCell>
                        <TableCell className="text-muted-foreground">{entry.occurrences}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components">
          <Card>
            <CardHeader>
              <CardTitle>{copy.stats.byComponent}</CardTitle>
              <CardDescription>{copy.stats.byComponentHint}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.questions.filterComponent}</TableHead>
                    <TableHead>{copy.stats.successRate}</TableHead>
                    <TableHead>{copy.stats.plays}</TableHead>
                    <TableHead>{copy.stats.questionCount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {components.map((component) => (
                    <TableRow key={component.component}>
                      <TableCell>{component.component}</TableCell>
                      <TableCell>{percent(component.successRate)}</TableCell>
                      <TableCell className="text-muted-foreground">{component.plays}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {component.questionCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modes">
          <Card>
            <CardHeader>
              <CardTitle>{copy.stats.byMode}</CardTitle>
              <CardDescription>{copy.stats.byModeHint}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <ModeChart stats={modes} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.questions.columnMode}</TableHead>
                    <TableHead>{copy.questions.columnDifficulty}</TableHead>
                    <TableHead>{copy.stats.successRate}</TableHead>
                    <TableHead>{copy.stats.medianTime}</TableHead>
                    <TableHead>{copy.stats.plays}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modes.map((stat) => (
                    <TableRow key={`${stat.mode}:${stat.difficulty}`}>
                      <TableCell>{copy.modes[stat.mode].name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{copy.difficulties[stat.difficulty].name}</Badge>
                      </TableCell>
                      <TableCell>{percent(stat.successRate)}</TableCell>
                      <TableCell>{seconds(stat.medianTimeMs)}</TableCell>
                      <TableCell className="text-muted-foreground">{stat.plays}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calibration">
          <Card>
            <CardHeader>
              <CardTitle>{copy.stats.calibration}</CardTitle>
              <CardDescription>{copy.stats.calibrationHint}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {calibration.length === 0 ? (
                <p className="text-sm text-muted-foreground">{copy.stats.calibrationClear}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{copy.questions.columnPrompt}</TableHead>
                      <TableHead>{copy.stats.declaredLevel}</TableHead>
                      <TableHead>{copy.stats.successRate}</TableHead>
                      <TableHead>{copy.stats.suggestedLevel}</TableHead>
                      <TableHead>{copy.stats.plays}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calibration.map((entry) => (
                      <TableRow key={`${entry.id}:${entry.version}`}>
                        <TableCell className="max-w-md whitespace-normal">
                          <span className="line-clamp-2">{entry.prompt}</span>
                          <span className="text-xs text-muted-foreground">{entry.component}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{copy.difficulties[entry.declared].name}</Badge>
                        </TableCell>
                        <TableCell>{percent(entry.successRate)}</TableCell>
                        <TableCell>
                          <Badge variant="default">
                            {copy.difficulties[entry.suggested].name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{entry.plays}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            nativeButton={false}
                            render={<Link href={`/admin/questions/${entry.id}/edit`} />}
                          >
                            <PencilIcon data-icon="inline-start" />
                            {copy.questions.edit}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams">
          <Card>
            <CardHeader>
              <CardTitle>{copy.stats.byTeam}</CardTitle>
              <CardDescription>{copy.stats.byTeamHint}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.leaderboard.columnTeam}</TableHead>
                    <TableHead>{copy.questions.columnDifficulty}</TableHead>
                    <TableHead>{copy.stats.successRate}</TableHead>
                    <TableHead>{copy.stats.plays}</TableHead>
                    <TableHead>{copy.stats.players}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((stat) => (
                    <TableRow key={`${stat.team}:${stat.difficulty}`}>
                      <TableCell>{copy.teams[stat.team]}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{copy.difficulties[stat.difficulty].name}</Badge>
                      </TableCell>
                      <TableCell>{percent(stat.successRate)}</TableCell>
                      <TableCell className="text-muted-foreground">{stat.plays}</TableCell>
                      <TableCell className="text-muted-foreground">{stat.players}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}
