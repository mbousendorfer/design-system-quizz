import Link from 'next/link'
import { FileQuestionIcon, PlusIcon } from 'lucide-react'

import { QuestionFilters } from '@/components/admin/question-filters'
import { QuestionRowActions } from '@/components/admin/question-row-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listQuestions, usedComponents, type QuestionWithStats } from '@/lib/admin/repository'
import { copy } from '@/lib/copy'
import type { Mode } from '@/lib/difficulty'
import type { Status } from '@/lib/schema/question'

export const dynamic = 'force-dynamic'

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; status?: string; component?: string; search?: string }>
}) {
  const filters = await searchParams

  const [questions, components] = await Promise.all([
    listQuestions({
      mode: filters.mode as Mode | 'all' | undefined,
      status: filters.status as Status | 'all' | undefined,
      component: filters.component,
      search: filters.search,
    }),
    usedComponents(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{copy.questions.title}</h1>
        <Button className="ml-auto" nativeButton={false} render={<Link href="/admin/questions/new" />}>
          <PlusIcon data-icon="inline-start" />
          {copy.questions.create}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{copy.questions.filtersTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionFilters components={components} />
        </CardContent>
      </Card>

      {questions.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileQuestionIcon />
            </EmptyMedia>
            <EmptyTitle>{copy.questions.empty}</EmptyTitle>
            <EmptyDescription>{copy.questions.emptyHint}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.questions.columnPrompt}</TableHead>
                <TableHead>{copy.questions.columnMode}</TableHead>
                <TableHead>{copy.questions.columnDifficulty}</TableHead>
                <TableHead>{copy.questions.columnStatus}</TableHead>
                <TableHead>{copy.questions.columnSuccess}</TableHead>
                <TableHead>{copy.questions.columnPlays}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((question) => (
                <QuestionRow key={`${question.id}:${question.version}`} question={question} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function QuestionRow({ question }: { question: QuestionWithStats }) {
  return (
    <TableRow>
      {/* TableCell is nowrap by default, which is right for the short columns and
          wrong for the prompt — it would clip mid-sentence instead of wrapping. */}
      <TableCell className="max-w-md whitespace-normal">
        <Link
          href={`/admin/questions/${question.id}/edit`}
          className="flex flex-col gap-1 hover:underline"
        >
          <span className="line-clamp-2">{question.prompt || copy.questions.untitled}</span>
          <span className="text-xs text-muted-foreground">{question.component}</span>
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{copy.modes[question.mode].name}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{copy.difficulties[question.difficulty].name}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={question.status === 'published' ? 'default' : 'ghost'}>
          {question.status}
        </Badge>
      </TableCell>
      <TableCell>
        {/* A success rate under ten plays is noise. Saying so beats printing a
            number nobody should act on. */}
        {question.successRate === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className={question.plays < 10 ? 'text-muted-foreground' : undefined}>
            {Math.round(question.successRate * 100)}%
          </span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{question.plays}</TableCell>
      <TableCell className="text-right">
        <QuestionRowActions
          id={question.id}
          version={question.version}
          status={question.status}
        />
      </TableCell>
    </TableRow>
  )
}
