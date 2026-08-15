'use server'

import { revalidatePath } from 'next/cache'

import {
  AdminError,
  loadQuestion,
  saveQuestion,
  setStatus,
  uploadShot,
  type SaveResult,
} from '@/lib/admin/repository'
import { adminQuestionInputSchema, publishBlockers } from '@/lib/admin/validation'
import { isSignedIn } from '@/lib/auth/admin-session'
import type { Status } from '@/lib/schema/question'

/**
 * Every write in the admin.
 *
 * A server action is a public endpoint — being reachable only from a page behind
 * the guard is not itself a guard. Each one re-checks the session for itself.
 */
async function requireAdmin(): Promise<void> {
  if (!(await isSignedIn())) throw new AdminError('Not signed in.')
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; errors: string[] }

function failure(error: unknown): { ok: false; errors: string[] } {
  return { ok: false, errors: [error instanceof Error ? error.message : 'Something went wrong.'] }
}

export async function saveQuestionAction(raw: unknown): Promise<ActionResult<SaveResult>> {
  try {
    await requireAdmin()

    const parsed = adminQuestionInputSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) }
    }

    // Drafts may be incomplete. Publishing may not.
    if (parsed.data.status === 'published') {
      const blockers = publishBlockers(parsed.data)
      if (blockers.length > 0) return { ok: false, errors: blockers }
    }

    const result = await saveQuestion(parsed.data)

    revalidatePath('/admin/questions')
    return { ok: true, data: result }
  } catch (error) {
    return failure(error)
  }
}

export async function setStatusAction(
  id: string,
  version: number,
  status: Status,
): Promise<ActionResult> {
  try {
    await requireAdmin()

    // Publishing from the list has to clear the same bar as publishing from the
    // form, or the list becomes a way around the validation.
    if (status === 'published') {
      const question = await loadQuestion(id)
      if (!question) return { ok: false, errors: ['That question no longer exists.'] }

      const blockers = publishBlockers({
        id: question.id,
        mode: question.mode,
        difficulty: question.difficulty,
        status: 'published',
        component: question.component,
        prompt: question.prompt,
        options: question.options,
        correctOptionId: question.correctOptionId,
        explanation: question.explanation,
        docUrl: question.docUrl,
        imageKey: question.imageKey,
        timerSeconds: question.timerSeconds,
      })
      if (blockers.length > 0) return { ok: false, errors: blockers }
    }

    await setStatus(id, version, status)
    revalidatePath('/admin/questions')
    return { ok: true, data: undefined }
  } catch (error) {
    return failure(error)
  }
}

/**
 * Duplication is how a series of variants gets written quickly, so the copy lands
 * as a draft: it is a starting point, not something to go live by accident.
 */
export async function duplicateQuestionAction(id: string): Promise<ActionResult<SaveResult>> {
  try {
    await requireAdmin()

    const source = await loadQuestion(id)
    if (!source) return { ok: false, errors: ['That question no longer exists.'] }

    const result = await saveQuestion({
      id: null,
      mode: source.mode,
      difficulty: source.difficulty,
      status: 'draft',
      component: source.component,
      prompt: source.prompt,
      options: source.options,
      correctOptionId: source.correctOptionId,
      explanation: source.explanation,
      docUrl: source.docUrl,
      imageKey: source.imageKey,
      timerSeconds: source.timerSeconds,
    })

    revalidatePath('/admin/questions')
    return { ok: true, data: result }
  } catch (error) {
    return failure(error)
  }
}

export async function uploadShotAction(formData: FormData): Promise<ActionResult<{ key: string }>> {
  try {
    await requireAdmin()

    const file = formData.get('file')
    if (!(file instanceof File)) return { ok: false, errors: ['No file was received.'] }

    return { ok: true, data: { key: await uploadShot(file) } }
  } catch (error) {
    return failure(error)
  }
}
