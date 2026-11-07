# Changelog

All notable changes to this package are documented here. Versions follow
[semantic versioning](https://semver.org/).

## 1.4.0 — 2026-11-07

Adapted to DSH **0.2.2-rc.1**, where the preset was missing from the mode
picker because its composition no longer mounted:

- Drop the `@deepseek-ai/dsh-tool-subagent-control/list-agents` child row. The
  subpath export is gone in 0.2.2-rc.1 (`list_agents` is registered by the root
  `dsh-tool-subagent-control` plugin), and the failed import marked the whole
  preset broken, so the picker — which lists healthy presets only — hid it.
- Follow the renamed subagent config: `modelSelectionSettings` becomes
  `modelSelection: true` plus `modelDiscovery: true`.
- Restore `tool-fs`'s `applyPatch: false` and `tool-plugin-manager`'s
  `!!js "!ctx.get('profileContext')"` condition from the 0.2.2 `standard`
  composition.
- Client half: 0.2.2's card now puts the question-title block first and styles
  the `detail` block with the 24px inset itself. The stylesheet now targets
  `[data-question-scroll] > div:nth-child(2):not([role])` and only paints the
  option-description gray; the old first-child selector would have recolored
  the title and double-inset the explanation.
- Tool description carries the 0.2.2 skip semantics.
- `engines.dsh` now `>=0.2.2-rc.1 <0.3.0`; `tools/validate.mjs` now also reads
  the installed `app.asar` to check every row resolves and that the preset still
  matches the shipped `standard` composition row by row.

## 1.3.0 — 2026-10-18

- Bilingual plugin metadata (`locale/zh.json`, `locale/en.json`) for the card
  title and description; the preset name and description stay bilingual in
  `cordis.patch.yml`.
- `repository`, `homepage`, `bugs`, `author` and `engines.dsh` declared for
  publication.

## 1.2.0 — 2026-10-18

- Client half: the per-question explanation (`detail`) is inset by 24px so it
  aligns with the question title, and painted in the option-description gray
  (`--dsw-alias-label-tertiary`). The selector anchors on structure, not on
  hashed class names.

## 1.0.0 — 2026-10-18

- Initial release: a `requirement-confirm` agent preset that keeps the shipped
  in `standard` composition, disables the shipped `ask_user_question` row and
  registers the same tool name through `./tool`, whose schema adds an optional
  per-question `detail`.
