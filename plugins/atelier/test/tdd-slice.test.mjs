import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { closeProblems } from '../lib/close.mjs'
import { nextStep } from '../lib/next-step.mjs'
import { setReviewedRefusal, setReviewedUpdate } from '../lib/review.mjs'
import { sliceState } from '../lib/slices.mjs'
import { testDrivenPhase } from '../lib/tdd.mjs'
import { decide, slicedChantier, planOf } from './helpers.mjs'

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
