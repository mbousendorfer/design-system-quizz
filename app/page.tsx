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
      {/* A staggered reveal on load. One orchestrated entrance is worth more
          than a dozen scattered micro-interactions, and it is the only place
          this screen moves at all. */}
      <header className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex items-start justify-between gap-4 duration-500">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {copy.home.title}
          </h1>
          <p className="text-text-secondary text-base text-balance sm:text-lg">
            {copy.home.subtitle}
          </p>
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

      <Card
        className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 duration-500"
        // A beat after the title, so the screen assembles rather than appearing.
        style={{ animationDelay: '90ms', animationFillMode: 'backwards' }}
      >
        <CardContent>
          <StartForm />
        </CardContent>
      </Card>
    </main>
  )
}
