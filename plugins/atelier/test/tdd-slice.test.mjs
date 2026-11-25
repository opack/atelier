import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { closeProblems } from '../lib/close.mjs'
import { nextStep } from '../lib/next-step.mjs'
import { setReviewedRefusal, setReviewedUpdate } from '../lib/review.mjs'
import { sliceState } from '../lib/slices.mjs'
import { reopenTestsRefusal, testDrivenPhase } from '../lib/tdd.mjs'
import { parseAmendments } from '../lib/spec.mjs'
import { decide, slicedChantier, planOf, atSliceTwo, atelierOk, atelierRun, commitFiles, commitSpec, setHeader, specData, specFileText } from './helpers.mjs'

describe('effective TDD of the current slice (slice_tdd)', () => {
  const base = 'a'.repeat(40)
  const reviewed = { reviewedCommit: base, found: true, isAncestor: true, codeFilesSince: [], amendmentsChanged: false }

  it('une tranche « TDD : non » d’un chantier TDD n’a pas de phase « tests d’abord » : site et tests s’écrivent [FIX-20 CA-2]', () => {
    const chantier = slicedChantier({ slice: '2', slice_base: base, slice_tdd: 'no' })
    assert.equal(testDrivenPhase(chantier), 'none')
    assert.equal(decide({ chantier, relativePath: 'site/cycle/tests.md' }).allowed, true)
    assert.equal(decide({ chantier, relativePath: 'plugins/atelier/test/core.test.mjs' }).allowed, true)
  })

  it('une tranche « TDD : oui » d’un chantier sans TDD commence par les tests ; un SPIKE sans TDD reste hors du cycle [FIX-20 CA-3]', () => {
    const fix = slicedChantier({ slice: '1', slice_tdd: 'yes' }, { type: 'FIX', tdd: 'no' })
    assert.equal(testDrivenPhase(fix), 'writing-tests')
    assert.equal(decide({ chantier: fix, relativePath: 'src/budget.ts' }).allowed, false)
    const spike = slicedChantier({ slice: '1', slice_tdd: 'yes' }, { type: 'SPIKE', tdd: 'no' })
    assert.equal(testDrivenPhase(spike), 'none')
  })

  it('sans slice_tdd, la phase suit le tdd du chantier et tests_commit, comme avant [FIX-20 CA-4]', () => {
    const cases = [
      ['tranche non déclarée, TDD', slicedChantier({ slice: '2', slice_base: base }), 'writing-tests'],
      ['tranche non déclarée, tests figés', slicedChantier({ slice: '2', slice_base: base, tests_commit: 'abc1234' }), 'implementing'],
      ['tranche non déclarée, sans TDD', slicedChantier({ slice: '2', slice_base: base }, { tdd: 'no' }), 'none'],
      ['chantier sans plan', slicedChantier({}, { plan: null }), 'writing-tests'],
      ['modèle legacy', slicedChantier({ tests_commit: 'abc1234' }, { plan: null }), 'implementing'],
      ['modèle legacy sans TDD', slicedChantier({ reviewed_commit: base }, { plan: null, tdd: 'no' }), 'none'],
      ['tranche absente du plan', slicedChantier({ slice: '5', slice_base: base }), 'writing-tests'],
    ]
    for (const [label, chantier, phase] of cases) {
      assert.equal(testDrivenPhase(chantier), phase, label)
    }
    assert.equal(sliceState(slicedChantier({ tests_commit: 'abc1234' }, { plan: null })).model, 'legacy')
  })

  it('sans slice_tdd, l’enregistrement d’une revue et la clôture restent ceux d’avant [FIX-20 CA-4]', () => {
    const sliceOne = slicedChantier({ slice: '1', tests_commit: 'abc1234' }, { plan: planOf([1, 2]) })
    const update = setReviewedUpdate(sliceOne, base)
    assert.equal(update.values.slice, '2')
    assert.equal(update.values.tests_commit, '')
    assert.match(update.message, /\/atelier:write-tests/)
    const writing = slicedChantier({ slice: '2', slice_base: base })
    const refusal = setReviewedRefusal({ chantier: writing, uncommittedCode: [], specUncommitted: false, changedTests: [] })
    assert.match(refusal, /pas figés/)
    const legacy = slicedChantier({ reviewed_commit: base }, { plan: null })
    const problems = closeProblems({ chantier: legacy, reviewFacts: reviewed, uncommittedCode: [], checksFailure: null })
    assert.ok(problems.some((problem) => /pas figés/.test(problem)), problems.join('\n'))
  })

  it('des tests figés restent figés, quoi que dise le TDD de la tranche [FIX-20 CA-5]', () => {
    const frozenNo = slicedChantier({ slice: '2', slice_base: base, tests_commit: 'abc1234', slice_tdd: 'no' })
    assert.equal(testDrivenPhase(frozenNo), 'implementing')
    assert.equal(decide({ chantier: frozenNo, relativePath: 'test/one.test.mjs' }).allowed, false)
    const frozenInNonTddChantier = slicedChantier({ slice: '2', slice_base: base, tests_commit: 'abc1234', slice_tdd: 'yes' }, { tdd: 'no' })
    assert.equal(testDrivenPhase(frozenInNonTddChantier), 'implementing')
  })

  it('après une dernière tranche « TDD : non », la revue du chantier ne réclame pas de tests figés [FIX-20 CA-7]', () => {
    const chantier = slicedChantier({ slice: 'chantier', last_slice: '3', slice_base: base })
    assert.equal(testDrivenPhase(chantier), 'none')
    assert.match(nextStep(chantier, 'none'), /^Revue du chantier : faire relire l.ensemble : \/atelier:review/)
    const refusal = setReviewedRefusal({ chantier, uncommittedCode: [], specUncommitted: false, changedTests: [] })
    assert.doesNotMatch(refusal ?? '', /pas figés/)
    const closing = { ...chantier, spec: { ...chantier.spec, data: { ...chantier.spec.data, reviewed_commit: base } } }
    const problems = closeProblems({ chantier: closing, reviewFacts: reviewed, uncommittedCode: [], checksFailure: null })
    assert.ok(!problems.some((problem) => /pas figés/.test(problem)), problems.join('\n'))
  })
})

// Plan of three slices: the second « TDD : <second> » (no declaration when null), the others in TDD.
function planWithSecond(second) {
  const tdd = second === null ? '' : ` — TDD : ${second}`
  return `# Plan : FEAT-20\n\n## Tranches\n1. Un — CA couverts : CA-1 — TDD : oui\n2. Deux — CA couverts : aucun${tdd}\n3. Trois — CA couverts : CA-3 — TDD : oui\n`
}

const amendments = (directory) => parseAmendments(specFileText(directory, 'FEAT-20')).entries
const phaseOf = (directory) => JSON.parse(atelierOk(directory, 'status', '--json')).chantier.testDrivenPhase

describe('slice TDD across transitions and commands', () => {
  const base = 'a'.repeat(40)

  it('la revue de la tranche 1 écrit le TDD de la tranche 2 et renvoie vers la bonne étape [FIX-20 CA-6]', () => {
    const reviewed = (second) => setReviewedUpdate(slicedChantier({ slice: '1', tests_commit: 'abc1234' }, { plan: planWithSecond(second) }), base)
    const withoutTdd = reviewed('non')
    assert.equal(withoutTdd.values.slice, '2')
    assert.equal(withoutTdd.values.slice_tdd, 'no')
    assert.equal(withoutTdd.values.tests_commit, '')
    assert.match(withoutTdd.message, /\/atelier:build/)
    assert.doesNotMatch(withoutTdd.message, /write-tests/)
    const withTdd = reviewed('oui')
    assert.equal(withTdd.values.slice_tdd, 'yes')
    assert.match(withTdd.message, /\/atelier:write-tests/)
    const undeclared = reviewed(null)
    assert.equal(undeclared.values.slice_tdd, '')
    assert.match(undeclared.message, /\/atelier:write-tests/)
  })

  it('en tranche sans TDD, la prochaine étape le dit et renvoie vers /atelier:build puis la revue [FIX-20 CA-6]', () => {
    const chantier = slicedChantier({ slice: '2', slice_base: base, slice_tdd: 'no' }, { plan: planWithSecond('non') })
    const step = nextStep(chantier, 'none')
    assert.match(step, /^Tranche 2\/3 : /)
    assert.match(step, /sans TDD pour cette tranche/)
    assert.match(step, /\/atelier:build/)
    assert.match(step, /\/atelier:review/)
  })

  it('set-tdd no en tranche 2 écrit slice_tdd et un amendement de tranche, sans toucher au tdd du chantier [FIX-20 CA-9]', () => {
    for (const before of [null, 'yes']) {
      const { directory } = atSliceTwo()
      if (before) setHeader(directory, 'FEAT-20', { slice_tdd: before })
      atelierOk(directory, 'set-tdd', 'no', 'rien', 'à', 'tester')
      const data = specData(directory, 'FEAT-20')
      assert.equal(data.slice_tdd, 'no', String(before))
      assert.equal(data.tdd, 'yes', String(before))
      assert.match(amendments(directory).at(-1), /TDD de la tranche 2 : désactivé : rien à tester$/, String(before))
    }
  })

  it('set-tdd est refusé si les tests de la tranche sont figés, ou si une réouverture est en attente [FIX-20 CA-9]', () => {
    const frozen = atSliceTwo().directory
    commitFiles(frozen, { 'test/two.test.mjs': 'test 2\n' }, 'test: two')
    atelierOk(frozen, 'freeze-tests')
    commitSpec(frozen)
    const refusedFrozen = atelierRun(frozen, 'set-tdd', 'no', 'trop', 'tard')
    assert.notEqual(refusedFrozen.status, 0)
    assert.match(refusedFrozen.output, /reopen-tests|rouvr/)
    assert.equal(specData(frozen, 'FEAT-20').slice_tdd ?? '', '')

    const reopened = atSliceTwo().directory
    atelierOk(reopened, 'reopen-tests', 'test', 'faux')
    commitSpec(reopened)
    const refusedReopened = atelierRun(reopened, 'set-tdd', 'no', 'finalement')
    assert.notEqual(refusedReopened.status, 0)
    assert.match(refusedReopened.output, /rouverts/)
    assert.equal(specData(reopened, 'FEAT-20').slice_tdd ?? '', '')
  })

  it('un chantier repassé en tdd: no après le gel, sans TDD de tranche, n’a plus de tests figés [FIX-20 CA-4]', () => {
    for (const chantier of [
      slicedChantier({ slice: '1', tests_commit: 'abc1234' }, { plan: null, tdd: 'no' }),
      slicedChantier({ tests_commit: 'abc1234' }, { plan: null, tdd: 'no' }),
      slicedChantier({ slice: '2', slice_base: base, tests_commit: 'abc1234' }, { tdd: 'no' }),
    ]) {
      assert.equal(testDrivenPhase(chantier), 'none', JSON.stringify(chantier.spec.data))
    }
  })

  it('slice_tdd se lit sans casse ; une valeur inconnue retombe sur le tdd du chantier [FIX-20 CA-4]', () => {
    assert.equal(testDrivenPhase(slicedChantier({ slice: '2', slice_base: base, slice_tdd: 'YES' }, { tdd: 'no' })), 'writing-tests')
    assert.equal(testDrivenPhase(slicedChantier({ slice: '2', slice_base: base, slice_tdd: 'No' })), 'none')
    for (const unknown of ['oui', 'true', 'nn']) {
      assert.equal(testDrivenPhase(slicedChantier({ slice: '2', slice_base: base, slice_tdd: unknown })), 'writing-tests', unknown)
      assert.equal(testDrivenPhase(slicedChantier({ slice: '2', slice_base: base, slice_tdd: unknown }, { tdd: 'no' })), 'none', unknown)
    }
  })

  it('en tranche sans TDD, freeze-tests et reopen-tests sont refusés et renvoient vers /atelier:build [FIX-20 CA-10]', () => {
    const pure = reopenTestsRefusal(slicedChantier({ slice: '2', slice_base: base, slice_tdd: 'no' }))
    assert.match(pure ?? '', /tranche 2 est sans TDD/)
    assert.match(pure ?? '', /\/atelier:build/)
    const { directory } = atSliceTwo()
    setHeader(directory, 'FEAT-20', { slice_tdd: 'no' })
    commitFiles(directory, { 'test/two.test.mjs': 'test 2\n' }, 'test: two')
    for (const command of ['freeze-tests', 'reopen-tests']) {
      const { status, output } = atelierRun(directory, command, ...(command === 'reopen-tests' ? ['raison'] : []))
      assert.notEqual(status, 0, command)
      assert.match(output, /tranche 2 est sans TDD/, command)
      assert.match(output, /\/atelier:build/, command)
    }
    assert.equal(specData(directory, 'FEAT-20').tests_commit ?? '', '')
  })

  it('en tranche TDD, un gel sans test dans le dernier commit indique comment déclarer la tranche sans TDD [FIX-20 CA-10]', () => {
    const { directory } = atSliceTwo()
    commitFiles(directory, { 'site/page.md': 'texte\n' }, 'docs: page')
    const { status, output } = atelierRun(directory, 'freeze-tests')
    assert.notEqual(status, 0)
    assert.match(output, /aucun fichier de test/)
    assert.match(output, /« TDD : non »/)
    assert.match(output, /atelier set-tdd no <raison>/)
  })

  it('en revue d’ensemble après une dernière tranche sans TDD, les tests se rouvrent puis se regèlent ; set-reviewed avait vidé slice_tdd [FIX-20 CA-15]', () => {
    const last = setReviewedUpdate(slicedChantier({ slice: '3', slice_base: base, slice_tdd: 'no' }, { plan: planWithSecond('oui') }), base)
    assert.equal(last.values.slice, 'chantier')
    assert.equal(last.values.slice_tdd, '')
    assert.equal(reopenTestsRefusal(slicedChantier({ slice: 'chantier', last_slice: '3', slice_base: base })), null)

    const { directory } = atSliceTwo()
    setHeader(directory, 'FEAT-20', { slice: 'chantier', last_slice: '3' })
    assert.equal(phaseOf(directory), 'none')
    atelierOk(directory, 'reopen-tests', 'cas', 'oublié')
    commitSpec(directory)
    assert.equal(phaseOf(directory), 'writing-tests')
    commitFiles(directory, { 'test/forgotten.test.mjs': 'cas oublié\n' }, 'test: forgotten case')
    atelierOk(directory, 'freeze-tests')
    commitSpec(directory)
    assert.equal(phaseOf(directory), 'implementing')
  })
})
