import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The stats page runs eight aggregate queries before it can render anything, so
 * it is the one place in the app where a blank pause is long enough to notice.
 */
export default function StatsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-24" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((slot) => (
          <Card key={slot}>
            <CardHeader className="gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-12" />
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((slot) => (
            <Skeleton key={slot} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
