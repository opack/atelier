import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { atelierOk, atelierRun, commitFiles, git, headOf, makeSlicedRepository, setHeader } from './helpers.mjs'
import { planOf } from './helpers.mjs'

// Slice 2 of a chantier with `tdd` (chantier) and `sliceTdd` (slice_tdd of slice 2): slice 1's
// code committed before slice_base, so that only slice 2's commits count.
function atSliceTwoWith({ tdd, sliceTdd }) {
  const directory = makeSlicedRepository({ id: 'FEAT-20', tdd })
  commitFiles(directory, { 'src/one.mjs': 'export const one = 1\n' }, 'feat: one')
  setHeader(directory, 'FEAT-20', { slice: '2', slice_base: headOf(directory), slice_tdd: sliceTdd })
  return directory
}

const shortHead = (directory) => git(directory, 'rev-parse', '--short', 'HEAD').trim()
const status = (directory) => JSON.parse(atelierOk(directory, 'status', '--json'))

describe('slice TDD in status and in the code of the slice', () => {
  it('tranche sans TDD d’un chantier TDD : un commit de tests seul est du code, set-reviewed ne la dit pas vide [FIX-20 AC-13]', () => {
    const directory = atSliceTwoWith({ tdd: 'yes', sliceTdd: 'no' })
    commitFiles(directory, { 'test/site.test.mjs': 'test\n' }, 'test: site')
    const result = atelierRun(directory, 'set-reviewed')
    assert.doesNotMatch(result.output, /tranche vide/i)
    assert.equal(result.status, 0, result.output)
  })

  it('tranche TDD d’un chantier sans TDD : le commit des tests ne compte pas, set-reviewed la dit vide [FIX-20 AC-13]', () => {
    const directory = atSliceTwoWith({ tdd: 'no', sliceTdd: 'yes' })
    commitFiles(directory, { 'test/two.test.mjs': 'test\n' }, 'test: two')
    setHeader(directory, 'FEAT-20', { tests_commit: shortHead(directory) })
    const result = atelierRun(directory, 'set-reviewed')
    assert.equal(result.status, 2, result.output)
    assert.match(result.output, /tranche vide/i)
  })

  it('status : codeCommitted d’une tranche sans TDD compte depuis slice_base, tests compris [FIX-20 AC-13]', () => {
    const directory = atSliceTwoWith({ tdd: 'yes', sliceTdd: 'no' })
    assert.equal(status(directory).chantier.codeCommitted, false, 'seule la spec depuis le début de la tranche')
    commitFiles(directory, { 'test/site.test.mjs': 'test\n' }, 'test: site')
    assert.equal(status(directory).chantier.codeCommitted, true, 'un commit de tests')
  })

  it('status : codeCommitted d’une tranche TDD d’un chantier sans TDD compte depuis le gel, tests exclus [FIX-20 AC-13]', () => {
    const directory = atSliceTwoWith({ tdd: 'no', sliceTdd: 'yes' })
    commitFiles(directory, { 'test/two.test.mjs': 'test\n' }, 'test: two')
    setHeader(directory, 'FEAT-20', { tests_commit: shortHead(directory) })
    assert.equal(status(directory).chantier.codeCommitted, false, 'seul le commit des tests')
    commitFiles(directory, { 'src/two.mjs': 'export const two = 2\n' }, 'feat: two')
    assert.equal(status(directory).chantier.codeCommitted, true, 'code après le gel')
  })

  it('status --json porte sliceTdd et le texte indique « TDD : oui » ou « TDD : non » pour la tranche [FIX-20 AC-14]', () => {
    for (const [sliceTdd, expected, label] of [['no', 'no', /TDD : non/], ['yes', 'yes', /TDD : oui/]]) {
      const directory = atSliceTwoWith({ tdd: 'yes', sliceTdd })
      assert.equal(status(directory).chantier.sliceTdd, expected, sliceTdd)
      assert.match(atelierOk(directory, 'status'), label, sliceTdd)
    }
    const undeclared = atSliceTwoWith({ tdd: 'yes', sliceTdd: '' })
    assert.equal(status(undeclared).chantier.sliceTdd, null, 'slice_tdd vide')
  })
})

describe('slice TDD line of the status text', () => {
  it('chantier à une seule tranche, slice_tdd: no : le texte indique « TDD : non » [FIX-20 AC-14]', () => {
    for (const plan of [planOf([1]), null]) {
      const directory = makeSlicedRepository({ id: 'FEAT-20', tdd: 'yes', plan })
      setHeader(directory, 'FEAT-20', { slice_tdd: 'no' })
      assert.match(atelierOk(directory, 'status'), /^TDD : non$/m, plan === null ? 'sans plan' : 'plan d’une tranche')
    }
  })

  it('slice_tdd vide : aucune ligne « TDD : » dans le texte, tranche numérotée ou unique [FIX-20 AC-14]', () => {
    for (const [plan, slice] of [[undefined, '2'], [planOf([1]), '1'], [null, '1']]) {
      const directory = makeSlicedRepository({ id: 'FEAT-20', tdd: 'yes', ...(plan === undefined ? {} : { plan }) })
      setHeader(directory, 'FEAT-20', { slice, slice_tdd: '' })
      assert.doesNotMatch(atelierOk(directory, 'status'), /TDD : (oui|non)/, `tranche ${slice}`)
    }
  })

  it('tranche numérotée : la ligne est rattachée à la tranche [FIX-20 AC-14]', () => {
    const directory = atSliceTwoWith({ tdd: 'yes', sliceTdd: 'no' })
    assert.match(atelierOk(directory, 'status'), /Tranche 2\/3 : TDD : non/)
  })
})
