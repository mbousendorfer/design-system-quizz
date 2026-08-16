import Link from 'next/link'
import { TrophyIcon } from 'lucide-react'

import { StartForm } from '@/components/game/start-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { copy } from '@/lib/copy'

/**
 * The start line.
 *
 * It used to be a single card in which the name field, the team select, the mode
 * picker and the difficulty picker all carried identical weight — which made the
 * page read as a settings form rather than as the thing you press to begin.
 *
 * The title now sits on the wall rather than inside a card, at a size that says
 * this is a game; the two real decisions get the card and the room; and the
 * leaderboard moves up beside the title instead of floating alone underneath,
 * where it looked like an afterthought.
 */
export default function HomePage() {
  return (
    <main
      id="content"
      // Vertically centred, because this is a title screen and a title screen
      // that clings to the top of a tall window looks like it failed to load.
      // `svh` rather than `vh` so mobile browser chrome does not push it off.
      className="mx-auto flex min-h-[100svh] w-full max-w-xl flex-col justify-center gap-8 px-4 py-12"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{copy.home.title}</h1>
          <p className="text-text-secondary text-balance">{copy.home.subtitle}</p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          nativeButton={false}
          render={<Link href="/leaderboard" />}
        >
          <TrophyIcon data-icon="inline-start" />
          {copy.home.seeLeaderboard}
        </Button>
      </header>

      <Card>
        <CardContent>
          <StartForm />
        </CardContent>
      </Card>
    </main>
  )
}
