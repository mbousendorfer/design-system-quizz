'use client'

import { useState, useTransition } from 'react'
import { BookTextIcon } from 'lucide-react'

import { Alert, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { suggestDescriptionsAction } from '@/lib/admin/actions'
import type { DescriptionCandidate } from '@/lib/admin/descriptions'
import { copy } from '@/lib/copy'
import type { Difficulty } from '@/lib/difficulty'

/**
 * Candidate prompts lifted from the design guidelines, with the component names
 * redacted, for the author to pick one and edit it.
 *
 * Never fills the prompt on its own. Silently overwriting something someone typed
 * is the surest way to make them stop pressing the button.
 */
export function DescriptionPicker({
  component,
  onPick,
}: {
  component: string
  onPick: (text: string, difficulty: Difficulty) => void
}) {
  const [candidates, setCandidates] = useState<DescriptionCandidate[] | null>(null)
  const [pending, startTransition] = useTransition()

  if (!component) {
    return <FieldDescription>{copy.questions.form.pickComponentFirst}</FieldDescription>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await suggestDescriptionsAction(component)
              setCandidates(result.ok ? result.data.candidates : [])
            })
          }
        >
          <BookTextIcon data-icon="inline-start" />
          {copy.questions.form.fillFromGuidelines}
        </Button>
        <FieldDescription>{copy.questions.form.fillFromGuidelinesHint}</FieldDescription>
      </div>

      {candidates?.length === 0 ? (
        <Alert>
          <AlertTitle>{copy.questions.form.noDescriptionFor(component)}</AlertTitle>
        </Alert>
      ) : null}

      {candidates && candidates.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          {candidates.map((candidate, index) => (
            <div key={candidate.tier} className="flex flex-col gap-2">
              {index > 0 ? <Separator /> : null}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{candidate.tier}</Badge>
                <Badge variant="outline">
                  {copy.difficulties[candidate.suggestedDifficulty].name}
                </Badge>
                {/* A thirty-character description does not identify one component,
                    so say so rather than letting it look publishable. */}
                {candidate.status === 'thin' ? (
                  <Badge variant="destructive">{copy.questions.form.descriptionThin}</Badge>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => onPick(candidate.text, candidate.suggestedDifficulty)}
                >
                  {copy.questions.form.useThisDescription}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{candidate.text}</p>
            </div>
          ))}
          <FieldDescription>{copy.questions.form.descriptionEditHint}</FieldDescription>
        </div>
      ) : null}
    </div>
  )
}
