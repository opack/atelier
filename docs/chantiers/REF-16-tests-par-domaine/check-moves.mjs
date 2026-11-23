#!/usr/bin/env node
// REF-16: checks that splitting plugins/atelier/test/core.test.mjs by domain lost, duplicated or
// altered nothing (spec §4). Run from anywhere: node docs/chantiers/REF-16-tests-par-domaine/check-moves.mjs
// Never run it twice at the same time in the same repository: each run first removes the
// `ref16-base-*` worktrees it finds, including another run's.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE_COMMIT = '8c1a799'
const BASE_TEST_COUNT = 314
const TEST_DIRECTORY = 'plugins/atelier/test'
const WORKTREE_PREFIX = 'ref16-base-'
const root = fileURLToPath(new URL('../../../', import.meta.url))

// Chantier of the describes that carry V-x tests without an ID prefix (spec §3).
const UNPREFIXED_DESCRIBES = {
  'write guard on a spec whose committed version is a draft': 'TEC-5',
  'chantier id from commit subjects': 'TEC-6',
  'active chantier deduced from commits': 'TEC-6',
  'chantier source shown to the user': 'TEC-6',
  'default branch resolved through origin/HEAD': 'TEC-6',
}
const DESCRIBE_PREFIX = /^(FEAT-4|FEAT-7|TEC-15|TEC-23|FIX-22)(?: :)? /
const LABEL = /^((?:CA|V)-\d+(?:(?:, ?|\/)(?:CA|V)-\d+)*)(?: : | )(.+)$/

// ---------- names

// The name a base test must have once moved: label prefix turned into a `[<ID> CA-x]` suffix. A test
// without a label of its own takes the one of its innermost labeled nested describe (spec §3).
function renamed(name, suites) {
  const describe = suites[0]
  const match = LABEL.exec(name)
  const nested = suites.slice(1).reverse().map((suite) => LABEL.exec(suite)).find(Boolean)
  const label = match?.[1] ?? nested?.[1]
  if (!label) return name
  const id = DESCRIBE_PREFIX.exec(describe)?.[1] ?? UNPREFIXED_DESCRIBES[describe]
  if (!id) throw new Error(`étiquette sans chantier connu : « ${name} » dans « ${describe} »`)
  const criteria = label.split(/, ?|\//).map((criterion) => criterion.replace(/^V-/, 'CA-'))
  return `${match ? match[2] : name} [${id} ${criteria.join(', ')}]`
}

// Tests (not suites) of the TAP stream of `file`, with the names of their suites (outermost first);
// suites reported as failed.
function parseTap(text, file) {
  const lines = text.split(/\r?\n/)
  const pending = new Map()
  for (let index = 0; index < lines.length; index++) {
    const match = /^( *)(not )?ok \d+ - (.*)$/.exec(lines[index])
    if (!match) continue
    const depth = match[1].length
    let type = null
    for (let next = index + 1; next < lines.length && lines[next].startsWith(' '.repeat(depth + 2)); next++) {
      type ??= /^\s*type: '(\w+)'$/.exec(lines[next])?.[1] ?? null
      if (lines[next].trim() === '...') break
    }
    const item = { name: match[3].replace(/ (?<!\\)# (SKIP|TODO)\b.*$/i, ''), ok: !match[2], type, children: pending.get(depth + 4) ?? [] }
    pending.delete(depth + 4)
    pending.set(depth, [...(pending.get(depth) ?? []), item])
  }
  const tests = []
  const failedSuites = []
  const walk = (items, suites) => items.forEach((item) => {
    if (item.type !== 'suite') return tests.push({ name: item.name, ok: item.ok, suites, file })
    if (!item.ok) failedSuites.push(item.name)
    walk(item.children, [...suites, item.name])
  })
  walk(pending.get(0) ?? [], [])
  const summary = (key) => Number(new RegExp(`^# ${key} (\\d+)$`, 'm').exec(text)?.[1] ?? NaN)
  return { tests, failedSuites, total: summary('tests'), failed: summary('fail') }
}

function testFiles(directory) {
  return readdirSync(join(directory, TEST_DIRECTORY)).filter((name) => name.endsWith('.test.mjs')).sort()
    .map((name) => `${TEST_DIRECTORY}/${name}`)
}

// Runs one test file with the TAP reporter; its tests are tagged with the file's name.
function runFile(directory, file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: directory })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('error', reject)
    child.on('close', () => resolve(parseTap(output, basename(file))))
  })
}

// Runs the files `npm test` runs (same pattern), one process per file as `node --test` does, so that
// each test is known with its file.
async function runSuite(directory) {
  const results = await Promise.all(testFiles(directory).map((file) => runFile(directory, file)))
  return {
    tests: results.flatMap((result) => result.tests),
    failedSuites: results.flatMap((result) => result.failedSuites),
    total: results.reduce((sum, result) => sum + result.total, 0),
    failed: results.reduce((sum, result) => sum + result.failed, 0),
  }
}

// Removes from `remaining` one test named `name` (in `file`, when given); tells whether there was one.
function take(remaining, name, file) {
  const index = remaining.findIndex((test) => test.name === name && (file === undefined || test.file === file))
  if (index < 0) return false
  remaining.splice(index, 1)
  return true
}

// A renamed test may be in any file; a test under its old name only in its base file, which it has
// not left yet.
function compareNames(baseTests, currentTests) {
  const remaining = currentTests.map(({ name, file }) => ({ name, file }))
  const expected = baseTests.map((test) => ({ old: test.name, new: renamed(test.name, test.suites), file: test.file }))
  expected.forEach((entry) => { entry.found = take(remaining, entry.new) ? 'new' : null })
  expected.filter((entry) => !entry.found).forEach((entry) => {
    entry.found = take(remaining, entry.old, entry.file) ? 'old' : null
  })
  const extra = remaining.map(({ name, file }) => `${name} (${file})`)
  return { expected, missing: expected.filter((entry) => !entry.found), extra }
}

// ---------- lines

const STRING_LITERAL = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/
const SECTION_COMMENT = /^\/\/ -+ [A-Z]+-\d+: .* -+$/
const OPENING = 'describe(<titre>, () => {'

// Replaces the first string literal of `line` (a describe title) by a placeholder.
function withoutTitle(line) {
  return line.replace(STRING_LITERAL, '<titre>')
}

// Replaces the first string literal of `line` (a test title) by its text without label, quotes or
// escapes: a base title and its renamed form give the same line. A title given by a variable,
// `it(name, …)`, reads as `it(`${name}`, …)`, the form it takes once labeled.
function withUnlabeledTitle(line) {
  return line.replace(/^it\(([A-Za-z_$][\w$]*),/, 'it(`${$1}`,').replace(STRING_LITERAL, (literal) => {
    const title = literal.slice(1, -1).replace(/\\(.)/g, '$1')
    const unlabeled = (LABEL.exec(title)?.[2] ?? title).replace(/ \[[A-Z]+-\d+ CA-\d+(?:, CA-\d+)*\]$/, '')
    return `<titre:${unlabeled}>`
  })
}

// Non-empty lines without their indentation, minus import and export statements and the base's
// section comments per chantier, titles replaced. A line of a test body is prefixed by the
// unlabeled title of its test, so that swapping two titles, or moving a line from one test to
// another, changes the multiset.
function significantLines(text) {
  const lines = []
  let describes = 0
  let block = null
  let test = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '') continue
    const indentation = raw.length - raw.trimStart().length
    if (test && indentation <= test.indentation) test = null
    if (test) { lines.push(`${test.title} ¦ ${line}`); continue }
    if (block === 'import') { if (/^\} from '[^']+'$/.test(line)) block = null; continue }
    if (block === 'export') { if (line === '}') block = null; continue }
    if (/^import .+ from '[^']+'$/.test(line) || /^export \{[^}]*\}$/.test(line)) continue
    if (line === 'import {' || line === 'export {') { block = line.slice(0, 6); continue }
    if (SECTION_COMMENT.test(line)) continue
    if (line.startsWith('describe(')) {
      describes++
      lines.push(withoutTitle(line))
      continue
    }
    if (line.startsWith('it(')) {
      const title = withUnlabeledTitle(line)
      lines.push(title)
      if (!line.endsWith('})')) test = { title, indentation }
      continue
    }
    if (block === 'cases') {
      if (line === ']') block = null
      else { lines.push(withUnlabeledTitle(line)); continue }
    }
    if (line === 'const cases = [') block = 'cases'
    lines.push(line)
  }
  return { lines, describes }
}

function compareLines(baseTexts, currentTexts) {
  const base = { lines: [], describes: 0 }
  baseTexts.map(significantLines).forEach(({ lines, describes }) => {
    base.lines.push(...lines)
    base.describes += describes
  })
  const current = currentTexts.map(significantLines)
  const counts = new Map()
  base.lines.forEach((line) => counts.set(line, (counts.get(line) ?? 0) - 1))
  current.flatMap(({ lines }) => lines).forEach((line) => counts.set(line, (counts.get(line) ?? 0) + 1))
  const describeDelta = current.reduce((sum, { describes }) => sum + describes, 0) - base.describes
  const closingDelta = counts.get('})') ?? 0
  const openingDelta = counts.get(OPENING) ?? 0
  counts.delete('})')
  counts.delete(OPENING)
  const differences = [...counts].filter(([, delta]) => delta !== 0)
  return { differences, describeDelta, closingDelta, openingDelta }
}

// ---------- main

function git(...gitArguments) {
  return execFileSync('git', gitArguments, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

// Removes the base worktrees an interrupted run (Ctrl-C) left behind.
function removeLeftoverWorktrees() {
  git('worktree', 'list', '--porcelain').split(/\r?\n/)
    .filter((line) => line.startsWith('worktree ') && basename(line.slice(9)).startsWith(WORKTREE_PREFIX))
    .forEach((line) => {
      const path = line.slice(9)
      try { git('worktree', 'remove', '--force', path) } catch {}
      rmSync(path, { recursive: true, force: true })
    })
  git('worktree', 'prune')
}

async function main() {
  removeLeftoverWorktrees()
  const worktree = mkdtempSync(join(tmpdir(), WORKTREE_PREFIX))
  try {
    git('worktree', 'add', '--detach', '-q', worktree, BASE_COMMIT)
    const [base, current] = await Promise.all([runSuite(worktree), runSuite(root)])
    const baseFiles = testFiles(worktree).map((name) => basename(name))
    const baseTexts = baseFiles.map((name) => readFileSync(join(worktree, TEST_DIRECTORY, name), 'utf8'))
    const testDirectory = join(root, TEST_DIRECTORY)
    const currentFiles = readdirSync(testDirectory).filter((name) => statSync(join(testDirectory, name)).isFile()).sort()
    const currentTexts = currentFiles.map((name) => readFileSync(join(testDirectory, name), 'utf8'))
    const problems = []

    console.log(`# Contrôle REF-16 (base ${BASE_COMMIT})\n`)
    console.log(`Fichiers de la base : ${baseFiles.join(', ')}`)
    console.log(`Fichiers de test/ : ${currentFiles.join(', ')}\n`)

    console.log('## Nombre')
    console.log(`- base : ${base.total} tests, ${base.failed} en échec`)
    console.log(`- après : ${current.total} tests, ${current.failed} en échec (${current.tests.length} lus dans la sortie TAP)`)
    if (base.total !== BASE_TEST_COUNT || base.failed !== 0 || base.tests.length !== BASE_TEST_COUNT) problems.push(`la base ne rapporte pas ${BASE_TEST_COUNT} tests verts`)
    if (current.total !== BASE_TEST_COUNT || current.tests.length !== BASE_TEST_COUNT) problems.push(`la suite rapporte ${current.total} tests au lieu de ${BASE_TEST_COUNT}`)
    if (current.failed !== 0 || current.tests.some((test) => !test.ok)) problems.push('des tests échouent')
    if (base.failedSuites.length) problems.push(`des suites de la base échouent : ${base.failedSuites.join(', ')}`)
    if (current.failedSuites.length) problems.push(`des suites échouent : ${current.failedSuites.join(', ')}`)

    console.log('\n## Noms')
    const baseFileStillThere = (file) => baseFiles.includes(file) && existsSync(join(testDirectory, file))
    const remainingBaseFiles = baseFiles.filter(baseFileStillThere)
    const names = compareNames(base.tests, current.tests)
    const renamedCount = names.expected.filter((entry) => entry.found === 'new' && entry.new !== entry.old).length
    const pendingCount = names.expected.filter((entry) => entry.found === 'old' && entry.new !== entry.old).length
    console.log(`- ${renamedCount} renommés, ${pendingCount} pas encore renommés${remainingBaseFiles.length ? ` (existent encore : ${remainingBaseFiles.join(', ')})` : ''}`)
    names.missing.forEach((entry) => console.log(`- introuvable : « ${entry.old} » (attendu : « ${entry.new} »)`))
    names.extra.forEach((name) => console.log(`- sans correspondance dans la base : « ${name} »`))
    if (names.missing.length || names.extra.length) problems.push('des noms de tests ne correspondent pas')

    console.log('\n## Lignes')
    const lines = compareLines(baseTexts, currentTexts)
    console.log(`- écart de describe : ${lines.describeDelta}, écart d'ouvertures « ${OPENING} » : ${lines.openingDelta}, écart de « }) » : ${lines.closingDelta}`)
    lines.differences.forEach(([line, delta]) => console.log(`- ${delta > 0 ? `en plus (${delta})` : `en moins (${-delta})`} : ${line}`))
    if (lines.differences.length) problems.push('des lignes diffèrent de la base')
    if (lines.closingDelta !== lines.describeDelta) problems.push('l’écart de « }) » diffère de l’écart de describe')
    if (lines.openingDelta !== lines.describeDelta) problems.push('l’écart d’ouvertures de describe diffère de l’écart de describe')

    console.log('\n## Table ancien nom → nouveau nom')
    names.expected.filter((entry) => entry.new !== entry.old)
      .forEach((entry) => console.log(`- ${entry.old} → ${entry.new}${entry.found === 'old' ? ' (pas encore renommé)' : ''}`))

    console.log(problems.length ? `\nÉCHEC :\n${problems.map((problem) => `- ${problem}`).join('\n')}` : '\nOK')
    process.exitCode = problems.length ? 1 : 0
  } finally {
    try { git('worktree', 'remove', '--force', worktree) } catch {}
    rmSync(worktree, { recursive: true, force: true })
    try { git('worktree', 'prune') } catch {}
  }
}

await main()
