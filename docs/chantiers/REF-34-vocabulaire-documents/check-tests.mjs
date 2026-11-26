#!/usr/bin/env node
// REF-34 CA-1: checks that the chantier left the existing tests untouched and that all tests pass.
// Run from anywhere: node docs/chantiers/REF-34-vocabulaire-documents/check-tests.mjs
//   --self-test   also proves that a fabricated change to an existing test file is caught (in a
//                 temporary copy, never in the repository)
// Proof valid against BASE_COMMIT only: a merge of the default branch moves the base, and both
// constants below change with it.
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE_COMMIT = '5ef9b80'
const BASE_TEST_COUNT = 498
const TESTS = 'plugins/atelier/test'
const root = fileURLToPath(new URL('../../../', import.meta.url))

const git = (...argumentList) => execFileSync('git', argumentList, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const baseFiles = () => git('ls-tree', '-r', '--name-only', BASE_COMMIT, `${TESTS}/`).split('\n').filter(Boolean).map((path) => path.slice(TESTS.length + 1))
const baseText = (name) => git('show', `${BASE_COMMIT}:${TESTS}/${name}`)

// Differences between the test files of the base and those of `directory`: every base file must be
// there and identical (no line removed or changed).
export function differences(directory) {
  const problems = []
  for (const name of baseFiles()) {
    let current
    try {
      current = readFileSync(join(directory, name), 'utf8')
    } catch {
      problems.push(`${name} : fichier supprimé ou renommé`)
      continue
    }
    const before = baseText(name).split('\n')
    const after = current.split('\n')
    if (before.join('\n') === after.join('\n')) continue
    const line = before.findIndex((text, index) => text !== after[index])
    problems.push(`${name} : modifié (première différence ligne ${(line === -1 ? before.length : line) + 1})`)
  }
  return problems
}

const addedFiles = (directory) => readdirSync(directory).filter((name) => name.endsWith('.test.mjs') && !baseFiles().includes(name))

function runTests(files) {
  const result = spawnSync('node', ['--test', ...files], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  const read = (label) => Number(new RegExp(`^# ${label} (\\d+)$`, 'm').exec(result.stdout)?.[1] ?? NaN)
  return { tests: read('tests'), pass: read('pass'), fail: read('fail') }
}

let failed = false
const report = (ok, title, details = []) => {
  console.log(`${ok ? '✓' : '✗'} ${title}`)
  for (const detail of details.slice(0, 30)) console.log(`    ${detail}`)
  if (!ok) failed = true
}

const testDirectory = join(root, TESTS)
const changes = differences(testDirectory)
report(changes.length === 0, `les fichiers de test présents à ${BASE_COMMIT} sont identiques (${baseFiles().length} fichiers)`, changes)

const added = addedFiles(testDirectory)
console.log(`  fichiers de test ajoutés depuis la base : ${added.length ? added.join(', ') : 'aucun'}`)
const addedCount = added.length ? runTests(added.map((name) => join(TESTS, name))).tests : 0
const all = runTests(readdirSync(testDirectory).filter((name) => name.endsWith('.test.mjs')).map((name) => join(TESTS, name)))
const expected = BASE_TEST_COUNT + addedCount
report(all.tests === expected, `nombre de tests : ${all.tests} (attendu ${BASE_TEST_COUNT} à la base + ${addedCount} ajoutés = ${expected})`)
report(all.fail === 0 && all.pass === all.tests, `tous les tests passent (${all.pass} réussis, ${all.fail} en échec)`)

if (process.argv.includes('--self-test')) {
  const copy = mkdtempSync(join(tmpdir(), 'ref34-'))
  try {
    cpSync(testDirectory, copy, { recursive: true })
    const clean = differences(copy)
    report(clean.length === 0, 'auto-test : la copie intacte ne signale rien', clean)
    const target = baseFiles().find((name) => name.endsWith('.test.mjs'))
    const path = join(copy, target)
    writeFileSync(path, readFileSync(path, 'utf8').replace(/^/, '// '))
    const caught = differences(copy)
    report(caught.length === 1 && caught[0].startsWith(target), `auto-test : une ligne modifiée dans ${target} est détectée`, caught)
    rmSync(path)
    const removed = differences(copy)
    report(removed.length === 1 && removed[0].includes('supprimé'), `auto-test : ${target} supprimé est détecté`, removed)
  } finally {
    rmSync(copy, { recursive: true, force: true })
  }
}

process.exit(failed ? 1 : 0)
