import { adminQuestionInputSchema, publishBlockers, type AdminQuestionInput } from '@/lib/admin/validation'
import { copy } from '@/lib/copy'
import { DIFFICULTIES, MODES, hasImageOptions, type Difficulty, type Mode } from '@/lib/difficulty'
import type { StoredOption } from '@/lib/schema/question'

/**
 * Reading a batch of questions out of a spreadsheet.
 *
 * One row shape, accepted as either CSV or JSON, so thirty questions can be
 * written in a spreadsheet rather than one at a time in a form. Images are
 * uploaded separately and referenced here by their key.
 */

export const IMPORT_COLUMNS = [
  'mode',
  'difficulty',
  'component',
  'prompt',
  'explanation',
  'docUrl',
  'imageKey',
  'timerSeconds',
  'option1',
  'option2',
  'option3',
  'option4',
  'option5',
  'option6',
  'correct',
  'status',
] as const

const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

export type ImportedRow = {
  /** 1-based, as the author sees it in their spreadsheet. */
  line: number
  raw: Record<string, string>
  input: AdminQuestionInput | null
  errors: string[]
}

export type ImportReport = {
  rows: ImportedRow[]
  validCount: number
  invalidCount: number
}

/**
 * A CSV reader that understands quoted fields, because an explanation is a
 * sentence and sentences contain commas.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      // Swallow the \n of a \r\n pair.
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((entry) => entry.some((value) => value.trim() !== ''))
}

function toInput(raw: Record<string, string>): { input: AdminQuestionInput | null; errors: string[] } {
  const errors: string[] = []

  const mode = raw.mode?.trim() as Mode
  const difficulty = (raw.difficulty?.trim() || 'medium') as Difficulty

  if (!MODES.includes(mode)) {
    errors.push(copy.questions.import.badMode(raw.mode ?? '', MODES.join(', ')))
  }
  if (!DIFFICULTIES.includes(difficulty)) {
    errors.push(copy.questions.import.badDifficulty(raw.difficulty ?? '', DIFFICULTIES.join(', ')))
  }
  if (errors.length > 0) return { input: null, errors }

  const values = OPTION_IDS.map((_, index) => raw[`option${index + 1}`]?.trim() ?? '').filter(Boolean)

  const options: StoredOption[] = values.map((value, index) =>
    hasImageOptions(mode)
      ? { id: OPTION_IDS[index], imageKey: value }
      : { id: OPTION_IDS[index], component: value },
  )

  const correct = Number(raw.correct)
  if (!Number.isInteger(correct) || correct < 1 || correct > options.length) {
    errors.push(copy.questions.import.badCorrect(raw.correct ?? '', options.length))
  }

  const status = raw.status?.trim() === 'draft' ? 'draft' : 'published'
  const timer = raw.timerSeconds?.trim()

  const candidate = {
    id: null,
    mode,
    difficulty,
    status,
    component: raw.component?.trim() ?? '',
    prompt: raw.prompt?.trim() ?? '',
    options,
    correctOptionId: options.length > 0 ? (OPTION_IDS[correct - 1] ?? null) : null,
    explanation: raw.explanation?.trim() ?? '',
    docUrl: raw.docUrl?.trim() || null,
    imageKey: raw.imageKey?.trim() || null,
    timerSeconds: timer ? Number(timer) : null,
  }

  const parsed = adminQuestionInputSchema.safeParse(candidate)
  if (!parsed.success) {
    return { input: null, errors: [...errors, ...parsed.error.issues.map((issue) => issue.message)] }
  }

  // An imported row is meant to go live, so it faces the publishing rules unless
  // it explicitly says it is a draft.
  if (parsed.data.status === 'published') errors.push(...publishBlockers(parsed.data))

  return { input: errors.length > 0 ? null : parsed.data, errors }
}

export function parseImport(text: string): ImportReport {
  const trimmed = text.trim()
  if (!trimmed) return { rows: [], validCount: 0, invalidCount: 0 }

  let records: Record<string, string>[] = []

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      const list = Array.isArray(parsed) ? parsed : [parsed]
      records = list.map((entry: Record<string, unknown>) => {
        const record: Record<string, string> = {}
        for (const [key, value] of Object.entries(entry)) {
          // A JSON row may carry `options` as an array rather than option1..6.
          if (key === 'options' && Array.isArray(value)) {
            value.forEach((option, index) => {
              record[`option${index + 1}`] = String(option ?? '')
            })
          } else {
            record[key] = value === null || value === undefined ? '' : String(value)
          }
        }
        return record
      })
    } catch (error) {
      return {
        rows: [
          {
            line: 1,
            raw: {},
            input: null,
            errors: [copy.questions.import.badJson(error instanceof Error ? error.message : '')],
          },
        ],
        validCount: 0,
        invalidCount: 1,
      }
    }
  } else {
    const table = parseCsv(trimmed)
    const [header, ...body] = table
    if (!header) return { rows: [], validCount: 0, invalidCount: 0 }

    const columns = header.map((name) => name.trim())
    records = body.map((cells) =>
      Object.fromEntries(columns.map((name, index) => [name, cells[index] ?? ''])),
    )
  }

  const rows: ImportedRow[] = records.map((raw, index) => {
    const { input, errors } = toInput(raw)
    return { line: index + 1, raw, input, errors }
  })

  return {
    rows,
    validCount: rows.filter((row) => row.input).length,
    invalidCount: rows.filter((row) => !row.input).length,
  }
}
