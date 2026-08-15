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
  return (
    <ChartContainer config={activityConfig} className="min-h-[220px] w-full">
      <LineChart data={points} accessibilityLayer margin={{ left: 4, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line type="monotone" dataKey="runsPlayed" stroke="var(--color-runsPlayed)" dot={false} />
        <Line type="monotone" dataKey="players" stroke="var(--color-players)" dot={false} />
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
    <ChartContainer config={modeConfig} className="min-h-[220px] w-full">
      <BarChart data={data} accessibilityLayer margin={{ left: 4, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="mode" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="successRate" fill="var(--color-successRate)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
