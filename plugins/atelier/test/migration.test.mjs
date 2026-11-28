import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

// TEC-37 migrates this repository from CA-n / V-n to AC-n: the tests and the open chantiers
// (EPIC-14, EPIC-17) no longer cite the retired forms. Closed chantiers and decisions.md files are
// archives and keep them. The patterns are written so that this file's own text does not match them.

const testDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(testDirectory, '..', '..', '..')
const RETIRED_FORMS = [/CA-\d/i, /\bV-\d/i, /CA\s+couverts/i]
const OPEN_CHANTIERS = ['EPIC-14-atelier-sur-tout-depot', 'EPIC-17-plugin-lisible']

function testFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return testFiles(path)
    return entry.name.endsWith('.mjs') ? [path] : []
  })
}

// Drops the tests tagged [TEC-37 …], which carry the refused examples: a source is cut at each line
// that opens a describe / it / test call or a top-level statement, and the pieces opened by a
// TEC-37-tagged test are left out.
function withoutTec37Tests(source) {
  const pieces = []
  for (const line of source.split('\n')) {
    const opens = /^\s*(?:describe|it|test)\(/.test(line) || /^[^\s})\]]/.test(line)
    if (opens || pieces.length === 0) pieces.push([])
    pieces.at(-1).push(line)
  }
  return pieces.filter((piece) => !/\[TEC-37 [^\]]*\]/.test(piece[0])).map((piece) => piece.join('\n')).join('\n')
}

// Lines of text that cite a retired form, as « path:line: text ».
function retiredLines(path, text) {
  return text.split('\n').flatMap((line, index) =>
    RETIRED_FORMS.some((form) => form.test(line)) ? [`${relative(repositoryRoot, path)}:${index + 1}: ${line.trim()}`] : [])
}

const amendmentsOf = (spec) => (spec.split(/^## Amendements\s*$/m)[1] ?? '').split(/^## /m)[0]

describe('migration du dépôt vers AC-n', () => {
  it('les tests du plugin ne citent plus CA-n, V-n ni « CA couverts », hors exemples refusés des tests de TEC-37 [TEC-37 AC-5]', () => {
    const files = testFiles(testDirectory)
    assert.ok(files.some((path) => path.endsWith('criteria.test.mjs')), 'les fichiers de test sont parcourus')
    const criteria = files.find((path) => path.endsWith('criteria.test.mjs'))
    assert.ok(retiredLines(criteria, readFileSync(criteria, 'utf8')).length > 0, 'la recherche voit les exemples refusés avant exclusion')
    const found = files.flatMap((path) => retiredLines(path, withoutTec37Tests(readFileSync(path, 'utf8'))))
    assert.deepEqual(found, [])
  })

  it('les spec et plan.md d’EPIC-14 et d’EPIC-17 ne citent plus CA-n, V-n ni « CA couverts » [TEC-37 AC-5]', () => {
    const found = OPEN_CHANTIERS.flatMap((chantier) => ['spec.md', 'plan.md'].flatMap((name) => {
      const path = join(repositoryRoot, 'docs', 'chantiers', chantier, name)
      return retiredLines(path, readFileSync(path, 'utf8'))
    }))
    assert.deepEqual(found, [])
  })

  it('les specs d’EPIC-14 et d’EPIC-17 portent une entrée d’amendement datée qui cite TEC-37 et AC [TEC-37 AC-5]', () => {
    for (const chantier of OPEN_CHANTIERS) {
      const spec = readFileSync(join(repositoryRoot, 'docs', 'chantiers', chantier, 'spec.md'), 'utf8')
      const entries = amendmentsOf(spec).split('\n').filter((line) => /^- \d{4}-\d{2}-\d{2} : /.test(line))
      assert.ok(entries.some((line) => /TEC-37/.test(line) && /\bAC\b/.test(line)), `${chantier} : ${entries.join(' | ') || 'aucune entrée'}`)
    }
  })
})
