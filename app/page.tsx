import Link from 'next/link'
import { TrophyIcon } from 'lucide-react'

import { StartForm } from '@/components/game/start-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { copy } from '@/lib/copy'

export default function HomePage() {
  return (
    <main id="content" className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10 sm:py-16">
      {/* CardTitle renders a div, so the visible title is not a heading. */}
      <h1 className="sr-only">{copy.home.title}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{copy.home.title}</CardTitle>
          <CardDescription>{copy.home.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <StartForm />
        </CardContent>
      </Card>

      <Button
        variant="ghost"
        className="self-center"
        nativeButton={false}
        render={<Link href="/leaderboard" />}
      >
        <TrophyIcon data-icon="inline-start" />
        {copy.home.seeLeaderboard}
      </Button>
    </main>
  )
}
