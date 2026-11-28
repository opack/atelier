import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nextStep } from '../lib/next-step.mjs'
import { assertLine, atelierRun, commit, commitFiles, epicPlan, git, headOf, makeRepository, setHeader, writeChantier } from './helpers.mjs'

const EPIC_BRANCH = 'epic/EPIC-1-x'

// main, then the branch of EPIC-1 (signed, with `option` as integration_branch).
function epicRepository(option = 'yes') {
  const directory = makeRepository('main')
  git(directory, 'switch', '-q', '-c', EPIC_BRANCH)
  writeChantier(directory, { id: 'EPIC-1', relations: { integration_branch: option }, files: epicPlan })
  git(directory, 'add', '-A')
  commit(directory, 'docs(chantiers): [EPIC-1] plan')
  return directory
}

// A child `id` of EPIC-1 started from the integration branch: code committed, review recorded on it
// (unless `reviewed` is false), closed, then merged into the integration branch by a merge commit
// (or by a squash when `squash`). The integration branch is left checked out.
function closedChild(directory, { id = 'FEAT-2', type = id.split('-')[0], reviewed = true, squash = false } = {}) {
  const branch = `${type.toLowerCase()}/${id}-x`
  git(directory, 'switch', '-q', '-c', branch, EPIC_BRANCH)
  writeChantier(directory, { id, tdd: 'no', relations: { rel_parent: 'EPIC-1' } })
  commitFiles(directory, { [`src/${id}.mjs`]: 'export const x = 1\n' }, `feat(x): [${id}] code`)
  setHeader(directory, id, { ...(reviewed ? { reviewed_commit: headOf(directory) } : {}), status: 'done' })
  git(directory, 'switch', '-q', EPIC_BRANCH)
  if (squash) {
    git(directory, 'merge', '-q', '--squash', branch)
    commit(directory, `[${id}] squash`)
  } else {
    git(directory, 'merge', '-q', '--no-ff', '--no-edit', branch)
  }
}

const closeCheck = (directory) => atelierRun(directory, 'close-check')

describe('close of an EPIC with an integration branch', () => {
  it('exige une revue comme un chantier à tranche unique, et renvoie vers /atelier:review [FEAT-21 AC-8]', () => {
    const directory = epicRepository()
    closedChild(directory)
    const result = closeCheck(directory)
    assert.notEqual(result.status, 0, result.output)
    assert.match(result.output, /Aucune revue enregistrée/)
    assert.match(result.output, /\/atelier:review/)
    assert.doesNotMatch(result.output, /relance la clôture : \/atelier:close/)
  })

  it('revue à jour : la clôture passe ; du code commité depuis la rend obsolète [FEAT-21 AC-8]', () => {
    const directory = epicRepository()
    closedChild(directory)
    setHeader(directory, 'EPIC-1', { reviewed_commit: headOf(directory) })
    const current = closeCheck(directory)
    assert.equal(current.status, 0, current.output)

    closedChild(directory, { id: 'FEAT-3' })
    const stale = closeCheck(directory)
    assert.notEqual(stale.status, 0, stale.output)
    assert.match(stale.output, /Revue obsolète/)
  })

  it('une fusion de la branche par défaut sans conflit après la revue d’ensemble la laisse à jour (règle de FIX-28) [FEAT-21 AC-8]', () => {
    const directory = epicRepository()
    closedChild(directory)
    setHeader(directory, 'EPIC-1', { reviewed_commit: headOf(directory) })
    git(directory, 'switch', '-q', 'main')
    commitFiles(directory, { 'src/main-only.mjs': 'export const m = 1\n' }, 'feat(m): [FEAT-9] code on main')
    git(directory, 'switch', '-q', EPIC_BRANCH)
    git(directory, 'merge', '-q', '--no-ff', '--no-edit', 'main')
    const result = closeCheck(directory)
    assert.equal(result.status, 0, result.output)
  })

  it('un EPIC sans l’option reste exempté de revue [FEAT-21 AC-8]', () => {
    const directory = epicRepository('no')
    closedChild(directory)
    const result = closeCheck(directory)
    assert.equal(result.status, 0, result.output)
  })
})

describe('reviews of the children of an EPIC with an integration branch', () => {
  // EPIC-1 with its own review recorded, so that only the children's reviews are judged.
  function reviewedEpic(directory) {
    setHeader(directory, 'EPIC-1', { reviewed_commit: headOf(directory) })
    return closeCheck(directory)
  }

  it('un enfant fusionné par squash : refus qui le nomme, avec la cause et le remède [FEAT-21 AC-9]', () => {
    const directory = epicRepository()
    closedChild(directory, { squash: true })
    const result = reviewedEpic(directory)
    assert.notEqual(result.status, 0, result.output)
    assertLine(result.output, [/FEAT-2/, /squash/, /rebase/])
    assert.match(result.output, /rétablir|rétablis/i)
  })

  it('un enfant done sans reviewed_commit : refus qui le nomme [FEAT-21 AC-9]', () => {
    const directory = epicRepository()
    closedChild(directory, { reviewed: false })
    const result = reviewedEpic(directory)
    assert.notEqual(result.status, 0, result.output)
    assertLine(result.output, [/FEAT-2/, /reviewed_commit|revue/])
  })

  it('un SPIKE sans TDD, exempté de revue, n’est pas vérifié [FEAT-21 AC-9]', () => {
    const directory = epicRepository()
    closedChild(directory)
    closedChild(directory, { id: 'SPIKE-3', reviewed: false })
    const result = reviewedEpic(directory)
    assert.equal(result.status, 0, result.output)
    assert.doesNotMatch(result.output, /SPIKE-3/)
  })
})

describe('dependencies and the integration branch', () => {
  it('enfant dont la dépendance n’est pas fusionnée : fusionner la branche d’intégration, pas la branche par défaut [FEAT-21 AC-10]', () => {
    const directory = epicRepository()
    git(directory, 'switch', '-q', '-c', 'feat/FEAT-5-x', EPIC_BRANCH)
    writeChantier(directory, { id: 'FEAT-5', tdd: 'no', relations: { rel_parent: 'EPIC-1' } })
    git(directory, 'add', '-A')
    commit(directory, 'docs(chantiers): [FEAT-5] spec')
    git(directory, 'switch', '-q', '-c', 'feat/FEAT-2-x', EPIC_BRANCH)
    writeChantier(directory, { id: 'FEAT-2', tdd: 'no', relations: { rel_parent: 'EPIC-1', rel_depends_on: 'FEAT-5' } })
    commitFiles(directory, { 'src/two.mjs': 'export const two = 2\n' }, 'feat(two): [FEAT-2] code')
    setHeader(directory, 'FEAT-2', { reviewed_commit: headOf(directory) })
    const result = closeCheck(directory)
    assert.notEqual(result.status, 0, result.output)
    assertLine(result.output, [/FEAT-5/, /epic\/EPIC-1-x/])
    assert.doesNotMatch(result.output.split('\n').filter((line) => /FEAT-5/.test(line)).join('\n'), /branche par défaut/)
  })

  it('chantier hors de l’EPIC qui dépend d’un enfant done seulement dans la branche d’intégration : attendre la clôture de l’EPIC [FEAT-21 AC-10]', () => {
    const directory = epicRepository()
    closedChild(directory)
    git(directory, 'switch', '-q', '-c', 'tec/TEC-6-x', 'main')
    writeChantier(directory, { id: 'TEC-6', relations: { rel_depends_on: 'FEAT-2' } })
    commitFiles(directory, { 'src/six.mjs': 'export const six = 6\n' }, 'chore(six): [TEC-6] code')
    setHeader(directory, 'TEC-6', { reviewed_commit: headOf(directory) })
    const result = closeCheck(directory)
    assert.notEqual(result.status, 0, result.output)
    assertLine(result.output, [/FEAT-2/, /epic\/EPIC-1-x/, /clôture de l’EPIC|clôture de EPIC-1/])
  })

  it('dépendance déjà livrée dans la branche par défaut, encore présente sur la branche d’intégration : pas d’attente de la clôture de l’EPIC [FEAT-21 AC-10]', () => {
    const directory = epicRepository()
    closedChild(directory)
    git(directory, 'switch', '-q', '-c', 'tec/TEC-6-x', 'main')
    writeChantier(directory, { id: 'TEC-6', relations: { rel_depends_on: 'FEAT-2' } })
    commitFiles(directory, { 'src/six.mjs': 'export const six = 6\n' }, 'chore(six): [TEC-6] code')
    setHeader(directory, 'TEC-6', { reviewed_commit: headOf(directory) })
    git(directory, 'switch', '-q', 'main')
    git(directory, 'merge', '-q', '--no-ff', '--no-edit', EPIC_BRANCH)
    git(directory, 'switch', '-q', 'tec/TEC-6-x')
    const result = closeCheck(directory)
    assert.notEqual(result.status, 0, result.output)
    assertLine(result.output, [/FEAT-2/, /branche par défaut/])
    assert.doesNotMatch(result.output, /clôture de l’EPIC|clôture de EPIC-1/)
  })
})

describe('next step of an EPIC with an integration branch', () => {
  const epic = (data = {}) => ({
    id: 'EPIC-1',
    directory: '/p/docs/chantiers/EPIC-1-x',
    spec: { data: { status: 'signed', type: 'EPIC', tdd: 'no', integration_branch: 'yes', ...data }, body: '# x\n' },
    files: ['spec.md', 'plan.md'],
    plan: '# Plan\n',
  })
  const done = [{ id: 'FEAT-2', closed: true, status: 'done' }]

  it('enfants ouverts : les mener à terme ; tous clos sans revue : la revue d’ensemble ; revue à jour : la clôture [FEAT-21 AC-14]', () => {
    assert.match(nextStep(epic(), 'none', [{ id: 'FEAT-2', closed: false, status: 'signed' }]), /encore ouvert/)
    const toReview = nextStep(epic(), 'none', done)
    assert.match(toReview, /\/atelier:review/)
    assert.doesNotMatch(toReview, /\/atelier:close/)
    assert.match(nextStep(epic(), 'stale', done), /\/atelier:review/)
    assert.match(nextStep(epic(), 'current', done), /\/atelier:close/)
  })

  it('sans l’option, tous les enfants clos mènent toujours à la clôture, sans revue [FEAT-21 AC-14]', () => {
    const step = nextStep(epic({ integration_branch: 'no' }), 'none', done)
    assert.match(step, /\/atelier:close/)
    assert.doesNotMatch(step, /\/atelier:review/)
  })
})
