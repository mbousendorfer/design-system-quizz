import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { QuestionForm } from '@/components/admin/question-form'
import { Button } from '@/components/ui/button'
import type { AdminQuestionInput } from '@/lib/admin/validation'
import { copy } from '@/lib/copy'

const BLANK: AdminQuestionInput = {
  id: null,
  mode: 'name-that-component',
  difficulty: 'medium',
  status: 'draft',
  component: '',
  prompt: '',
  options: [],
  correctOptionId: null,
  explanation: '',
  docUrl: null,
  imageKey: null,
  stimulusRecipe: null,
  timerSeconds: null,
}

export default function NewQuestionPage() {
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

      <QuestionForm initial={BLANK} answered={false} plays={0} />
    </div>
  )
}
