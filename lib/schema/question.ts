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

import {
  renderSchema,
  toPlayerRender,
  toRender,
  type PlayerRender,
  type StoredRender,
} from '@/lib/schema/render'

import { hasLivingStory, isKnownComponent } from '@/lib/catalog'
import { copy } from '@/lib/copy'
import {
  DIFFICULTIES,
  DIFFICULTY_RULES,
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

/**
 * An option that shows a component: rendered live, or as a screenshot.
 * `imageKey` stays accepted so questions written before live rendering keep parsing.
 */
const visualOptionSchema = z
  .object({
    id: optionIdSchema,
    imageKey: imageKeySchema.optional(),
    render: renderSchema.optional(),
    label: z.string().max(80).optional(),
  })
  .refine((option) => option.render != null || option.imageKey != null, {
    message: 'This option needs a screenshot or a live render',
  })

export type ComponentOption = z.infer<typeof componentOptionSchema>
export type VisualOption = z.infer<typeof visualOptionSchema>
export type QuestionOption = ComponentOption | VisualOption

/**
 * An option as it sits in the database, where a half-written draft is legal.
 * The strict union above is what a question must satisfy to be published; this
 * is what the admin reads and writes in the meantime.
 */
export type StoredOption = {
  id: string
  component?: string
  /** Older shape, still read: a bare screenshot key. */
  imageKey?: string
  /** Live render or screenshot. Supersedes `imageKey`. */
  render?: StoredRender
  label?: string
}

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
  /**
   * The question's own visual, when it has one. `imageKey` is the older shape and
   * stays accepted so nothing written before live rendering has to be rewritten.
   */
  stimulus: renderSchema.nullable().default(null),
  imageKey: imageKeySchema.nullable().default(null),
}

const variants = [
  z.object({
    ...baseFields,
    mode: z.literal('name-that-component'),
    options: z.array(componentOptionSchema).min(4).max(6),
  }),
  z.object({
    ...baseFields,
    mode: z.literal('which-variant'),
    options: z.array(visualOptionSchema).min(3).max(6),
  }),
  z.object({
    ...baseFields,
    mode: z.literal('spot-the-drift'),
    /** Always A versus B. */
    options: z.array(visualOptionSchema).length(2),
  }),
  z.object({
    ...baseFields,
    mode: z.literal('which-component'),
    /** A product scenario in words — no visual at all. */
    options: z.array(componentOptionSchema).min(4).max(6),
  }),
  z.object({
    ...baseFields,
    mode: z.literal('name-from-description'),
    /** A description lifted from the design guidelines, with the names redacted. */
    options: z.array(componentOptionSchema).min(4).max(6),
  }),
] as const

/**
 * A missing variant used to fail at *runtime*, on a real question, in production,
 * with a zod message about a discriminator. These two lines turn it into a compile
 * error naming the mode — and the second one catches a typo'd literal, which is the
 * other half of the same bug.
 */
type CoveredModes = z.infer<(typeof variants)[number]>['mode']
type Exhaustive<T extends never> = T
/* eslint-disable @typescript-eslint/no-unused-vars -- these exist to fail the build */
type _EveryModeHasAVariant = Exhaustive<Exclude<Mode, CoveredModes>>
type _NoVariantForAPhantomMode = Exhaustive<Exclude<CoveredModes, Mode>>
/* eslint-enable @typescript-eslint/no-unused-vars */

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

  // Lives here rather than on the variant: refining a variant would turn it into a
  // ZodEffects, and a discriminated union only accepts plain objects.
  if (
    question.mode === 'name-that-component' &&
    question.stimulus == null &&
    question.imageKey == null
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['stimulus'],
      message: 'This mode shows the component being identified, so it needs one',
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
  /** Compiled markup or a screenshot key — never the recipe either came from. */
  render?: PlayerRender
  label?: string
}

export type PlayerQuestion = {
  runId: string
  position: number
  mode: Mode
  difficulty: Difficulty
  timerSeconds: number
  prompt: string
  /** The question's own visual, when it has one. */
  stimulus: PlayerRender | null
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

/**
 * The subset of a question that is allowed to be rendered.
 *
 * Options are the loose stored shape rather than the strict union, so the admin
 * can preview a half-written draft through the very same renderer the game uses.
 */
export type PlayableFields = {
  mode: Mode
  difficulty: Difficulty
  prompt: string
  /** Either shape; `toRender` reads both. */
  stimulus?: StoredRender | null
  imageKey?: string | null
  component: string | null
  options: readonly StoredOption[]
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
  const options: PlayerOption[] = fields.options.map((option) => {
    if (option.component) return { id: option.id, component: option.component }
    const render = toPlayerRender(toRender(option))
    return {
      id: option.id,
      ...(render ? { render } : {}),
      ...(option.label ? { label: option.label } : {}),
    }
  })

  return {
    runId: context.runId,
    position: context.position,
    mode: fields.mode,
    difficulty: fields.difficulty,
    timerSeconds: fields.timerSeconds,
    prompt: fields.prompt,
    stimulus: toPlayerRender(toRender(fields)),
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
 * The subset a lint needs. Loose enough that both a published `Question` and an
 * unfinished admin draft satisfy it, so a draft gets the same advice.
 */
export type LintableQuestion = {
  mode: Mode
  difficulty: Difficulty
  component: string
  docUrl: string | null
  correctOptionId: string | null
  options: readonly StoredOption[]
}

/**
 * Things worth telling the author about but not worth refusing to save over.
 * The option count per level is a default, not a rule — the brief says so.
 */
export function lintQuestion(question: LintableQuestion): string[] {
  const warnings: string[] = []
  const advice = copy.questions.warnings
  const expected = DIFFICULTY_RULES[question.difficulty].optionCount

  if (question.mode !== 'spot-the-drift' && question.options.length !== expected) {
    warnings.push(advice.optionCount(question.difficulty, expected, question.options.length))
  }
  if (!question.docUrl) {
    warnings.push(advice.noDocLink)
  }

  // Thirteen catalog entries have a spec but no story; ten of those the design
  // guidelines have already retired. Writing about one is usually a mistake, but
  // several existing questions name them, so this warns rather than blocks.
  const named = [
    question.component,
    ...question.options.map((option) => option.component).filter(Boolean),
  ] as string[]
  for (const name of [...new Set(named)]) {
    if (name && isKnownComponent(name) && !hasLivingStory(name)) {
      warnings.push(advice.noStory(name))
    }
  }

  if (isComponentAnswerMode(question.mode)) {
    const answer = question.options.find((option) => option.id === question.correctOptionId)
    if (answer?.component && answer.component !== question.component) {
      warnings.push(advice.filedUnderWrongComponent(answer.component, question.component))
    }
  }
  return warnings
}
