#!/usr/bin/env node
// REF-29: checks that splitting plugins/atelier/lib/core.mjs and cli.mjs by domain lost, duplicated or
// altered nothing (spec §4). Run from anywhere: node docs/chantiers/REF-29-lib-par-domaine/check-moves.mjs
//   --self-test   also proves that the declaration check catches three fabricated mutations
//   --no-tests    skips the test run (count); the other checks still run
// Proof valid against BASE_COMMIT only: a merge of the default branch moves the base (spec §4, SD5),
// recorded in decisions.md, and both constants below change with it.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const BASE_COMMIT = 'f3ec902'
const BASE_TEST_COUNT = 340
const LIB = 'plugins/atelier/lib'
const TESTS = 'plugins/atelier/test'
const BASE_LIB_FILES = [`${LIB}/core.mjs`, `${LIB}/cli.mjs`]
const ARCHITECTURE_TEST = 'architecture.test.mjs'
const root = fileURLToPath(new URL('../../../', import.meta.url))

const args = new Set(process.argv.slice(2))
const problems = []
const report = (title, list) => {
  console.log(`${list.length ? '✗' : '✓'} ${title}${list.length ? ` (${list.length})` : ''}`)
  for (const item of list.slice(0, 30)) console.log(`    ${item}`)
  if (list.length > 30) console.log(`    … ${list.length - 30} de plus`)
  problems.push(...list)
}

// ---------- reading files

const git = (...argumentList) => execFileSync('git', argumentList, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const baseText = (path) => git('show', `${BASE_COMMIT}:${path}`)
const baseList = (directory) => git('ls-tree', '--name-only', `${BASE_COMMIT}:${directory}`).split('\n').filter(Boolean)

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? walk(path) : name.endsWith('.mjs') ? [path] : []
  })
}

function currentLibFiles() {
  return Object.fromEntries(walk(join(root, LIB)).sort().map((path) => [relative(root, path), readFileSync(path, 'utf8')]))
}

// ---------- splitting a module into units

const DECLARATION = /^(export )?(async )?(function\*?|const|let|class) ([A-Za-z0-9_$]+)/
const SECTION = /^\/\/ -{5,} .* -{5,}$/
const CLOSING = /^[}\])`'"]/

// A module is a sequence of: header comments (before the first import or declaration), import and
// re-export statements, section comments, blank lines, free comments, and declarations. A declaration
// takes the comment lines glued right above it and runs until the next line at column 0 that does not
// close it. Any other line at column 0 is reported: the split would then be unreliable.
export function splitModule(text, file) {
  const lines = text.replace(/\r/g, '').split('\n')
  const units = []
  const statements = []
  const freeComments = []
  const strays = []
  let index = 0
  let header = true
  let pendingComments = []
  const flushComments = () => {
    if (!header) freeComments.push(...pendingComments)
    pendingComments = []
  }
  while (index < lines.length) {
    const line = lines[index]
    if (line.trim() === '') {
      flushComments()
      index++
      continue
    }
    if (SECTION.test(line)) {
      flushComments()
      index++
      continue
    }
    if (line.startsWith('//')) {
      pendingComments.push(line)
      index++
      continue
    }
    if (/^import\b/.test(line) || /^export (\{|\*)/.test(line)) {
      header = false
      flushComments()
      const start = index
      while (!/\bfrom ['"][^'"]+['"]/.test(lines[index]) && !/^import ['"]/.test(lines[index])) index++
      statements.push(lines.slice(start, index + 1).join('\n'))
      index++
      continue
    }
    const match = DECLARATION.exec(line)
    if (match) {
      header = false
      const start = index
      index++
      while (index < lines.length && (lines[index] === '' || /^\s/.test(lines[index]) || CLOSING.test(lines[index]))) index++
      let end = index
      while (end > start + 1 && lines[end - 1].trim() === '') end--
      const body = lines.slice(start, end)
      body[0] = body[0].replace(/^export /, '')
      units.push({ name: match[4], file, text: [...pendingComments, ...body].join('\n') })
      pendingComments = []
      continue
    }
    strays.push(`${file}:${index + 1} : ${line}`)
    index++
  }
  flushComments()
  return { units, statements, freeComments, strays }
}

// ---------- declarations

// The only code line the spec lets change (SB3): pluginRoot gains one level once in lib/cli/.
const normalizeUnit = (unit) =>
  unit.name === 'pluginRoot' ? unit.text.replace("import.meta.url)), '..', '..')", "import.meta.url)), '..')") : unit.text

export function compareDeclarations(baseFiles, afterFiles) {
  const found = []
  const split = (files) => Object.entries(files).map(([file, text]) => splitModule(text, file))
  const base = split(baseFiles)
  const after = split(afterFiles)
  const strays = [...base, ...after].flatMap((module) => module.strays)
  const index = new Map()
  for (const unit of after.flatMap((module) => module.units)) {
    const key = `${unit.name}\n${normalizeUnit(unit)}`
    index.set(key, [...(index.get(key) ?? []), unit])
  }
  const baseUnits = base.flatMap((module) => module.units)
  const placement = {}
  for (const unit of baseUnits) {
    const key = `${unit.name}\n${normalizeUnit(unit)}`
    const matches = index.get(key) ?? []
    if (matches.length === 0) found.push(`${unit.name} (${unit.file}) : absente ou modifiée`)
    else placement[unit.name] = matches.shift().file
  }
  for (const [, rest] of index) for (const unit of rest) found.push(`${unit.name} (${unit.file}) : en trop ou dupliquée`)
  const count = (list) => list.reduce((map, item) => map.set(item, (map.get(item) ?? 0) + 1), new Map())
  const baseFree = count(base.flatMap((module) => module.freeComments))
  const afterFree = count(after.flatMap((module) => module.freeComments))
  const comments = []
  for (const [line, number] of baseFree) if ((afterFree.get(line) ?? 0) < number) comments.push(`commentaire perdu : ${line}`)
  for (const [line, number] of afterFree) if ((baseFree.get(line) ?? 0) < number) comments.push(`commentaire en trop : ${line}`)
  return { declarations: found, comments, strays, placement, baseCount: baseUnits.length }
}

// ---------- plan table

// Module of each declaration, as given by the tables of plan.md (`| \`module\` | \`name\` E, … |`).
function planTable() {
  const plan = readFileSync(join(root, 'docs/chantiers/REF-29-lib-par-domaine/plan.md'), 'utf8')
  const table = {}
  for (const line of plan.split('\n')) {
    const match = /^\| `([a-z/.-]+\.mjs)` \| (.+?) \|/.exec(line)
    if (!match) continue
    for (const [, name] of match[2].matchAll(/`([A-Za-z0-9_$]+)`/g)) table[name] = `${LIB}/${match[1]}`
  }
  return table
}

// ---------- tests

const WINDOWS_LAUNCHER = `${TESTS}/windows-launcher.test.mjs`

// Base test line as it must read after REF-29: `core.<export>` loses its prefix (SB2); in
// windows-launcher.test.mjs, names follow the REF-16 rules (SB4).
function expectedTestLine(line, file, coreExports) {
  let expected = line.replace(/\bcore\.([A-Za-z0-9_$]+)/g, (whole, name) => (coreExports.has(name) ? name : whole))
  if (file === WINDOWS_LAUNCHER) {
    expected = expected
      .replace(/describe\('FIX-25 : /, "describe('")
      .replace(/it\('CA-(\d+) : (.*)', /, (whole, criterion, label) => `it('${label} [FIX-25 CA-${criterion}]', `)
  }
  return expected
}

// Test file without its imports from ../lib/ (any line of an `import … from '../lib/…'` statement).
function withoutLibImports(text) {
  const lines = text.replace(/\r/g, '').split('\n')
  const kept = []
  for (let index = 0; index < lines.length; index++) {
    if (/^import\b/.test(lines[index])) {
      let end = index
      while (!/\bfrom ['"][^'"]+['"]/.test(lines[end])) end++
      if (/from ['"]\.\.\/lib\//.test(lines[end])) {
        index = end
        continue
      }
    }
    kept.push(lines[index])
  }
  return kept
}

function compareTests(coreExports) {
  const found = []
  const baseFiles = baseList(TESTS)
  const afterFiles = readdirSync(join(root, TESTS)).filter((name) => name.endsWith('.mjs')).sort()
  const expectedFiles = [...baseFiles, ...(afterFiles.includes(ARCHITECTURE_TEST) ? [ARCHITECTURE_TEST] : [])].sort()
  if (expectedFiles.join() !== afterFiles.join()) {
    found.push(`fichiers de tests : attendu ${expectedFiles.join(', ')} ; trouvé ${afterFiles.join(', ')}`)
  }
  for (const name of baseFiles.filter((file) => afterFiles.includes(file))) {
    const path = `${TESTS}/${name}`
    // Each tolerated difference is optional: a line may still read as in the base (tranches 1 to 5).
    const before = withoutLibImports(baseText(path))
    const after = withoutLibImports(readFileSync(join(root, path), 'utf8'))
    const length = Math.max(before.length, after.length)
    for (let index = 0; index < length; index++) {
      const expected = before[index] === undefined ? undefined : expectedTestLine(before[index], path, coreExports)
      if (after[index] !== before[index] && after[index] !== expected) {
        found.push(`${name}, ligne ${index + 1} hors imports : attendu « ${expected ?? '(fin)'} », trouvé « ${after[index] ?? '(fin)'} »`)
        break
      }
    }
  }
  return found
}

function runTests() {
  const files = readdirSync(join(root, TESTS)).filter((name) => name.endsWith('.test.mjs')).map((name) => `${TESTS}/${name}`)
  const run = (list) => {
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...list], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const summary = (key) => Number(new RegExp(`^# ${key} (\\d+)$`, 'm').exec(result.stdout)?.[1] ?? NaN)
    return { total: summary('tests'), failed: summary('fail'), notOk: (result.stdout.match(/^\s*not ok /gm) ?? []).length, status: result.status }
  }
  const all = run(files)
  const architecture = files.some((file) => file.endsWith(ARCHITECTURE_TEST)) ? run([`${TESTS}/${ARCHITECTURE_TEST}`]).total : 0
  const found = []
  const expected = BASE_TEST_COUNT + architecture
  if (all.total !== expected) found.push(`${all.total} tests rapportés, ${expected} attendus (${BASE_TEST_COUNT} de la base + ${architecture} d’architecture)`)
  if (all.failed !== 0 || all.notOk !== 0 || all.status !== 0) found.push(`suite en échec : ${all.failed} test(s), ${all.notOk} ligne(s) « not ok », code ${all.status}`)
  return { found, total: all.total }
}

// ---------- façade exports

async function compareExports() {
  const directory = mkdtempSync(join(tmpdir(), 'ref29-base-'))
  try {
    writeFileSync(join(directory, 'core.mjs'), baseText(`${LIB}/core.mjs`))
    const before = await import(pathToFileURL(join(directory, 'core.mjs')).href)
    const after = await import(pathToFileURL(join(root, LIB, 'core.mjs')).href)
    const found = []
    for (const name of Object.keys(before)) {
      if (!(name in after)) found.push(`${name} n’est plus exporté par core.mjs`)
      else if (typeof before[name] !== typeof after[name]) found.push(`${name} : ${typeof before[name]} devenu ${typeof after[name]}`)
      else if (typeof before[name] === 'function' && before[name].toString() !== after[name].toString()) found.push(`${name} : code différent`)
      else if (typeof before[name] !== 'function' && serialize(before[name]) !== serialize(after[name])) found.push(`${name} : valeur différente`)
    }
    for (const name of Object.keys(after)) if (!(name in before)) found.push(`${name} : export ajouté à la façade (règle SB6 : à justifier par une branche fusionnée)`)
    return { found, names: new Set(Object.keys(before)) }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

const serialize = (value) => JSON.stringify(value, (key, item) => (item instanceof RegExp ? item.toString() : item))

// ---------- self-test

// The declaration check must fail on each fabricated mutation of the current lib/.
function selfTest(baseFiles, afterFiles) {
  const found = []
  const first = Object.keys(afterFiles).sort((a, b) => BASE_LIB_FILES.includes(a) - BASE_LIB_FILES.includes(b)).find((file) => splitModule(afterFiles[file], file).units.filter((unit) => unit.text.split('\n').length > 6).length >= 2)
  const units = splitModule(afterFiles[first], first).units.filter((unit) => unit.text.split('\n').length > 6)
  const [a, b] = units
  const lineOf = (unit) => unit.text.split('\n')[3]
  const mutations = {
    'ligne échangée entre deux déclarations': afterFiles[first].replace(lineOf(a), '\u0000').replace(lineOf(b), lineOf(a)).replace('\u0000', lineOf(b)),
    'ligne supprimée': afterFiles[first].replace(`${lineOf(a)}\n`, ''),
    'déclaration dupliquée': `${afterFiles[first]}\n${a.text.replace(/^(?:\/\/.*\n)*/, '')}\n`,
  }
  for (const [label, text] of Object.entries(mutations)) {
    const result = compareDeclarations(baseFiles, { ...afterFiles, [first]: text })
    const caught = result.declarations.length > 0
    console.log(`    mutation « ${label} » (${a.name} / ${b.name}) : ${caught ? 'détectée' : 'NON détectée'}`)
    if (!caught) found.push(`mutation non détectée : ${label}`)
  }
  return found
}

// ---------- main

// Imported by move.mjs for splitModule: runs only when launched directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()

async function main() {

  const baseFiles = Object.fromEntries(BASE_LIB_FILES.map((path) => [path, baseText(path)]))
  const afterFiles = currentLibFiles()
  console.log(`Base ${BASE_COMMIT} : ${BASE_LIB_FILES.join(', ')} ; après : ${Object.keys(afterFiles).length} module(s) dans ${LIB}`)

  const declarations = compareDeclarations(baseFiles, afterFiles)
  console.log(`  ${declarations.baseCount} déclarations dans la base`)
  report('découpage des modules (aucune ligne hors catégorie en colonne 0)', declarations.strays)
  report('déclarations identiques, une seule fois (au `export ` et à `pluginRoot` près)', declarations.declarations)
  report('commentaires libres conservés', declarations.comments)

  const table = planTable()
  // A declaration still in core.mjs or cli.mjs is not moved yet; a moved one must be where the table says.
  const misplaced = Object.entries(declarations.placement)
    .filter(([name, file]) => !BASE_LIB_FILES.includes(file) && table[name] !== file)
    .map(([name, file]) => `${name} : dans ${file}, la table du plan dit ${table[name] ?? '(absente)'}`)
  const unplanned = Object.keys(declarations.placement).filter((name) => !table[name] && !['commands', 'main'].includes(name))
  report('déclarations déplacées dans le module que donne la table du plan', misplaced)
  report('déclarations présentes dans la table du plan', unplanned)
  const remaining = Object.values(declarations.placement).filter((file) => BASE_LIB_FILES.includes(file)).length
  console.log(`  ${declarations.baseCount - remaining} déclaration(s) déplacée(s), ${remaining} encore dans core.mjs ou cli.mjs`)

  const exportsCheck = await compareExports()
  report('exports de core.mjs (noms, typeof, code ou valeur)', exportsCheck.found)
  report('fichiers de tests (liste, lignes hors imports de ../lib/)', compareTests(exportsCheck.names))

  if (args.has('--self-test')) {
    console.log('Auto-contrôle :')
    report('mutations fabriquées détectées', selfTest(baseFiles, afterFiles))
  }

  if (!args.has('--no-tests')) {
    const tests = runTests()
    report(`suite verte, nombre de tests (${tests.total})`, tests.found)
  }

  console.log(problems.length ? `\nÉCHEC : ${problems.length} problème(s).` : '\nOK : rangement conforme à la spec §4.')
  process.exit(problems.length ? 1 : 0)
}
