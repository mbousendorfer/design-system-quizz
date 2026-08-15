'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CheckCircle2Icon, ClipboardIcon, UploadIcon, XCircleIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { commitImportAction, previewImportAction } from '@/lib/admin/actions'
import { IMPORT_COLUMNS, type ImportReport } from '@/lib/admin/import'
import { copy } from '@/lib/copy'

const TEMPLATE = [
  IMPORT_COLUMNS.join(','),
  [
    'which-component',
    'medium',
    'Infobox',
    '"A plan limit needs explaining, with a heading and an Upgrade button."',
    '"Infobox takes a title, an action button and a closable flag; Notification only exposes a type."',
    // A real deep link, so the template teaches the right shape rather than the
    // homepage every seeded question used to point at.
    'https://design.agorapulse.com/?path=/docs/feedback-infobox--docs',
    '',
    '',
    'Snackbars Thread',
    'Notification',
    'Infobox',
    'Tooltip',
    '',
    '',
    '3',
    'published',
  ].join(','),
].join('\n')

export function ImportPanel() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [report, setReport] = useState<ImportReport | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [pending, startTransition] = useTransition()

  function check() {
    setErrors([])
    startTransition(async () => {
      const result = await previewImportAction(text)
      if (result.ok) setReport(result.data)
      else setErrors(result.errors)
    })
  }

  function commit() {
    setErrors([])
    startTransition(async () => {
      const result = await commitImportAction(text)
      if (!result.ok) {
        setErrors(result.errors)
        return
      }
      toast.add({ title: copy.questions.import.imported(result.data.imported), type: 'success' })
      setText('')
      setReport(null)
      router.push('/admin/questions')
    })
  }

  const ready = report !== null && report.validCount > 0 && report.invalidCount === 0

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{copy.questions.import.title}</CardTitle>
          <CardDescription>{copy.questions.import.hint}</CardDescription>
        </CardHeader>

        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rows">{copy.questions.import.pasteLabel}</FieldLabel>
              <Textarea
                id="rows"
                rows={10}
                value={text}
                className="font-mono text-xs"
                onChange={(event) => {
                  setText(event.target.value)
                  // The report describes the text it was run on, so it stops
                  // being true the moment the text changes.
                  setReport(null)
                }}
              />
              <FieldDescription>{copy.questions.import.columnsHint}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>{copy.questions.import.columnsTitle}</FieldLabel>
              <code className="block overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                {IMPORT_COLUMNS.join(', ')}
              </code>
              <FieldDescription>{copy.questions.import.correctHint}</FieldDescription>
              <FieldDescription>{copy.questions.import.statusHint}</FieldDescription>
              <FieldDescription>{copy.questions.import.imagesSeparate}</FieldDescription>
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={pending || !text.trim()} onClick={check}>
                {copy.questions.import.preview}
              </Button>
              <Button type="button" disabled={pending || !ready} onClick={commit}>
                <UploadIcon data-icon="inline-start" />
                {copy.questions.import.commit(report?.validCount ?? 0)}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setText(TEMPLATE)
                  setReport(null)
                  toast.add({ title: copy.questions.import.templateCopied, type: 'info' })
                }}
              >
                <ClipboardIcon data-icon="inline-start" />
                {copy.questions.import.copyTemplate}
              </Button>
            </div>

            <Alert>
              <AlertTitle>{copy.questions.import.allOrNothing}</AlertTitle>
            </Alert>
          </FieldGroup>
        </CardContent>
      </Card>

      {errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>{copy.questions.import.nothingValid}</AlertTitle>
          <AlertDescription>
            <ul className="flex flex-col gap-1">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {report === null ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardIcon />
            </EmptyMedia>
            <EmptyTitle>{copy.questions.import.empty}</EmptyTitle>
            <EmptyDescription>{copy.questions.import.emptyHint}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{copy.questions.import.preview}</CardTitle>
            <CardDescription className="flex flex-wrap gap-2">
              <Badge variant="default">{copy.questions.import.rowsValid(report.validCount)}</Badge>
              {report.invalidCount > 0 ? (
                <Badge variant="destructive">
                  {copy.questions.import.rowsInvalid(report.invalidCount)}
                </Badge>
              ) : null}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {report.rows.map((row, index) => (
              <div key={row.line} className="flex flex-col gap-2">
                {index > 0 ? <Separator /> : null}
                <div className="flex flex-wrap items-center gap-2">
                  {row.input ? (
                    <CheckCircle2Icon className="size-4" />
                  ) : (
                    <XCircleIcon className="size-4" />
                  )}
                  <span className="font-medium">{copy.questions.import.rowLabel(row.line)}</span>
                  {row.raw.mode ? <Badge variant="secondary">{row.raw.mode}</Badge> : null}
                  {row.raw.component ? <Badge variant="ghost">{row.raw.component}</Badge> : null}
                </div>

                <p className="text-sm text-muted-foreground">{row.raw.prompt || '—'}</p>

                {row.errors.length > 0 ? (
                  <ul className="flex flex-col gap-1 text-sm text-destructive">
                    {row.errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
