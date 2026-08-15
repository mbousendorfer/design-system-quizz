import { z } from 'zod'

import { getComponent } from '@/lib/catalog'

/**
 * How a question shows a component: rendered live, or as a screenshot.
 *
 * A live render is stored as a *recipe* — component, modifiers, label — plus the
 * markup those compile to. The recipe is what the author edits and what the admin
 * reads back; the compiled markup is the only part that ever reaches a player,
 * because the recipe names the component and the modifier, which on two of the
 * modes is precisely the answer.
 */

export const imageKeySchema = z
  .string()
  .regex(/^[a-z0-9]{6,12}\.(png|jpe?g|webp|svg)$/, 'An image key looks like `q7f3a91.png`')

/** A class token as the design system spells it: `ap-button`, `primary`, `no-dot`. */
const modifierSchema = z.string().regex(/^[a-zA-Z][\w-]{0,40}$/)

const cssUiRenderSchema = z.object({
  kind: z.literal('css-ui'),
  /** Must be a catalog component that ships a CSS-UI template. */
  component: z.string().refine((name) => getComponent(name)?.cssUiTemplate != null, {
    message: 'This component has no CSS-UI layer, so it cannot be rendered live',
  }),
  modifiers: z.array(modifierSchema).max(8).default([]),
  label: z.string().max(120).default(''),
  /**
   * Produced server-side when the question is saved. Classes are already renamed,
   * so this is the one field that is safe in a payload — and the reason the render
   * costs nothing on a 15-second timer.
   */
  compiled: z.string().max(4000),
  /**
   * The stylesheet the markup above was compiled against.
   *
   * `ds:css` salts every class name, so regenerating it reassigns all 600 of them
   * and markup compiled against the old sheet renders as unstyled HTML — correct
   * structure, no design system, and nothing anywhere would say why. Stamping the
   * checksum makes that detectable: `npm run ds:recompile` finds the stale rows and
   * rebuilds them from the recipe, which is exactly why the recipe is kept.
   */
  cssChecksum: z.string().max(32).default(''),
})

const shotRenderSchema = z.object({
  kind: z.literal('shot'),
  imageKey: imageKeySchema,
})

export const renderSchema = z.discriminatedUnion('kind', [cssUiRenderSchema, shotRenderSchema])

export type StoredRender = z.infer<typeof renderSchema>
export type CssUiRender = z.infer<typeof cssUiRenderSchema>

/** The recipe an author edits, before it has been compiled. */
export type RenderRecipe = {
  component: string
  modifiers: string[]
  label: string
}

/**
 * Reads a render off a stored option or question, accepting the older shape where a
 * screenshot was a bare `imageKey`. Every existing row and every CSV import keeps
 * working without being rewritten.
 */
export function toRender(
  stored: { render?: StoredRender | null; imageKey?: string | null } | null | undefined,
): StoredRender | null {
  if (!stored) return null
  if (stored.render) return stored.render
  return stored.imageKey ? { kind: 'shot', imageKey: stored.imageKey } : null
}

/** What survives into a payload: never the recipe, only what it compiled to. */
export type PlayerRender = { kind: 'live'; html: string } | { kind: 'shot'; imageKey: string }

/**
 * The projection. A `switch` with no `default` over the discriminant, so adding a
 * render kind without teaching this function about it is a compile error rather
 * than a silent leak of whatever the new kind carries.
 */
export function toPlayerRender(stored: StoredRender | null): PlayerRender | null {
  if (!stored) return null
  switch (stored.kind) {
    case 'css-ui':
      return { kind: 'live', html: stored.compiled }
    case 'shot':
      return { kind: 'shot', imageKey: stored.imageKey }
  }
}
