import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chantierSteps, versionFacts } from '../lib/list.mjs'
import { planOf, threeSlices } from './helpers.mjs'

// The step of a chantier, as `atelier list` shows it: computed from the shown version of each
// known chantier (header, spec body, plan, files of the directory), without any git command.

const reopenedBody = '# Spec\n\n## Amendements\n- 2026-11-20 : tests rouverts (gel quitté : abc1234) : cas oublié\n'
const refrozenBody = `${reopenedBody}- 2026-11-21 : tests regelés : def5678\n`

// The shown version of a chantier: `data` is its header, `body` its spec without the header,
// `plan` the text of plan.md (null when there is none).
function version(id, data, { body = '# Spec\n', plan = null, files } = {}) {
  const type = id.split('-')[0]
  const directoryFiles = files ?? (plan === null ? ['spec.md'] : ['spec.md', 'plan.md'])
  return { id, ...versionFacts({ data: { type, ...data }, specBody: body, planText: plan ?? '', files: directoryFiles }) }
}

// { step, stepLabel } of `id`, among the shown versions `versions`.
function stepOf(versions, id) {
  const steps = chantierSteps(versions)
  assert.ok(steps.has(id), `pas d’étape pour ${id}`)
  return steps.get(id)
}

function assertStep(chantier, step, stepLabel, others = []) {
  assert.deepEqual(stepOf([chantier, ...others], chantier.id), { step, stepLabel }, chantier.id)
}

const signed = (extra = {}) => ({ status: 'signed', ...extra })

describe('step of a chantier: the table of the spec, first case that applies', () => {
  it('abandonné, puis clos, l’emportent sur tout le reste [FEAT-35 AC-7]', () => {
    assertStep(version('EPIC-3', { status: 'abandoned', tdd: 'no' }), 'abandoned', 'abandonné', [version('FEAT-4', signed({ rel_parent: 'EPIC-3' }))])
    assertStep(version('FEAT-5', { status: 'abandoned', tdd: 'yes' }), 'abandoned', 'abandonné')
    assertStep(version('FEAT-6', { status: 'done', tdd: 'yes' }), 'done', 'clos')
    assertStep(version('EPIC-7', { status: 'done', tdd: 'no' }, { plan: '# Plan\n' }), 'done', 'clos', [version('FEAT-8', signed({ rel_parent: 'EPIC-7', tdd: 'yes' }))])
  })

  it('brouillon : statut draft ou absent, plan ou pas [FEAT-35 AC-7]', () => {
    assertStep(version('FEAT-9', { status: 'draft', tdd: 'yes' }), 'draft', 'brouillon')
    assertStep(version('FIX-10', { tdd: 'yes' }), 'draft', 'brouillon')
    assertStep(version('FEAT-11', { status: 'draft', tdd: 'yes' }, { plan: threeSlices }), 'draft', 'brouillon')
  })

  it('à planifier : FEAT, REF ou EPIC signé sans plan.md, pas les autres types [FEAT-35 AC-7]', () => {
    assertStep(version('FEAT-12', signed({ tdd: 'yes' })), 'plan', 'à planifier')
    assertStep(version('REF-13', signed({ tdd: 'yes' })), 'plan', 'à planifier')
    assertStep(version('EPIC-14', signed({ tdd: 'no' })), 'plan', 'à planifier', [version('FEAT-15', signed({ rel_parent: 'EPIC-14', tdd: 'yes' }))])
    assertStep(version('FIX-16', signed({ tdd: 'yes' })), 'tests', 'tests d’abord')
    assertStep(version('TEC-17', signed({ tdd: 'no' })), 'build', 'implémentation')
  })

  it('tests d’abord : TDD sans tests figés, y compris tests rouverts et revue déjà enregistrée [FEAT-35 AC-7]', () => {
    assertStep(version('FIX-18', signed({ tdd: 'yes' })), 'tests', 'tests d’abord')
    assertStep(version('FEAT-19', signed({ tdd: 'yes', slice: '1' }), { plan: planOf([1]) }), 'tests', 'tests d’abord')
    assertStep(version('FIX-20', signed({ tdd: 'yes', reviewed_commit: 'abc1234' }), { body: reopenedBody }), 'tests', 'tests d’abord')
    assertStep(version('SPIKE-21', signed({ tdd: 'yes' })), 'tests', 'tests d’abord')
  })

  it('revue du chantier : tranche du chantier sans revue enregistrée, sauf tests rouverts [FEAT-35 AC-7]', () => {
    const atChantier = (extra, options = {}) => version('FEAT-22', signed({ tdd: 'yes', slice: 'chantier', ...extra }), { plan: threeSlices, ...options })
    assertStep(atChantier({}), 'chantier-review', 'revue du chantier')
    assertStep(atChantier({}, { body: refrozenBody }), 'chantier-review', 'revue du chantier')
    assertStep(atChantier({ tests_commit: 'def5678' }, { body: refrozenBody }), 'chantier-review', 'revue du chantier')
    assertStep(atChantier({}, { body: reopenedBody }), 'tests', 'tests d’abord')
  })

  it('revue enregistrée : tranche unique, ancien modèle ou revue du chantier faite [FEAT-35 AC-7]', () => {
    assertStep(version('FIX-23', signed({ tdd: 'yes', tests_commit: 'abc1234', reviewed_commit: 'def5678' })), 'reviewed', 'revue enregistrée')
    assertStep(version('TEC-24', signed({ tdd: 'no', reviewed_commit: 'def5678' })), 'reviewed', 'revue enregistrée')
    assertStep(version('FEAT-25', signed({ tdd: 'yes', tests_commit: 'abc1234', reviewed_commit: 'def5678' }), { plan: '# Plan\n' }), 'reviewed', 'revue enregistrée')
    assertStep(version('FEAT-26', signed({ tdd: 'yes', slice: 'chantier', reviewed_commit: 'def5678' }), { plan: threeSlices }), 'reviewed', 'revue enregistrée')
  })

  it('implémentation : TDD figé, sans TDD, SPIKE sans TDD [FEAT-35 AC-7]', () => {
    assertStep(version('FIX-27', signed({ tdd: 'yes', tests_commit: 'abc1234' })), 'build', 'implémentation')
    assertStep(version('FIX-28', signed({ tdd: 'no' })), 'build', 'implémentation')
    assertStep(version('SPIKE-29', signed({ tdd: 'no' })), 'build', 'implémentation')
    assertStep(version('FEAT-30', signed({ tdd: 'no' }), { plan: '# Plan\n' }), 'build', 'implémentation')
  })
})

describe('step of a chantier split into slices', () => {
  it('« Tranche 2/3 : implémentation » sur la tranche 2 d’un chantier TDD aux tests figés [FEAT-35 AC-7]', () => {
    const chantier = version('FEAT-31', signed({ tdd: 'yes', slice: '2', tests_commit: 'abc1234' }), { plan: threeSlices })
    assertStep(chantier, 'build', 'Tranche 2/3 : implémentation')
  })

  it('« Tranche 4 (absente du plan) : tests d’abord » sur une tranche absente du plan, sans tests figés [FEAT-35 AC-7]', () => {
    const chantier = version('FEAT-32', signed({ tdd: 'yes', slice: '4' }), { plan: threeSlices })
    assertStep(chantier, 'tests', 'Tranche 4 (absente du plan) : tests d’abord')
  })

  it('la tranche 1 d’un plan à plusieurs tranches est préfixée, une tranche déclarée sans TDD est en implémentation [FEAT-35 AC-7]', () => {
    assertStep(version('FEAT-33', signed({ tdd: 'yes', slice: '1' }), { plan: threeSlices }), 'tests', 'Tranche 1/3 : tests d’abord')
    assertStep(version('FEAT-34', signed({ tdd: 'yes', slice: '3', slice_tdd: 'no' }), { plan: threeSlices }), 'build', 'Tranche 3/3 : implémentation')
    assertStep(version('FEAT-35', signed({ tdd: 'no', slice: '2', slice_tdd: 'yes' }), { plan: threeSlices }), 'tests', 'Tranche 2/3 : tests d’abord')
  })

  it('pas de préfixe pour la revue du chantier [FEAT-35 AC-7]', () => {
    assertStep(version('FEAT-36', signed({ tdd: 'yes', slice: 'chantier' }), { plan: threeSlices }), 'chantier-review', 'revue du chantier')
  })
})

describe('step of an EPIC: its children among all the known chantiers', () => {
  const epic = version('EPIC-40', signed({ tdd: 'no' }), { plan: '# Plan : EPIC-40\n\n## Lots\n- FEAT-41, FEAT-42\n' })
  const child = (id, status, extra = {}) => version(id, { status, tdd: 'yes', rel_parent: 'EPIC-40', ...extra })

  it('« 2 enfant(s) ouvert(s) » avec deux enfants ouverts et un clos [FEAT-35 AC-8]', () => {
    const others = [child('FEAT-41', 'signed'), child('FIX-43', 'draft'), child('FEAT-42', 'done')]
    assertStep(epic, 'epic-children', '2 enfant(s) ouvert(s)', others)
  })

  it('« enfants clos : à clôturer » quand tous sont clos, dont au moins un done [FEAT-35 AC-8]', () => {
    assertStep(epic, 'epic-close', 'enfants clos : à clôturer', [child('FEAT-41', 'done'), child('FEAT-42', 'abandoned')])
  })

  it('« enfants clos, aucun livré : à abandonner » quand tous sont abandonnés [FEAT-35 AC-8]', () => {
    assertStep(epic, 'epic-abandon', 'enfants clos, aucun livré : à abandonner', [child('FEAT-41', 'abandoned'), child('FEAT-42', 'abandoned')])
  })

  it('« aucun enfant » sans enfant, même avec d’autres chantiers connus [FEAT-35 AC-8]', () => {
    assertStep(epic, 'epic-children', 'aucun enfant')
    const others = [version('FEAT-44', signed({ tdd: 'yes' })), version('FEAT-45', signed({ tdd: 'yes', rel_parent: 'EPIC-46' }))]
    assertStep(epic, 'epic-children', 'aucun enfant', others)
  })

  it('l’enfant se reconnaît au rel_parent de sa version, sans tenir compte de la casse [FEAT-35 AC-8]', () => {
    assertStep(epic, 'epic-children', '1 enfant(s) ouvert(s)', [child('FEAT-41', 'signed', { rel_parent: 'epic-40' })])
  })

  it('l’étape de chaque chantier est rendue, enfants et EPIC dans le même calcul [FEAT-35 AC-8]', () => {
    const versions = [epic, child('FEAT-41', 'done'), child('FEAT-42', 'signed', { tests_commit: 'abc1234' })]
    const steps = chantierSteps(versions)
    assert.deepEqual([...steps.keys()].sort(), ['EPIC-40', 'FEAT-41', 'FEAT-42'])
    assert.deepEqual(steps.get('EPIC-40'), { step: 'epic-children', stepLabel: '1 enfant(s) ouvert(s)' })
    assert.deepEqual(steps.get('FEAT-41'), { step: 'done', stepLabel: 'clos' })
    assert.deepEqual(steps.get('FEAT-42'), { step: 'plan', stepLabel: 'à planifier' })
  })
})

describe('step of a chantier: cases added after the review of slice 1', () => {
  it('ancien modèle : plan à tranches, pas de slice, tests rouverts : « tests d’abord » sans préfixe [FEAT-35 AC-7]', () => {
    assertStep(version('FEAT-50', signed({ tdd: 'yes' }), { plan: threeSlices, body: reopenedBody }), 'tests', 'tests d’abord')
  })

  it('tranche numérotée dont la revue est enregistrée : préfixe de tranche [FEAT-35 AC-7]', () => {
    assertStep(version('FEAT-51', signed({ tdd: 'yes', slice: '2', tests_commit: 'abc1234', reviewed_commit: 'def5678' }), { plan: threeSlices }), 'reviewed', 'Tranche 2/3 : revue enregistrée')
  })
})
