# dsh-preset-requirement-confirm

[中文](README.md) | [English](README.en.md)

[![npm](https://img.shields.io/npm/v/dsh-preset-requirement-confirm.svg)](https://www.npmjs.com/package/dsh-preset-requirement-confirm)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A DSH agent preset that confirms the requirement before executing: the agent splits the request into sub-requirements, asks one questionnaire (choices, multi-select, free text, a plain-language explanation per question), and only starts working after you submit it.

The package is a bundle with two halves:

- **Agent preset (host)**: inserts an `@deepseek-ai/dsh-agent-preset` row, so **Requirement Confirmation** appears in the preset picker. It also registers the `ask_user_question` tool through `./tool`, whose schema adds an optional per-question `detail`.
- **Browser styling (client)**: insets each question's explanation by 24px so it aligns with the question title, and paints it in the option-description gray.

> Target client: DSH desktop **0.2.1-rc.1 / 0.2.1-rc.2**.

**Usage**: start a session in this mode, describe the task, answer the questionnaire the agent sends, and submit. The agent executes only after the answers; approvals show the model-written `justification` in the approval panel.

## Install

1. Client sidebar → **Plugins** → **Add plugin**.
2. Enter `dsh-preset-requirement-confirm@1.3.0` (or choose the local source directory).
3. **Install** → **Enable now**; restart the client if it says the change takes effect on the next start.
4. Open a new session and pick **Requirement Confirmation** in the preset selector.

## Usage

1. Describe a task that has several aspects.
2. The model calls `ask_user_question`: every question shows an explanation (`detail`), a set of choices including **Any of these**, and a free-text field.
3. The model starts executing only after you submit.
4. When an operation needs your approval, the approval panel shows the model-written `justification`.

## Difference from the shipped `standard` preset

Aligned with the `standard` composition of 0.2.1-rc.1 / rc.2, with two changes:

- the persona `prefix` adds the four-step workflow (split → questionnaire → wait → authorization note);
- the shipped `@deepseek-ai/dsh-tool-ask-user` row is disabled, and the same tool name is registered by this package's `./tool` with the extra `detail` field.

Every other row is identical to `standard` (persona, agent-instructions, time-context, bash/pwsh, fs, jobs, schedule, skill, goal, plan mode, compaction, delegation and workflow-ptc, todo, web, present, plugin-manager, plugin-market).

Registering the same tool name is intentional: the questionnaire card and the tool row are associated by the name `ask_user_question`, and renaming it would break integrations such as reopening a closed card from the tool row.

## Why the client half is needed

The shipped questionnaire card (`dsh-client-ui-user-questions`) renders each `detail` as the first child without a `role` in the card's scroll area, but its stylesheet gives that block only `margin: 0 2px 8px` and no horizontal padding, so the explanation hugs the card edge while the title is inset by 24px.

The browser half injects one rule:

```css
[data-question-scroll] > div:first-child:not([role]) {
  margin-inline: 0;
  padding-inline: 24px;
  color: var(--dsw-alias-label-tertiary);
}
```

The selector anchors on structure, not on class names: CSS-module class names change on every build, while `data-question-scroll`, the role-less explanation block and the role-bearing options block are stable. A question without `detail` starts with the options block (which has a role), so the rule does not apply. The style node is attached to the plugin fiber and removed on disable or reload.

## Known limitations

- **The selector depends on the card structure.** If a future client drops `data-question-scroll` or reorders the children, the styling silently stops applying; it does not break the layout.
- **Only the generic questionnaire card is affected.** Plan-review cards and answered-replay cards do not use `data-question-scroll`.
- **The preset is advisory.** A model can still skip the questionnaire; use sandbox and approval policy when a hard gate is required.
- **The approval explanation is not a separate collapsible block.** The plugin requires the model to write a clear `justification` through the persona; it does not modify the client.

## Compatibility

Target client **0.2.1-rc.2**. All JavaScript avoids `@deepseek-ai/*` imports: the host half uses only `ctx.tools.register()` and `ctx.userQuestions.ask()`, and the client half uses the browser module loader plus the DOM.

## Layout

```
dsh-preset-requirement-confirm/
├── package.json         # dsh.bundle.patch (host patch) + dsh.client (browser half)
├── cordis.patch.yml     # preset declaration + bundle-level row
├── lib/index.js         # bundle row host half: inert
├── lib/tool.js          # preset row: registers ask_user_question with detail
├── lib/client.js        # browser half: explanation alignment and color
└── README.md
```

## Uninstall

Disable or remove the bundle in **Plugins**, then restart the client.

## Development

```powershell
node --check lib/index.js
node --check lib/tool.js
node --check lib/client.js
node tools/validate.mjs
```

## License

MIT. Not affiliated with DeepSeek.
