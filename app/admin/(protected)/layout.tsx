import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogOutIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Toaster } from '@/components/ui/toast'
import { isSignedIn, signOut } from '@/lib/auth/admin-session'
import { copy } from '@/lib/copy'

/**
 * The guard for everything under /admin except the login page, which sits outside
 * this route group.
 */
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSignedIn())) redirect('/admin/login')

  async function leave() {
    'use server'
    await signOut()
    redirect('/admin/login')
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{copy.admin.title}</span>
        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/questions" />}>
            {copy.admin.navQuestions}
          </Button>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/questions/import" />}>
            {copy.admin.navImport}
          </Button>
          {/* The stats link arrives with the stats page, in the next phase. A nav
              item that 404s is worse than one that is not there yet. */}
        </nav>
        <form action={leave} className="ml-auto">
          <Button variant="ghost" size="sm" type="submit">
            <LogOutIcon data-icon="inline-start" />
            {copy.admin.signOut}
          </Button>
        </form>
      </header>

      <Separator />

      <Toaster>{children}</Toaster>
    </div>
  )
}
