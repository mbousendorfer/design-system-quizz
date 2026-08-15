import { isSignedIn } from '@/lib/auth/admin-session'
import { serviceClient } from '@/lib/supabase/service'

/**
 * The raw answers table as CSV.
 *
 * Behind the same session as the rest of the admin — this is every answer every
 * player ever gave, which is exactly the sort of thing that should not sit on a
 * guessable URL.
 */

const COLUMNS = [
  'answered_at',
  'pseudo',
  'team',
  'run_id',
  'position',
  'question_id',
  'question_version',
  'mode',
  'difficulty',
  'component',
  'chosen_option_id',
  'correct',
  'time_ms',
  'points',
] as const

/** Quote anything that could otherwise break a column, and double inner quotes. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export async function GET() {
  if (!(await isSignedIn())) {
    return new Response('Not signed in', { status: 401 })
  }

  // `answers` keys off `run_items(run_id, position)`, not off `runs` directly, so
  // reaching the player means going through the item that was served.
  const { data, error } = await serviceClient()
    .from('answers')
    .select(
      'answered_at, run_id, position, question_id, question_version, mode, difficulty, component, chosen_option_id, correct, time_ms, points, run_items!inner(runs!inner(players!inner(pseudo, team)))',
    )
    .order('answered_at', { ascending: true })

  if (error) return new Response(error.message, { status: 500 })

  const rows = (data ?? []).map((row) => {
    const player = (
      row.run_items as unknown as { runs: { players: { pseudo: string; team: string } } }
    ).runs.players
    return [
      row.answered_at,
      player.pseudo,
      player.team,
      row.run_id,
      row.position,
      row.question_id,
      row.question_version,
      row.mode,
      row.difficulty,
      row.component,
      row.chosen_option_id,
      row.correct,
      row.time_ms,
      row.points,
    ]
      .map(csvCell)
      .join(',')
  })

  const csv = [COLUMNS.join(','), ...rows].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="ds-quiz-answers.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
