'use client'

import { useEffect, useRef, useState } from 'react'

import { dsStyleSheets } from '@/lib/render/stylesheets'

/**
 * A design system component, rendered for real, inside a closed shadow root.
 *
 * The isolation has to go both ways. Outward, the design system's stylesheet
 * restyles bare `h1`–`h4`, `p` and `small` and claims generic class names like
 * `.divider` and `.truncate`, so loading it into the document would wreck the
 * quiz's own interface. Inward, Tailwind's preflight zeroes margins and borders on
 * every element, so a merely-scoped stylesheet would leave the component rendering
 * subtly wrong — which is the one thing a design system quiz cannot afford.
 *
 * The markup arrives already compiled and class-renamed. Nothing here can read the
 * class map, and nothing here needs to.
 */
export function LiveRender({
  html,
  zoom,
  onMeasure,
}: {
  html: string
  zoom: number
  /** Reports the natural size at scale 1, so the group can pick one zoom for all. */
  onMeasure?: (size: { width: number; height: number }) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const root = useRef<ShadowRoot | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const element = host.current
    if (!element) return

    let cancelled = false
    root.current ??= element.attachShadow({ mode: 'closed' })

    dsStyleSheets()
      .then(async (sheets) => {
        if (cancelled || !root.current) return
        root.current.adoptedStyleSheets = sheets
        root.current.innerHTML = html

        // Averta loads with font-display: swap, and metrics move when it lands —
        // measuring before then would pick a zoom for the fallback font.
        await document.fonts.ready
        if (cancelled || !onMeasure) return
        const child = root.current.firstElementChild
        if (child) {
          const box = child.getBoundingClientRect()
          onMeasure({ width: box.width, height: box.height })
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [html, onMeasure])

  if (failed) return null

  return (
    <div
      ref={host}
      // A live `<button>` inside a ToggleGroupItem would steal the click and join
      // the tab order. The option's own aria-label carries the accessible name.
      inert
      aria-hidden
      className="pointer-events-none select-none"
      style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
    />
  )
}
