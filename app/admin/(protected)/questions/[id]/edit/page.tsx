import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'

import { QuestionForm } from '@/components/admin/question-form'
import { Button } from '@/components/ui/button'
import { loadQuestion } from '@/lib/admin/repository'
import { copy } from '@/lib/copy'

export const dynamic = 'force-dynamic'

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const question = await loadQuestion(id)
  if (!question) notFound()

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        nativeButton={false}
        render={<Link href="/admin/questions" />}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        {copy.questions.form.backToList}
      </Button>

      <QuestionForm
        initial={{
          id: question.id,
          mode: question.mode,
          difficulty: question.difficulty,
          status: question.status,
          component: question.component,
          prompt: question.prompt,
          options: question.options,
          correctOptionId: question.correctOptionId,
          explanation: question.explanation,
          docUrl: question.docUrl,
          imageKey: question.imageKey,
          stimulusRecipe: question.stimulusRecipe,
          timerSeconds: question.timerSeconds,
        }}
        // Editing what was judged now cuts a new version, and the form says so
        // before anything is typed rather than after it is saved.
        answered={question.answered}
        plays={question.plays}
      />
    </div>
  )
}
