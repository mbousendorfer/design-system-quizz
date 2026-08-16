'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { copy } from '@/lib/copy'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { href: '/admin/questions', label: copy.admin.navQuestions },
  { href: '/admin/questions/import', label: copy.admin.navImport },
  { href: '/admin/stats', label: copy.admin.navStats },
]

/**
 * Where you are in the admin.
 *
 * The nav was three ghost buttons with no current state, so every screen looked
 * like every other screen and the only way to know which section you were in was
 * to read the page. A back office people visit a few times a month is exactly
 * where that costs the most.
 *
 * The match is by prefix, but longest-first: `/admin/questions/import` starts
 * with `/admin/questions`, so a plain prefix test would light up two sections at
 * once — and the wrong one would be the wider link.
 */
export function AdminNav() {
  const pathname = usePathname()

  const active = SECTIONS.map((section) => section.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0]

  return (
    <nav aria-label={copy.admin.title} className="flex items-center gap-1">
      {SECTIONS.map((section) => {
        const current = section.href === active
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-sm transition-colors',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              current
                ? 'bg-accent text-foreground font-medium'
                : 'text-text-tertiary hover:text-foreground hover:bg-accent/50',
            )}
          >
            {section.label}
          </Link>
        )
      })}
    </nav>
  )
}
