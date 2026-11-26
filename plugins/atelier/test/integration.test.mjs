import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chantierBase } from '../lib/integration.mjs'
import { integrationRefChoice } from '../lib/integration.mjs'
import { buildChantierIndex } from '../lib/relations.mjs'
import { checkSpec } from '../lib/spec.mjs'
import { git, commit, makeRepository, atelier, atelierRun, specText, writeChantier, makeChantiersRepository } from './helpers.mjs'

// Index of chantiers in the current tree, each one { id, data } with its directory `<id>-demo`.
function indexOf(headers) {
  return buildChantierIndex(headers.map(({ id, ...data }) => ({
    id,
    directory: `${id}-demo`,
    data: { id, type: id.split('-')[0], status: 'signed', ...data },
  })), [])
}

describe('integration_branch in the spec header', () => {
  const epicText = (header) => specText({ id: 'EPIC-1', relations: header })
  const featText = (header) => specText({ id: 'FEAT-2', tdd: 'yes', relations: header })
  const optionProblems = (text) => checkSpec(text).filter((problem) => problem.includes('integration_branch'))

  it('accepte yes et no sur un EPIC, et l’absence du champ [FEAT-21 CA-2]', () => {
    assert.deepEqual(optionProblems(epicText({ integration_branch: 'yes' })), [])
    assert.deepEqual(optionProblems(epicText({ integration_branch: 'no' })), [])
    assert.deepEqual(optionProblems(epicText({})), [])
    assert.deepEqual(optionProblems(featText({})), [])
  })

  it('signale une valeur autre que yes ou no [FEAT-21 CA-2]', () => {
    for (const value of ['oui', 'true', 'YES']) {
      assert.equal(optionProblems(epicText({ integration_branch: value })).length, 1, value)
    }
  })

  it('signale integration_branch sur un chantier qui n’est pas un EPIC, même à no [FEAT-21 CA-2]', () => {
    assert.equal(optionProblems(featText({ integration_branch: 'yes' })).length, 1)
    assert.equal(optionProblems(featText({ integration_branch: 'no' })).length, 1)
  })
})

describe('base of a chantier', () => {
  it('sans EPIC ancêtre, ou avec des EPIC ancêtres sans l’option ou à no : la branche par défaut [FEAT-21 CA-1]', () => {
    const index = indexOf([
      { id: 'EPIC-1' },
      { id: 'EPIC-2', integration_branch: 'no', rel_parent: 'EPIC-1' },
      { id: 'FEAT-3', rel_parent: 'EPIC-2' },
      { id: 'FEAT-4' },
    ])
    assert.deepEqual(chantierBase(index, null, 'main'), { branch: 'main', epic: null, warning: null })
    assert.deepEqual(chantierBase(index, 'EPIC-2', 'main'), { branch: 'main', epic: null, warning: null })
    assert.deepEqual(chantierBase(index, 'EPIC-1', null), { branch: null, epic: null, warning: null }, 'branche par défaut inconnue')
  })

  it('enfant direct d’un EPIC à l’option : sa branche d’intégration, déduite de son dossier [FEAT-21 CA-4]', () => {
    const index = indexOf([{ id: 'EPIC-1', integration_branch: 'yes' }, { id: 'FEAT-2', rel_parent: 'EPIC-1' }])
    assert.deepEqual(chantierBase(index, 'EPIC-1', 'main'), { branch: 'epic/EPIC-1-demo', epic: 'EPIC-1', warning: null })
  })

  it('EPIC imbriqués : l’EPIC à l’option le plus proche impose sa branche ; un EPIC n’est pas son propre ancêtre [FEAT-21 CA-5]', () => {
    const index = indexOf([
      { id: 'EPIC-1', integration_branch: 'yes' },
      { id: 'EPIC-2', rel_parent: 'EPIC-1' },
      { id: 'EPIC-3', integration_branch: 'yes', rel_parent: 'EPIC-1' },
      { id: 'EPIC-4', integration_branch: 'yes' },
      { id: 'FEAT-5', rel_parent: 'EPIC-2' },
      { id: 'FEAT-6', rel_parent: 'EPIC-3' },
    ])
    assert.equal(chantierBase(index, 'EPIC-2', 'main').branch, 'epic/EPIC-1-demo', 'enfant d’un sous-EPIC sans l’option')
    assert.deepEqual(chantierBase(index, 'EPIC-3', 'main'), { branch: 'epic/EPIC-3-demo', epic: 'EPIC-3', warning: null }, 'enfant d’un sous-EPIC à l’option')
    assert.deepEqual(chantierBase(index, 'EPIC-1', 'main'), { branch: 'epic/EPIC-1-demo', epic: 'EPIC-1', warning: null }, 'EPIC-3 lui-même : la base de son parent')
    assert.deepEqual(chantierBase(index, null, 'main'), { branch: 'main', epic: null, warning: null }, 'EPIC-4 lui-même, sans parent')
  })

  it('parent introuvable ou cycle rel_parent : la branche par défaut et un avertissement', () => {
    const index = indexOf([
      { id: 'EPIC-7', integration_branch: 'yes', rel_parent: 'EPIC-8' },
      { id: 'EPIC-8', integration_branch: 'no', rel_parent: 'EPIC-7' },
      { id: 'EPIC-10', integration_branch: 'no', rel_parent: 'EPIC-11' },
      { id: 'EPIC-11', integration_branch: 'no', rel_parent: 'EPIC-10' },
    ])
    const missing = chantierBase(index, 'EPIC-9', 'main')
    assert.equal(missing.branch, 'main')
    assert.match(missing.warning ?? '', /EPIC-9/)
    const cycle = chantierBase(index, 'EPIC-10', 'main')
    assert.equal(cycle.branch, 'main')
    assert.match(cycle.warning ?? '', /cycle/)
  })
})

describe('base shown by the commands', () => {
  const epicBranch = 'epic/EPIC-1-x'

  // main without the EPIC; the EPIC (with `header`) on its integration branch; FEAT-2, child of
  // EPIC-1, on its own branch started from the integration branch.
  function epicRepository(header) {
    const directory = makeChantiersRepository({ main: [], branches: { [epicBranch]: [{ id: 'EPIC-1', relations: header }] } })
    git(directory, 'switch', '-q', '-c', 'feat/FEAT-2-x', epicBranch)
    writeChantier(directory, { id: 'FEAT-2', status: 'draft', tdd: 'yes', relations: { rel_parent: 'EPIC-1' } })
    git(directory, 'add', '-A')
    commit(directory, 'docs(chantiers): [FEAT-2] spec draft')
    return directory
  }
  const statusOf = (directory) => JSON.parse(atelier(directory, 'status', '--json')).chantier

  it('status --json expose la branche par défaut sans EPIC à l’option, null si elle est inconnue [FEAT-21 CA-1]', () => {
    const plain = makeChantiersRepository({ main: [], branches: { 'feat/FEAT-2-x': [{ id: 'FEAT-2', status: 'draft', tdd: 'yes' }] }, checkout: 'feat/FEAT-2-x' })
    assert.equal(statusOf(plain).baseBranch, 'main')
    assert.equal(statusOf(plain).baseEpic, null)
    const withoutOption = epicRepository({ integration_branch: 'no' })
    assert.equal(statusOf(withoutOption).baseBranch, 'main')
    const unknown = makeRepository('trunk')
    git(unknown, 'switch', '-q', '-c', 'feat/FEAT-2-x')
    writeChantier(unknown, { id: 'FEAT-2', status: 'draft', tdd: 'yes' })
    git(unknown, 'add', '-A')
    commit(unknown, 'docs(chantiers): [FEAT-2] spec draft')
    assert.equal(statusOf(unknown).baseBranch, null)
  })

  it('status --json d’un enfant expose la branche d’intégration et l’EPIC qui l’impose [FEAT-21 CA-4]', () => {
    const chantier = statusOf(epicRepository({ integration_branch: 'yes' }))
    assert.equal(chantier.baseBranch, epicBranch)
    assert.equal(chantier.baseEpic, 'EPIC-1')
  })

  it('base --parent, depuis la branche par défaut où la spec de l’EPIC n’existe pas [FEAT-21 CA-4]', () => {
    const directory = epicRepository({ integration_branch: 'yes' })
    git(directory, 'switch', '-q', 'main')
    assert.equal(atelier(directory, 'base', '--parent', 'EPIC-1').trim(), epicBranch)
    assert.equal(atelier(directory, 'base', '--parent', 'epic-1').trim(), epicBranch, 'identifiant en minuscules')
    const withoutOption = epicRepository({ integration_branch: 'no' })
    git(withoutOption, 'switch', '-q', 'main')
    assert.equal(atelier(withoutOption, 'base', '--parent', 'EPIC-1').trim(), 'main')
  })

  it('base --parent sans identifiant : refusé avec l’usage', () => {
    const directory = makeRepository('main')
    const { status, output } = atelierRun(directory, 'base')
    assert.notEqual(status, 0)
    assert.match(output, /--parent/)
  })
})

describe('base of an EPIC with an integration branch, shown by status', () => {
  it('sur sa propre branche, un EPIC à l’option a pour base celle de son parent, pas sa branche [FEAT-21 CA-5]', () => {
    const directory = makeChantiersRepository({ main: [], branches: { 'epic/EPIC-1-x': [{ id: 'EPIC-1', relations: { integration_branch: 'yes' } }] }, checkout: 'epic/EPIC-1-x' })
    const chantier = JSON.parse(atelier(directory, 'status', '--json')).chantier
    assert.equal(chantier.baseBranch, 'main')
    assert.equal(chantier.baseEpic, null)
  })
})

describe('git reference of an integration branch', () => {
  const branch = 'epic/EPIC-1-x'
  it('la plus avancée quand l’une contient l’autre, une erreur nommant la branche sinon [FEAT-21 CA-6]', () => {
    assert.deepEqual(integrationRefChoice({ branch, local: true, remote: false }), { ref: 'local' })
    assert.deepEqual(integrationRefChoice({ branch, local: false, remote: true }), { ref: 'remote' })
    assert.deepEqual(integrationRefChoice({ branch, local: true, remote: true, localInRemote: true, remoteInLocal: false }), { ref: 'remote' })
    assert.deepEqual(integrationRefChoice({ branch, local: true, remote: true, localInRemote: false, remoteInLocal: true }), { ref: 'local' })
    const diverged = integrationRefChoice({ branch, local: true, remote: true, localInRemote: false, remoteInLocal: false })
    assert.match(diverged.error ?? '', /epic\/EPIC-1-x/)
    assert.match(diverged.error ?? '', /synchronise/)
    const missing = integrationRefChoice({ branch, local: false, remote: false })
    assert.match(missing.error ?? '', /epic\/EPIC-1-x/)
    assert.match(missing.error ?? '', /récupère|pousse/)
  })
})
