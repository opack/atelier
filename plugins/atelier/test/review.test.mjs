import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { reviewCodeFiles, reviewProblems, reviewState, setReviewedRefusal } from '../lib/review.mjs'
import { DEFAULT_CONFIG } from '../lib/common.mjs'
import { amendmentsDiffer } from '../lib/spec.mjs'
import { signedChantier, draftChantier, implementingChantier, signedTec, git, atelier, atelierRun, specData, planOf, threeSlices, makeSlicedRepository, commitFiles, headOf, commitSpec, setHeader, specFileText, atelierOk, atSliceTwo, implementedSlice } from './helpers.mjs'

describe('review state', () => {
  const current = { reviewedCommit: 'a'.repeat(40), found: true, isAncestor: true, codeFilesSince: [], amendmentsChanged: false }

  it('is none without a reviewed commit, current when nothing changed since', () => {
    assert.equal(reviewState({ reviewedCommit: null }), 'none')
    assert.equal(reviewState(current), 'current')
    assert.deepEqual(reviewProblems(current), [])
  })

  it('is stale after code, a rebase, a lost commit, an amendment or a git error', () => {
    const cases = {
      code: [{ codeFilesSince: ['src/a.ts'] }, /src\/a\.ts/],
      'not an ancestor': [{ isAncestor: false }, /ancêtre/],
      'commit not found': [{ found: false, isAncestor: undefined }, /introuvable/],
      amendment: [{ amendmentsChanged: true }, /amendée/],
      'git error': [{ gitError: 'fatal: bad object' }, /bad object/],
    }
    for (const [name, [overrides, message]] of Object.entries(cases)) {
      const facts = { ...current, ...overrides }
      assert.equal(reviewState(facts), 'stale', name)
      assert.match(reviewProblems(facts).join('\n'), message, name)
    }
  })

  it('counts tests and .claude as code, but not documentation, chantier documents or atelier state', () => {
    const files = ['src/a.ts', 'src/a.test.ts', '.claude/atelier.json', '.claude/settings.json', 'docs/notes.md', 'README.md', 'docs/chantiers/TEC-3-x/spec.md', '.atelier/gate.json']
    assert.deepEqual(reviewCodeFiles(files, DEFAULT_CONFIG), ['src/a.ts', 'src/a.test.ts', '.claude/atelier.json', '.claude/settings.json'])
    assert.deepEqual(reviewCodeFiles(['.CLAUDE/atelier.json', 'DOCS/x.md'], { ...DEFAULT_CONFIG, ignoreCase: true }), ['.CLAUDE/atelier.json'])
  })

  it('keeps .claude as code even when a free path pattern covers it', () => {
    const config = { ...DEFAULT_CONFIG, freePaths: [...DEFAULT_CONFIG.freePaths, '**/*.json', '**/*.md'] }
    assert.deepEqual(reviewCodeFiles(['.claude/settings.json', '.claude/agents/x.md', 'package.json', 'src/a.ts'], config), ['.claude/settings.json', '.claude/agents/x.md', 'src/a.ts'])
  })

  it('tells an amendment since the review from an unchanged list of entries', () => {
    const spec = '---\nid: TEC-3\n---\n# T\n\n## Amendements\n<!-- x -->\n- 2026-11-01 : a\n'
    assert.equal(amendmentsDiffer(spec, spec.replace(/\n/g, '\r\n').replace('# T', '# T modifié')), false)
    assert.equal(amendmentsDiffer(spec, `${spec}- 2026-11-20 : b\n`), true)
  })

  it('records a review only on a signed, committed chantier with frozen, unchanged tests', () => {
    const clean = { chantier: signedTec, uncommittedCode: [], specUncommitted: false, changedTests: [] }
    assert.equal(setReviewedRefusal(clean), null)
    assert.equal(setReviewedRefusal({ ...clean, chantier: implementingChantier }), null)
    assert.match(setReviewedRefusal({ ...clean, chantier: draftChantier }), /pas signée/)
    assert.match(setReviewedRefusal({ ...clean, uncommittedCode: ['src/a.ts'] }), /src\/a\.ts/)
    assert.match(setReviewedRefusal({ ...clean, specUncommitted: true }), /spec/)
    assert.match(setReviewedRefusal({ ...clean, chantier: signedChantier }), /pas figés/)
    assert.match(setReviewedRefusal({ ...clean, chantier: implementingChantier, changedTests: ['src/a.test.ts'] }), /a\.test\.ts/)
  })
})

describe('review and next slice', () => {
  it('la revue validée de la tranche 2 sur 3 passe à la tranche 3 [FEAT-7 CA-14]', () => {
    const { directory } = implementedSlice({ slice: 2 })
    const head = headOf(directory)
    const output = atelierOk(directory, 'set-reviewed')
    const data = specData(directory, 'FEAT-20')
    assert.equal(data.slice, '3')
    assert.equal(data.slice_base, head)
    assert.equal(data.tests_commit ?? '', '')
    assert.ok(!data.reviewed_commit)
    assert.match(output, /[Tt]ranche 3/)
    assert.match(output, /\/atelier:write-tests/)
  })

  for (const [label, plan] of [['tranche 3 sur 3', threeSlices], ['tranche 3 retirée d’un plan à 2', planOf([1, 2])]]) {
    it(`la revue validée de la dernière tranche passe à la revue du chantier (${label}) [FEAT-7 CA-15]`, () => {
      const { directory, testsCommit } = implementedSlice({ slice: 3, plan })
      const head = headOf(directory)
      const output = atelierOk(directory, 'set-reviewed')
      const data = specData(directory, 'FEAT-20')
      assert.equal(data.slice, 'chantier')
      assert.equal(data.last_slice, '3')
      assert.equal(data.slice_base, head)
      assert.equal(data.tests_commit, testsCommit)
      assert.ok(!data.reviewed_commit)
      assert.match(output, /revue du chantier/i)
      assert.match(output, /\/atelier:review/)
    })
  }

  it('status signale une tranche en cours absente du plan [FEAT-7 CA-15]', () => {
    const { directory } = implementedSlice({ slice: 3, plan: planOf([1, 2]) })
    assert.match(atelierOk(directory, 'status'), /tranche 3 absente du plan/i)
  })

  it('en revue du chantier, set-reviewed écrit reviewed_commit sans toucher à slice [FEAT-7 CA-16]', () => {
    const { directory } = implementedSlice({ slice: 'chantier', extra: { last_slice: '3' } })
    const head = headOf(directory)
    atelierOk(directory, 'set-reviewed')
    const data = specData(directory, 'FEAT-20')
    assert.equal(data.reviewed_commit, head)
    assert.equal(data.slice, 'chantier')
  })

  it('un chantier à tranche unique enregistre reviewed_commit comme aujourd’hui [FEAT-7 CA-16]', () => {
    for (const plan of [null, planOf([1])]) {
      const directory = makeSlicedRepository({ tdd: 'no', plan })
      commitFiles(directory, { 'src/a.mjs': 'code\n' }, 'feat: a')
      const head = headOf(directory)
      atelierOk(directory, 'set-reviewed')
      assert.equal(specData(directory, 'FEAT-20').reviewed_commit, head, String(plan))
    }
  })

  it('sans TDD, la revue de la tranche 1 sur 2 passe à la tranche 2 ; prochaine étape /atelier:build [FEAT-7 CA-18]', () => {
    const directory = makeSlicedRepository({ tdd: 'no', plan: planOf([1, 2]) })
    commitFiles(directory, { 'src/a.mjs': 'code\n' }, 'feat: a')
    const head = headOf(directory)
    atelierOk(directory, 'set-reviewed')
    const data = specData(directory, 'FEAT-20')
    assert.equal(data.slice, '2')
    assert.equal(data.slice_base, head)
    commitSpec(directory)
    assert.match(JSON.parse(atelierOk(directory, 'status', '--json')).nextStep, /\/atelier:build/)
  })

  it('les refus actuels de set-reviewed ne changent pas de tranche [FEAT-7 CA-19]', () => {
    const uncommitted = implementedSlice({ slice: 2 }).directory
    writeFileSync(join(uncommitted, 'src', 'pending.mjs'), 'code\n')
    const testsChanged = implementedSlice({ slice: 2 }).directory
    commitFiles(testsChanged, { 'test/now.test.mjs': 'test modifié\n' }, 'test: change')
    const notFrozen = atSliceTwo().directory
    commitFiles(notFrozen, { 'src/two.mjs': 'code\n' }, 'feat: two')
    for (const [label, directory] of [['code non commité', uncommitted], ['tests modifiés', testsChanged], ['tests non figés', notFrozen]]) {
      const before = specFileText(directory, 'FEAT-20')
      assert.notEqual(atelierRun(directory, 'set-reviewed').status, 0, label)
      assert.equal(specFileText(directory, 'FEAT-20'), before, label)
    }
  })

  it('refuse de passer une tranche sans commit de code depuis son début [FEAT-7 CA-20]', () => {
    const sliceTwo = makeSlicedRepository({ tdd: 'no' })
    commitFiles(sliceTwo, { 'src/one.mjs': 'code\n' }, 'feat: one')
    setHeader(sliceTwo, 'FEAT-20', { slice: '2', slice_base: headOf(sliceTwo) })
    const sliceOne = makeSlicedRepository({ tdd: 'no' })
    for (const [label, directory] of [['tranche 2', sliceTwo], ['tranche 1', sliceOne]]) {
      const before = specFileText(directory, 'FEAT-20')
      const { status, output } = atelierRun(directory, 'set-reviewed')
      assert.notEqual(status, 0, label)
      assert.match(output, /tranche vide/i, label)
      assert.equal(specFileText(directory, 'FEAT-20'), before, label)
    }
  })

  it('en TDD, une tranche dont seuls les tests ont été commités est vide [FEAT-7 CA-20]', () => {
    const directory = makeSlicedRepository({ tdd: 'yes' })
    commitFiles(directory, { 'src/one.mjs': 'code\n' }, 'feat: one')
    const base = headOf(directory)
    commitFiles(directory, { 'test/two.test.mjs': 'test\n' }, 'test: two')
    const testsCommit = git(directory, 'rev-parse', '--short', 'HEAD').trim()
    setHeader(directory, 'FEAT-20', { slice: '2', slice_base: base, tests_commit: testsCommit })
    const before = specFileText(directory, 'FEAT-20')
    const { status, output } = atelierRun(directory, 'set-reviewed')
    assert.notEqual(status, 0)
    assert.match(output, /tranche vide/i)
    assert.equal(specFileText(directory, 'FEAT-20'), before)
  })
})
