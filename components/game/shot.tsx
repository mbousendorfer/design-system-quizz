import { cn } from '@/lib/utils'

/**
 * A question screenshot, served under its opaque key.
 *
 * A plain `img` rather than `next/image` on purpose: the seeded placeholders are
 * SVG, and routing those through the image optimiser would mean turning on
 * `images.dangerouslyAllowSVG` globally. The `/shots` route already serves every
 * file under a sandbox content security policy, and an `img` element does not run
 * script in an SVG anyway.
 *
 * The fixed ratio keeps the layout from jumping between questions; `object-contain`
 * means a screenshot of any shape is shown whole rather than cropped.
 */
export function Shot({
  imageKey,
  alt,
  className,
  priority,
}: {
  imageKey: string
  alt: string
  className?: string
  priority?: boolean
}) {
  return (
    <div
      className={cn(
        'flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg border bg-muted',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/shots/${imageKey}`}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="size-full object-contain"
      />
    </div>
  )
}
