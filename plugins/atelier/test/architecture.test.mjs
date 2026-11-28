import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHANTIER_TYPES } from '../lib/common.mjs'
import { CRITERION_ID, FINAL_TAG } from '../lib/criteria.mjs'

// Structural rules of lib/ and test/ (EPIC-17). The checks are plain functions of source texts, so
// that each rule can be shown failing on a fabricated example. This file is left out of the name
// check only: its fabricated examples would trip it.

const pluginDirectory = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAX_LINES = 400
// Criterion prefixes retired by TEC-37: a test name that still cites one is refused.
const RETIRED_CRITERION_ID = /\b(?:CA|V)-\d+\b/
const CHANTIER_ID = new RegExp(`\\b(?:${CHANTIER_TYPES.join('|')})-\\d+\\b`)

function mjsFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return mjsFiles(path)
    return entry.name.endsWith('.mjs') ? [path] : []
  })
}

// files: [{ path, text }] → paths over MAX_LINES lines (a final newline does not count as a line).
function oversizedFiles(files) {
  return files.filter(({ text }) => text.replace(/\n$/, '').split('\n').length > MAX_LINES).map(({ path }) => path)
}

// Reads the string starting at text[start] (quote, double quote or backquote). Returns its static
// part (template expressions dropped), or null when it is not closed.
function readLiteral(text, start) {
  const quote = text[start]
  let value = ''
  for (let index = start + 1; index < text.length; index++) {
    const char = text[index]
    if (char === '\\') { value += text[++index] ?? ''; continue }
    if (char === quote) return value
    if (quote === '`' && char === '$' && text[index + 1] === '{') {
      let depth = 1
      index += 2
      while (index < text.length && depth > 0) {
        if (text[index] === '{') depth++
        else if (text[index] === '}') depth--
        index++
      }
      index--
      value += ' '
      continue
    }
    value += char
  }
  return null
}

// Names given to describe / it / test in a source: a literal whole, a template by its static part;
// a variable or any other expression is ignored.
function testNames(source) {
  const names = []
  for (const match of source.matchAll(/(?<![\w.$])(describe|it|test)(?:\.(?:only|skip|todo))?\(\s*/g)) {
    const start = match.index + match[0].length
    if (!['\'', '"', '`'].includes(source[start])) continue
    const name = readLiteral(source, start)
    if (name !== null) names.push({ kind: match[1] === 'describe' ? 'describe' : 'test', name })
  }
  return names
}

function nameProblems(source) {
  const problems = []
  for (const { kind, name } of testNames(source)) {
    if (kind === 'describe' && CHANTIER_ID.test(name)) problems.push(`describe nommé d'après un chantier : « ${name} »`)
    else if (kind === 'test' && CRITERION_ID.test(name.replace(FINAL_TAG, ''))) {
      problems.push(`critère hors de l'étiquette finale [<ID> AC-n] : « ${name} »`)
    }
    else if (kind === 'test' && RETIRED_CRITERION_ID.test(name)) problems.push(`ancien préfixe de critère (CA-n, V-n) : « ${name} »`)
  }
  return problems
}

// Relative modules a source imports (with or without `from`) or re-exports from, as written.
// Dynamic import() calls are not import statements: they are left out of the rules.
function importedSpecifiers(text) {
  const statements = /^(?:import\s*['"](\.{1,2}\/[^'"]+)['"]|(?:import|export)\b[^'"]*?\bfrom\s*['"](\.{1,2}\/[^'"]+)['"])/gm
  return [...text.matchAll(statements)].map((match) => match[1] ?? match[2])
}

// modules: Map of path relative to lib/ (posix) → text. Checks the import rules of REF-29 §3.
function importProblems(modules) {
  const graph = new Map()
  for (const [path, text] of modules) {
    graph.set(path, importedSpecifiers(text).map((specifier) => posix.normalize(posix.join(posix.dirname(path), specifier))))
  }
  const problems = []
  for (const [path, targets] of graph) {
    const isPure = !path.includes('/') && path !== 'cli.mjs'
    for (const target of targets) {
      if (path === 'common.mjs') problems.push(`common.mjs importe ${target}`)
      else if (isPure && target.startsWith('cli/')) problems.push(`le module pur ${path} importe ${target}`)
    }
  }
  const state = new Map()
  const visit = (path, stack) => {
    state.set(path, 'open')
    for (const target of graph.get(path) ?? []) {
      if (state.get(target) === 'open') problems.push(`cycle d'import : ${[...stack.slice(stack.indexOf(target)), target].join(' → ')}`)
      else if (!state.has(target) && graph.has(target)) visit(target, [...stack, target])
    }
    state.set(path, 'done')
  }
  for (const path of graph.keys()) if (!state.has(path)) visit(path, [path])
  return problems
}

function readFiles(paths) {
  return paths.map((path) => ({ path: relative(pluginDirectory, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }))
}

describe('architecture de lib/ et de test/', () => {
  const libFiles = readFiles(mjsFiles(join(pluginDirectory, 'lib')))
  const testFiles = readFiles(mjsFiles(join(pluginDirectory, 'test')))
  // This file is left out of the name check only: its fabricated examples would trip it.
  const namedTestFiles = testFiles.filter(({ path }) => path !== 'test/architecture.test.mjs')

  it('ce dépôt respecte toutes les règles [REF-29 AC-4]', () => {
    assert.deepEqual(oversizedFiles([...libFiles, ...testFiles]), [])
    assert.deepEqual(namedTestFiles.flatMap(({ path, text }) => nameProblems(text).map((problem) => `${path} : ${problem}`)), [])
    assert.deepEqual(importProblems(new Map(libFiles.map(({ path, text }) => [path.replace(/^lib\//, ''), text]))), [])
  })

  it('un fichier de plus de 400 lignes est signalé [REF-29 AC-4]', () => {
    const lines = (count) => Array.from({ length: count }, (_, index) => `const a${index} = ${index}`).join('\n') + '\n'
    assert.deepEqual(oversizedFiles([{ path: 'lib/long.mjs', text: lines(401) }, { path: 'lib/ok.mjs', text: lines(400) }]), ['lib/long.mjs'])
  })

  it('un describe qui contient un identifiant de chantier est signalé [REF-29 AC-4]', () => {
    assert.equal(nameProblems("describe('FIX-25 : lanceur Windows', () => {})").length, 1)
    assert.equal(nameProblems('describe(`REF-29 ${domain}`, () => {})').length, 1)
    assert.deepEqual(nameProblems("describe('lanceur Windows', () => {})"), [])
    assert.deepEqual(nameProblems('describe(title, () => {})'), [], 'une variable est ignorée')
  })

  it('un critère hors de l’étiquette finale est signalé [REF-29 AC-4]', () => {
    assert.equal(nameProblems("it('AC-1 : lance node', () => {})").length, 1)
    assert.equal(nameProblems("test('lance node [FIX-25 AC-1] encore', () => {})").length, 1)
    assert.equal(nameProblems("it('lance node [FIX-25 AC-1,AC-2]', () => {})").length, 1, 'séparateur « , » exigé')
    assert.equal(nameProblems("it('lance node [FOO-25 AC-1]', () => {})").length, 1, 'type de chantier inconnu')
    assert.equal(nameProblems('it(`AC-2 : ${label}`, () => {})').length, 1)
    assert.deepEqual(nameProblems("it('lance node [FIX-25 AC-1]', () => {})"), [])
    assert.deepEqual(nameProblems("it('lance node [FIX-25 AC-1, AC-2, AC-3]', () => {})"), [])
    assert.deepEqual(nameProblems("it(\"sans critère\", () => {})"), [])
  })

  it('une étiquette finale en AC-n est acceptée, une ancienne forme est refusée [TEC-37 AC-4]', () => {
    assert.deepEqual(nameProblems("it('lance node [FEAT-40 AC-3]', () => {})"), [])
    assert.deepEqual(nameProblems("it('lance node [FEAT-40 AC-3, AC-4]', () => {})"), [])
    assert.equal(nameProblems("it('lance node [FEAT-4 CA-3]', () => {})").length, 1)
    assert.equal(nameProblems("it('lance node [TEC-5 V-1]', () => {})").length, 1)
    assert.equal(nameProblems("it('lance node [FEAT-40 CA-1, AC-2]', () => {})").length, 1, 'mélange')
    assert.equal(nameProblems("it('AC-3 : lance node', () => {})").length, 1, 'AC-3 hors de l’étiquette finale')
    assert.equal(nameProblems("it('AC-1, AC-2… : lance node', () => {})").length, 1, 'exemple à ellipse hors de l’étiquette finale')
    assert.equal(nameProblems("it('lance node [FEAT-40 ac-3]', () => {})").length, 1, 'étiquette en minuscules')
  })

  it('common.mjs qui importe un module de lib/ est signalé [REF-29 AC-4]', () => {
    const problems = importProblems(new Map([
      ['common.mjs', "import { a } from './spec.mjs'\n"],
      ['spec.mjs', 'export const a = 1\n'],
    ]))
    assert.deepEqual(problems, ['common.mjs importe spec.mjs'])
  })

  it('un module pur qui importe lib/cli/ est signalé [REF-29 AC-4]', () => {
    const problems = importProblems(new Map([
      ['spec.mjs', "import { git } from './cli/common.mjs'\n"],
      ['docs.mjs', "import './cli/docs.mjs'\n"],
      ['cli/common.mjs', "import { a } from '../common.mjs'\n"],
      ['cli.mjs', "import { b } from './cli/spec.mjs'\n"],
      ['common.mjs', 'export const a = 1\n'],
    ]))
    assert.deepEqual(problems, ['le module pur spec.mjs importe cli/common.mjs', 'le module pur docs.mjs importe cli/docs.mjs'])
  })

  it('un cycle d’import est signalé [REF-29 AC-4]', () => {
    const problems = importProblems(new Map([
      ['review.mjs', "import { b } from './close.mjs'\n"],
      ['close.mjs', "export {\n  a,\n} from './slices.mjs'\n"],
      ['slices.mjs', "import { r } from './review.mjs'\n"],
    ]))
    assert.deepEqual(problems, ["cycle d'import : review.mjs → close.mjs → slices.mjs → review.mjs"])
  })
})
