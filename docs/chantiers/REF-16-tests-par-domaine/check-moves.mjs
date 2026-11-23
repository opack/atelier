#!/usr/bin/env node
// REF-16: checks that splitting plugins/atelier/test/core.test.mjs by domain lost, duplicated or
// altered nothing (spec §4). Run from anywhere: node docs/chantiers/REF-16-tests-par-domaine/check-moves.mjs
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE_COMMIT = 'ae55ab5'
const BASE_TEST_COUNT = 256
const TEST_DIRECTORY = 'plugins/atelier/test'
const root = fileURLToPath(new URL('../../../', import.meta.url))

// Chantier of the describes that carry V-x tests without an ID prefix (spec §3).
const UNPREFIXED_DESCRIBES = {
  'write guard on a spec whose committed version is a draft': 'TEC-5',
  'chantier id from commit subjects': 'TEC-6',
  'active chantier deduced from commits': 'TEC-6',
  'chantier source shown to the user': 'TEC-6',
  'default branch resolved through origin/HEAD': 'TEC-6',
}
const DESCRIBE_PREFIX = /^(FEAT-4|FEAT-7|TEC-15) /
const LABEL = /^((?:CA|V)-\d+(?:(?:, ?|\/)(?:CA|V)-\d+)*)(?: : | )(.+)$/

// ---------- names

// The name a base test must have once moved: label prefix turned into a `[<ID> CA-x]` suffix.
function renamed(name, describe) {
  const match = LABEL.exec(name)
  if (!match) return name
  const id = DESCRIBE_PREFIX.exec(describe)?.[1] ?? UNPREFIXED_DESCRIBES[describe]
  if (!id) throw new Error(`étiquette sans chantier connu : « ${name} » dans « ${describe} »`)
  const criteria = match[1].split(/, ?|\//).map((label) => label.replace(/^V-/, 'CA-'))
  return `${match[2]} [${id} ${criteria.join(', ')}]`
}

// Tests (not suites) of a TAP stream, with the name of their top-level suite.
function parseTap(text) {
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
  const walk = (items, suite) => items.forEach((item) => {
    if (item.type === 'suite') walk(item.children, suite ?? item.name)
    else tests.push({ name: item.name, ok: item.ok, suite })
  })
  walk(pending.get(0) ?? [], null)
  const summary = (key) => Number(new RegExp(`^# ${key} (\\d+)$`, 'm').exec(text)?.[1] ?? NaN)
  return { tests, total: summary('tests'), failed: summary('fail') }
}

function testFiles(directory) {
  return readdirSync(join(directory, TEST_DIRECTORY)).filter((name) => name.endsWith('.test.mjs')).sort()
    .map((name) => `${TEST_DIRECTORY}/${name}`)
}

// Runs the suite of `directory` as `npm test` does (same file pattern), with the TAP reporter.
function runSuite(directory) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', '--test-reporter=tap', ...testFiles(directory)], { cwd: directory })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('error', reject)
    child.on('close', () => resolve(parseTap(output)))
  })
}

function take(counts, name) {
  const count = counts.get(name) ?? 0
  if (count === 0) return false
  counts.set(name, count - 1)
  return true
}

function compareNames(baseTests, currentTests, coreStillThere) {
  const remaining = new Map()
  currentTests.forEach(({ name }) => remaining.set(name, (remaining.get(name) ?? 0) + 1))
  const expected = baseTests.map((test) => ({ old: test.name, new: renamed(test.name, test.suite) }))
  expected.forEach((entry) => { entry.found = take(remaining, entry.new) ? 'new' : null })
  expected.filter((entry) => !entry.found).forEach((entry) => {
    entry.found = coreStillThere && take(remaining, entry.old) ? 'old' : null
  })
  const extra = [...remaining].flatMap(([name, count]) => Array(count).fill(name))
  return { expected, missing: expected.filter((entry) => !entry.found), extra }
}

// ---------- lines

// Replaces the first string literal of `line` (a title) by a placeholder.
function withoutTitle(line) {
  return line.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/, '<titre>')
}

// Non-empty lines without their indentation, minus import and export statements, titles replaced.
function significantLines(text) {
  const lines = []
  let describes = 0
  let block = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '') continue
    if (block === 'import') { if (/^\} from '[^']+'$/.test(line)) block = null; continue }
    if (block === 'export') { if (line === '}') block = null; continue }
    if (/^import .+ from '[^']+'$/.test(line) || /^export \{[^}]*\}$/.test(line)) continue
    if (line === 'import {' || line === 'export {') { block = line.slice(0, 6); continue }
    if (/^(describe|it)\(/.test(line)) {
      if (line.startsWith('describe(')) describes++
      lines.push(withoutTitle(line))
      continue
    }
    if (block === 'cases') {
      if (line === ']') block = null
      else { lines.push(withoutTitle(line)); continue }
    }
    if (line === 'const cases = [') block = 'cases'
    lines.push(line)
  }
  return { lines, describes }
}

function compareLines(baseText, currentTexts) {
  const base = significantLines(baseText)
  const current = currentTexts.map(significantLines)
  const counts = new Map()
  base.lines.forEach((line) => counts.set(line, (counts.get(line) ?? 0) - 1))
  current.flatMap(({ lines }) => lines).forEach((line) => counts.set(line, (counts.get(line) ?? 0) + 1))
  const describeDelta = current.reduce((sum, { describes }) => sum + describes, 0) - base.describes
  const closingDelta = counts.get('})') ?? 0
  counts.delete('})')
  const differences = [...counts].filter(([, delta]) => delta !== 0)
  return { differences, describeDelta, closingDelta }
}

// ---------- main

function git(...gitArguments) {
  return execFileSync('git', gitArguments, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

async function main() {
  const worktree = mkdtempSync(join(tmpdir(), 'ref16-base-'))
  try {
    git('worktree', 'add', '--detach', '-q', worktree, BASE_COMMIT)
    const [base, current] = await Promise.all([runSuite(worktree), runSuite(root)])
    const baseText = readFileSync(join(worktree, TEST_DIRECTORY, 'core.test.mjs'), 'utf8')
    const testDirectory = join(root, TEST_DIRECTORY)
    const currentFiles = readdirSync(testDirectory).filter((name) => statSync(join(testDirectory, name)).isFile()).sort()
    const currentTexts = currentFiles.map((name) => readFileSync(join(testDirectory, name), 'utf8'))
    const problems = []

    console.log(`# Contrôle REF-16 (base ${BASE_COMMIT})\n`)
    console.log(`Fichiers de test/ : ${currentFiles.join(', ')}\n`)

    console.log('## Nombre')
    console.log(`- base : ${base.total} tests, ${base.failed} en échec`)
    console.log(`- après : ${current.total} tests, ${current.failed} en échec (${current.tests.length} lus dans la sortie TAP)`)
    if (base.total !== BASE_TEST_COUNT || base.failed !== 0 || base.tests.length !== BASE_TEST_COUNT) problems.push(`la base ne rapporte pas ${BASE_TEST_COUNT} tests verts`)
    if (current.total !== BASE_TEST_COUNT || current.tests.length !== BASE_TEST_COUNT) problems.push(`la suite rapporte ${current.total} tests au lieu de ${BASE_TEST_COUNT}`)
    if (current.failed !== 0 || current.tests.some((test) => !test.ok)) problems.push('des tests échouent')

    console.log('\n## Noms')
    const coreStillThere = existsSync(join(testDirectory, 'core.test.mjs'))
    const names = compareNames(base.tests, current.tests, coreStillThere)
    const renamedCount = names.expected.filter((entry) => entry.found === 'new' && entry.new !== entry.old).length
    const pendingCount = names.expected.filter((entry) => entry.found === 'old' && entry.new !== entry.old).length
    console.log(`- ${renamedCount} renommés, ${pendingCount} pas encore renommés${coreStillThere ? ' (core.test.mjs existe encore)' : ''}`)
    names.missing.forEach((entry) => console.log(`- introuvable : « ${entry.old} » (attendu : « ${entry.new} »)`))
    names.extra.forEach((name) => console.log(`- sans correspondance dans la base : « ${name} »`))
    if (names.missing.length || names.extra.length) problems.push('des noms de tests ne correspondent pas')

    console.log('\n## Lignes')
    const lines = compareLines(baseText, currentTexts)
    console.log(`- écart de describe : ${lines.describeDelta}, écart de « }) » : ${lines.closingDelta}`)
    lines.differences.forEach(([line, delta]) => console.log(`- ${delta > 0 ? `en plus (${delta})` : `en moins (${-delta})`} : ${line}`))
    if (lines.differences.length) problems.push('des lignes diffèrent de la base')
    if (lines.closingDelta !== lines.describeDelta) problems.push('l’écart de « }) » diffère de l’écart de describe')

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
