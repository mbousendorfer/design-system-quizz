/**
 * The prefix a project GitHub Pages site lives under.
 *
 * Next handles `<Link>` and its own bundled assets. It does not touch a URL you
 * assemble yourself, which is the whole reason this exists: `/shots/q7f3a91.png`
 * and `/ds/tokens.css` are strings, and on Pages the site is served from
 * `/design-system-quizz/`, so an unprefixed string resolves against the domain
 * root and 404s — in production only, while working perfectly in development.
 *
 * Read from a `NEXT_PUBLIC_` variable because it has to be inlined at build time:
 * the browser is the only thing running this code.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/** Prefixes a root-relative path. Pass the path exactly as it is written in the repo. */
export function assetPath(path: string): string {
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`
}
