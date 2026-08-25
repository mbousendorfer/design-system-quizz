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

/**
 * Busts the CDN cache on every deploy.
 *
 * Turbopack gives a chunk the same filename across builds even when its
 * contents change — verified by rebuilding after an edit and diffing the names.
 * GitHub Pages serves those files with `max-age=600` and offers no way to set a
 * header, so for ten minutes after a deploy anyone who had already visited gets
 * the previous CSS against the new HTML. It looks exactly like the deploy
 * failed, which is how this was found.
 *
 * `deploymentId` appends `?dpl=…` to every asset URL, so a new deploy asks for
 * a URL no cache has seen. The workflow sets it to the commit SHA.
 */
const deploymentId = process.env.NEXT_PUBLIC_DEPLOYMENT_ID || undefined

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  deploymentId,
  // Every internal link gets a trailing slash, so Pages resolves `/leaderboard`
  // to `/leaderboard/index.html` rather than 404ing on a file it does not have.
  trailingSlash: true,
  // There is no image optimiser on a static host.
  images: { unoptimized: true },
}

export default nextConfig
