import { z } from 'zod'

import { copy } from '@/lib/copy'
import { DIFFICULTIES, MODES, type Mode } from '@/lib/difficulty'
import {
  STATUSES,
  imageKeySchema,
  optionIdSchema,
  questionSchema,
} from '@/lib/schema/question'

/**
 * What the admin form may send. Deliberately permissive: an unfinished draft has
 * to be saveable. The strict rules only apply on the way to `published`, and they
 * come from `questionSchema` rather than being restated here — one source of truth.
 */
export const adminQuestionInputSchema = z.object({
  id: z.uuid().nullable().default(null),
  mode: z.enum(MODES),
  difficulty: z.enum(DIFFICULTIES),
  status: z.enum(STATUSES),
  component: z.string().max(80).default(''),
  prompt: z.string().max(400).default(''),
  options: z
    .array(
      z.object({
        id: optionIdSchema,
        component: z.string().max(80).optional(),
        imageKey: imageKeySchema.optional(),
        label: z.string().max(80).optional(),
      }),
    )
    .max(6)
    .default([]),
  correctOptionId: z.string().max(16).nullable().default(null),
  explanation: z.string().max(1000).default(''),
  docUrl: z.string().max(500).nullable().default(null),
  imageKey: imageKeySchema.nullable().default(null),
  timerSeconds: z.number().int().min(5).max(120).nullable().default(null),
})

export type AdminQuestionInput = z.infer<typeof adminQuestionInputSchema>

/** Stands in for the real id while validating a question that has never been saved. */
const PLACEHOLDER_ID = '00000000-0000-4000-8000-000000000000'

const OPTION_BOUNDS: Record<Mode, [number, number]> = {
  'name-that-component': [4, 6],
  'which-component': [4, 6],
  'which-variant': [3, 6],
  'spot-the-drift': [2, 2],
}

/**
 * Turns a schema issue into something worth showing a person.
 *
 * The rules stay in `questionSchema` — this only rewrites how they read. Zod's own
 * wording is aimed at whoever wrote the schema, and "expected string, received
 * null" tells the author of a question nothing about what to do next.
 */
function humanise(issue: z.core.$ZodIssue, input: AdminQuestionInput): string {
  const [head, index, tail] = issue.path as (string | number)[]
  const blockers = copy.questions.form.blockers

  if (head === 'options' && typeof index === 'number') {
    const option = input.options[index]
    if (tail === 'component') {
      return option?.component
        ? blockers.optionComponent(option.component)
        : blockers.optionEmpty
    }
    if (tail === 'imageKey') return blockers.optionImage
  }

  switch (head) {
    case 'prompt':
      return blockers.prompt
    case 'explanation':
      return blockers.explanation
    case 'component':
      return blockers.component
    case 'imageKey':
      return blockers.image
    case 'docUrl':
      return blockers.docUrl
    case 'correctOptionId':
      return blockers.correctAnswer
    case 'options': {
      if (issue.message.includes('same id')) return blockers.duplicateIds
      const [min, max] = OPTION_BOUNDS[input.mode]
      return blockers.optionCount(min, max)
    }
    default:
      return head ? blockers.fallback(String(head)) : issue.message
  }
}

/**
 * The blocking rules for publishing, read straight off `questionSchema`: exactly
 * one correct answer, the right number of options, a non-empty explanation, an
 * image where the mode needs one, and every named component present in the design
 * system catalog.
 */
export function publishBlockers(input: AdminQuestionInput): string[] {
  const result = questionSchema.safeParse({
    ...input,
    id: input.id ?? PLACEHOLDER_ID,
    version: 1,
    status: 'published',
    // `null` reads better than `undefined` through a form round trip, and the
    // schema treats an absent correct answer as a missing one either way.
    correctOptionId: input.correctOptionId ?? '',
  })

  if (result.success) return []

  // Several issues often describe the same missing thing; say it once.
  return [...new Set(result.error.issues.map((issue) => humanise(issue, input)))]
}
