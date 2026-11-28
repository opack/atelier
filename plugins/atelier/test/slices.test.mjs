import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { planSliceCount, sliceState } from '../lib/slices.mjs'
import { planOf, threeSlices, slicedChantier, makeSlicedRepository, atelierOk } from './helpers.mjs'

describe('plan and current slice', () => {
  it('compte les entrées numérotées de premier niveau de « Tranches » (sous-listes, commentaires et autres sections ignorés) [FEAT-7 AC-1]', () => {
    assert.equal(planSliceCount(threeSlices), 3)
    assert.equal(planSliceCount(threeSlices.replace(/\n/g, '\r\n')), 3, 'plan en CRLF')
  })

  it('le nombre de tranches est le plus grand numéro [FEAT-7 AC-1]', () => {
    assert.equal(planSliceCount(planOf([1, 2, 4])), 4)
  })

  it('sans plan, sans section « Tranches » ou avec une seule entrée, une tranche unique [FEAT-7 AC-2]', () => {
    for (const plan of [null, '# Plan\n\n## Approche\nTexte.\n', planOf([1])]) {
      assert.equal(sliceState(slicedChantier({}, { plan })).model, 'single', String(plan))
    }
  })

  it('status --json donne slice et sliceCount null, et ne parle de tranche ni en texte ni dans la prochaine étape [FEAT-7 AC-2]', () => {
    for (const plan of [null, planOf([1])]) {
      const directory = makeSlicedRepository({ plan })
      const summary = JSON.parse(atelierOk(directory, 'status', '--json'))
      assert.equal(summary.chantier.slice, null)
      assert.equal(summary.chantier.sliceCount, null)
      assert.doesNotMatch(summary.nextStep, /tranche/i)
      assert.doesNotMatch(atelierOk(directory, 'status'), /tranche/i)
    }
  })

  it('sans champ slice ni trace de l’ancien modèle, la tranche en cours est la 1 [FEAT-7 AC-3]', () => {
    assert.deepEqual(sliceState(slicedChantier()), { model: 'sliced', slice: 1, sliceCount: 3 })
    const summary = JSON.parse(atelierOk(makeSlicedRepository(), 'status', '--json'))
    assert.equal(summary.chantier.slice, 1)
    assert.equal(summary.chantier.sliceCount, 3)
  })

  it('avec slice: 2, la tranche en cours est la 2 [FEAT-7 AC-3]', () => {
    assert.deepEqual(sliceState(slicedChantier({ slice: '2' })), { model: 'sliced', slice: 2, sliceCount: 3 })
    const summary = JSON.parse(atelierOk(makeSlicedRepository({ header: { slice: 2 } }), 'status', '--json'))
    assert.equal(summary.chantier.slice, 2)
    assert.equal(summary.chantier.sliceCount, 3)
  })

  it('un chantier de l’ancien modèle (tests_commit, reviewed_commit, tests rouverts ou regelés) est une tranche unique, quel que soit le plan [FEAT-7 AC-4]', () => {
    const withAmendment = (entry) => ({ ...slicedChantier(), spec: { data: { status: 'signed', type: 'FEAT', tdd: 'yes' }, body: `# x\n\n## Amendements\n- ${entry}\n` } })
    const legacy = [
      slicedChantier({ tests_commit: 'abc1234' }),
      slicedChantier({ reviewed_commit: 'a'.repeat(40) }, { tdd: 'no' }),
      withAmendment('2026-11-01 : tests rouverts (gel quitté : abc1234) : oubli'),
      withAmendment('2026-11-02 : tests regelés : def5678'),
    ]
    legacy.forEach((chantier, index) => assert.equal(sliceState(chantier).model, 'legacy', `cas ${index}`))
    const summary = JSON.parse(atelierOk(makeSlicedRepository({ header: { tests_commit: 'abc1234' } }), 'status', '--json'))
    assert.equal(summary.chantier.slice, null)
    assert.equal(summary.chantier.sliceCount, null)
  })
})
