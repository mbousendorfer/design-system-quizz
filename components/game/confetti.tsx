'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * A confetti burst, hand-rolled on a canvas.
 *
 * No dependency: the whole thing is eighty lines, and pulling a library in for
 * it would ship more bytes than the game's entire question bank.
 *
 * Three things it takes care of, because a celebration that misbehaves is worse
 * than none:
 *
 * - **It never blocks a click.** `pointer-events: none` and a z-index above the
 *   page, so the Next button underneath stays pressable while it rains.
 * - **It stops.** Particles are dropped once they leave the viewport, and the
 *   animation frame is cancelled when the last one goes — an idle rAF loop on a
 *   quiz you leave open for an hour is a battery bug.
 * - **It respects reduced motion.** Checked with `matchMedia`, because this is
 *   JavaScript and a CSS query cannot reach it. Someone who asked their system
 *   for less movement gets none.
 */

/** The design system's own families, so even the celebration is on-palette. */
const COLOURS = [
  'oklch(0.698 0.199 40.5)', // orange-100
  'oklch(0.644 0.193 253.5)', // electric-blue-100
  'oklch(0.695 0.174 145.7)', // green-100
  'oklch(0.923 0.189 102.3)', // yellow-100
  'oklch(0.520 0.163 286.5)', // purple-100
]

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  spin: number
  angle: number
  colour: string
}

const GRAVITY = 0.28
const DRAG = 0.992

export type ConfettiHandle = {
  /** Bursts from a point on screen, or from the top centre when given nothing. */
  fire: (origin?: { x: number; y: number }, count?: number) => void
}

export function useConfetti(): ConfettiHandle {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const particles = useRef<Particle[]>([])
  const frame = useRef<number | undefined>(undefined)

  const stop = useCallback(() => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    frame.current = undefined
    canvas.current?.remove()
    canvas.current = null
    particles.current = []
  }, [])

  useEffect(() => stop, [stop])

  const fire = useCallback(
    (origin?: { x: number; y: number }, count = 60) => {
      if (typeof window === 'undefined') return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      if (!canvas.current) {
        const element = document.createElement('canvas')
        element.style.cssText =
          'position:fixed;inset:0;pointer-events:none;z-index:60;width:100%;height:100%'
        document.body.append(element)
        canvas.current = element
      }

      const element = canvas.current
      const ratio = window.devicePixelRatio || 1
      element.width = window.innerWidth * ratio
      element.height = window.innerHeight * ratio

      const from = origin ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.3 }

      for (let i = 0; i < count; i += 1) {
        // Fired upward in a fan, so it arcs and falls rather than spraying flat.
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6
        const speed = 6 + Math.random() * 7
        particles.current.push({
          x: from.x * ratio,
          y: from.y * ratio,
          vx: Math.cos(angle) * speed * ratio,
          vy: Math.sin(angle) * speed * ratio,
          size: (5 + Math.random() * 5) * ratio,
          spin: (Math.random() - 0.5) * 0.3,
          angle: Math.random() * Math.PI,
          colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
        })
      }

      if (frame.current !== undefined) return

      const context = element.getContext('2d')
      if (!context) return

      const step = () => {
        context.clearRect(0, 0, element.width, element.height)

        particles.current = particles.current.filter((particle) => {
          particle.vy += GRAVITY * ratio
          particle.vx *= DRAG
          particle.vy *= DRAG
          particle.x += particle.vx
          particle.y += particle.vy
          particle.angle += particle.spin

          if (particle.y > element.height + 40) return false

          context.save()
          context.translate(particle.x, particle.y)
          context.rotate(particle.angle)
          context.fillStyle = particle.colour
          // Rectangles, not circles: a spinning rectangle reads as a piece of
          // paper catching the light, which is what makes it look like confetti
          // rather than like bubbles.
          context.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2)
          context.restore()
          return true
        })

        if (particles.current.length > 0) {
          frame.current = requestAnimationFrame(step)
        } else {
          stop()
        }
      }

      frame.current = requestAnimationFrame(step)
    },
    [stop],
  )

  return { fire }
}
