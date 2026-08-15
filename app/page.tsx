import { StartForm } from '@/components/game/start-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { copy } from '@/lib/copy'

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10 sm:py-16">
      <Card>
        <CardHeader>
          <CardTitle>{copy.home.title}</CardTitle>
          <CardDescription>{copy.home.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <StartForm />
        </CardContent>
      </Card>
    </main>
  )
}
