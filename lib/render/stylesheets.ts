'use client'

/**
 * The vendored design system sheets, parsed once per page load and shared by every
 * shadow root that adopts them.
 *
 * This is the reason live rendering uses shadow DOM rather than iframes: six
 * options on a 15-second timer would mean six documents each reparsing a megabyte
 * of CSS, every question. A `CSSStyleSheet` object is parsed once and adopted for
 * free thereafter.
 */

const SHEETS = ['/ds/tokens.css', '/ds/ui.css', '/ds/icons.css']

let cache: Promise<CSSStyleSheet[]> | null = null

export function dsStyleSheets(): Promise<CSSStyleSheet[]> {
  cache ??= Promise.all(
    SHEETS.map(async (url) => {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(await (await fetch(url)).text())
      return sheet
    }),
  ).catch((error) => {
    // Let the next attempt retry rather than caching a rejection forever.
    cache = null
    throw error
  })
  return cache
}

/**
 * Starts the fetch before anything needs it. Called when a run page mounts: the
 * question request is in flight at the same moment, so the sheets are usually
 * parsed by the time the first option paints, and questions 2 to 5 cost nothing.
 */
export function warmStyleSheets(): void {
  void dsStyleSheets().catch(() => {})
}
