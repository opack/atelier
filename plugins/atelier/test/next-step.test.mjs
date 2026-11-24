import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nextStep } from '../lib/next-step.mjs'
import { signedChantier, draftChantier, implementingChantier, signedTec, atelier, makeChantiersRepository, assertLine, epicPlan, slicedChantier, makeSlicedRepository, atelierOk, atSliceTwo, planOf, commitFiles, setHeader, headOf, git } from './helpers.mjs'

describe('next step', () => {
  it('follows the process order', () => {
    assert.match(nextStep(null), /\/atelier:new/)
    assert.match(nextStep(draftChantier), /\/atelier:sign/)
    assert.match(nextStep(signedChantier), /\/atelier:plan/)
    assert.match(nextStep({ ...signedChantier, files: ['spec.md', 'plan.md'] }), /\/atelier:write-tests/)
    assert.match(nextStep({ ...implementingChantier, files: ['spec.md', 'plan.md'] }), /\/atelier:build.*\/atelier:review/)
    const signedFix = { ...signedChantier, spec: { data: { status: 'signed', type: 'FIX', tdd: 'yes' } } }
    assert.match(nextStep(signedFix), /\/atelier:write-tests/)
    assert.match(nextStep(signedTec), /\/atelier:build.*\/atelier:review/)
  })

  it('goes to close once the review is current, back to review when it is stale', () => {
    assert.match(nextStep(signedTec, 'current'), /\/atelier:close/)
    assert.doesNotMatch(nextStep(signedTec, 'current'), /\/atelier:review/)
    assert.match(nextStep(signedTec, 'stale'), /\/atelier:review/)
    assert.match(nextStep({ ...signedChantier, files: ['spec.md', 'plan.md'] }, 'current'), /\/atelier:write-tests/, 'tests reopened after the review')
  })

  it('takes a SPIKE from build to close, without review', () => {
    const spike = { ...signedTec, id: 'SPIKE-4', spec: { data: { status: 'signed', type: 'SPIKE', tdd: 'no' } } }
    for (const review of ['none', 'stale', 'current']) {
      assert.match(nextStep(spike, review), /\/atelier:build.*\/atelier:close/, review)
      assert.doesNotMatch(nextStep(spike, review), /\/atelier:review/, review)
    }
  })
})

describe('next step of an EPIC', () => {
  const nextStepOf = (directory) => JSON.parse(atelier(directory, 'status', '--json')).nextStep

  it('concevoir le découpage sans plan, puis les enfants ouverts et leur nombre, puis la clôture ; jamais la revue [FEAT-4 CA-10]', () => {
    const withoutPlan = makeChantiersRepository({ branches: { 'epic/EPIC-5-x': [{ id: 'EPIC-5' }] }, checkout: 'epic/EPIC-5-x' })
    const open = makeChantiersRepository({
      main: [{ id: 'EPIC-5', files: epicPlan }, { id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } }],
      branches: { 'feat/FEAT-7-x': [{ id: 'FEAT-7', relations: { rel_parent: 'EPIC-5' } }], 'epic/EPIC-5-x': [] },
      checkout: 'epic/EPIC-5-x',
    })
    const closed = makeChantiersRepository({
      main: [{ id: 'EPIC-5', files: epicPlan }, { id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } }],
      branches: { 'epic/EPIC-5-x': [] },
      checkout: 'epic/EPIC-5-x',
    })
    const steps = { withoutPlan: nextStepOf(withoutPlan), open: nextStepOf(open), closed: nextStepOf(closed) }
    assert.match(steps.withoutPlan, /\/atelier:plan/)
    assert.match(steps.open, /\b1\b/)
    assert.match(steps.open, /FEAT-7/)
    assert.doesNotMatch(steps.open, /FEAT-6/)
    assert.match(steps.closed, /\/atelier:close/)
    for (const [name, step] of Object.entries(steps)) {
      assert.doesNotMatch(step, /\/atelier:review/, name)
    }
  })

  it('tous les enfants clos sans aucun done : propose l’abandon, pas la clôture [FEAT-4 CA-10]', () => {
    const directory = makeChantiersRepository({
      main: [
        { id: 'EPIC-5', files: epicPlan },
        { id: 'FEAT-6', status: 'abandoned', relations: { rel_parent: 'EPIC-5' } },
        { id: 'FEAT-17', status: 'abandoned', relations: { rel_parent: 'EPIC-5' } },
      ],
      branches: { 'epic/EPIC-5-x': [] },
      checkout: 'epic/EPIC-5-x',
    })
    const step = nextStepOf(directory)
    assert.match(step, /set-status abandoned/)
    assert.doesNotMatch(step, /\/atelier:close/)
    assert.doesNotMatch(step, /\/atelier:review/)
  })
})

describe('relations shown by status', () => {
  it('affiche parent, dépendances avec leur statut, origine, remplacement [FEAT-4 CA-11]', () => {
    const directory = makeChantiersRepository({
      main: [{ id: 'EPIC-5' }, { id: 'TEC-8' }, { id: 'TEC-10', status: 'done' }, { id: 'FEAT-3', status: 'abandoned' }],
      branches: {
        'feat/FEAT-11-x': [{
          id: 'FEAT-11',
          relations: { rel_parent: 'EPIC-5', rel_depends_on: 'TEC-8, TEC-10', rel_origin: 'BUG-421', rel_replaces: 'FEAT-3' },
        }],
      },
      checkout: 'feat/FEAT-11-x',
    })
    const text = atelier(directory, 'status')
    assertLine(text, [/^Parent :/, /EPIC-5/])
    assertLine(text, [/^Dépendances :/, /TEC-8[^,]*signed/, /TEC-10[^,]*done/])
    assertLine(text, [/^Origine :/, /BUG-421/])
    assertLine(text, [/^Remplace :/, /FEAT-3/])
    const relations = JSON.parse(atelier(directory, 'status', '--json')).chantier.relations
    assert.deepEqual(relations.dependsOn.map(({ id, status, closed }) => ({ id, status, closed })), [
      { id: 'TEC-8', status: 'signed', closed: false },
      { id: 'TEC-10', status: 'done', closed: true },
    ])
  })

  it('pour un EPIC, affiche ses enfants directs calculés avec leur statut [FEAT-4 CA-11]', () => {
    const directory = makeChantiersRepository({
      main: [
        { id: 'EPIC-5', files: epicPlan },
        { id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } },
        { id: 'EPIC-20', relations: { rel_parent: 'EPIC-5' } },
        { id: 'FEAT-22', relations: { rel_parent: 'EPIC-20' } },
      ],
      branches: { 'feat/FEAT-7-x': [{ id: 'FEAT-7', relations: { rel_parent: 'EPIC-5' } }], 'epic/EPIC-5-x': [] },
      checkout: 'epic/EPIC-5-x',
    })
    const text = atelier(directory, 'status')
    assertLine(text, [/^Enfants :/, /FEAT-6[^,]*done/, /EPIC-20[^,]*signed/, /FEAT-7/])
    assert.doesNotMatch(text, /FEAT-22/, 'enfants directs seulement')
  })

  it('le hook de démarrage affiche les enfants d’un EPIC et sa prochaine étape [FEAT-4 CA-10, CA-11]', () => {
    const directory = makeChantiersRepository({
      main: [{ id: 'EPIC-5', files: epicPlan }, { id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } }],
      branches: { 'feat/FEAT-7-x': [{ id: 'FEAT-7', relations: { rel_parent: 'EPIC-5' } }], 'epic/EPIC-5-x': [] },
      checkout: 'epic/EPIC-5-x',
    })
    const reminder = atelier(directory, 'hook-session-start')
    assertLine(reminder, [/^Enfants :/, /FEAT-6[^,]*done/, /FEAT-7/])
    assertLine(reminder, [/^Prochaine étape :/, /\b1\b/, /FEAT-7/])
    assert.doesNotMatch(reminder, /\/atelier:review/)
  })

  it('compatibilité : un chantier sans rel_* s’affiche comme avant', () => {
    const directory = makeChantiersRepository({ branches: { 'tec/TEC-8-x': [{ id: 'TEC-8' }] }, checkout: 'tec/TEC-8-x' })
    assert.doesNotMatch(atelier(directory, 'status'), /^(Parent|Dépendances|Origine|Remplace|Enfants) :/m)
  })
})

describe('next step of a sliced chantier', () => {
  it('la prochaine étape préfixe le message de la phase par « Tranche N/3 : » [FEAT-7 CA-24]', () => {
    assert.match(nextStep(slicedChantier()), /^Tranche 1\/3 : .*\/atelier:write-tests/)
    assert.match(nextStep(slicedChantier({ slice: '2', slice_base: 'a'.repeat(40) })), /^Tranche 2\/3 : .*\/atelier:write-tests/)
    assert.match(nextStep(slicedChantier({ slice: '2', slice_base: 'a'.repeat(40), tests_commit: 'abc1234' })), /^Tranche 2\/3 : .*\/atelier:build.*\/atelier:review/)
  })

  it('en revue du chantier, demande la revue de l’ensemble, puis la clôture [FEAT-7 CA-24]', () => {
    const chantier = slicedChantier({ slice: 'chantier', last_slice: '3', slice_base: 'a'.repeat(40), tests_commit: 'abc1234' })
    assert.match(nextStep(chantier, 'none'), /^Revue du chantier : faire relire l.ensemble : \/atelier:review/)
    assert.match(nextStep(chantier, 'current'), /\/atelier:close/)
  })

  it('le rappel de début de session indique la tranche, et n’en parle pas pour une tranche unique [FEAT-7 CA-26]', () => {
    const { directory } = atSliceTwo()
    assert.match(atelierOk(directory, 'hook-session-start'), /Tranche 2\/3/)
    assert.doesNotMatch(atelierOk(makeSlicedRepository({ plan: null }), 'hook-session-start'), /tranche/i)
  })
})

describe('next step once the implementation is committed', () => {
  const twoSlices = planOf([1, 2])
  const base = 'a'.repeat(40)
  // Typographic and straight apostrophes are the same text for the user.
  const plain = (text) => text.replaceAll('’', "'")
  const sameText = (actual, expected, label) => assert.equal(plain(actual), plain(expected), label)
  const toReview = 'Implémentation commitée : faire relire : /atelier:review (ou reprendre /atelier:build si elle n\'est pas finie)'
  const toClose = 'Implémentation commitée : clôturer : /atelier:close (ou reprendre /atelier:build si elle n\'est pas finie)'
  const buildWithoutTdd = 'Implémenter (sans TDD pour ce chantier), puis commiter : /atelier:build ; ensuite faire relire : /atelier:review'
  const buildWithTdd = 'Implémenter jusqu\'à ce que tous les tests passent, sans modifier les tests, puis commiter : /atelier:build ; ensuite faire relire : /atelier:review'
  const slicedWithoutTdd = slicedChantier({ slice: '2', slice_base: base }, { plan: twoSlices, type: 'REF', tdd: 'no' })
  const slicedImplementing = slicedChantier({ slice: '2', slice_base: base, tests_commit: 'abc1234' }, { plan: twoSlices })
  const fix = (data) => ({ id: 'FIX-9', directory: '/p/docs/chantiers/FIX-9-x', spec: { data: { status: 'signed', type: 'FIX', ...data }, body: '# x\n' }, files: ['spec.md'] })
  const singleImplementing = fix({ tdd: 'yes', tests_commit: 'abc1234', slice: '1' })
  const singleWithoutTdd = fix({ tdd: 'no' })
  const legacyImplementing = fix({ tdd: 'yes', tests_commit: 'abc1234' })
  const spike = { ...signedTec, id: 'SPIKE-4', spec: { data: { status: 'signed', type: 'SPIKE', tdd: 'no' } } }

  it('tranche en cours sans TDD, code commité : faire relire [FIX-26 CA-1]', () => {
    sameText(nextStep(slicedWithoutTdd, 'none', [], true), `Tranche 2/2 : ${toReview}`)
  })

  it('tranche en cours sans TDD, sans code commité ou signal absent : texte actuel [FIX-26 CA-2]', () => {
    for (const codeCommitted of [false, null, undefined]) {
      sameText(nextStep(slicedWithoutTdd, 'none', [], codeCommitted), `Tranche 2/2 : ${buildWithoutTdd}`, String(codeCommitted))
    }
  })

  it('TDD en phase implementing : faire relire si du code est commité, sinon implémenter [FIX-26 CA-3]', () => {
    sameText(nextStep(slicedImplementing, 'none', [], true), `Tranche 2/2 : ${toReview}`)
    sameText(nextStep(singleImplementing, 'none', [], true), toReview)
    sameText(nextStep(slicedImplementing, 'none', [], false), `Tranche 2/2 : ${buildWithTdd}`)
    sameText(nextStep(singleImplementing, 'none', [], false), buildWithTdd)
  })

  it('chantier single et legacy, code commité : faire relire, sans préfixe de tranche [FIX-26 CA-4]', () => {
    sameText(nextStep(singleWithoutTdd, 'none', [], true), toReview, 'single')
    sameText(nextStep(legacyImplementing, 'none', [], true), toReview, 'legacy')
  })

  it('SPIKE sans TDD, code commité : clôturer [FIX-26 CA-5]', () => {
    sameText(nextStep(spike, 'none', [], true), toClose)
  })

  it('le signal ne change rien en écriture des tests, avec une revue, ni en revue du chantier [FIX-26 CA-6]', () => {
    const cases = [
      ['writing-tests', slicedChantier({ slice: '2', slice_base: base }, { plan: twoSlices }), 'none'],
      ['writing-tests single', fix({ tdd: 'yes' }), 'none'],
      ['revue current', singleWithoutTdd, 'current'],
      ['revue stale', singleWithoutTdd, 'stale'],
      ['revue current sliced', slicedWithoutTdd, 'current'],
      ['revue stale sliced', slicedWithoutTdd, 'stale'],
      ['tranche chantier', slicedChantier({ slice: 'chantier', last_slice: '2', slice_base: base }, { plan: twoSlices, type: 'REF', tdd: 'no' }), 'none'],
      ['tranche chantier revue current', slicedChantier({ slice: 'chantier', last_slice: '2', slice_base: base }, { plan: twoSlices, type: 'REF', tdd: 'no' }), 'current'],
    ]
    for (const [label, chantier, review] of cases) {
      assert.equal(nextStep(chantier, review, [], true), nextStep(chantier, review, [], false), label)
    }
  })
})

describe('status and session start once the implementation is committed', () => {
  const status = (directory) => JSON.parse(atelierOk(directory, 'status', '--json'))
  const plain = (text) => text.replaceAll('’', "'")
  const reviewPattern = /Implémentation commitée : faire relire : \/atelier:review/

  // REF-20 without TDD, slice 2/2 started after slice 1's code, only the spec committed since.
  function refAtSliceTwo() {
    const directory = makeSlicedRepository({ id: 'REF-20', tdd: 'no', plan: planOf([1, 2]) })
    commitFiles(directory, { 'src/one.mjs': 'export const one = 1\n' }, 'refactor: one')
    setHeader(directory, 'REF-20', { slice: '2', slice_base: headOf(directory) })
    return directory
  }

  it('status : codeCommitted false tant que seul le dossier du chantier change, puis true après un commit de code [FIX-26 CA-7]', () => {
    const directory = refAtSliceTwo()
    commitFiles(directory, { 'docs/chantiers/REF-20-x/notes.md': 'notes\n' }, 'docs: notes')
    const before = status(directory)
    assert.equal(before.chantier.codeCommitted, false)
    assert.match(before.nextStep, /^Tranche 2\/2 : Implémenter/)
    commitFiles(directory, { 'src/two.mjs': 'export const two = 2\n' }, 'refactor: two')
    const after = status(directory)
    assert.equal(after.chantier.codeCommitted, true)
    assert.match(plain(after.nextStep), /^Tranche 2\/2 : Implémentation commitée : faire relire : \/atelier:review \(ou reprendre \/atelier:build si elle n'est pas finie\)$/)
  })

  it('le hook de début de session affiche la revue comme prochaine étape [FIX-26 CA-8]', () => {
    const directory = refAtSliceTwo()
    commitFiles(directory, { 'src/two.mjs': 'export const two = 2\n' }, 'refactor: two')
    assertLine(atelierOk(directory, 'hook-session-start'), [/^Prochaine étape :/, reviewPattern])
  })

  it('TDD : le commit des tests et le code commité avant le gel ne comptent pas [FIX-26 CA-9]', () => {
    const frozen = (directory) => {
      commitFiles(directory, { 'test/fix.test.mjs': 'test\n' }, 'test: fix')
      setHeader(directory, 'FIX-20', { tests_commit: git(directory, 'rev-parse', '--short', 'HEAD').trim(), slice: '1' })
    }
    const onlyTests = makeSlicedRepository({ id: 'FIX-20', tdd: 'yes', plan: null })
    frozen(onlyTests)
    assert.equal(status(onlyTests).chantier.codeCommitted, false, 'seul le commit des tests')

    const codeBeforeFreeze = makeSlicedRepository({ id: 'FIX-20', tdd: 'yes', plan: null })
    commitFiles(codeBeforeFreeze, { 'src/early.mjs': 'export const early = 1\n' }, 'fix: early')
    frozen(codeBeforeFreeze)
    assert.equal(status(codeBeforeFreeze).chantier.codeCommitted, false, 'code commité avant le gel')

    commitFiles(codeBeforeFreeze, { 'src/fix.mjs': 'export const fix = 1\n' }, 'fix: fix')
    const after = status(codeBeforeFreeze)
    assert.equal(after.chantier.codeCommitted, true, 'code commité après le gel')
    assert.match(after.nextStep, reviewPattern)
  })

  it('début de tranche introuvable ou hors de l’historique : null, texte actuel, sans échec [FIX-26 CA-10]', () => {
    const missing = refAtSliceTwo()
    commitFiles(missing, { 'src/two.mjs': 'export const two = 2\n' }, 'refactor: two')
    setHeader(missing, 'REF-20', { slice_base: 'f'.repeat(40) })

    const notAncestor = refAtSliceTwo()
    commitFiles(notAncestor, { 'src/two.mjs': 'export const two = 2\n' }, 'refactor: two')
    git(notAncestor, 'switch', '-q', '-c', 'other')
    commitFiles(notAncestor, { 'src/other.mjs': 'export const other = 1\n' }, 'chore: other')
    const outside = headOf(notAncestor)
    git(notAncestor, 'switch', '-q', 'ref/REF-20-x')
    setHeader(notAncestor, 'REF-20', { slice_base: outside })

    for (const [label, directory] of [['introuvable', missing], ['hors historique', notAncestor]]) {
      const summary = status(directory)
      assert.equal(summary.chantier.codeCommitted, null, label)
      assert.match(summary.nextStep, /^Tranche 2\/2 : Implémenter/, label)
      assertLine(atelierOk(directory, 'hook-session-start'), [/^Prochaine étape :/, /Implémenter/], label)
    }
  })

  it('sans TDD ni slice_base, le code est compté depuis la base de fusion avec la branche par défaut [FIX-26 CA-4]', () => {
    const directory = makeSlicedRepository({ id: 'FIX-20', tdd: 'no', plan: null })
    const before = status(directory)
    assert.equal(before.chantier.codeCommitted, false, 'seule la spec depuis la base de fusion')
    assert.match(before.nextStep, /^Implémenter/)
    commitFiles(directory, { 'src/fix.mjs': 'export const fix = 1\n' }, 'fix: fix')
    const after = status(directory)
    assert.equal(after.chantier.codeCommitted, true)
    assert.match(plain(after.nextStep), /^Implémentation commitée : faire relire : \/atelier:review \(ou reprendre \/atelier:build si elle n'est pas finie\)$/)
    assertLine(atelierOk(directory, 'hook-session-start'), [/^Prochaine étape :/, reviewPattern])
  })

  it('SPIKE sans TDD, code commité : status propose la clôture [FIX-26 CA-5]', () => {
    const directory = makeSlicedRepository({ id: 'SPIKE-20', tdd: 'no', plan: null })
    commitFiles(directory, { 'src/spike.mjs': 'export const spike = 1\n' }, 'chore: spike')
    const summary = status(directory)
    assert.equal(summary.chantier.codeCommitted, true)
    assert.match(summary.nextStep, /^Implémentation commitée : clôturer : \/atelier:close/)
  })

  it('revue obsolète : codeCommitted vaut null [FIX-26 CA-11]', () => {
    const directory = makeSlicedRepository({ id: 'FIX-20', tdd: 'no', plan: null })
    commitFiles(directory, { 'src/fix.mjs': 'export const fix = 1\n' }, 'fix: fix')
    setHeader(directory, 'FIX-20', { reviewed_commit: headOf(directory), slice: '1' })
    commitFiles(directory, { 'src/more.mjs': 'export const more = 1\n' }, 'fix: more')
    const summary = status(directory)
    assert.equal(summary.chantier.reviewState, 'stale', 'précondition')
    assert.equal(summary.chantier.codeCommitted, null)
  })

  it('revue à jour ou tests pas encore figés : codeCommitted vaut null [FIX-26 CA-11]', () => {
    const reviewed = makeSlicedRepository({ id: 'FIX-20', tdd: 'no', plan: null })
    commitFiles(reviewed, { 'src/fix.mjs': 'export const fix = 1\n' }, 'fix: fix')
    setHeader(reviewed, 'FIX-20', { reviewed_commit: headOf(reviewed), slice: '1' })
    const reviewedSummary = status(reviewed)
    assert.equal(reviewedSummary.chantier.reviewState, 'current', 'précondition')
    assert.equal(reviewedSummary.chantier.codeCommitted, null, 'revue à jour')

    const writingTests = makeSlicedRepository({ id: 'FIX-20', tdd: 'yes', plan: null })
    commitFiles(writingTests, { 'src/fix.mjs': 'export const fix = 1\n' }, 'fix: fix')
    const writingSummary = status(writingTests)
    assert.equal(writingSummary.chantier.testDrivenPhase, 'writing-tests', 'précondition')
    assert.equal(writingSummary.chantier.codeCommitted, null, 'tests pas encore figés')
  })
})
