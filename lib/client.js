/**
 * dsh-preset-requirement-confirm — browser half.
 *
 * The questionnaire is rendered by the shipped `dsh-client-ui-user-questions`
 * card. In DSH 0.2.2-rc.1 the card's scroll body has three children:
 *
 *     <div class="…body" data-question-scroll>
 *       <div class="…questionTitle">   <- 1st child, no role (h2 title + toggle)
 *       <div class="…detail">          <- 2nd child, no role, only with `detail`
 *       <div class="…options" role="radiogroup|group"> … </div>
 *
 * Upstream now styles the detail block with `margin: 0 24px 8px`, which matches
 * the title block's `margin: 5px 24px 0` inline inset, so the explanation is
 * already aligned under the title. It still inherits the card's primary label
 * color, so this plugin paints the explanation with
 * `--dsw-alias-label-tertiary` — the token the card itself uses for option
 * descriptions (`…description`).
 *
 * The 0.2.1 selectors (`> div:first-child:not([role])`) must NOT be reused:
 * since 0.2.2 the first child is the question-title block, so that rule would
 * recolor the title and add a second 24px inset. The title block is always the
 * first child, so the explanation is selected as the second child when it
 * carries no role; a question without `detail` has the role-bearing options
 * block in that slot and matches nothing.
 *
 * The selector is structural on purpose: the card's class names are CSS-module
 * hashes that change between client builds, while `data-question-scroll`, the
 * child order, the no-role detail block and the role-bearing options block are
 * stable across the shipped card's versions.
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
     * Explanation block under the question title: the option-description gray.
     * Alignment (24px inline inset) is owned by the shipped card since
     * 0.2.2-rc.1, so this rule must not add margin or padding of its own.
     */
    const DETAIL_CSS = [
      '[data-question-scroll] > div:nth-child(2):not([role]){',
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
