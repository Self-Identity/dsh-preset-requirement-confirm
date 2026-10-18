/**
 * dsh-preset-requirement-confirm — browser half.
 *
 * The questionnaire is rendered by the shipped `dsh-client-ui-user-questions`
 * card. Its per-question `detail` block (the plain-language explanation under the
 * question title) is the first un-roled child of the card's scroll body:
 *
 *     <div class="…body" data-question-scroll>
 *       <div class="…detail">   <- the explanation (no role attribute)
 *       <div class="…options" role="radiogroup|group"> … </div>
 *     </div>
 *
 * The shipped CSS gives that block `margin: 0 2px 8px` and no inline padding, so
 * its text starts at the card edge while the title starts at the header's 24px
 * inset (`…header { padding: 20px 16px 0 24px }`). This plugin:
 *
 *   - insets the explanation 24px on both sides (left edge aligns with the title);
 *   - paints it with `--dsw-alias-label-tertiary`, the token the card itself uses
 *     for option descriptions (`…description`).
 *
 * The selector is structural on purpose: the card's class names are CSS-module
 * hashes that change between client builds, while `data-question-scroll`, the
 * no-role detail block and the role-bearing options block are stable across the
 * shipped card's versions. When a question carries no `detail`, the first child
 * is the options block (it has a role), so nothing is matched.
 *
 * No imports: React is not needed for a stylesheet, and client plugins resolve
 * no other module here.
 */

window.__ModuleLoader__.load({
  id: 'dsh-preset-requirement-confirm',
  factory: () => {
    'use strict'

    /** Package name; also the `style[data-plugin]` key and the row id. */
    const PKG = 'dsh-preset-requirement-confirm'

    /**
     * Explanation block under the question title: 24px inline inset (equal to
     * the title's header inset) and the option-description gray.
     */
    const DETAIL_CSS = [
      '[data-question-scroll] > div:first-child:not([role]){',
      'margin-inline:0;',
      'padding-inline:24px;',
      'color:var(--dsw-alias-label-tertiary);',
      '}',
    ].join('')

    /** Insert the stylesheet once; returns its remover. */
    function insertStyles() {
      if (typeof document === 'undefined') return function noop() {}
      const selector = 'style[data-plugin="' + PKG + '"]'
      if (document.querySelector(selector) !== null) return function noop() {}
      const host = document.head || document.body
      if (host === null || host === undefined) return function noop() {}
      const node = document.createElement('style')
      node.dataset.plugin = PKG
      node.textContent = DETAIL_CSS
      host.appendChild(node)
      return function removeStyles() {
        if (node.parentNode !== null) node.parentNode.removeChild(node)
      }
    }

    /** Client plugin body: own the stylesheet with the plugin fiber. */
    function apply(ctx) {
      try {
        ctx.effect(() => insertStyles(), PKG + ': question detail styling')
      } catch (error) {
        try {
          console.error('[' + PKG + '] activation failed; the plugin stays inert', error)
        } catch {
          /* console may be unavailable in an exotic carrier */
        }
      }
    }

    return {
      name: PKG,
      inject: [],
      apply,
    }
  },
})
