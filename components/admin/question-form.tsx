'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { PlusIcon, SparklesIcon, TrashIcon } from 'lucide-react'

import { ComponentCombobox } from '@/components/admin/component-combobox'
import { ShotDropzone } from '@/components/admin/shot-dropzone'
import { ChoiceGroup } from '@/components/game/choice-group'
import { QuestionOptions, QuestionPrompt } from '@/components/game/question-view'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { saveQuestionAction } from '@/lib/admin/actions'
import type { AdminQuestionInput } from '@/lib/admin/validation'
import {
  distractorsAvailableInCategory,
  docUrlFor,
  getComponent,
  suggestDistractors,
} from '@/lib/catalog'
import { copy } from '@/lib/copy'
import {
  DIFFICULTIES,
  DIFFICULTY_RULES,
  MODES,
  hasImageOptions,
  timerSecondsFor,
  type Difficulty,
  type Mode,
} from '@/lib/difficulty'
import { buildPlayerQuestion, type StoredOption } from '@/lib/schema/question'

const MODE_CHOICES = MODES.map((mode) => ({ value: mode, label: copy.modes[mode].name }))
const DIFFICULTY_CHOICES = DIFFICULTIES.map((difficulty) => ({
  value: difficulty,
  label: copy.difficulties[difficulty].name,
}))

/** Ids are letters and never shift, so removing an option cannot silently move the answer. */
const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

function nextOptionId(options: StoredOption[]): string {
  const used = new Set(options.map((option) => option.id))
  return OPTION_IDS.find((id) => !used.has(id)) ?? `x${options.length}`
}

export function QuestionForm({
  initial,
  answered,
  plays,
}: {
  initial: AdminQuestionInput
  answered: boolean
  plays: number
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<AdminQuestionInput>(initial)
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [pending, startTransition] = useTransition()

  const patch = (changes: Partial<AdminQuestionInput>) =>
    setDraft((current) => ({ ...current, ...changes }))

  /**
   * Picking a component fills the documentation link, unless the author typed their
   * own. Comparing against the previous component's derived URL is what tells a
   * stale auto-fill apart from a deliberate one, so a hand-typed link is never
   * clobbered by changing the component.
   */
  function changeComponent(component: string) {
    const derived = docUrlFor(component)
    const wasAutoFilled = !draft.docUrl || draft.docUrl === docUrlFor(draft.component)
    patch({ component, ...(wasAutoFilled ? { docUrl: derived } : {}) })
  }

  const images = hasImageOptions(draft.mode)

  /**
   * Switching between a mode whose options are component names and one whose
   * options are screenshots makes the existing options meaningless, so they go.
   * Switching within a family keeps them.
   */
  function changeMode(mode: Mode) {
    const wasImages = hasImageOptions(draft.mode)
    if (wasImages === hasImageOptions(mode)) {
      patch({ mode })
      return
    }
    patch({ mode, options: [], correctOptionId: null, imageKey: null })
  }

  function updateOption(id: string, changes: Partial<StoredOption>) {
    patch({
      options: draft.options.map((option) => (option.id === id ? { ...option, ...changes } : option)),
    })
  }

  function addOption() {
    if (draft.options.length >= 6) return
    patch({ options: [...draft.options, { id: nextOptionId(draft.options) }] })
  }

  function removeOption(id: string) {
    patch({
      options: draft.options.filter((option) => option.id !== id),
      correctOptionId: draft.correctOptionId === id ? null : draft.correctOptionId,
    })
  }

  /**
   * The accelerator for writing. Without it every question means stopping to think
   * up plausible wrong answers, which is the slowest part of the job.
   */
  function suggest() {
    const answer = draft.component
    if (!answer) {
      setErrors([copy.questions.form.pickComponentFirst])
      return
    }

    let options = [...draft.options]
    let correctOptionId = draft.correctOptionId

    if (!options.some((option) => option.component === answer)) {
      const id = nextOptionId(options)
      options = [...options, { id, component: answer }]
      correctOptionId = id
    } else if (!correctOptionId) {
      correctOptionId = options.find((option) => option.component === answer)?.id ?? null
    }

    const target = DIFFICULTY_RULES[draft.difficulty].optionCount
    const taken = options.map((option) => option.component).filter(Boolean) as string[]

    for (const name of suggestDistractors(answer, Math.max(0, target - options.length), taken)) {
      options = [...options, { id: nextOptionId(options), component: name }]
    }

    setErrors([])
    patch({ options, correctOptionId })
  }

  function save(status: 'draft' | 'published') {
    setErrors([])
    setWarnings([])
    startTransition(async () => {
      const result = await saveQuestionAction({ ...draft, status })

      if (!result.ok) {
        setErrors(result.errors)
        return
      }

      setWarnings(result.data.warnings)

      toast.add({
        title: result.data.createdNewVersion
          ? copy.questions.versionCut(result.data.version)
          : copy.questions.savedInPlace,
        type: 'success',
      })

      if (!draft.id) router.replace(`/admin/questions/${result.data.id}/edit`)
      else router.refresh()
    })
  }

  // Rendered through the very same components the game uses, so the preview
  // cannot drift from what a player will actually see.
  const preview = useMemo(
    () =>
      buildPlayerQuestion(
        {
          mode: draft.mode,
          difficulty: draft.difficulty,
          prompt: draft.prompt || copy.questions.form.promptLabel,
          imageKey: draft.imageKey,
          component: draft.component || null,
          // Half-filled options are dropped from the preview rather than rendered
          // as empty boxes.
          options: draft.options.filter((option) => option.component || option.imageKey),
          timerSeconds: timerSecondsFor(draft.difficulty, draft.timerSeconds),
        },
        { runId: 'preview', position: 1 },
      ),
    [draft],
  )

  const categorySize = draft.component ? distractorsAvailableInCategory(draft.component) : 0
  const category = draft.component ? getComponent(draft.component)?.category : null

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="flex flex-col gap-6">
        {answered ? (
          <Alert>
            <AlertTitle>{copy.questions.form.versionNotice}</AlertTitle>
            <AlertDescription>
              {copy.questions.form.versionNoticeSafe} {copy.questions.form.playsSoFar(plays)}
            </AlertDescription>
          </Alert>
        ) : null}

        {errors.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>{copy.questions.publishRefused}</AlertTitle>
            <AlertDescription>
              <ul className="flex flex-col gap-1">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Advice on a save that already succeeded, so the default variant rather
            than destructive — nothing here needs fixing before moving on. */}
        {warnings.length > 0 ? (
          <Alert>
            <AlertTitle>{copy.questions.warningsTitle}</AlertTitle>
            <AlertDescription>
              <ul className="flex flex-col gap-1">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{draft.id ? copy.questions.form.editTitle : copy.questions.form.newTitle}</CardTitle>
            <CardDescription>{copy.questions.form.modeHint}</CardDescription>
          </CardHeader>

          <CardContent>
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">{copy.questions.form.modeLabel}</FieldLegend>
                <ChoiceGroup
                  label={copy.questions.form.modeLabel}
                  value={draft.mode}
                  onChange={changeMode}
                  choices={MODE_CHOICES}
                />
                <FieldDescription>{copy.modes[draft.mode].help}</FieldDescription>
              </FieldSet>

              <Field>
                <FieldLabel htmlFor="component">{copy.questions.form.componentLabel}</FieldLabel>
                <ComponentCombobox
                  id="component"
                  value={draft.component}
                  onChange={changeComponent}
                />
                <FieldDescription>{copy.questions.form.componentHint}</FieldDescription>
              </Field>

              <FieldSet>
                <FieldLegend variant="label">{copy.questions.form.difficultyLabel}</FieldLegend>
                <ChoiceGroup
                  label={copy.questions.form.difficultyLabel}
                  value={draft.difficulty}
                  onChange={(difficulty: Difficulty) => patch({ difficulty })}
                  choices={DIFFICULTY_CHOICES}
                />
                <FieldDescription>{copy.questions.form.difficultyHint}</FieldDescription>
              </FieldSet>

              <Field>
                <FieldLabel htmlFor="prompt">{copy.questions.form.promptLabel}</FieldLabel>
                <Textarea
                  id="prompt"
                  rows={3}
                  maxLength={400}
                  value={draft.prompt}
                  onChange={(event) => patch({ prompt: event.target.value })}
                />
              </Field>

              {draft.mode === 'name-that-component' ? (
                <Field>
                  <FieldLabel>{copy.questions.form.imageLabel}</FieldLabel>
                  <ShotDropzone
                    imageKey={draft.imageKey}
                    label={copy.questions.form.imageLabel}
                    onChange={(imageKey) => patch({ imageKey })}
                  />
                </Field>
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.questions.form.optionsLabel}</CardTitle>
            <CardDescription>{copy.questions.form.optionsForMode[draft.mode]}</CardDescription>
          </CardHeader>

          <CardContent>
            <FieldGroup>
              {draft.options.length === 0 ? (
                <FieldDescription>{copy.questions.form.noOptionsYet}</FieldDescription>
              ) : null}

              {draft.options.map((option, index) => (
                <Field key={option.id}>
                  <FieldLabel htmlFor={`option-${option.id}`}>
                    {copy.questions.form.optionNumber(index + 1)}
                  </FieldLabel>

                  {images ? (
                    <ShotDropzone
                      imageKey={option.imageKey ?? null}
                      label={copy.questions.form.optionNumber(index + 1)}
                      onChange={(imageKey) => updateOption(option.id, { imageKey: imageKey ?? undefined })}
                    />
                  ) : (
                    <ComponentCombobox
                      id={`option-${option.id}`}
                      value={option.component ?? ''}
                      onChange={(component) => updateOption(option.id, { component })}
                    />
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => removeOption(option.id)}
                  >
                    <TrashIcon data-icon="inline-start" />
                    {copy.questions.form.removeOption}
                  </Button>
                </Field>
              ))}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={draft.options.length >= 6}
                  onClick={addOption}
                >
                  <PlusIcon data-icon="inline-start" />
                  {copy.questions.form.addOption}
                </Button>

                {!images ? (
                  <Button type="button" variant="outline" size="sm" onClick={suggest}>
                    <SparklesIcon data-icon="inline-start" />
                    {copy.questions.form.suggestDistractors}
                  </Button>
                ) : null}
              </div>

              {!images ? (
                <FieldDescription>{copy.questions.form.suggestHint}</FieldDescription>
              ) : null}

              {/* The `actions` category holds five components in total, so a
                  six-option hard question there cannot be filled from it alone.
                  Better to say so than to quietly return too few. */}
              {category && categorySize < DIFFICULTY_RULES[draft.difficulty].optionCount - 1 ? (
                <Alert>
                  <AlertTitle>
                    {copy.questions.form.categoryTooSmall(category, categorySize)}
                  </AlertTitle>
                </Alert>
              ) : null}

              <FieldSet>
                <FieldLegend variant="label">{copy.questions.form.correctLabel}</FieldLegend>
                {draft.options.length > 0 ? (
                  <ChoiceGroup
                    label={copy.questions.form.correctLabel}
                    value={draft.correctOptionId ?? ''}
                    onChange={(correctOptionId) => patch({ correctOptionId })}
                    choices={draft.options.map((option, index) => ({
                      value: option.id,
                      label: option.component ?? copy.questions.form.optionNumber(index + 1),
                    }))}
                  />
                ) : (
                  <FieldDescription>{copy.questions.form.noOptionsYet}</FieldDescription>
                )}
              </FieldSet>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.questions.form.explanationLabel}</CardTitle>
            <CardDescription>{copy.questions.form.explanationHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="explanation">{copy.questions.form.explanationLabel}</FieldLabel>
                <Textarea
                  id="explanation"
                  rows={5}
                  maxLength={1000}
                  value={draft.explanation}
                  onChange={(event) => patch({ explanation: event.target.value })}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="docUrl">{copy.questions.form.docUrlLabel}</FieldLabel>
                <Input
                  id="docUrl"
                  type="url"
                  value={draft.docUrl ?? ''}
                  onChange={(event) => patch({ docUrl: event.target.value || null })}
                />
                <FieldDescription>{copy.questions.form.docUrlHint}</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="timer">{copy.questions.form.timerLabel}</FieldLabel>
                <Input
                  id="timer"
                  type="number"
                  min={5}
                  max={120}
                  value={draft.timerSeconds ?? ''}
                  onChange={(event) =>
                    patch({ timerSeconds: event.target.value ? Number(event.target.value) : null })
                  }
                />
                <FieldDescription>
                  {copy.questions.form.timerHint(DIFFICULTY_RULES[draft.difficulty].timerSeconds)}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => save('draft')}>
            {copy.questions.form.saveDraft}
          </Button>
          <Button type="button" disabled={pending} onClick={() => save('published')}>
            {copy.questions.form.savePublished}
          </Button>
        </div>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>{copy.questions.form.previewTitle}</CardTitle>
            <CardDescription>{copy.questions.form.previewHint}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <QuestionPrompt question={preview} />
            <QuestionOptions
              question={preview}
              chosen={null}
              verdict={null}
              onChoose={() => {}}
              disabled
            />
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {timerSecondsFor(draft.difficulty, draft.timerSeconds)}s
              </Badge>
              <Badge variant="ghost">
                {draft.status === 'published'
                  ? copy.questions.form.publishedBadge
                  : copy.questions.form.draftBadge}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
