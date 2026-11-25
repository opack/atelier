import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { isRefreeze, refreezeTestsEntry, removedTestLines, reopenTestsEntry, reopenTestsRefusal, testDrivenPhase } from '../lib/tdd.mjs'
import { parseFrontMatter } from '../lib/common.mjs'
import { parseAmendments } from '../lib/spec.mjs'
import { signedChantier, implementingChantier, signedTec, decide, git, commit, atelier, atelierRun, specData, slicedChantier, makeSlicedRepository, commitFiles, headOf, commitSpec, setHeader, specFileText, atelierOk, atSliceTwo, implementedSlice } from './helpers.mjs'

describe('test-driven phases', () => {
  it('follows the human decision in the spec, whatever the type', () => {
    assert.equal(testDrivenPhase(signedChantier), 'writing-tests')
    assert.equal(testDrivenPhase(implementingChantier), 'implementing')
    assert.equal(testDrivenPhase(signedTec), 'none')
    const featWithoutTdd = { ...signedChantier, spec: { data: { status: 'signed', type: 'FEAT', tdd: 'no' } } }
    assert.equal(testDrivenPhase(featWithoutTdd), 'none')
    assert.equal(decide({ chantier: featWithoutTdd, relativePath: 'src/budget.ts' }).allowed, true)
    const tecWithTdd = { ...signedTec, spec: { data: { status: 'signed', type: 'TEC', tdd: 'yes' } } }
    assert.equal(testDrivenPhase(tecWithTdd), 'writing-tests')
  })

  it('forbids any implementation code while writing tests', () => {
    const decision = decide({ chantier: signedChantier, relativePath: 'src/budget.ts' })
    assert.equal(decision.allowed, false)
    assert.match(decision.reason, /aucune implémentation/)
  })

  it('allows test files while writing tests', () => {
    for (const relativePath of ['src/budget.test.ts', 'src/Budget.spec.js', 'tests/e2e/flow.ts', 'src/__tests__/a.ts']) {
      assert.equal(decide({ chantier: signedChantier, relativePath }).allowed, true, relativePath)
    }
  })

  it('freezes the tests while implementing', () => {
    const decision = decide({ chantier: implementingChantier, relativePath: 'src/budget.test.ts' })
    assert.equal(decision.allowed, false)
    assert.match(decision.reason, /figés/)
    assert.equal(decide({ chantier: implementingChantier, relativePath: 'src/budget.ts' }).allowed, true)
  })
})

describe('refreeze detection', () => {
  const entries = (...texts) => parseAmendments(`## Amendements\n${texts.map((text) => `- ${text}`).join('\n')}\n`).entries

  it('adds no entry on a first freeze', () => {
    assert.equal(isRefreeze(entries()), false)
    assert.equal(isRefreeze(entries('2026-11-01 : critère ajouté')), false)
  })

  it('recognizes a refreeze after a reopening, old format included', () => {
    assert.equal(isRefreeze(entries(reopenTestsEntry('2026-11-02', 'abc', 'oubli'))), true)
    assert.equal(isRefreeze(entries('2026-11-02 : tests rouverts : oubli')), true, 'pre-0.2.0 format')
    assert.equal(isRefreeze(entries(reopenTestsEntry('2026-11-02', 'abc', 'oubli'), refreezeTestsEntry('2026-11-03', 'def'))), false)
  })

  it('decides by position, not by date, for entries of the same day', () => {
    const reopen = reopenTestsEntry('2026-11-02', 'abc', 'x')
    const refreeze = refreezeTestsEntry('2026-11-02', 'def')
    assert.equal(isRefreeze(entries(reopen, refreeze)), false)
    assert.equal(isRefreeze(entries(reopen, refreeze, reopenTestsEntry('2026-11-02', 'def', 'y'))), true)
  })
})

describe('reopen tests', () => {
  it('refuses a chantier without TDD or whose tests are not frozen', () => {
    assert.match(reopenTestsRefusal(signedTec), /ne suit pas le TDD/)
    assert.match(reopenTestsRefusal(signedChantier), /pas figés/)
    assert.equal(reopenTestsRefusal(implementingChantier), null)
  })

  it('refuses a chantier that is no longer signed', () => {
    for (const status of ['draft', 'done', 'abandoned']) {
      const chantier = { ...implementingChantier, spec: { data: { ...implementingChantier.spec.data, status } } }
      assert.match(reopenTestsRefusal(chantier), /pas signée/, status)
    }
  })
})

function amendmentEntries(directory, id) {
  return parseAmendments(parseFrontMatter(specFileText(directory, id)).body).entries
}

describe('freezing the tests of a slice', () => {
  it('le premier gel écrit tests_commit et slice: 1, avec ou sans plan, SPIKE compris [FEAT-7 CA-6]', () => {
    for (const options of [{}, { plan: null }, { id: 'SPIKE-20' }]) {
      const id = options.id ?? 'FEAT-20'
      const directory = makeSlicedRepository(options)
      commitFiles(directory, { 'test/one.test.mjs': 'test\n' }, 'test: one')
      atelierOk(directory, 'freeze-tests')
      const data = specData(directory, id)
      assert.ok(data.tests_commit, JSON.stringify(options))
      assert.equal(data.slice, '1', JSON.stringify(options))
    }
  })

  for (const [label, change] of [
    ['ligne modifiée', { 'test/one.test.mjs': 'ligne a\nligne B\nligne c\n' }],
    ['fichier supprimé', { 'test/one.test.mjs': null }],
  ]) {
    it(`en tranche 2, refuse le gel quand une ligne de test antérieure a changé (${label}) [FEAT-7 CA-7]`, () => {
      const { directory } = atSliceTwo()
      commitFiles(directory, { ...change, 'test/two.test.mjs': 'test 2\n' }, 'test: two')
      const before = specFileText(directory, 'FEAT-20')
      const { status, output } = atelierRun(directory, 'freeze-tests')
      assert.notEqual(status, 0)
      assert.match(output, /test\/one\.test\.mjs/)
      assert.match(output, /\/atelier:amend/)
      assert.match(output, /\/atelier:write-tests/)
      assert.equal(specFileText(directory, 'FEAT-20'), before, 'rien n’est écrit')
    })
  }

  it('en tranche 2, un fichier de test renommé compte comme supprimé [FEAT-7 CA-7]', () => {
    const { directory } = atSliceTwo()
    git(directory, 'mv', 'test/one.test.mjs', 'test/renamed.test.mjs')
    commit(directory, 'test: rename')
    const before = specFileText(directory, 'FEAT-20')
    const { status, output } = atelierRun(directory, 'freeze-tests')
    assert.notEqual(status, 0)
    assert.match(output, /test\/one\.test\.mjs/)
    assert.equal(specFileText(directory, 'FEAT-20'), before)
  })

  it('extrait du diff les fichiers dont des lignes sont retirées [FEAT-7 CA-7]', () => {
    const diff = [
      'diff --git a/test/one.test.mjs b/test/one.test.mjs',
      'index 1..2 100644',
      '--- a/test/one.test.mjs',
      '+++ b/test/one.test.mjs',
      '@@ -1,3 +1,3 @@',
      ' ligne a',
      '-ligne b',
      '+ligne B',
      'diff --git a/test/gone.test.mjs b/test/gone.test.mjs',
      'deleted file mode 100644',
      '--- a/test/gone.test.mjs',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-tout',
      'diff --git a/test/added.test.mjs b/test/added.test.mjs',
      '--- a/test/added.test.mjs',
      '+++ b/test/added.test.mjs',
      '@@ -1 +1,2 @@',
      ' x',
      '+--- pas un en-tête',
      '',
    ].join('\n')
    assert.deepEqual(removedTestLines(diff).sort(), ['test/gone.test.mjs', 'test/one.test.mjs'])
    assert.deepEqual(removedTestLines(''), [])
  })

  it('en tranche 2, la réouverture trace le gel quitté (slice_base) ; le gel suivant accepte les modifications et trace le regel [FEAT-7 CA-8]', () => {
    const { directory, base } = atSliceTwo()
    atelierOk(directory, 'reopen-tests', 'test', 'faux')
    assert.match(amendmentEntries(directory, 'FEAT-20').at(-1), new RegExp(`tests rouverts \\(gel quitté : ${base.slice(0, 7)}[0-9a-f]*\\) : test faux`))
    commitSpec(directory)
    commitFiles(directory, { 'test/one.test.mjs': 'ligne a\nligne B\nligne c\n' }, 'test: fix one')
    atelierOk(directory, 'freeze-tests')
    assert.match(amendmentEntries(directory, 'FEAT-20').at(-1), /tests regelés/)
    assert.ok(specData(directory, 'FEAT-20').tests_commit)
  })

  it('une seconde réouverture avant le regel est refusée [FEAT-7 CA-8]', () => {
    const { directory } = atSliceTwo()
    atelierOk(directory, 'reopen-tests', 'première')
    commitSpec(directory)
    const { status, output } = atelierRun(directory, 'reopen-tests', 'seconde')
    assert.notEqual(status, 0)
    assert.match(output, /tests déjà rouverts/)
  })

  it('en phase « tests d’abord » de la tranche 1, la réouverture reste refusée ; en tranche 2 elle est possible [FEAT-7 CA-8]', () => {
    assert.match(reopenTestsRefusal(slicedChantier({ slice: '1' })), /pas figés/)
    assert.match(reopenTestsRefusal(slicedChantier()), /pas figés/)
    assert.equal(reopenTestsRefusal(slicedChantier({ slice: '2', slice_base: 'a'.repeat(40) })), null)
  })

  it('en tranche 2, des tests seulement ajoutés (lignes, fichiers ; espaces et fins de ligne changés) se figent sans raison [FEAT-7 CA-9]', () => {
    const { directory } = atSliceTwo()
    commitFiles(directory, {
      'test/one.test.mjs': 'ligne a\r\nligne b  \r\n  ligne    c\r\nligne d\r\n',
      'test/two.test.mjs': 'test 2\n',
    }, 'test: two')
    atelierOk(directory, 'freeze-tests')
    const data = specData(directory, 'FEAT-20')
    assert.ok(data.tests_commit)
    assert.equal(data.slice, '2')
    assert.deepEqual(amendmentEntries(directory, 'FEAT-20'), [], 'aucune entrée de gel')
  })

  it('en revue du chantier, la réouverture vide tests_commit, garde slice: chantier ; le gel suivant accepte les modifications [FEAT-7 CA-10]', () => {
    const { directory } = implementedSlice({ slice: 'chantier', extra: { last_slice: '3' } })
    atelierOk(directory, 'reopen-tests', 'CA', 'sans', 'test')
    let data = specData(directory, 'FEAT-20')
    assert.equal(data.tests_commit ?? '', '')
    assert.equal(data.slice, 'chantier')
    assert.match(amendmentEntries(directory, 'FEAT-20').at(-1), /tests rouverts/)
    commitSpec(directory)
    assert.equal(JSON.parse(atelierOk(directory, 'status', '--json')).chantier.testDrivenPhase, 'writing-tests')
    commitFiles(directory, { 'test/now.test.mjs': 'test modifié\n' }, 'test: cover CA')
    atelierOk(directory, 'freeze-tests')
    data = specData(directory, 'FEAT-20')
    assert.ok(data.tests_commit)
    assert.equal(data.slice, 'chantier')
  })

  it('refuse le gel et la revue quand slice_base n’est plus un ancêtre de HEAD [FEAT-7 CA-11]', () => {
    for (const command of ['freeze-tests', 'set-reviewed']) {
      const directory = makeSlicedRepository({ tdd: command === 'freeze-tests' ? 'yes' : 'no' })
      git(directory, 'switch', '-q', '-c', 'side')
      commit(directory, 'chore: side')
      const side = headOf(directory)
      git(directory, 'switch', '-q', '-')
      setHeader(directory, 'FEAT-20', { slice: '2', slice_base: side })
      commitFiles(directory, command === 'freeze-tests' ? { 'test/two.test.mjs': 'test\n' } : { 'src/two.mjs': 'code\n' }, 'work')
      const before = specFileText(directory, 'FEAT-20')
      const { status, output } = atelierRun(directory, command)
      assert.notEqual(status, 0, command)
      assert.match(output, /ancêtre/, command)
      assert.equal(specFileText(directory, 'FEAT-20'), before, `${command} : rien n’est écrit`)
    }
  })
})

describe('gel après un gros diff ou une fusion de la branche par défaut', () => {
  // FEAT-20 on feat/FEAT-20-x, in slice 2: `test/main.test.mjs` comes from the default branch,
  // merged before slice_base; `test/one.test.mjs` is a test of slice 1.
  function sliceTwoWithMainTest() {
    const directory = makeSlicedRepository()
    git(directory, 'switch', '-q', 'main')
    commitFiles(directory, { 'test/main.test.mjs': 'ligne a\nligne b\n' }, 'test: main')
    git(directory, 'switch', '-q', 'feat/FEAT-20-x')
    git(directory, 'merge', '-q', '--no-edit', 'main')
    commitFiles(directory, { 'test/one.test.mjs': 'ligne a\nligne b\n' }, 'test: one')
    commitFiles(directory, { 'src/one.mjs': 'export const one = 1\n' }, 'feat: one')
    setHeader(directory, 'FEAT-20', { slice: '2', slice_base: headOf(directory) })
    return directory
  }

  // The default branch changes a line of `test/main.test.mjs`, then is merged without conflict.
  function mergeMainChangingItsTest(directory) {
    git(directory, 'switch', '-q', 'main')
    commitFiles(directory, { 'test/main.test.mjs': 'ligne a\nligne B\n' }, 'test: main changed')
    git(directory, 'switch', '-q', 'feat/FEAT-20-x')
    git(directory, 'merge', '-q', '--no-edit', 'main')
  }

  it('fige les tests quand le diff depuis slice_base dépasse 1 Mo hors fichiers de test [FIX-31 CA-1]', () => {
    const { directory } = atSliceTwo()
    commitFiles(directory, { 'src/big.mjs': `// ${'x'.repeat(100)}\n`.repeat(20000) }, 'feat: big')
    commitFiles(directory, { 'test/two.test.mjs': 'test\n' }, 'test: two')
    const { status, output } = atelierRun(directory, 'freeze-tests')
    assert.equal(status, 0, output)
    assert.ok(specData(directory, 'FEAT-20').tests_commit)
  })

  it('ne refuse pas le gel pour un test modifié par la branche par défaut et apporté par une fusion [FIX-31 CA-2]', () => {
    const directory = sliceTwoWithMainTest()
    mergeMainChangingItsTest(directory)
    commitFiles(directory, { 'test/two.test.mjs': 'test\n' }, 'test: two')
    const { status, output } = atelierRun(directory, 'freeze-tests')
    assert.equal(status, 0, output)
    assert.ok(specData(directory, 'FEAT-20').tests_commit)
  })

  it('refuse le gel en ne citant que le test d’une tranche précédente modifié par le chantier, malgré une fusion [FIX-31 CA-3]', () => {
    const directory = sliceTwoWithMainTest()
    mergeMainChangingItsTest(directory)
    commitFiles(directory, { 'test/one.test.mjs': 'ligne a\nligne B\n', 'test/two.test.mjs': 'test\n' }, 'test: two')
    const { status, output } = atelierRun(directory, 'freeze-tests')
    assert.equal(status, 2, output)
    assert.match(output, /- test\/one\.test\.mjs/)
    assert.doesNotMatch(output, /main\.test\.mjs/)
    assert.equal(specData(directory, 'FEAT-20').tests_commit ?? '', '')
  })
})

describe('tests modifiés depuis le gel, après une fusion de la branche par défaut', () => {
  // FIX-20 (single slice, TDD) on fix/FIX-20-x: `test/main.test.mjs` comes from the default branch,
  // `test/fix.test.mjs` is the chantier's test; both frozen at `tests_commit`.
  function frozenFix() {
    const directory = makeSlicedRepository({ id: 'FIX-20', tdd: 'yes', plan: null })
    git(directory, 'switch', '-q', 'main')
    commitFiles(directory, { 'test/main.test.mjs': 'ligne a\nligne b\n' }, 'test: main')
    git(directory, 'switch', '-q', 'fix/FIX-20-x')
    git(directory, 'merge', '-q', '--no-edit', 'main')
    commitFiles(directory, { 'test/fix.test.mjs': 'ligne a\nligne b\n' }, 'test: fix')
    setHeader(directory, 'FIX-20', { tests_commit: git(directory, 'rev-parse', '--short', 'HEAD').trim(), slice: '1' })
    return directory
  }

  // The default branch changes `test/main.test.mjs` (and `files`), then is merged without conflict.
  function mergeMainChangingItsTest(directory, files = {}) {
    git(directory, 'switch', '-q', 'main')
    commitFiles(directory, { 'test/main.test.mjs': 'ligne a\nligne B\n', ...files }, 'test: main changed')
    git(directory, 'switch', '-q', 'fix/FIX-20-x')
    git(directory, 'merge', '-q', '--no-edit', 'main')
  }

  it('ne signale pas un test modifié par la branche par défaut et apporté par une fusion sans conflit [FIX-32 CA-1]', () => {
    const directory = frozenFix()
    mergeMainChangingItsTest(directory)
    const { status, output } = atelierRun(directory, 'tests-changed')
    assert.equal(status, 0, output)
    assert.doesNotMatch(output, /main\.test\.mjs/)
  })

  it('signale le seul test figé modifié par un commit du chantier, malgré la fusion [FIX-32 CA-2]', () => {
    const directory = frozenFix()
    mergeMainChangingItsTest(directory)
    commitFiles(directory, { 'test/fix.test.mjs': 'ligne a\nligne B\n' }, 'fix: change a frozen test')
    const { status, output } = atelierRun(directory, 'tests-changed')
    assert.equal(status, 2, output)
    assert.match(output, /- test\/fix\.test\.mjs/)
    assert.doesNotMatch(output, /main\.test\.mjs/)
  })

  it('set-reviewed ne refuse pas la revue pour un test venu de la branche par défaut [FIX-32 CA-3]', () => {
    const directory = frozenFix()
    commitFiles(directory, { 'src/fix.mjs': 'export const fix = 1\n' }, 'fix: fix')
    mergeMainChangingItsTest(directory)
    const { status, output } = atelierRun(directory, 'set-reviewed')
    assert.equal(status, 0, output)
    assert.ok(specData(directory, 'FIX-20').reviewed_commit)
  })

  it('signale un test figé modifié sans être commité [FIX-32 CA-4]', () => {
    const directory = frozenFix()
    writeFileSync(join(directory, 'test/fix.test.mjs'), 'ligne a\nligne B\n')
    const { status, output } = atelierRun(directory, 'tests-changed')
    assert.equal(status, 2, output)
    assert.match(output, /- test\/fix\.test\.mjs/)
  })

  it('ne signale pas un test figé modifié puis rétabli à l’identique par le chantier [FIX-32 CA-5]', () => {
    const directory = frozenFix()
    commitFiles(directory, { 'test/fix.test.mjs': 'ligne a\nligne B\n' }, 'fix: change a frozen test')
    commitFiles(directory, { 'test/fix.test.mjs': 'ligne a\nligne b\n' }, 'fix: restore it')
    const { status, output } = atelierRun(directory, 'tests-changed')
    assert.equal(status, 0, output)
  })

  // FIX-20's case: the chantier wrote its frozen test in `test/main.test.mjs`, a file shared with the
  // default branch, which then adds its own lines at the same place: the merge conflicts and is
  // resolved with `resolution`, then committed.
  function conflictOnSharedTest(resolution) {
    const directory = makeSlicedRepository({ id: 'FIX-20', tdd: 'yes', plan: null })
    git(directory, 'switch', '-q', 'main')
    commitFiles(directory, { 'test/main.test.mjs': 'ligne a\n' }, 'test: main')
    git(directory, 'switch', '-q', 'fix/FIX-20-x')
    git(directory, 'merge', '-q', '--no-edit', 'main')
    commitFiles(directory, { 'test/main.test.mjs': 'ligne a\nligne fix\n' }, 'test: fix')
    setHeader(directory, 'FIX-20', { tests_commit: git(directory, 'rev-parse', '--short', 'HEAD').trim(), slice: '1' })
    git(directory, 'switch', '-q', 'main')
    commitFiles(directory, { 'test/main.test.mjs': 'ligne a\nligne main\n' }, 'test: main changed')
    git(directory, 'switch', '-q', 'fix/FIX-20-x')
    let conflict = false
    try { git(directory, 'merge', '-q', '--no-edit', 'main') } catch { conflict = true }
    assert.ok(conflict, 'la fusion doit être en conflit')
    writeFileSync(join(directory, 'test/main.test.mjs'), resolution)
    git(directory, 'add', '-A')
    commit(directory, 'chore(merge): main')
    return directory
  }

  it('ne signale pas un test figé dont le conflit avec la branche par défaut est résolu en gardant les deux côtés [FIX-32 CA-6]', () => {
    const directory = conflictOnSharedTest('ligne a\nligne fix\nligne main\n')
    const { status, output } = atelierRun(directory, 'tests-changed')
    assert.equal(status, 0, output)
  })

  it('signale un test figé dont la résolution du conflit modifie une ligne figée [FIX-32 CA-8]', () => {
    const directory = conflictOnSharedTest('ligne a\nligne fix modifiée\nligne main\n')
    const { status, output } = atelierRun(directory, 'tests-changed')
    assert.equal(status, 2, output)
    assert.match(output, /- test\/main\.test\.mjs/)
  })
})
