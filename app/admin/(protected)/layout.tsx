import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogOutIcon } from 'lucide-react'

import { AdminNav } from '@/components/admin/admin-nav'
import { Button } from '@/components/ui/button'
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
    <div className="flex min-h-screen flex-col">
      {/* Same ground as the canvas, separated by a border rather than by a
          different colour: a differently-coloured bar would split the screen
          into "chrome world" and "content world" for no gain. Sticky, because
          the questions table is long and losing the nav halfway down it is how
          you end up using the browser's back button as navigation. */}
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/admin/questions" className="text-sm font-semibold tracking-tight">
            {copy.admin.title}
          </Link>
          <AdminNav />
          <form action={leave} className="ml-auto">
            <Button variant="ghost" size="sm" type="submit">
              <LogOutIcon data-icon="inline-start" />
              {copy.admin.signOut}
            </Button>
          </form>
        </div>
      </header>

      <Toaster>
        <main id="content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
      </Toaster>
    </div>
  )
}
