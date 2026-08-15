import 'server-only'

import classmap from '@/content/ds-classmap.json'

/**
 * The design system's renamed class and custom-property names.
 *
 * This file is the deobfuscation key: with it, `c3yuqrv` is `ap-badge` again and
 * every live-rendered question gives up its answer. The `server-only` import above
 * is what makes an accidental client import a build error rather than a quiet leak,
 * and it is the reason the map lives in `content/` and not in `public/`.
 *
 * Regenerate with `npm run ds:css`.
 */

const CLASSES = classmap.classes as Record<string, string>
const PROPERTIES = classmap.properties as Record<string, string>

export const DS_CSS_CHECKSUM: string = classmap.checksum
export const DS_THEME_VERSION: string = classmap.themeVersion

export class UnknownClassError extends Error {
  constructor(name: string) {
    super(
      `"${name}" is not a class in the vendored design system stylesheet. ` +
        `Either it was removed upstream, or ds:css needs re-running.`,
    )
  }
}

/**
 * The renamed class for a design system class name.
 *
 * Throws rather than passing the name through: an unrenamed class would both fail
 * to style anything and print the component's real name into the markup, which is
 * the exact failure this whole mechanism exists to prevent.
 */
export function renamedClass(name: string): string {
  const renamed = CLASSES[name]
  if (!renamed) throw new UnknownClassError(name)
  return renamed
}

export function isKnownClass(name: string): boolean {
  return name in CLASSES
}

export function renamedProperty(name: string): string | null {
  return PROPERTIES[name] ?? null
}

/** Every class the vendored sheet defines — used by `ds:verify` to catch template rot. */
export function knownClasses(): string[] {
  return Object.keys(CLASSES)
}
