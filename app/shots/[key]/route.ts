import { NextResponse } from 'next/server'

import { imageKeySchema } from '@/lib/schema/question'
import { SHOTS_BUCKET, readSupabaseEnv } from '@/lib/supabase/env'

/**
 * Serves a question screenshot under its opaque key.
 *
 * Two reasons this proxies rather than pointing an `<img>` straight at Supabase.
 * It keeps the screenshots on the app's own domain, so nothing about the storage
 * layout is visible from the network tab; and it lets every image carry a
 * `sandbox` content security policy. That second one matters because seeded
 * placeholders are SVG, and an SVG opened as a document can run script — under
 * this header it cannot, whoever uploaded it.
 *
 * Keys are content-derived and never reused, so the response is immutable and
 * the CDN answers almost every request without waking this function.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params

  // The key shape is the same one the schema enforces on the way in: this is a
  // path segment reaching a storage API, so it is validated, not trusted.
  if (!imageKeySchema.safeParse(key).success) {
    return new NextResponse('Not found', { status: 404 })
  }

  const { url } = readSupabaseEnv()
  const upstream = await fetch(`${url}/storage/v1/object/public/${SHOTS_BUCKET}/${key}`, {
    cache: 'force-cache',
  })

  if (!upstream.ok) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
