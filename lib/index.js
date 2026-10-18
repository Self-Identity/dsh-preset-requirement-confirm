/**
 * dsh-preset-requirement-confirm — Host half of the bundle-level row.
 *
 * Nothing runs on the Host. The row exists so the client module graph attaches
 * this package's browser half (`lib/client.js`, declared under
 * `package.json` `dsh.client`) and so the bundle can be switched on as a whole.
 * The questionnaire tool is a separate module (`lib/tool.js`) mounted only as a
 * row inside the `requirement-confirm` agent preset.
 *
 * No imports on purpose: this file must stay resolvable without the profile's
 * module tree (third-party profile packages must not import `@deepseek-ai/*`).
 */

export const name = 'preset-requirement-confirm-host'

export function apply() {}
