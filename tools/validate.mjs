/**
 * Repeatable acceptance checks for dsh-preset-requirement-confirm.
 *
 * Runs the plugin-internal contract checks without a browser or a running
 * client: manifest/exports, patch structure, both host halves, and the browser
 * half against a minimal fake DOM (style injection + disposal).
 *
 * When the installed DSH `app.asar` is readable (or `--asar` names one), the
 * script also checks the plugin against the runtime it targets:
 *
 *   - every preset child row name resolves to an installed package/subpath
 *     export (a removed subpath is exactly what once hid the preset);
 *   - every row of this preset matches the shipped `standard` preset of that
 *     runtime, apart from the two documented changes plus the questionnaire row
 *     (this is the upgrade-drift guard);
 *   - the Web question card still carries the structural anchors the browser
 *     half relies on (auto-read from the asar; `--official <client.js>` overrides).
 *
 * Usage:
 *   node tools/validate.mjs
 *   node tools/validate.mjs --asar "F:\DSH-Official\resources\app.asar"
 *   node tools/validate.mjs --official <path-to-official-ui-user-questions-lib-client.js>
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PKG = 'dsh-preset-requirement-confirm'

const argOf = (name) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

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

const checks = []
const skipped = []
const check = (label, ok, detail = '') => {
  checks.push({ label, ok })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === '' ? '' : ` — ${detail}`}`)
}
const skip = (label, why) => {
  skipped.push({ label, why })
  console.log(`skip ${label} — ${why}`)
}

/** Minimal read-only app.asar reader (Electron archive: header JSON + data). */
function openAsar(file) {
  const buffer = fs.readFileSync(file)
  const headerSize = buffer.readUInt32LE(12)
  const header = JSON.parse(buffer.subarray(16, 16 + headerSize).toString('utf8'))
  const dataStart = 8 + buffer.readUInt32LE(4)
  const entries = new Map()
  const walk = (node, prefix) => {
    for (const [name, value] of Object.entries(node.files ?? {})) {
      const key = prefix === '' ? name : `${prefix}/${name}`
      if (value.files !== undefined) walk(value, key)
      else entries.set(key, { size: value.size, offset: Number(value.offset) })
    }
  }
  walk(header, '')
  return {
    read(archivePath) {
      const entry = entries.get(archivePath)
      if (entry === undefined) return undefined
      return buffer.subarray(dataStart + entry.offset, dataStart + entry.offset + entry.size).toString('utf8')
    },
    readJson(archivePath) {
      const text = this.read(archivePath)
      return text === undefined ? undefined : JSON.parse(text)
    },
  }
}

const asarPath = argOf('--asar')
  ?? (fs.existsSync('F:\\DSH-Official\\resources\\app.asar') ? 'F:\\DSH-Official\\resources\\app.asar' : undefined)
let asar
if (asarPath !== undefined && fs.existsSync(asarPath)) {
  try {
    asar = openAsar(asarPath)
  } catch (error) {
    skip('runtime parity', `cannot read ${asarPath}: ${String(error)}`)
  }
} else {
  skip('runtime parity', 'no app.asar (pass --asar <path>)')
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
check('engines.dsh targets 0.2.2', String(manifest.engines?.dsh).startsWith('>=0.2.2-rc.1'))

const JsTag = new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar' })
const yamlSchema = yaml.DEFAULT_SCHEMA.extend([JsTag])
const patch = yaml.load(fs.readFileSync(path.join(ROOT, 'cordis.patch.yml'), 'utf8'), { schema: yamlSchema })
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
const rowById = new Map(presetRows.map((row) => [row.id, row]))
check('tool row uses ./tool', rowById.get('tool-requirement-questionnaire')?.name === `${PKG}/tool`)
check('shipped ask-user disabled', rowById.get('tool-ask-user')?.disabled === true)
check('persona workflow kept', String(preset.plugins[0].config.prefix).includes('需求确认工作流'))
check('preset name is bilingual', String(preset.name).includes('需求确认') && String(preset.name).includes('Requirement Confirmation'))
check('preset description is bilingual and carries the flow', String(preset.description).includes('用法') && String(preset.description).includes('Standard mode plus confirm-before-execute'))

// 0.2.2-rc.1 composition facts that made the 0.2.1 preset fail to mount.
check('no removed /list-agents row', !presetRows.some((row) => String(row.name).endsWith('/list-agents')))
const subagentRow = rowById.get('tool-subagent')
check('subagent uses 0.2.2 model keys', subagentRow?.config?.modelSelection === true
  && subagentRow?.config?.modelDiscovery === true
  && !('modelSelectionSettings' in (subagentRow?.config ?? {})))
check('fs tool keeps apply_patch off', rowById.get('tool-fs')?.config?.applyPatch === false)
check('plugin-manager row keeps the 0.2.2 condition', typeof rowById.get('tool-plugin-manager')?.disabled === 'string')

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
check('tool description carries skip semantics', /skipped that question/.test(definition.description))
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
check('style targets the detail block, not the title', style.textContent.includes('[data-question-scroll] > div:nth-child(2):not([role])'))
check('style no longer re-insets the detail', !style.textContent.includes('padding-inline') && !style.textContent.includes('margin-inline'))
check('style uses label-tertiary', style.textContent.includes('color:var(--dsw-alias-label-tertiary)'))
plugin.apply({ effect: (fn) => { effects.push({ label: 'second', dispose: fn() }); return effects[effects.length - 1].dispose } })
check('repeated apply does not duplicate', styleNodes.length === 1)
effects[0].dispose()
check('disposal removes the style node', styleNodes.length === 0)

// The question card the browser half targets: auto-read from the asar, or an
// explicitly supplied extracted client.js.
const official = argOf('--official') !== undefined
  ? fs.readFileSync(argOf('--official'), 'utf8')
  : asar?.read('dsh/node_modules/@deepseek-ai/dsh-client-ui-user-questions/lib/client.js')
if (official === undefined) {
  skip('official client anchors', 'no user-questions client bundle found')
} else {
  check('official: scroll marker', official.includes('"data-question-scroll": true'))
  check('official: title block precedes detail', official.indexOf('css_default.questionTitle') !== -1
    && official.indexOf('css_default.questionTitle') < official.indexOf('css_default.detail'))
  check('official: detail precedes options', official.indexOf('css_default.detail') < official.indexOf('css_default.options'))
  check('official: options carry a role', official.includes('role: question.multiSelect === true ? "group" : "radiogroup"'))
  check('official: 24px title inset', official.includes('padding:20px 16px 0 24px'))
  check('official: detail keeps the 24px margin', /\.wnLwla_detail\{[^}]*margin:0 24px 8px/.test(official))
  check('official: label-tertiary option description', /_description\{[^}]*color:var\(--dsw-alias-label-tertiary\)/.test(official))
}

/**
 * Whether a package `exports` map or `main` makes `subpath` importable.
 * @param manifest - the installed package.json.
 * @param subpath - '.' or './tool' style key.
 * @returns true when Node-style resolution would find it.
 */
function exportExists(manifest, subpath) {
  const exportsField = manifest?.exports
  if (exportsField === undefined) return subpath === '.' && typeof manifest?.main === 'string'
  const keys = typeof exportsField === 'string' ? { '.': exportsField }
    : Array.isArray(exportsField) ? { '.': exportsField[0] } : exportsField
  if (Object.hasOwn(keys, subpath)) return true
  for (const key of Object.keys(keys)) {
    if (!key.includes('*')) continue
    const [head, tail] = key.split('*')
    if (subpath.startsWith(head) && subpath.endsWith(tail)) return true
  }
  return false
}

/** Resolve one preset row name against the installed runtime or this package. */
function resolveRowName(name) {
  if (name === 'cordis:group') return { ok: true }
  if (name === PKG || name.startsWith(`${PKG}/`)) {
    const subpath = name === PKG ? '.' : `./${name.slice(PKG.length + 1)}`
    return exportExists(manifest, subpath)
      ? { ok: true }
      : { ok: false, why: `${PKG} has no export ${subpath}` }
  }
  const match = /^((?:@[^/]+\/)?[^/@]+)(?:\/(.+))?$/.exec(name)
  if (match === null) return { ok: false, why: 'not a bare package specifier' }
  const packageName = match[1]
  const subpath = match[2] === undefined ? '.' : `./${match[2]}`
  if (asar === undefined) return { ok: true, why: 'unverified: no app.asar' }
  const installed = asar.readJson(`dsh/node_modules/${packageName}/package.json`)
  if (installed === undefined) return { ok: false, why: `${packageName} is not part of the runtime` }
  return exportExists(installed, subpath)
    ? { ok: true }
    : { ok: false, why: `${packageName} has no export ${subpath}` }
}

if (asar !== undefined) {
  const unresolved = presetRows
    .map((row) => ({ row, resolved: resolveRowName(String(row.name)) }))
    .filter((entry) => !entry.resolved.ok)
  check('every preset row resolves in the runtime', unresolved.length === 0,
    unresolved.map((entry) => `${entry.row.id}: ${entry.resolved.why}`).join('; '))
  check('bundle row resolves in the runtime', resolveRowName(bundleRow.name).ok === true)

  const standardText = asar.read('dsh/node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml')
  if (standardText === undefined) {
    skip('runtime parity with shipped standard', 'the runtime has no dsh-web-app standard preset')
  } else {
    const standard = yaml.load(standardText, { schema: yamlSchema })[0].insert[0].config
    const standardRows = collect(standard.plugins)
    const standardById = new Map(standardRows.map((row) => [row.id, row]))
    const deviations = new Map([
      ['persona', 'documented: the persona prefix carries the workflow'],
      ['tool-ask-user', 'documented: disabled in favour of ./tool'],
    ])
    const documentedExtras = new Set(['tool-requirement-questionnaire'])
    const extra = presetRows
      .filter((row) => !standardById.has(row.id) && !documentedExtras.has(row.id))
      .map((row) => row.id)
    check('no undocumented extra rows', extra.length === 0, extra.join(', '))
    const missing = standardRows.filter((row) => !rowById.has(row.id)).map((row) => row.id)
    check('no shipped standard row dropped', missing.length === 0, missing.join(', '))
    const drift = []
    for (const shipped of standardRows) {
      const own = rowById.get(shipped.id)
      if (own === undefined || deviations.has(shipped.id)) continue
      if (own.name !== shipped.name) drift.push(`${shipped.id}: name ${own.name} != ${shipped.name}`)
      if (JSON.stringify(own.disabled) !== JSON.stringify(shipped.disabled)) {
        drift.push(`${shipped.id}: disabled ${JSON.stringify(own.disabled)} != ${JSON.stringify(shipped.disabled)}`)
      }
      if (JSON.stringify(own.config) !== JSON.stringify(shipped.config)) drift.push(`${shipped.id}: config drifted from standard`)
    }
    check('preset matches the shipped standard composition', drift.length === 0, drift.join('; '))
  }
}

const localeZh = JSON.parse(fs.readFileSync(path.join(ROOT, 'locale/zh.json'), 'utf8'))
const localeEn = JSON.parse(fs.readFileSync(path.join(ROOT, 'locale/en.json'), 'utf8'))
check('zh metadata title', localeZh.meta?.title === '需求确认')
check('en metadata title', localeEn.meta?.title === 'Requirement Confirmation')
check('metadata descriptions carry the usage flow', String(localeZh.meta?.description).includes('使用流程') && String(localeEn.meta?.description).includes('Usage'))
check('metadata descriptions are language-specific', localeZh.meta?.description !== localeEn.meta?.description)

const failed = checks.filter((entry) => !entry.ok).length
console.log(`\n${failed === 0 ? 'VALIDATE PASS' : `VALIDATE FAIL (${failed})`}${skipped.length === 0 ? '' : ` (${skipped.length} skipped)`}`)
process.exit(failed === 0 ? 0 : 1)
