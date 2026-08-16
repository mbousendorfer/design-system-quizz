import { redirect } from 'next/navigation'
import { LogInIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { isSignedIn, signIn } from '@/lib/auth/admin-session'
import { copy } from '@/lib/copy'

/**
 * Outside the `(protected)` route group on purpose: the guard lives in that
 * group's layout, and a login page behind its own guard is a redirect loop.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (await isSignedIn()) redirect('/admin/questions')

  const { error } = await searchParams

  async function attempt(formData: FormData) {
    'use server'

    const result = await signIn(String(formData.get('password') ?? ''))
    if (result.ok) redirect('/admin/questions')
    redirect(`/admin/login?error=${result.reason}`)
  }

  return (
    <main id="content" // Centred rather than pinned to the top: a lone card in the corner of a
      // tall window reads as a page that failed to finish loading.
      className="mx-auto flex min-h-[100svh] w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>{copy.admin.title}</CardTitle>
          <CardDescription>{copy.admin.signInHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={attempt} className="flex flex-col gap-6">
            <FieldGroup>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="password">{copy.admin.passwordLabel}</FieldLabel>
                <Input id="password" name="password" type="password" autoFocus required />
                {error ? (
                  <FieldError>
                    {error === 'throttled' ? copy.admin.throttled : copy.admin.wrongPassword}
                  </FieldError>
                ) : null}
              </Field>
            </FieldGroup>
            <Button type="submit">
              <LogInIcon data-icon="inline-start" />
              {copy.admin.signIn}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
