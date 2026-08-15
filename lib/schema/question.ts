/**
 * The single source of truth for what a question is.
 *
 * Used for server-side validation when a question is saved, and for typing the
 * front end. One schema, discriminated on `mode`.
 *
 * Two levels of strictness:
 *   - `questionDraftSchema` — what you can save as a draft: incomplete is fine.
 *   - `questionSchema`      — what you must satisfy to publish. Blocking.
 */
import { z } from 'zod'

import { isKnownComponent } from '@/lib/catalog'
import {
  DIFFICULTIES,
  MODES,
  QUESTIONS_PER_RUN,
  isComponentAnswerMode,
  timerSecondsFor,
  type Difficulty,
  type Mode,
} from '@/lib/difficulty'

export const STATUSES = ['draft', 'published', 'archived'] as const
export type Status = (typeof STATUSES)[number]

export const TEAMS = ['product', 'engineering', 'design', 'other'] as const
export type Team = (typeof TEAMS)[number]

export const optionIdSchema = z
  .string()
  .regex(/^[a-z0-9_-]{1,16}$/, 'An option id is 1 to 16 characters of a-z, 0-9, _ or -')

/**
 * Opaque storage object name, extension included: `q7f3a91.png`.
 * Never derived from the original filename — that would put the answer in the
 * network tab. The admin uploader renames on the way in.
 */
export const imageKeySchema = z
  .string()
  .regex(/^[a-z0-9]{6,12}\.(png|jpe?g|webp|svg)$/, 'An image key looks like `q7f3a91.png`')

const componentNameSchema = z.string().refine(isKnownComponent, {
  message: 'This component does not exist in the design system catalog',
})

/** An option that names a design system component. */
const componentOptionSchema = z.object({
  id: optionIdSchema,
  component: componentNameSchema,
})

/** An option that shows a screenshot. */
const imageOptionSchema = z.object({
  id: optionIdSchema,
  imageKey: imageKeySchema,
  label: z.string().max(80).optional(),
})

export type ComponentOption = z.infer<typeof componentOptionSchema>
export type ImageOption = z.infer<typeof imageOptionSchema>
export type QuestionOption = ComponentOption | ImageOption

const baseFields = {
  id: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(STATUSES),
  difficulty: z.enum(DIFFICULTIES),
  /** The component the question is about — the aggregation axis for the stats. */
  component: componentNameSchema,
  prompt: z.string().min(1).max(400),
  /** Mandatory: the quiz has to teach something even when the answer was right. */
  explanation: z.string().min(20).max(1000),
  docUrl: z.url().max(500).nullable(),
  /** Overrides the level default when set. */
  timerSeconds: z.number().int().min(5).max(120).nullable(),
  correctOptionId: optionIdSchema,
}

const variants = [
  z.object({
    ...baseFields,
    mode: z.literal('name-that-component'),
    /** The screenshot to identify. */
    imageKey: imageKeySchema,
    options: z.array(componentOptionSchema).min(4).max(6),
  }),
  z.object({
    ...baseFields,
    mode: z.literal('which-variant'),
    imageKey: z.null().default(null),
    options: z.array(imageOptionSchema).min(3).max(6),
  }),
  z.object({
    ...baseFields,
    mode: z.literal('spot-the-drift'),
    imageKey: z.null().default(null),
    /** Always A versus B. */
    options: z.array(imageOptionSchema).length(2),
  }),
  z.object({
    ...baseFields,
    mode: z.literal('which-component'),
    /** A product scenario in words — no screenshot at all. */
    imageKey: z.null().default(null),
    options: z.array(componentOptionSchema).min(4).max(6),
  }),
] as const

/**
 * Note there is no "exactly one correct answer" rule to enforce: `correctOptionId`
 * holds a single id, so a second correct answer is not representable. All that is
 * left to check is that the id points at an option that exists.
 */
export const questionSchema = z.discriminatedUnion('mode', variants).superRefine((question, ctx) => {
  const ids = question.options.map((option) => option.id)

  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'Two options share the same id' })
  }
  if (!ids.includes(question.correctOptionId)) {
    ctx.addIssue({
      code: 'custom',
      path: ['correctOptionId'],
      message: 'The correct answer does not match any option',
    })
  }
})

export type Question = z.infer<typeof questionSchema>

/**
 * What can be saved while still writing. Mode and difficulty are required because
 * they drive the shape of the form; everything else may still be blank.
 * Strict validation only runs on the way to `published`.
 */
export const questionDraftSchema = z.object({
  id: z.uuid().optional(),
  mode: z.enum(MODES),
  difficulty: z.enum(DIFFICULTIES),
  component: z.string().default(''),
  prompt: z.string().max(400).default(''),
  explanation: z.string().max(1000).default(''),
  docUrl: z.string().max(500).nullable().default(null),
  timerSeconds: z.number().int().min(5).max(120).nullable().default(null),
  imageKey: imageKeySchema.nullable().default(null),
  options: z
    .array(
      z.object({
        id: optionIdSchema,
        component: z.string().optional(),
        imageKey: imageKeySchema.optional(),
        label: z.string().max(80).optional(),
      }),
    )
    .max(6)
    .default([]),
  correctOptionId: optionIdSchema.nullable().default(null),
})

export type QuestionDraft = z.infer<typeof questionDraftSchema>

// ---------------------------------------------------------------------------
// What actually reaches the player
// ---------------------------------------------------------------------------

export type PlayerOption = {
  id: string
  /** Set on the component-naming modes: these are the choices, not the answer. */
  component?: string
  imageKey?: string
  label?: string
}

export type PlayerQuestion = {
  runId: string
  position: number
  mode: Mode
  difficulty: Difficulty
  timerSeconds: number
  prompt: string
  imageKey: string | null
  /**
   * Present only when naming the component is *not* the point of the question.
   * On `name-that-component` and `which-component` it is the answer, so it is
   * stripped along with the explanation.
   */
  component: string | null
  options: PlayerOption[]
  totalQuestions: number
}

/** Deterministic PRNG, so refreshing mid-question does not reshuffle the options. */
function seededRandom(seed: string): () => number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash += 0x6d2b79f5
    let value = hash
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: readonly T[], seed: string): T[] {
  const random = seededRandom(seed)
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

export type PlayerQuestionContext = {
  runId: string
  position: number
  totalQuestions?: number
}

/** The subset of a question that is allowed to be rendered. */
export type PlayableFields = {
  mode: Mode
  difficulty: Difficulty
  prompt: string
  imageKey: string | null
  component: string | null
  options: readonly QuestionOption[]
  timerSeconds: number
}

/**
 * The only place a question becomes a payload.
 *
 * Whatever it is handed, it emits `component` as null on the two modes where the
 * component name is the answer, and it never copies anything else across — so a
 * caller that passes a full row cannot leak the answer or the explanation by
 * forgetting to strip them.
 *
 * Two callers: the game, reading the `questions_public` view, and the admin
 * preview, holding a full question.
 */
export function buildPlayerQuestion(
  fields: PlayableFields,
  context: PlayerQuestionContext,
): PlayerQuestion {
  const options: PlayerOption[] = fields.options.map((option) =>
    'component' in option
      ? { id: option.id, component: option.component }
      : {
          id: option.id,
          imageKey: option.imageKey,
          ...(option.label ? { label: option.label } : {}),
        },
  )

  return {
    runId: context.runId,
    position: context.position,
    mode: fields.mode,
    difficulty: fields.difficulty,
    timerSeconds: fields.timerSeconds,
    prompt: fields.prompt,
    imageKey: fields.imageKey,
    component: isComponentAnswerMode(fields.mode) ? null : fields.component,
    options: shuffled(options, `${context.runId}:${context.position}`),
    totalQuestions: context.totalQuestions ?? QUESTIONS_PER_RUN,
  }
}

/** Same thing, from a full stored question. */
export function toPlayerQuestion(
  question: Question,
  context: PlayerQuestionContext,
): PlayerQuestion {
  return buildPlayerQuestion(
    {
      mode: question.mode,
      difficulty: question.difficulty,
      prompt: question.prompt,
      imageKey: question.imageKey ?? null,
      component: question.component,
      options: question.options,
      timerSeconds: timerSecondsFor(question.difficulty, question.timerSeconds),
    },
    context,
  )
}

// ---------------------------------------------------------------------------
// Non-blocking advice for the admin form
// ---------------------------------------------------------------------------

/**
 * Things worth telling the author about but not worth refusing to save over.
 * The option count per level is a default, not a rule — the brief says so.
 */
export function lintQuestion(question: Question): string[] {
  const warnings: string[] = []
  const expected = { easy: 4, medium: 5, hard: 6 }[question.difficulty]

  if (question.mode !== 'spot-the-drift' && question.options.length !== expected) {
    warnings.push(
      `A ${question.difficulty} question usually offers ${expected} options; this one offers ${question.options.length}.`,
    )
  }
  if (!question.docUrl) {
    warnings.push('No documentation link — players cannot go read more after answering.')
  }
  if (isComponentAnswerMode(question.mode)) {
    const answer = question.options.find((option) => option.id === question.correctOptionId)
    if (answer && 'component' in answer && answer.component !== question.component) {
      warnings.push(
        `The correct option names "${answer.component}" but the question is filed under "${question.component}", so the stats will aggregate under the wrong component.`,
      )
    }
  }
  return warnings
}
