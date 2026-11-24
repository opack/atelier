import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { closeProblems } from '../lib/close.mjs'
import { DEFAULT_CONFIG } from '../lib/common.mjs'
import { nextStep } from '../lib/next-step.mjs'
import { reviewCodeFiles } from '../lib/review.mjs'
import { sliceState } from '../lib/slices.mjs'
import { signedChantier, draftChantier, signedTec, git, commit, atelier, makeChantiersRepository, atelierRun, specData, assertLine, epicPlan, planOf, threeSlices, slicedChantier, makeSlicedRepository, commitFiles, headOf, setHeader, atelierOk, implementedSlice } from './helpers.mjs'

describe('close decision', () => {
  const reviewed = { reviewedCommit: 'a'.repeat(40), found: true, isAncestor: true, codeFilesSince: [], amendmentsChanged: false }
  const nominal = { chantier: signedTec, reviewFacts: reviewed, uncommittedCode: [], checksFailure: null }
  const spike = { ...signedTec, id: 'SPIKE-4', spec: { data: { status: 'signed', type: 'SPIKE', tdd: 'no' } } }
  const refused = (overrides, message, label = JSON.stringify(overrides)) => {
    const problems = closeProblems({ ...nominal, ...overrides })
    assert.ok(problems.length, label)
    assert.match(problems.join('\n'), message, label)
  }
  const since = (files) => ({ reviewFacts: { ...reviewed, codeFilesSince: reviewCodeFiles(files, DEFAULT_CONFIG) } })

  it('accepts a current review, with documentation committed after it', () => {
    assert.deepEqual(closeProblems(nominal), [])
    assert.deepEqual(closeProblems({ ...nominal, ...since(['docs/chantiers/TEC-3-x/bilan.md', 'README.md']) }), [])
  })

  it('refuses without review, or after code or tests committed since the review', () => {
    refused({ reviewFacts: { reviewedCommit: null } }, /Aucune revue/)
    refused(since(['src/a.ts']), /src\/a\.ts/)
    refused(since(['src/a.test.ts']), /a\.test\.ts/)
    refused(since(['src/merged.ts']), /merged\.ts/, 'conflict resolved in a merge: listed by git log --diff-merges=first-parent')
    refused(since(['src/old.ts', 'docs/old.ts']), /src\/old\.ts/, 'renamed to a free path: listed as delete plus add (--no-renames)')
    refused(since(['.claude/atelier.json']), /\.claude\/atelier\.json/)
  })

  it('refuses a stale review: rebase, lost commit, amendment', () => {
    refused({ reviewFacts: { ...reviewed, isAncestor: false } }, /ancêtre/)
    refused({ reviewFacts: { ...reviewed, found: false } }, /introuvable/)
    refused({ reviewFacts: { ...reviewed, amendmentsChanged: true } }, /amendée/)
  })

  it('refuses uncommitted code, red checks, tests not frozen, an unsigned spec', () => {
    refused({ uncommittedCode: ['src/a.ts'] }, /pas commité/)
    refused({ uncommittedError: 'fatal: not a git repository' }, /non commités \(fatal: not a git repository\)/)
    refused({ checksFailure: { check: { name: 'tests', command: 'npm test' } } }, /« tests » échoue/)
    refused({ chantier: signedChantier, reviewFacts: reviewed }, /pas figés/)
    refused({ chantier: draftChantier }, /pas signée/)
  })

  it('lets a SPIKE close without review, or after changes since its review, other checks still applied', () => {
    assert.deepEqual(closeProblems({ ...nominal, chantier: spike, reviewFacts: { reviewedCommit: null } }), [])
    assert.deepEqual(closeProblems({ ...nominal, chantier: spike, reviewFacts: { ...reviewed, isAncestor: false, codeFilesSince: ['src/a.ts'], amendmentsChanged: true } }), [])
    refused({ chantier: spike, reviewFacts: { reviewedCommit: null }, uncommittedCode: ['src/a.ts'] }, /pas commité/)
  })
})

describe('dependencies checked at close', () => {
  it('refuse la clôture tant qu’une dépendance n’est pas done dans l’arbre courant, en la nommant avec son statut [FEAT-4 CA-3]', () => {
    const directory = makeChantiersRepository({
      main: [{ id: 'TEC-8' }, { id: 'TEC-12', status: 'abandoned' }],
      branches: {
        'tec/TEC-9-y': [{ id: 'TEC-9', status: 'done' }],
        'spike/SPIKE-13-x': [{ id: 'SPIKE-13', relations: { rel_depends_on: 'TEC-8, TEC-12, TEC-9' } }],
      },
      checkout: 'spike/SPIKE-13-x',
    })
    const { status, output } = atelierRun(directory, 'set-status', 'done')
    assert.notEqual(status, 0)
    assertLine(output, [/TEC-8/, /signed/])
    assertLine(output, [/TEC-12/, /abandoned/])
    assertLine(output, [/TEC-9/, /fusionn/], 'clos seulement sur une branche non fusionnée : inviter à fusionner')
    assert.equal(specData(directory, 'SPIKE-13').status, 'signed')
  })

  it('laisse clore quand toutes les dépendances sont done dans l’arbre courant [FEAT-4 CA-4]', () => {
    const directory = makeChantiersRepository({
      main: [{ id: 'TEC-10', status: 'done' }],
      branches: { 'spike/SPIKE-13-x': [{ id: 'SPIKE-13', relations: { rel_depends_on: 'TEC-10' } }] },
      checkout: 'spike/SPIKE-13-x',
    })
    const { status, output } = atelierRun(directory, 'set-status', 'done')
    assert.equal(status, 0, output)
    assert.equal(specData(directory, 'SPIKE-13').status, 'done')
  })
})

describe('closing an EPIC', () => {
  const epicOn = (main, branches = {}) => makeChantiersRepository({
    main: [{ id: 'EPIC-5', files: epicPlan }, ...main],
    branches: { ...branches, 'epic/EPIC-5-x': [] },
    checkout: 'epic/EPIC-5-x',
  })

  it('refuse avec la liste des enfants ouverts, sans exiger de revue [FEAT-4 CA-9]', () => {
    const directory = epicOn(
      [{ id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } }, { id: 'TEC-18', relations: { rel_parent: 'EPIC-5' } }],
      { 'feat/FEAT-7-x': [{ id: 'FEAT-7', status: 'done', relations: { rel_parent: 'EPIC-5' } }] },
    )
    const { status, output } = atelierRun(directory, 'set-status', 'done')
    assert.notEqual(status, 0)
    assertLine(output, [/TEC-18/])
    assertLine(output, [/FEAT-7/, /feat\/FEAT-7-x/], 'l’enfant qui ne vit que sur sa branche est nommé avec sa branche')
    assert.doesNotMatch(output, /revue|\/atelier:review/i)
    assert.equal(specData(directory, 'EPIC-5').status, 'signed')
  })

  it('refuse sans enfant done (aucun enfant, ou tous abandonnés) [FEAT-4 CA-9]', () => {
    for (const main of [[], [{ id: 'FEAT-6', status: 'abandoned', relations: { rel_parent: 'EPIC-5' } }, { id: 'FEAT-17', status: 'abandoned', relations: { rel_parent: 'EPIC-5' } }]]) {
      const directory = epicOn(main)
      const { status, output } = atelierRun(directory, 'set-status', 'done')
      assert.notEqual(status, 0, `${main.length} enfant(s)`)
      assert.match(output, /enfant/, 'refusé faute d’enfant done')
      assert.equal(specData(directory, 'EPIC-5').status, 'signed', output)
    }
  })

  it('permet la clôture quand tous les enfants sont clos et au moins un est done, sans revue enregistrée [FEAT-4 CA-9]', () => {
    const directory = epicOn([
      { id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } },
      { id: 'FEAT-17', status: 'abandoned', relations: { rel_parent: 'EPIC-5' } },
    ])
    const { status, output } = atelierRun(directory, 'set-status', 'done')
    assert.equal(status, 0, output)
    assert.equal(specData(directory, 'EPIC-5').status, 'done')
  })

  it('un EPIC enfant ouvert bloque la clôture de son EPIC parent [FEAT-4 CA-9]', () => {
    const directory = makeChantiersRepository({
      main: [
        { id: 'EPIC-21', files: epicPlan },
        { id: 'EPIC-20', relations: { rel_parent: 'EPIC-21' } },
        { id: 'FEAT-22', status: 'done', relations: { rel_parent: 'EPIC-20' } },
      ],
      branches: { 'epic/EPIC-21-x': [] },
      checkout: 'epic/EPIC-21-x',
    })
    const { status, output } = atelierRun(directory, 'set-status', 'done')
    assert.notEqual(status, 0)
    assertLine(output, [/EPIC-20/])
  })

  it('l’abandon reste permis avec des enfants ouverts, qui sont listés [FEAT-4 CA-9]', () => {
    const directory = epicOn([{ id: 'TEC-18', relations: { rel_parent: 'EPIC-5' } }])
    const { status, output } = atelierRun(directory, 'set-status', 'abandoned')
    assert.equal(status, 0, output)
    assert.match(output, /TEC-18/)
    assert.equal(specData(directory, 'EPIC-5').status, 'abandoned')
  })
})

describe('close of a sliced chantier', () => {
  // Code committed, then the review recorded by hand at that commit (spec committed after it).
  function reviewedChantier({ plan = threeSlices, header = {}, tdd = 'no', id = 'FEAT-20' } = {}) {
    const directory = makeSlicedRepository({ plan, tdd, id })
    commitFiles(directory, { 'src/a.mjs': 'code\n' }, 'feat: a')
    setHeader(directory, id, { ...header, reviewed_commit: headOf(directory) })
    return directory
  }

  it('refuse la clôture tant qu’une tranche est en cours [FEAT-7 CA-21]', () => {
    for (const slice of ['2', '3']) {
      const { directory } = implementedSlice({ slice, tdd: 'no' })
      const { status, output } = atelierRun(directory, 'close-check')
      assert.notEqual(status, 0, slice)
      assert.match(output, new RegExp(`tranche ${slice}/3 en cours`, 'i'), slice)
    }
  })

  it('en revue du chantier sans reviewed_commit, demande la revue du chantier [FEAT-7 CA-21]', () => {
    const { directory } = implementedSlice({ slice: 'chantier', tdd: 'no', extra: { last_slice: '3' } })
    const { status, output } = atelierRun(directory, 'close-check')
    assert.notEqual(status, 0)
    assert.match(output, /revue du chantier/i)
  })

  it('refuse la clôture quand le plan compte une tranche après last_slice [FEAT-7 CA-22]', () => {
    const directory = reviewedChantier({ plan: planOf([1, 2, 3, 4]), header: { slice: 'chantier', last_slice: '3' } })
    const { status, output } = atelierRun(directory, 'close-check')
    assert.notEqual(status, 0)
    assert.match(output, /tranche 4 du plan non revue/i)
  })

  it('clôture possible avec la revue du chantier à jour, et pour un chantier de l’ancien modèle revu [FEAT-7 CA-23]', () => {
    const sliced = reviewedChantier({ header: { slice: 'chantier', last_slice: '3' } })
    const slicedResult = atelierRun(sliced, 'close-check')
    assert.equal(slicedResult.status, 0, slicedResult.output)
    const legacy = makeSlicedRepository({ tdd: 'yes' })
    commitFiles(legacy, { 'test/a.test.mjs': 'test\n' }, 'test: a')
    const testsCommit = git(legacy, 'rev-parse', '--short', 'HEAD').trim()
    commitFiles(legacy, { 'src/a.mjs': 'code\n' }, 'feat: a')
    setHeader(legacy, 'FEAT-20', { tests_commit: testsCommit, reviewed_commit: headOf(legacy) })
    const legacyResult = atelierRun(legacy, 'close-check')
    assert.equal(legacyResult.status, 0, legacyResult.output)
  })

  it('un SPIKE en TDD suit le cycle par tranche et sa clôture exige la revue du chantier [FEAT-7 CA-25]', () => {
    const spike = slicedChantier({ slice: '2', slice_base: 'a'.repeat(40) }, { type: 'SPIKE' })
    assert.equal(sliceState(spike).model, 'sliced')
    assert.match(nextStep(spike), /^Tranche 2\/3 : .*\/atelier:write-tests/)
    const directory = makeSlicedRepository({ id: 'SPIKE-20', tdd: 'yes', header: { slice: 'chantier', last_slice: '3', tests_commit: 'abc1234' } })
    const { status, output } = atelierRun(directory, 'close-check')
    assert.notEqual(status, 0)
    assert.match(output, /revue du chantier/i)
  })

  it('un SPIKE en TDD de l’ancien modèle se clôt sans revue exigée [FEAT-7 CA-25]', () => {
    const directory = makeSlicedRepository({ id: 'SPIKE-20', tdd: 'yes' })
    commitFiles(directory, { 'test/a.test.mjs': 'test\n' }, 'test: a')
    const testsCommit = git(directory, 'rev-parse', '--short', 'HEAD').trim()
    commitFiles(directory, { 'src/a.mjs': 'code\n' }, 'feat: a')
    setHeader(directory, 'SPIKE-20', { tests_commit: testsCommit })
    const { status, output } = atelierRun(directory, 'close-check')
    assert.equal(status, 0, output)
  })

  it('un SPIKE sans TDD reste hors tranches : pas de slice, pas de message de tranche, clôture sans revue [FEAT-7 CA-25]', () => {
    const spike = slicedChantier({}, { type: 'SPIKE', tdd: 'no' })
    assert.equal(sliceState(spike).model, 'none')
    assert.doesNotMatch(nextStep(spike), /tranche/i)
    const directory = makeSlicedRepository({ id: 'SPIKE-20', tdd: 'no' })
    commitFiles(directory, { 'src/a.mjs': 'code\n' }, 'feat: a')
    const summary = JSON.parse(atelierOk(directory, 'status', '--json'))
    assert.equal(summary.chantier.slice, null)
    assert.equal(summary.chantier.sliceCount, null)
    const closeResult = atelierRun(directory, 'close-check')
    assert.equal(closeResult.status, 0, closeResult.output)
    atelierOk(directory, 'set-reviewed')
    assert.equal(specData(directory, 'SPIKE-20').slice, undefined)
  })
})
