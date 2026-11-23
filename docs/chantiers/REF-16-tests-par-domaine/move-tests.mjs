#!/usr/bin/env node
// REF-16: moves describes (or some of their tests) out of plugins/atelier/test/core.test.mjs into a
// domain file, with the imports the moved code uses; prunes the imports core.test.mjs no longer uses.
// One domain per run, from a clean tree, then check-moves.mjs, then one commit per domain (plan.md).
// usage: node docs/chantiers/REF-16-tests-par-domaine/move-tests.mjs <domain>
// The domains of tranche 2 are done: kept as the record of what was moved, they no longer run.
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../../../plugins/atelier/test/', import.meta.url))
const corePath = join(dir, 'core.test.mjs')

// unit: { describe, name?, tests?: regex on the raw title (subset), helpers?: [function names, moved before] }
const DOMAINS = {
  // ---------- tranche 2 (done; tests were still labeled CA-x : <title> then)
  common: [
    { describe: 'front matter' }, { describe: 'project relative paths' }, { describe: 'git output' },
    { describe: 'tool edits' }, { describe: 'path patterns' },
  ],
  identifiers: [
    { describe: 'chantier identifiers' },
    { describe: 'chantier id from commit subjects' },
    { helpers: ['addChantierSpec', 'makeDeductionRepository'] },
    { describe: 'active chantier deduced from commits' },
    { describe: 'chantier source shown to the user' },
    { helpers: ['makeRepositoryWithOrigin'] },
    { describe: 'default branch resolved through origin/HEAD' },
    { describe: 'FEAT-4 EPIC type', name: 'EPIC identifiers', tests: /^CA-6 / },
    { helpers: ['makeCounterRepository'] },
    { describe: 'Next identifier: where the counter reads identifiers' },
  ],
  relations: [
    { describe: 'FEAT-4 relations read from the spec header' },
    { describe: 'FEAT-4 children of an EPIC across branches' },
  ],
  spec: [
    { describe: 'spec completeness' }, { describe: 'amendments section' },
    { describe: 'FEAT-4 relations checked before signature' },
    { describe: 'FEAT-4 EPIC type', name: 'EPIC spec and templates', tests: /^CA-7 / },
  ],
  // ---------- tranche 3 (tests already renamed: a subset is selected by its label suffix)
  'write-guard': [
    { describe: 'write guard' },
    { describe: 'write guard on a spec that is no longer a draft' },
    { describe: 'write guard on a spec whose committed version is a draft' },
    { describe: 'FEAT-7 write guard and stop hook per slice' },
    { describe: 'FEAT-7 plan and current slice', name: 'slice fields written by the command', tests: /\[FEAT-7 CA-5\]$/ },
    { describe: 'FEAT-4 EPIC type', name: 'write guard on an EPIC' },
  ],
  'stop-hook': [{ describe: 'stop hook' }],
  checks: [{ describe: 'TEC-23 checks run once per working tree' }],
  tdd: [
    { describe: 'test-driven phases' }, { describe: 'refreeze detection' }, { describe: 'reopen tests' },
    { helpers: ['amendmentEntries'] },
    { describe: 'FEAT-7 freezing the tests of a slice' },
  ],
  slices: [{ describe: 'FEAT-7 plan and current slice' }],
}

const UNPREFIXED = {
  'write guard on a spec whose committed version is a draft': 'TEC-5',
  'chantier id from commit subjects': 'TEC-6',
  'active chantier deduced from commits': 'TEC-6',
  'chantier source shown to the user': 'TEC-6',
  'default branch resolved through origin/HEAD': 'TEC-6',
}
const PREFIX = /^(FEAT-4|FEAT-7|TEC-15|TEC-23|FIX-22)(?: :)? /
const LABEL = /^((?:CA|V)-\d+(?:(?:, ?|\/)(?:CA|V)-\d+)*)(?: : | )(.+)$/

function relabel(title, describe) {
  const match = LABEL.exec(title)
  if (!match) return title
  const id = PREFIX.exec(describe)?.[1] ?? UNPREFIXED[describe]
  if (!id) throw new Error(`no id for ${title}`)
  const criteria = match[1].split(/, ?|\//).map((label) => label.replace(/^V-/, 'CA-'))
  return `${match[2]} [${id} ${criteria.join(', ')}]`
}

// Rewrites the title literal of an `it(` line (single quotes only in this file).
function relabelLine(line, describe) {
  return line.replace(/^(\s*it\()'((?:\\.|[^'\\])*)'/, (all, head, raw) => {
    const title = raw.replace(/\\(.)/g, '$1')
    const renamed = relabel(title, describe)
    return `${head}'${renamed.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  })
}

const domain = process.argv[2]

// spec-ellipsis: check-spec-ellipsis.test.mjs renamed, describes without chantier id, the label of a
// nested describe moved onto each of its tests (spec §3).
if (domain === 'spec-ellipsis') {
  const source = join(dir, 'check-spec-ellipsis.test.mjs')
  const top = 'FIX-22 : « … » dans checkSpec'
  let label = null
  const result = readFileSync(source, 'utf8').split(/\r?\n/).map((line) => {
    if (line === `describe('${top}', () => {`) return `describe('${top.replace(PREFIX, '')}', () => {`
    const nested = /^  describe\('((?:\\.|[^'\\])*)', \(\) => \{$/.exec(line)
    if (nested) {
      const match = LABEL.exec(nested[1])
      if (!match) return line
      label = `[FIX-22 ${match[1].split(/, ?/).join(', ')}]`
      return `  describe('${match[2]}', () => {`
    }
    if (line === '  })') { label = null; return line }
    if (!/^\s*it\(/.test(line)) return line
    if (!label) return relabelLine(line, top)
    return line
      .replace(/^(\s*it\()'((?:\\.|[^'\\])*)'/, (all, head, title) => `${head}'${title} ${label}'`)
      .replace(/^(\s*it\()`((?:\\.|[^`\\])*)`/, (all, head, title) => `${head}\`${title} ${label}\``)
      .replace(/^(\s*it\()([A-Za-z_$][\w$]*),/, (all, head, name) => `${head}\`\${${name}} ${label}\`,`)
  })
  writeFileSync(join(dir, 'spec-ellipsis.test.mjs'), result.join('\r\n'))
  rmSync(source)
  console.log('renamed check-spec-ellipsis.test.mjs to spec-ellipsis.test.mjs')
  process.exit(0)
}

let lines = readFileSync(corePath, 'utf8').split(/\r?\n/)
const units = DOMAINS[domain]
const taken = new Set() // line indexes moved out
const out = []

function describeRange(name) {
  const start = lines.findIndex((l) => l === `describe('${name}', () => {`)
  if (start < 0) throw new Error(`describe not found: ${name}`)
  const end = lines.findIndex((l, i) => i > start && l === '})')
  return [start, end]
}

function functionRange(name) {
  const start = lines.findIndex((l) => l.startsWith(`function ${name}(`))
  if (start < 0) throw new Error(`function not found: ${name}`)
  let first = start
  while (first > 0 && lines[first - 1].startsWith('//') && !/^\/\/ -+ /.test(lines[first - 1])) first--
  const end = lines.findIndex((l, i) => i > start && l === '}')
  return [first, end]
}

function takeRange(s, e) {
  for (let i = s; i <= e; i++) taken.add(i)
  if (lines[e + 1] === "") taken.add(e + 1)
  else if (lines[s - 1] === "") taken.add(s - 1)
}

for (const unit of units) {
  if (unit.helpers) {
    for (const name of unit.helpers) {
      const [s, e] = functionRange(name)
      takeRange(s, e)
      out.push(lines.slice(s, e + 1).join('\n'))
    }
    continue
  }
  const [s, e] = describeRange(unit.describe)
  const title = unit.name ?? unit.describe.replace(PREFIX, '')
  if (!unit.tests) {
    takeRange(s, e)
    const body = lines.slice(s + 1, e).map((l) => relabelLine(l, unit.describe))
    out.push([`describe('${title.replace(/'/g, "\\'")}', () => {`, ...body, '})'].join('\n'))
    continue
  }
  // Subset: tests at indent 2 whose title matches.
  const picked = []
  for (let i = s + 1; i < e; i++) {
    const m = /^  it\('((?:\\.|[^'\\])*)'/.exec(lines[i])
    if (!m || !unit.tests.test(m[1])) continue
    let j = i
    if (!lines[i].endsWith('})')) j = lines.findIndex((l, k) => k > i && l === '  })')
    picked.push(lines.slice(i, j + 1).map((l) => relabelLine(l, unit.describe)).join('\n'))
    for (let k = i; k <= j; k++) taken.add(k)
    // drop the blank line before the test (or after, if first)
    if (lines[i - 1] === '' && !taken.has(i - 1)) taken.add(i - 1)
    else if (lines[j + 1] === '') taken.add(j + 1)
    i = j
  }
  if (!picked.length) throw new Error(`no test picked in ${unit.describe}`)
  out.push([`describe('${title}', () => {`, picked.join('\n\n'), '})'].join('\n'))
}

// Remove moved lines, then collapse runs of blank lines left behind (max 2, as in the base).
let remaining = lines.filter((_, i) => !taken.has(i))
// Drop section comments whose section no longer holds anything before the next section.
remaining = remaining.filter((l, i) => {
  if (!/^\/\/ -+ [A-Z]+-\d+: .* -+$/.test(l)) return true
  for (let k = i + 1; k < remaining.length; k++) {
    if (/^\/\/ -+ [A-Z]+-\d+: /.test(remaining[k])) return false
    if (remaining[k].trim() !== '') return true
  }
  return false
})
const collapsed = []
for (const l of remaining) {
  if (l === '' && collapsed.at(-1) === '' && collapsed.at(-2) === '') continue
  collapsed.push(l)
}
while (collapsed.at(-1) === '' && collapsed.at(-2) === '') collapsed.pop()

// ---- imports
function withoutStrings(text) {
  return text.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")
}
const NODE = [
  ['assert', "import assert from 'node:assert/strict'", /\bassert\b/],
]
function headerFor(text) {
  const body = withoutStrings(text)
  const used = (name) => new RegExp(`(?<![\\w$])(?<![^.]\\.)${name}(?![\\w$])`).test(body)
  const coreHeader = readFileSync(corePath, 'utf8').split(/\r?\n/)
  const coreNamed = []
  const helperNames = []
  let block = null
  for (const l of coreHeader) {
    if (l === 'import {') { block = []; continue }
    if (block && /^\} from '\.\.\/lib\/core\.mjs'$/.test(l)) { coreNamed.push(...block); block = null; continue }
    if (block && /^\} from '\.\/helpers\.mjs'$/.test(l)) { helperNames.push(...block); block = null; continue }
    if (block) block.push(...l.split(',').map((s) => s.trim()).filter(Boolean))
  }
  const header = []
  if (used('assert')) header.push("import assert from 'node:assert/strict'")
  const childProcess = ['execFileSync', 'spawnSync'].filter(used)
  if (childProcess.length) header.push(`import { ${childProcess.join(', ')} } from 'node:child_process'`)
  const fs = ['mkdirSync', 'readFileSync', 'readdirSync', 'writeFileSync'].filter(used)
  if (fs.length) header.push(`import { ${fs.join(', ')} } from 'node:fs'`)
  const usesPath = /(?<![\w.$])path\.\w/.test(body)
  const usesJoin = used('join')
  if (usesPath || usesJoin) header.push(`import ${[usesPath && 'path', usesJoin && '{ join }'].filter(Boolean).join(', ')} from 'node:path'`)
  header.push("import { describe, it } from 'node:test'")
  if (used('fileURLToPath')) header.push("import { fileURLToPath } from 'node:url'")
  const named = coreNamed.filter(used)
  if (named.length) header.push(`import { ${named.join(', ')} } from '../lib/core.mjs'`)
  if (/\bcore\./.test(body)) header.push("import * as core from '../lib/core.mjs'")
  const helpers = helperNames.filter(used)
  if (helpers.length) header.push(`import { ${helpers.join(', ')} } from './helpers.mjs'`)
  return header.join('\n')
}

const newBody = out.join('\n\n')
const target = join(dir, `${domain}.test.mjs`)
if (existsSync(target)) throw new Error(`exists: ${target}`)
writeFileSync(target, `${headerFor(newBody)}\n\n${newBody}\n`.replace(/\n/g, '\r\n'))

// Prune now-unused imports of core.test.mjs.
const coreText = collapsed.join('\n')
const headerEnd = coreText.indexOf('\ndescribe(')
const head = coreText.slice(0, headerEnd)
const rest = coreText.slice(headerEnd)
const restCode = withoutStrings(rest)
const stillUsed = (name) => new RegExp(`(?<![\\w$])(?<![^.]\\.)${name}(?![\\w$])`).test(restCode)
const prunedHead = head.split('\n').map((l) => {
  let m
  if ((m = /^import \{ (.+) \} from '(.+)'$/.exec(l))) {
    const names = m[1].split(', ').filter(stillUsed)
    return names.length ? `import { ${names.join(', ')} } from '${m[2]}'` : null
  }
  if ((m = /^import path, \{ join \} from 'node:path'$/.exec(l))) {
    const p = /(?<![\w.$])path\.\w/.test(restCode), j = stillUsed('join')
    return p || j ? `import ${[p && 'path', j && '{ join }'].filter(Boolean).join(', ')} from 'node:path'` : null
  }
  if (/^import \* as core/.test(l)) return /\bcore\./.test(rest) ? l : null
  if (/^import |^\} from |^import \{$/.test(l) || l === '') return l
  // a line of names inside a block
  const names = l.split(',').map((s) => s.trim()).filter(Boolean)
  const kept = names.filter(stillUsed)
  if (!kept.length) return null
  return `  ${kept.join(', ')}${l.trim().endsWith(',') ? ',' : ''}`
}).filter((l) => l !== null).join('\n')
writeFileSync(corePath, (prunedHead + rest).replace(/\n/g, '\r\n'))
console.log(`moved ${taken.size} lines to ${domain}.test.mjs`)
