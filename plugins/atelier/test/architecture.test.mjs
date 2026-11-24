import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHANTIER_TYPES } from '../lib/common.mjs'

// Structural rules of lib/ and test/ (EPIC-17). The checks are plain functions of source texts, so
// that each rule can be shown failing on a fabricated example. This file does not check itself:
// its examples would trip its own rules.

const pluginDirectory = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAX_LINES = 400
const CHANTIER_ID = new RegExp(`\\b(?:${CHANTIER_TYPES.join('|')})-\\d+\\b`)
const CRITERION_ID = /\b(?:CA|V)-\d+\b/
const FINAL_TAG = new RegExp(`\\s\\[(?:${CHANTIER_TYPES.join('|')})-\\d+ (?:CA|V)-\\d+(?:, (?:CA|V)-\\d+)*\\]$`)

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
      problems.push(`critère hors de l'étiquette finale [<ID> CA-n] : « ${name} »`)
    }
  }
  return problems
}

// core.mjs may hold only re-exports (`export { … } from '…'`, on one line or several), comments
// and blank lines.
function facadeProblems(text) {
  const withoutReexports = text.replace(/^export\s*\{[^}]*\}\s*from\s*'[^']*'[ \t]*;?[ \t]*$/gm, '')
  const withoutComments = withoutReexports.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  return withoutComments.split('\n').map((line) => line.trim()).filter(Boolean)
    .map((line) => `core.mjs contient autre chose qu'un réexport : « ${line} »`)
}

// Relative modules a source imports (with or without `from`) or re-exports from, as written.
// Dynamic import() calls are not import statements: they are left out of the rules.
function importedSpecifiers(text) {
  const statements = /^(?:import\s*['"](\.{1,2}\/[^'"]+)['"]|(?:import|export)\b[^'"]*?\bfrom\s*['"](\.{1,2}\/[^'"]+)['"])/gm
  return [...text.matchAll(statements)].map((match) => match[1] ?? match[2])
}

// files: [{ path, text }], paths relative to the plugin (posix). No file but the façade's readers of
// old branches may import lib/core.mjs: neither a test nor a module of lib/.
function coreImportProblems(files) {
  return files.flatMap(({ path, text }) => importedSpecifiers(text)
    .filter((specifier) => posix.normalize(posix.join(posix.dirname(path), specifier)) === 'lib/core.mjs')
    .map(() => `${path} importe lib/core.mjs`))
}

// modules: Map of path relative to lib/ (posix) → text. Checks the import rules of REF-29 §3.
function importProblems(modules) {
  const graph = new Map()
  for (const [path, text] of modules) {
    graph.set(path, importedSpecifiers(text).map((specifier) => posix.normalize(posix.join(posix.dirname(path), specifier))))
  }
  const problems = []
  for (const [path, targets] of graph) {
    const isPure = !path.includes('/') && path !== 'cli.mjs' && path !== 'core.mjs'
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

  it('ce dépôt respecte toutes les règles [REF-29 CA-4]', () => {
    assert.deepEqual(oversizedFiles([...libFiles, ...testFiles]), [])
    assert.deepEqual(namedTestFiles.flatMap(({ path, text }) => nameProblems(text).map((problem) => `${path} : ${problem}`)), [])
    assert.deepEqual(facadeProblems(readFileSync(join(pluginDirectory, 'lib/core.mjs'), 'utf8')), [])
    assert.deepEqual(importProblems(new Map(libFiles.map(({ path, text }) => [path.replace(/^lib\//, ''), text]))), [])
    assert.deepEqual(coreImportProblems([...libFiles, ...testFiles]), [])
  })

  it('un fichier de plus de 400 lignes est signalé [REF-29 CA-4]', () => {
    const lines = (count) => Array.from({ length: count }, (_, index) => `const a${index} = ${index}`).join('\n') + '\n'
    assert.deepEqual(oversizedFiles([{ path: 'lib/long.mjs', text: lines(401) }, { path: 'lib/ok.mjs', text: lines(400) }]), ['lib/long.mjs'])
  })

  it('un describe qui contient un identifiant de chantier est signalé [REF-29 CA-4]', () => {
    assert.equal(nameProblems("describe('FIX-25 : lanceur Windows', () => {})").length, 1)
    assert.equal(nameProblems('describe(`REF-29 ${domain}`, () => {})').length, 1)
    assert.deepEqual(nameProblems("describe('lanceur Windows', () => {})"), [])
    assert.deepEqual(nameProblems('describe(title, () => {})'), [], 'une variable est ignorée')
  })

  it('un critère hors de l’étiquette finale est signalé [REF-29 CA-4]', () => {
    assert.equal(nameProblems("it('CA-1 : lance node', () => {})").length, 1)
    assert.equal(nameProblems("test('lance node [FIX-25 CA-1] encore', () => {})").length, 1)
    assert.equal(nameProblems("it('lance node [FIX-25 CA-1,CA-2]', () => {})").length, 1, 'séparateur « , » exigé')
    assert.equal(nameProblems("it('lance node [FOO-25 CA-1]', () => {})").length, 1, 'type de chantier inconnu')
    assert.equal(nameProblems('it(`V-2 : ${label}`, () => {})').length, 1)
    assert.deepEqual(nameProblems("it('lance node [FIX-25 CA-1]', () => {})"), [])
    assert.deepEqual(nameProblems("it('lance node [FIX-25 CA-1, CA-2, V-3]', () => {})"), [])
    assert.deepEqual(nameProblems("it(\"sans critère\", () => {})"), [])
  })

  it('une façade qui contient autre chose que des réexports est signalée [REF-29 CA-4]', () => {
    const facade = "// Façade\n\nexport { a, b } from './a.mjs'\nexport {\n  c,\n} from './cli/c.mjs'\n"
    assert.deepEqual(facadeProblems(facade), [])
    assert.equal(facadeProblems(`${facade}export function d() { return 1 }\n`).length, 1)
    assert.equal(facadeProblems(`import { a } from './a.mjs'\n${facade}`).length, 1)
  })

  it('common.mjs qui importe un module de lib/ est signalé [REF-29 CA-4]', () => {
    const problems = importProblems(new Map([
      ['common.mjs', "import { a } from './spec.mjs'\n"],
      ['spec.mjs', 'export const a = 1\n'],
    ]))
    assert.deepEqual(problems, ['common.mjs importe spec.mjs'])
  })

  it('un module pur qui importe lib/cli/ est signalé [REF-29 CA-4]', () => {
    const problems = importProblems(new Map([
      ['spec.mjs', "import { git } from './cli/common.mjs'\n"],
      ['docs.mjs', "import './cli/docs.mjs'\n"],
      ['cli/common.mjs', "import { a } from '../common.mjs'\n"],
      ['cli.mjs', "import { b } from './cli/spec.mjs'\n"],
      ['common.mjs', 'export const a = 1\n'],
    ]))
    assert.deepEqual(problems, ['le module pur spec.mjs importe cli/common.mjs', 'le module pur docs.mjs importe cli/docs.mjs'])
  })

  it('un test ou un module de lib/ qui importe la façade est signalé', () => {
    const problems = coreImportProblems([
      { path: 'test/spec.test.mjs', text: "import { checkSpec } from '../lib/core.mjs'\n" },
      { path: 'lib/cli.mjs', text: "import {\n  main,\n} from './core.mjs'\n" },
      { path: 'lib/core.mjs', text: "export { checkSpec } from './spec.mjs'\n" },
      { path: 'test/tdd.test.mjs', text: "import { testDrivenPhase } from '../lib/tdd.mjs'\n" },
    ])
    assert.deepEqual(problems, ['test/spec.test.mjs importe lib/core.mjs', 'lib/cli.mjs importe lib/core.mjs'])
  })

  it('un cycle d’import est signalé [REF-29 CA-4]', () => {
    const problems = importProblems(new Map([
      ['review.mjs', "import { b } from './close.mjs'\n"],
      ['close.mjs', "export {\n  a,\n} from './slices.mjs'\n"],
      ['slices.mjs', "import { r } from './review.mjs'\n"],
    ]))
    assert.deepEqual(problems, ["cycle d'import : review.mjs → close.mjs → slices.mjs → review.mjs"])
  })
})
