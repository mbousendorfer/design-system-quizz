import type { NextConfig } from 'next'

/**
 * Static export, for GitHub Pages.
 *
 * Pages serves files. There is no runtime, so there are no route handlers, no
 * server actions and no secret held anywhere the browser cannot read. The game
 * runs entirely in the browser against a question bank baked into the bundle;
 * the leaderboard talks to Supabase directly, through row level security rather
 * than through our own server.
 *
 * `NEXT_PUBLIC_BASE_PATH` is set by the deploy workflow to `/design-system-quizz`,
 * because a project Pages site lives under the repository name rather than at the
 * root of the domain. It stays empty in development so `npm run dev` still serves
 * from `/`.
 *
 * The trap it brings: Next rewrites `<Link>` targets and its own `/_next` assets
 * for you, but a hand-written string like `/shots/abc.png` or a `fetch('/ds/ui.css')`
 * is untouched and will 404 in production while working perfectly on localhost.
 * Everything that builds such a URL goes through `assetPath()` in `lib/base-path.ts`.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  // Every internal link gets a trailing slash, so Pages resolves `/leaderboard`
  // to `/leaderboard/index.html` rather than 404ing on a file it does not have.
  trailingSlash: true,
  // There is no image optimiser on a static host.
  images: { unoptimized: true },
}

export default nextConfig
