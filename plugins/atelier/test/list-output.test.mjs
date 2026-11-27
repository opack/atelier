import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { describe, it } from 'node:test'
import { atelierOk, atelierRun, chantierDirectoryOf, commitFiles, epicPlan, listed, listedIds, makeChantiersRepository } from './helpers.mjs'

// `atelier list`: refused arguments, JSON output, empty list, directories without spec, and the
// type of a chantier (read in its header, the prefix of its identifier when the header has none).

describe('atelier list: refused arguments', () => {
  const directory = makeChantiersRepository({ main: [{ id: 'FEAT-1' }] })

  function assertRefused(cliArguments, patterns) {
    const result = atelierRun(directory, 'list', ...cliArguments)
    assert.notEqual(result.status, 0, `atelier list ${cliArguments.join(' ')} devrait échouer :\n${result.output}`)
    for (const pattern of patterns) {
      assert.match(result.output, pattern, `atelier list ${cliArguments.join(' ')}`)
    }
  }

  it('une option inconnue est nommée [FEAT-35 CA-6]', () => {
    assertRefused(['--bogus'], [/--bogus/])
  })

  it('une option répétée est nommée [FEAT-35 CA-6]', () => {
    assertRefused(['--type', 'FIX', '--type', 'TEC'], [/--type/])
    assertRefused(['--all', '--all'], [/--all/])
  })

  it('une option sans valeur est nommée [FEAT-35 CA-6]', () => {
    assertRefused(['--status'], [/--status/])
    assertRefused(['--parent'], [/--parent/])
    assertRefused(['--type', '--all'], [/--type/])
  })

  it('une valeur inconnue est nommée, avec les valeurs admises [FEAT-35 CA-6]', () => {
    assertRefused(['--status', 'signed,finished'], [/finished/, /draft/, /signed/, /done/, /abandoned/])
    assertRefused(['--type', 'BUG'], [/BUG/, /FEAT/, /FIX/, /REF/, /TEC/, /SPIKE/, /EPIC/])
    assertRefused(['--sort', 'date'], [/date/, /\bid\b/, /status/, /type/])
  })
})

describe('atelier list --json', () => {
  const directory = makeChantiersRepository({
    main: [
      { id: 'EPIC-17', files: epicPlan, relations: { title: 'Rendre le plugin lisible' } },
      { id: 'FEAT-20', tdd: 'yes', relations: { rel_parent: 'EPIC-17', title: 'Lister les chantiers' } },
      { id: 'FIX-21', tdd: 'yes', relations: { tests_commit: 'abc1234' } },
      { id: 'TEC-22', status: 'done' },
    ],
  })
  commitFiles(directory, { 'docs/chantiers/FEAT-23-x/spec.md': '---\nid: FEAT-23\ntype: FEAT\ntitle: Sans statut\ntdd: yes\n---\n\n# FEAT-23\n' })

  it('un tableau d’objets { id, type, title, status, step, stepLabel, location, path, parent } [FEAT-35 CA-13]', () => {
    const chantiers = listed(directory)
    const feat = chantiers.find((chantier) => chantier.id === 'FEAT-20')
    assert.deepEqual(Object.keys(feat).sort(), ['id', 'location', 'parent', 'path', 'status', 'step', 'stepLabel', 'title', 'type'])
    const { path: featPath, ...rest } = feat
    assert.deepEqual(rest, { id: 'FEAT-20', type: 'FEAT', title: 'Lister les chantiers', status: 'signed', step: 'plan', stepLabel: 'à planifier', location: null, parent: 'EPIC-17' })
    assert.equal(realpathSync(featPath), realpathSync(chantierDirectoryOf(directory, 'FEAT-20')))
    assert.ok(isAbsolute(featPath), `chemin absolu attendu : ${featPath}`)
    const fix = chantiers.find((chantier) => chantier.id === 'FIX-21')
    assert.equal(fix.parent, null)
    assert.equal(fix.step, 'build')
    assert.equal(fix.stepLabel, 'implémentation')
  })

  it('status vaut draft quand l’en-tête ne le dit pas [FEAT-35 CA-13]', () => {
    const feat = listed(directory).find((chantier) => chantier.id === 'FEAT-23')
    assert.equal(feat.status, 'draft')
    assert.equal(feat.step, 'draft')
    assert.equal(feat.stepLabel, 'brouillon')
  })

  it('la même sélection, dans le même ordre que l’affichage, avec les filtres [FEAT-35 CA-13]', () => {
    const cliArguments = ['--all', '--sort', 'type', '--type', 'FEAT,TEC,EPIC']
    const ids = listedIds(directory, ...cliArguments)
    assert.deepEqual(ids, ['FEAT-20', 'FEAT-23', 'TEC-22', 'EPIC-17'])
    const output = atelierOk(directory, 'list', ...cliArguments)
    const shown = output.split(/\r?\n/).map((line) => (line.match(/\b(FEAT|FIX|REF|TEC|SPIKE|EPIC)-\d+\b/) ?? [])[0]).filter(Boolean)
    assert.deepEqual(shown, ids)
  })
})

describe('atelier list: empty list', () => {
  it('filtres qui écartent tout : une ligne le dit, sans mentionner --all, succès ; --json rend [] [FEAT-35 CA-14]', () => {
    const directory = makeChantiersRepository({ main: [{ id: 'FEAT-1' }] })
    const output = atelierOk(directory, 'list', '--type', 'FIX')
    assert.match(output, /aucun chantier/i)
    assert.doesNotMatch(output, /--all/)
    assert.deepEqual(listed(directory, '--type', 'FIX'), [])
  })

  it('aucun chantier ouvert mais des chantiers clos : la ligne mentionne --all [FEAT-35 CA-14]', () => {
    const directory = makeChantiersRepository({ main: [{ id: 'FEAT-1', status: 'done' }, { id: 'FIX-2', status: 'abandoned' }] })
    const output = atelierOk(directory, 'list')
    assert.match(output, /aucun chantier/i)
    assert.match(output, /--all/)
    assert.deepEqual(listed(directory), [])
  })

  it('aucun chantier du tout : la ligne le dit, sans --all [FEAT-35 CA-14]', () => {
    const directory = makeChantiersRepository({})
    const output = atelierOk(directory, 'list')
    assert.match(output, /aucun chantier/i)
    assert.doesNotMatch(output, /--all/)
    assert.deepEqual(listed(directory), [])
  })
})

describe('atelier list: current tree only, directories without spec', () => {
  it('sans autre branche, les chantiers de l’arbre courant sont listés et le dossier sans spec.md est ignoré [FEAT-35 CA-15]', () => {
    const directory = makeChantiersRepository({ main: [{ id: 'FEAT-1' }, { id: 'FIX-3' }] })
    commitFiles(directory, { 'docs/chantiers/FEAT-2-y/notes.md': '# Notes\n' })
    assert.deepEqual(listedIds(directory), ['FEAT-1', 'FIX-3'])
    const output = atelierOk(directory, 'list')
    assert.doesNotMatch(output, /FEAT-2\b/)
  })

})

describe('type of a chantier: its header, the prefix of its identifier when the header has none', () => {
  const directory = makeChantiersRepository({
    main: [
      { id: 'FEAT-1', relations: { type: 'feat' } },
      { id: 'FEAT-2' },
    ],
  })
  commitFiles(directory, { 'docs/chantiers/EPIC-3-x/spec.md': '---\nid: EPIC-3\ntitle: Sans type\nstatus: signed\ntdd: no\n---\n\n# EPIC-3\n' })

  it('un type en minuscules dans l’en-tête est le même type, pour la colonne, le filtre et l’étape [FEAT-35 CA-7]', () => {
    const feat = listed(directory).find((chantier) => chantier.id === 'FEAT-1')
    assert.equal(feat.type, 'FEAT')
    assert.equal(feat.step, 'plan')
    assert.deepEqual(listedIds(directory, '--type', 'FEAT'), ['FEAT-1', 'FEAT-2'])
  })

  it('sans type dans l’en-tête, le préfixe de l’identifiant donne la colonne, le filtre et l’étape [FEAT-35 CA-7]', () => {
    const epic = listed(directory).find((chantier) => chantier.id === 'EPIC-3')
    assert.equal(epic.type, 'EPIC')
    assert.equal(epic.step, 'plan')
    assert.equal(epic.stepLabel, 'à planifier')
    assert.deepEqual(listedIds(directory, '--type', 'EPIC'), ['EPIC-3'])
  })
})
