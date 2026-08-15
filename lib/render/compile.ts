import 'server-only'

import { getComponent } from '@/lib/catalog'
import { isKnownClass, renamedClass,
  DS_CSS_CHECKSUM,
} from '@/lib/render/classmap'
import type { CssUiRender, RenderRecipe } from '@/lib/schema/render'

/**
 * Turns a render recipe into the markup a player receives.
 *
 * Runs at save time, never at serve time. Three reasons: the class map never
 * leaves the server, the timed path costs nothing, and `questions_public` can
 * genuinely strip the recipe because the payload no longer needs it.
 */

export class CompileError extends Error {}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string,
  )

/**
 * Every class token in the markup is replaced by its renamed form. A token that is
 * not in the vendored stylesheet throws rather than passing through: it would both
 * fail to style anything and print the design system's real class name into the
 * markup, which is the exact leak this exists to prevent.
 */
function renameClassAttributes(markup: string): string {
  return markup.replace(/class="([^"]*)"/g, (_whole, classes: string) => {
    const renamed = classes
      .split(/\s+/)
      .filter(Boolean)
      .map((name) => renamedClass(name))
      .join(' ')
    return `class="${renamed}"`
  })
}

export function compileCssUi(recipe: RenderRecipe): CssUiRender {
  const component = getComponent(recipe.component)
  if (!component) throw new CompileError(`"${recipe.component}" is not in the design system catalog.`)

  const template = component.cssUiTemplate
  if (!template) {
    throw new CompileError(
      `"${recipe.component}" has no CSS-UI layer, so it cannot be rendered live. Use a screenshot.`,
    )
  }

  for (const modifier of recipe.modifiers) {
    if (!component.modifiers.includes(modifier)) {
      throw new CompileError(
        `"${modifier}" is not a modifier of ${recipe.component}. The design system ships: ` +
          `${component.modifiers.join(', ') || '(none)'}.`,
      )
    }
    if (!isKnownClass(modifier)) {
      throw new CompileError(
        `"${modifier}" is not in the vendored stylesheet — run npm run ds:css, or the design ` +
          `system dropped it.`,
      )
    }
  }

  const withModifiers = template.replaceAll(
    '{{modifiers}}',
    recipe.modifiers.length > 0 ? ` ${recipe.modifiers.join(' ')}` : '',
  )

  // The label is escaped before it goes anywhere near the markup, and the rename
  // runs on the template only — a label containing `class="..."` cannot smuggle a
  // class through, because renaming happens first.
  const renamed = renameClassAttributes(withModifiers)
  const compiled = renamed.replaceAll('{{label}}', escapeHtml(recipe.label))

  return {
    kind: 'css-ui',
    component: recipe.component,
    modifiers: recipe.modifiers,
    label: recipe.label,
    compiled,
    cssChecksum: DS_CSS_CHECKSUM,
  }
}

/** Recompiles a stored render, for after `ds:css` has been re-run with a new salt. */
export function recompile(render: CssUiRender): CssUiRender {
  return compileCssUi({
    component: render.component,
    modifiers: render.modifiers,
    label: render.label,
  })
}
