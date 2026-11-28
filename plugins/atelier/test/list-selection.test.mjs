import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { atelierOk, epicPlan, listed, listedIds, makeChantiersRepository } from './helpers.mjs'

// `atelier list` on the current tree: default « open » chantiers, filters, free text, sort.

// The line of `output` that shows `id` (the identifier as a whole word).
function lineOf(output, id) {
  const line = output.split(/\r?\n/).find((candidate) => new RegExp(`(^|[^\\w-])${id}(?![\\w-])`).test(candidate))
  assert.ok(line, `${id} absent de\n${output}`)
  return line
}

describe('atelier list: one line per chantier, numeric order', () => {
  const directory = makeChantiersRepository({
    main: [
      { id: 'FEAT-30', tdd: 'yes', relations: { title: 'Calibrer les relectures' } },
      { id: 'FEAT-4', tdd: 'yes', relations: { title: 'Lier les chantiers' } },
      { id: 'TEC-2', tdd: 'no', relations: { title: 'Installer le plugin' } },
    ],
  })

  it('TEC-2, FEAT-4, FEAT-30 dans cet ordre, chacun avec identifiant, type, titre, statut, étape et emplacement [FEAT-35 AC-1]', () => {
    const output = atelierOk(directory, 'list')
    const lines = ['TEC-2', 'FEAT-4', 'FEAT-30'].map((id) => lineOf(output, id))
    const positions = lines.map((line) => output.indexOf(line))
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, `ordre attendu TEC-2, FEAT-4, FEAT-30 dans\n${output}`)
    const [tec, feat4, feat30] = lines
    for (const pattern of [/\bTEC\b/, /Installer le plugin/, /\bsigned\b/, /implémentation/, /\bici\b/]) {
      assert.match(tec, pattern)
    }
    for (const pattern of [/\bFEAT\b/, /Lier les chantiers/, /\bsigned\b/, /à planifier/, /\bici\b/]) {
      assert.match(feat4, pattern)
    }
    assert.match(feat30, /Calibrer les relectures/)
  })

  it('le même ordre numérique en JSON [FEAT-35 AC-1]', () => {
    assert.deepEqual(listedIds(directory), ['TEC-2', 'FEAT-4', 'FEAT-30'])
  })
})

describe('atelier list: open chantiers by default, --all, --status', () => {
  const directory = makeChantiersRepository({
    main: [
      { id: 'FEAT-1', status: 'done' },
      { id: 'FEAT-2', status: 'abandoned' },
      { id: 'FEAT-3', status: 'signed' },
      { id: 'FEAT-4', status: 'draft' },
    ],
  })

  it('sans option, seuls les chantiers ni done ni abandoned ; --all ajoute les clos [FEAT-35 AC-2]', () => {
    assert.deepEqual(listedIds(directory), ['FEAT-3', 'FEAT-4'])
    assert.deepEqual(listedIds(directory, '--all'), ['FEAT-1', 'FEAT-2', 'FEAT-3', 'FEAT-4'])
  })

  it('un --status explicite remplace le défaut, sans --all ; --all avec --status est sans effet [FEAT-35 AC-2]', () => {
    assert.deepEqual(listedIds(directory, '--status', 'done'), ['FEAT-1'])
    assert.deepEqual(listedIds(directory, '--status', 'done,signed'), ['FEAT-1', 'FEAT-3'])
    assert.deepEqual(listedIds(directory, '--status', 'done', '--all'), ['FEAT-1'])
  })

  it('--status ne tient pas compte de la casse [FEAT-35 AC-2]', () => {
    assert.deepEqual(listedIds(directory, '--status', 'DONE,Abandoned'), ['FEAT-1', 'FEAT-2'])
  })
})

describe('atelier list: filters by type and by parent', () => {
  const directory = makeChantiersRepository({
    main: [
      { id: 'FIX-1' },
      { id: 'FIX-2', status: 'draft' },
      { id: 'TEC-3' },
      { id: 'FEAT-5' },
      { id: 'REF-6' },
      { id: 'TEC-7', status: 'done' },
      { id: 'EPIC-17', files: epicPlan },
      { id: 'FEAT-20', relations: { rel_parent: 'EPIC-17' } },
      { id: 'FEAT-21', status: 'done', relations: { rel_parent: 'EPIC-17' } },
      { id: 'FIX-22', status: 'draft', relations: { rel_parent: 'epic-17' } },
      { id: 'FEAT-23', relations: { rel_parent: 'EPIC-18' } },
    ],
  })

  it('--type fix,TEC --status signed : les FIX et TEC signés seulement, casse ignorée [FEAT-35 AC-3]', () => {
    assert.deepEqual(listedIds(directory, '--type', 'fix,TEC', '--status', 'signed'), ['FIX-1', 'TEC-3'])
  })

  it('les filtres se cumulent : ET entre filtres, OU entre valeurs d’un filtre [FEAT-35 AC-3]', () => {
    assert.deepEqual(listedIds(directory, '--type', 'FIX'), ['FIX-1', 'FIX-2', 'FIX-22'])
    assert.deepEqual(listedIds(directory, '--type', 'FIX', '--status', 'draft'), ['FIX-2', 'FIX-22'])
    assert.deepEqual(listedIds(directory, '--type', 'FEAT,REF', '--status', 'signed,done'), ['FEAT-5', 'REF-6', 'FEAT-20', 'FEAT-21', 'FEAT-23'])
  })

  it('--parent EPIC-17 : les chantiers ouverts dont rel_parent vaut EPIC-17, casse ignorée [FEAT-35 AC-3]', () => {
    assert.deepEqual(listedIds(directory, '--parent', 'EPIC-17'), ['FEAT-20', 'FIX-22'])
    assert.deepEqual(listedIds(directory, '--parent', 'epic-17'), ['FEAT-20', 'FIX-22'])
    assert.deepEqual(listedIds(directory, '--parent', 'EPIC-17', '--all'), ['FEAT-20', 'FEAT-21', 'FIX-22'])
    assert.deepEqual(listedIds(directory, '--parent', 'EPIC-99'), [])
  })
})

describe('atelier list: free text on identifier and title', () => {
  const directory = makeChantiersRepository({
    main: [
      { id: 'FEAT-1', relations: { title: 'Calibrer les relectures' } },
      { id: 'FEAT-2', relations: { title: 'Rélecture du plan' } },
      { id: 'FEAT-3', relations: { title: 'Planifier autre chose' } },
      { id: 'FIX-11', relations: { title: 'Corriger le gel' } },
      { id: 'FIX-12', relations: { title: 'Corriger la revue' } },
      { id: 'FIX-21', relations: { title: 'Corriger le plan' } },
    ],
  })

  it('« relecture » trouve « relectures » et « Rélecture », sans casse ni accents [FEAT-35 AC-4]', () => {
    assert.deepEqual(listedIds(directory, 'relecture'), ['FEAT-1', 'FEAT-2'])
    assert.deepEqual(listedIds(directory, 'RELECTURE'), ['FEAT-1', 'FEAT-2'])
  })

  it('plusieurs mots : chacun doit être trouvé [FEAT-35 AC-4]', () => {
    assert.deepEqual(listedIds(directory, 'relecture', 'plan'), ['FEAT-2'])
    assert.deepEqual(listedIds(directory, 'relecture', 'gel'), [])
  })

  it('recherche de texte dans l’identifiant : fix-1 trouve FIX-11 et FIX-12, pas FIX-21 [FEAT-35 AC-4]', () => {
    assert.deepEqual(listedIds(directory, 'fix-1'), ['FIX-11', 'FIX-12'])
  })

  it('le texte se cumule avec les autres filtres [FEAT-35 AC-4]', () => {
    assert.deepEqual(listedIds(directory, 'plan', '--type', 'FIX'), ['FIX-21'])
  })
})

describe('atelier list: sort by status or by type', () => {
  const directory = makeChantiersRepository({
    main: [
      { id: 'FEAT-1', status: 'done' },
      { id: 'FIX-2', status: 'draft' },
      { id: 'TEC-3', status: 'signed' },
      { id: 'REF-4', status: 'abandoned' },
      { id: 'FEAT-5', status: 'draft' },
      { id: 'SPIKE-6', status: 'signed' },
      { id: 'EPIC-7', status: 'done' },
      { id: 'FIX-8', status: 'abandoned' },
      { id: 'FEAT-10', status: 'signed' },
    ],
  })

  it('--sort status : draft, signed, done, abandoned, par numéro dans chaque groupe [FEAT-35 AC-5]', () => {
    assert.deepEqual(listedIds(directory, '--all', '--sort', 'status'),
      ['FIX-2', 'FEAT-5', 'TEC-3', 'SPIKE-6', 'FEAT-10', 'FEAT-1', 'EPIC-7', 'REF-4', 'FIX-8'])
  })

  it('--sort type : FEAT, FIX, REF, TEC, SPIKE, EPIC, par numéro dans chaque groupe [FEAT-35 AC-5]', () => {
    assert.deepEqual(listedIds(directory, '--all', '--sort', 'type'),
      ['FEAT-1', 'FEAT-5', 'FEAT-10', 'FIX-2', 'FIX-8', 'REF-4', 'TEC-3', 'SPIKE-6', 'EPIC-7'])
  })

  it('--sort id est l’ordre par défaut, numérique [FEAT-35 AC-5]', () => {
    assert.deepEqual(listedIds(directory, '--all', '--sort', 'id'), listedIds(directory, '--all'))
    assert.deepEqual(listedIds(directory, '--all'), ['FEAT-1', 'FIX-2', 'TEC-3', 'REF-4', 'FEAT-5', 'SPIKE-6', 'EPIC-7', 'FIX-8', 'FEAT-10'])
  })
})

describe('atelier list: the step of an EPIC does not depend on the filters', () => {
  it('« 2 enfant(s) ouvert(s) » y compris avec --type EPIC, qui écarte les enfants [FEAT-35 AC-8]', () => {
    const directory = makeChantiersRepository({
      main: [
        { id: 'EPIC-40', files: epicPlan },
        { id: 'FEAT-41', relations: { rel_parent: 'EPIC-40' } },
        { id: 'FIX-43', status: 'draft', relations: { rel_parent: 'EPIC-40' } },
        { id: 'FEAT-42', status: 'done', relations: { rel_parent: 'EPIC-40' } },
      ],
    })
    const [epic] = listed(directory, '--type', 'EPIC')
    assert.equal(epic.id, 'EPIC-40')
    assert.equal(epic.step, 'epic-children')
    assert.equal(epic.stepLabel, '2 enfant(s) ouvert(s)')
  })

  it('« enfants clos : à clôturer » y compris sans --all, qui écarte les enfants clos [FEAT-35 AC-8]', () => {
    const directory = makeChantiersRepository({
      main: [
        { id: 'EPIC-40', files: epicPlan },
        { id: 'FEAT-41', status: 'done', relations: { rel_parent: 'EPIC-40' } },
        { id: 'FEAT-42', status: 'abandoned', relations: { rel_parent: 'EPIC-40' } },
      ],
    })
    const chantiers = listed(directory)
    assert.deepEqual(chantiers.map((chantier) => chantier.id), ['EPIC-40'])
    assert.equal(chantiers[0].step, 'epic-close')
    assert.equal(chantiers[0].stepLabel, 'enfants clos : à clôturer')
  })
})
