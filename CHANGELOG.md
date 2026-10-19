# Changelog

All notable changes to this package are documented here. Versions follow
[semantic versioning](https://semver.org/).

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
