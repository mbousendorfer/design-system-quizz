'use client'

import { LiveRender } from '@/components/game/live-render'
import type { PlayerRender } from '@/lib/schema/render'
import { cn } from '@/lib/utils'

/**
 * One box, whatever is inside it.
 *
 * The fixed ratio does two jobs. It reserves the space before any content exists,
 * so nothing shifts as images load or stylesheets parse. And it is byte-identical
 * across a live render and a screenshot, so a player cannot tell one kind of option
 * from another — or a tall component from a short one — by looking at the geometry.
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
        'flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg border',
        // The design system's tokens are light-only, so a live component sits on a
        // fixed light surface in either theme rather than half-inverting.
        render.kind === 'live' ? 'bg-white' : 'bg-muted',
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
