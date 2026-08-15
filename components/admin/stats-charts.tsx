'use client'

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { copy } from '@/lib/copy'
import type { DailyPoint, ModeStat } from '@/lib/stats/queries'

/**
 * The only two charts on the page.
 *
 * Both read from already-aggregated rows: the server hands over one point per
 * day and one bar per mode, never the answer-by-answer history.
 */

const activityConfig = {
  runsPlayed: { label: 'Runs', color: 'var(--chart-1)' },
  players: { label: 'Players', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function ActivityChart({ points }: { points: DailyPoint[] }) {
  // A line through one point is not a trend, it is a dot on an empty grid. Until
  // there are two days to compare, the number says more than the chart would.
  if (points.length < 2) {
    const only = points[0]
    return (
      <p className="text-sm text-muted-foreground">
        {only
          ? copy.stats.singleDay(only.day, only.runsPlayed, only.players)
          : copy.stats.emptyHint}
      </p>
    )
  }

  return (
    // `aspect-auto` first: ChartContainer ships with `aspect-video`, which at full
    // width makes a 700px-tall chart whose bars fall below the fold.
    <ChartContainer config={activityConfig} className="aspect-auto h-[260px] w-full">
      <LineChart data={points} accessibilityLayer margin={{ left: 4, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {/* Animation off: these charts live inside tabs, so they mount hidden.
            Recharts starts its enter animation from zero and never finishes it
            for a chart that was not visible, leaving empty shapes behind. */}
        <Line
          type="monotone"
          dataKey="runsPlayed"
          stroke="var(--color-runsPlayed)"
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="players"
          stroke="var(--color-players)"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

const modeConfig = {
  successRate: { label: 'Success rate', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function ModeChart({ stats }: { stats: ModeStat[] }) {
  // One bar per mode, averaged across levels and weighted by how often each was
  // actually played — the point is which mode is hardest, not which level is.
  const byMode = new Map<string, { plays: number; correct: number }>()
  for (const stat of stats) {
    const current = byMode.get(stat.mode) ?? { plays: 0, correct: 0 }
    current.plays += stat.plays
    current.correct += Math.round(stat.successRate * stat.plays)
    byMode.set(stat.mode, current)
  }

  const data = [...byMode.entries()].map(([mode, totals]) => ({
    mode: copy.modes[mode as keyof typeof copy.modes].name,
    successRate: totals.plays > 0 ? Math.round((totals.correct / totals.plays) * 100) : 0,
    plays: totals.plays,
  }))

  return (
    <ChartContainer config={modeConfig} className="aspect-auto h-[260px] w-full">
      <BarChart data={data} accessibilityLayer margin={{ left: 4, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="mode" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey="successRate"
          fill="var(--color-successRate)"
          radius={4}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  )
}
