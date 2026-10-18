/**
 * Repeatable acceptance checks for dsh-preset-requirement-confirm.
 *
 * Runs the plugin-internal contract checks without a browser or a running
 * client: manifest/exports, patch structure, both host halves, and the browser
 * half against a minimal fake DOM (style injection + disposal).
 *
 * Usage:
 *   node tools/validate.mjs
 *   node tools/validate.mjs --official <path-to-official-ui-user-questions-lib-client.js>
 *     additionally verifies that the structural anchors the stylesheet relies on
 *     (data-question-scroll, the un-roled detail block, the 24px title inset and
 *     the label-tertiary option description) still exist in the client bundle.
 *     Extract it with the asar-extract helper of the dsh-plugin-authoring skill.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PKG = 'dsh-preset-requirement-confirm'

// js-yaml lives outside this package (the plugin ships no node_modules): resolve
// it locally when running from a checkout, otherwise through the desktop
// profile's module tree.
let yaml
try {
  yaml = (await import('js-yaml')).default
} catch {
  const { createRequire } = await import('node:module')
  const dshHome = process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
  yaml = createRequire(path.join(dshHome, 'profiles', 'desktop', 'package.json'))('js-yaml')
}

const officialIndex = process.argv.indexOf('--official')
const officialPath = officialIndex === -1 ? undefined : process.argv[officialIndex + 1]

const checks = []
const check = (label, ok, detail = '') => {
  checks.push({ label, ok })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === '' ? '' : ` — ${detail}`}`)
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
check('manifest name', manifest.name === PKG)
check('bundle patch declared', manifest.dsh?.bundle?.patch === './cordis.patch.yml')
check('client platform web', manifest.dsh?.client?.platform === 'web')
check('exports . / ./tool / ./client', ['.', './tool', './client'].every((key) => typeof manifest.exports?.[key] === 'string'))
check('entry files exist', ['.', './tool', './client'].every((key) => fs.existsSync(path.join(ROOT, manifest.exports[key]))))
check('icon declared and present', manifest.icon === './icon.svg' && fs.existsSync(path.join(ROOT, 'icon.svg')) && fs.readFileSync(path.join(ROOT, 'icon.svg'), 'utf8').trimStart().startsWith('<svg'))
check('locale exports declared', ['./locale/en.json', './locale/zh.json'].every((key) => typeof manifest.exports?.[key] === 'string'))
check('files include locale and icon', Array.isArray(manifest.files) && manifest.files.includes('locale') && manifest.files.includes('icon.svg'))

const JsTag = new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar' })
const patch = yaml.load(fs.readFileSync(path.join(ROOT, 'cordis.patch.yml'), 'utf8'), {
  schema: yaml.DEFAULT_SCHEMA.extend([JsTag]),
})
check('patch is two insert entries', Array.isArray(patch) && patch.length === 2
  && patch.every((entry) => Array.isArray(entry.insert) && entry.insert.length === 1))
const presetRow = patch[0].insert[0]
const bundleRow = patch[1].insert[0]
check('preset row', presetRow.id === 'preset-requirement-confirm' && presetRow.name === '@deepseek-ai/dsh-agent-preset')
check('bundle row names the package root', bundleRow.id === 'client-ui-requirement-questionnaire' && bundleRow.name === PKG)

const preset = presetRow.config
check('preset identity', preset.id === 'requirement-confirm' && preset.order === 5 && String(preset.name).startsWith('需求确认'))
const collect = (rows, out = []) => {
  for (const row of rows) {
    if (row === null || typeof row !== 'object') continue
    out.push(row)
    if (Array.isArray(row.config)) collect(row.config, out)
  }
  return out
}
const presetRows = collect(preset.plugins)
const ids = [...presetRows.map((row) => row.id), presetRow.id, bundleRow.id]
check('row ids unique', new Set(ids).size === ids.length)
check('tool row uses ./tool', presetRows.find((row) => row.id === 'tool-requirement-questionnaire')?.name === `${PKG}/tool`)
check('shipped ask-user disabled', presetRows.find((row) => row.id === 'tool-ask-user')?.disabled === true)
check('persona workflow kept', String(preset.plugins[0].config.prefix).includes('需求确认工作流'))
check('preset name is bilingual', String(preset.name).includes('需求确认') && String(preset.name).includes('Requirement Confirmation'))
check('preset description is bilingual and carries the flow', String(preset.description).includes('用法') && String(preset.description).includes('Standard mode plus confirm-before-execute'))

const host = await import(pathToFileURL(path.join(ROOT, 'lib/index.js')).href)
check('bundle host half inert', host.name === 'preset-requirement-confirm-host' && host.apply() === undefined)

const tool = await import(pathToFileURL(path.join(ROOT, 'lib/tool.js')).href)
const registered = []
const asked = []
tool.apply({
  tools: { register: (definition) => { registered.push(definition); return () => {} } },
  userQuestions: { ask: async (request) => { asked.push(request); return { answers: [{ id: 'q', selected: ['以上皆可'] }] } } },
})
const definition = registered[0]
check('tool registers ask_user_question', registered.length === 1 && definition.name === 'ask_user_question')
check('tool satisfies register() contract', typeof definition.output?.schema === 'object' && typeof definition.output?.render === 'function')
check('tool schema carries detail', 'detail' in definition.parameters.properties.questions.items.properties)
const result = await definition.execute(
  { questions: [{ id: 'q', question: 'q?', detail: '解释', options: [{ label: '以上皆可' }] }] },
  { signal: new AbortController().signal },
)
check('tool forwards detail', result.answers[0].id === 'q' && asked[0].questions[0].detail === '解释')
let duplicateRejected = false
try {
  await definition.execute({ questions: [{ id: 'd', question: 'a' }, { id: 'd', question: 'b' }] }, { signal: new AbortController().signal })
} catch (error) {
  duplicateRejected = /unique/.test(String(error))
}
check('tool rejects duplicate ids', duplicateRejected)

const styleNodes = []
function fakeContainer() {
  const container = {
    appendChild(node) { node.parentNode = container; styleNodes.push(node) },
    removeChild(node) { const index = styleNodes.indexOf(node); if (index !== -1) styleNodes.splice(index, 1); node.parentNode = null },
  }
  return container
}
const body = fakeContainer()
globalThis.window = { __ModuleLoader__: { load: (entry) => { globalThis.__loaded = entry } } }
globalThis.document = {
  head: null,
  body,
  createElement() { return { tagName: 'style', dataset: {}, textContent: '', parentNode: null } },
  querySelector(selector) {
    const match = /data-plugin="([^"]+)"/.exec(selector)
    if (match === null) return null
    return styleNodes.find((node) => node.dataset.plugin === match[1]) ?? null
  },
}
await import(pathToFileURL(path.join(ROOT, 'lib/client.js')).href)
const loaded = globalThis.__loaded
check('client registers one module', loaded !== null && loaded.id === PKG)
const plugin = loaded.factory()
check('client factory returns a cordis plugin', plugin.name === PKG && Array.isArray(plugin.inject) && typeof plugin.apply === 'function')
const effects = []
plugin.apply({ effect: (fn, label) => { effects.push({ label, dispose: fn() }); return effects[effects.length - 1].dispose } })
const style = styleNodes[0]
check('client injects one style node', styleNodes.length === 1 && style.dataset.plugin === PKG)
check('style targets the un-roled first child', style.textContent.includes('[data-question-scroll] > div:first-child:not([role])'))
check('style insets 24px (title alignment)', style.textContent.includes('padding-inline:24px'))
check('style uses label-tertiary', style.textContent.includes('color:var(--dsw-alias-label-tertiary)'))
check('style drops the old 2px inline margin', style.textContent.includes('margin-inline:0'))
plugin.apply({ effect: (fn) => { effects.push({ label: 'second', dispose: fn() }); return effects[effects.length - 1].dispose } })
check('repeated apply does not duplicate', styleNodes.length === 1)
effects[0].dispose()
check('disposal removes the style node', styleNodes.length === 0)

if (officialPath !== undefined) {
  const official = fs.readFileSync(officialPath, 'utf8')
  check('official: scroll marker', official.includes('"data-question-scroll": true'))
  check('official: 24px title inset', official.includes('.mAtvLq_header{') && official.includes('padding:20px 16px 0 24px'))
  check('official: label-tertiary option description', official.includes('.mAtvLq_description{color:var(--dsw-alias-label-tertiary)'))
  check('official: detail is the un-roled first child',
    official.indexOf('data-question-scroll') < official.indexOf('css_default.detail')
    && official.indexOf('css_default.detail') < official.indexOf('css_default.options')
    && official.includes('role: question.multiSelect === true ? "group" : "radiogroup"'))
}

const localeZh = JSON.parse(fs.readFileSync(path.join(ROOT, 'locale/zh.json'), 'utf8'))
const localeEn = JSON.parse(fs.readFileSync(path.join(ROOT, 'locale/en.json'), 'utf8'))
check('zh metadata title', localeZh.meta?.title === '需求确认')
check('en metadata title', localeEn.meta?.title === 'Requirement Confirmation')
check('metadata descriptions carry the usage flow', String(localeZh.meta?.description).includes('使用流程') && String(localeEn.meta?.description).includes('Usage'))
check('metadata descriptions are language-specific', localeZh.meta?.description !== localeEn.meta?.description)

const failed = checks.filter((entry) => !entry.ok).length
console.log(`\n${failed === 0 ? 'VALIDATE PASS' : `VALIDATE FAIL (${failed})`}`)
process.exit(failed === 0 ? 0 : 1)
