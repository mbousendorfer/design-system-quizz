'use client'

import { LiveRender } from '@/components/game/live-render'
import type { PlayerRender } from '@/lib/schema/render'
import { cn } from '@/lib/utils'

/**
 * The plate: the surface every examined component sits on.
 *
 * It is the one bright object in an otherwise neutral interface, and the only
 * place colour is allowed to come from the content rather than from us. The wall
 * around it is cool and quiet precisely so the plate carries the eye.
 *
 * Three properties it must hold, in order of how badly breaking them hurts:
 *
 * 1. **The same ground for every kind of content.** Live renders and screenshots
 *    share one surface. This used to be `bg-white` for live and `bg-muted` for a
 *    screenshot, which meant that on a mixed question the ground colour sorted the
 *    options into two groups before the player had read anything.
 * 2. **White, in both themes.** Not an aesthetic call. The design system is
 *    authored against white, and on a dark plate a white component would read
 *    off-white on the one screen where judging exactly that is the exercise.
 * 3. **The same geometry, always.** The ratio is fixed and reserved before any
 *    content exists, so nothing shifts as images load, and a tall component cannot
 *    be told from a short one by the shape of its box.
 *
 * The edge is a hairline rather than the wall's border, and the corner is tighter
 * than the card it sits in — a plate is a physical thing inside a softer frame.
 */
export function RenderBox({
  render,
  alt,
  zoom = 1,
  onMeasure,
  className,
  priority,
}: {
  render: PlayerRender
  alt: string
  zoom?: number
  onMeasure?: (size: { width: number; height: number }) => void
  className?: string
  priority?: boolean
}) {
  return (
    <div
      className={cn(
        'flex aspect-[16/10] w-full items-center justify-center overflow-hidden',
        'rounded-plate border border-plate-edge bg-plate',
        className,
      )}
    >
      {render.kind === 'live' ? (
        <LiveRender html={render.html} zoom={zoom} onMeasure={onMeasure} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/shots/${render.imageKey}`}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="size-full object-contain"
        />
      )}
    </div>
  )
}
