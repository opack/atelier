import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path, { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_CONFIG,
  amendmentsDiffer,
  applyToolEdit,
  closeProblems,
  decideStop,
  isRefreeze,
  nextStep,
  parseAmendments,
  parseFrontMatter,
  refreezeTestsEntry,
  reopenTestsEntry,
  reopenTestsRefusal,
  reviewCodeFiles,
  reviewProblems,
  reviewState,
  setReviewedRefusal,
  setStatusRefusal,
  testDrivenPhase,
} from '../lib/core.mjs'
import * as core from '../lib/core.mjs'
import {
  template,
  signedChantier, draftChantier, implementingChantier, signedTec, decide,
  atelierBin, temporaryDirectory, git, commit, makeRepository, atelier,
  completeBodies, chantierDirectoryOf, writeChantier, makeChantiersRepository, atelierRun, specData, assertLine, epicPlan,
  planOf, threeSlices, slicedChantier, makeSlicedRepository, commitFiles, headOf, commitSpec, setHeader, specFileText, atelierOk, atSliceTwo, implementedSlice,
  revueOf,
} from './helpers.mjs'


describe('write guard', () => {
  it('blocks code edits without an active chantier', () => {
    assert.equal(decide({ chantier: null }).allowed, false)
  })

  it('blocks code edits while the spec is a draft', () => {
    const decision = decide({ chantier: draftChantier })
    assert.equal(decision.allowed, false)
    assert.match(decision.reason, /pas signée/)
  })

  it('allows code edits once the spec is signed, for a chantier without test-first', () => {
    assert.equal(decide({ chantier: signedTec }).allowed, true)
  })

  it('always allows documentation and configuration paths', () => {
    assert.equal(decide({ chantier: null, relativePath: 'docs/chantiers/FEAT-12-x/spec.md' }).allowed, true)
    assert.equal(decide({ chantier: null, relativePath: 'CLAUDE.md' }).allowed, true)
  })

  it('allows code edits during a bypass', () => {
    assert.equal(decide({ chantier: null, bypass: { reason: 'prod down' } }).allowed, true)
  })

  it('never allows sensitive files, even with a bypass', () => {
    assert.equal(decide({ relativePath: '.env.production', bypass: { reason: 'x' } }).allowed, false)
    assert.equal(decide({ relativePath: 'keys/server.pem' }).allowed, false)
  })

  it('refuses to overwrite a signed spec but allows targeted edits', () => {
    const path = 'docs/chantiers/FEAT-12-x/spec.md'
    const existingSpec = { data: { status: 'signed' } }
    assert.equal(decide({ relativePath: path, toolName: 'Write', existingSpec }).allowed, false)
    assert.equal(decide({ relativePath: path, toolName: 'Edit', existingSpec, proposedSpec: existingSpec }).allowed, true)
  })

  it('ignores files outside the project', () => {
    assert.equal(decide({ chantier: null, relativePath: null }).allowed, true)
  })

  it('protects the atelier state: .atelier always, the configuration once created', () => {
    assert.equal(decide({ relativePath: '.atelier/bypass.json', bypass: { reason: 'x' } }).allowed, false)
    assert.equal(decide({ relativePath: '.claude/atelier.json', fileExists: false }).allowed, true)
    assert.equal(decide({ relativePath: '.claude/atelier.json', fileExists: true }).allowed, false)
    assert.equal(decide({ relativePath: '.claude/settings.json', fileExists: true }).allowed, true)
  })

  it('keeps the spec header fields written by the command out of reach of the agent', () => {
    const relativePath = 'docs/chantiers/FEAT-12-x/spec.md'
    const draft = parseFrontMatter('---\nid: FEAT-12\nstatus: draft\ntdd: yes\nsigned_by:\n---\n')
    const signed = parseFrontMatter('---\nid: FEAT-12\nstatus: signed\ntdd: yes\nsigned_by: Ana\n---\n')
    const write = (existingSpec, proposedText) => decide({ relativePath, existingSpec, proposedSpec: parseFrontMatter(proposedText) })
    assert.equal(write(draft, '---\nid: FEAT-12\nstatus: signed\ntdd: yes\nsigned_by:\n---\n').allowed, false, 'self-signature')
    assert.equal(write(draft, '---\nid: FEAT-12\nstatus: draft\ntdd: no\nsigned_by:\n---\n').allowed, true, 'tdd while draft')
    assert.equal(write(signed, '---\nid: FEAT-12\nstatus: signed\ntdd: no\nsigned_by: Ana\n---\n').allowed, false, 'tdd after signature')
    assert.equal(write(signed, '---\nid: FEAT-12\nstatus: signed\ntdd: yes\nsigned_by: Ana\ntests_commit: abc\n---\n').allowed, false, 'freezing by hand')
    assert.equal(write(signed, '---\nstatus: signed\n---\n').allowed, false, 'signed_by removed')
    assert.equal(write(null, '---\nid: FEAT-12\nstatus: draft\ntdd: yes\nsigned_by:\nsigned_at:\n---\n').allowed, true, 'new spec')
  })

  it('refuses a spec edit that cannot be replayed, since it cannot be checked', () => {
    const relativePath = 'docs/chantiers/FEAT-12-x/spec.md'
    const existingSpec = parseFrontMatter('---\nstatus: draft\n---\n')
    const decision = decide({ relativePath, toolName: 'Edit', existingSpec, proposedSpec: null })
    assert.equal(decision.allowed, false)
    assert.match(decision.reason, /édition exacte/)
  })

  it('blocks code edits once the chantier is closed', () => {
    const decision = decide({ chantier: { ...signedTec, spec: { data: { status: 'done', type: 'TEC', tdd: 'no' } } } })
    assert.equal(decision.allowed, false)
    assert.match(decision.reason, /nouveau chantier/)
  })

  it('compares paths without case when the file system ignores it', () => {
    const config = { ...DEFAULT_CONFIG, ignoreCase: true }
    assert.equal(decide({ chantier: null, config, relativePath: 'Docs/notes.md' }).allowed, true)
    assert.equal(decide({ config, relativePath: '.ATELIER/bypass.json' }).allowed, false)
    assert.equal(decide({ chantier: null, relativePath: 'Docs/notes.md' }).allowed, false)
  })
})

describe('write guard on a spec that is no longer a draft', () => {
  const relativePath = 'docs/chantiers/FEAT-12-x/spec.md'
  const signedText = '---\nid: FEAT-12\ntype: FEAT\ntitle: Budget\nstatus: signed\ntdd: yes\nsigned_by: Ana\n---\n# FEAT-12\n\n## 1. Contexte\nTexte initial.\n\n## Amendements\n<!-- Après signature : une entrée datée. -->\n- 2026-11-01 : critère ajouté\n'
  const newEntry = '- 2026-11-01 : critère ajouté\n- 2026-11-20 : contexte précisé\n'

  // Edits `text` (the committed spec by default) and asks the guard, the committed spec as reference.
  function edit(edits, { current = signedText, committed = signedText, toolName = 'MultiEdit', ...overrides } = {}) {
    const proposed = applyToolEdit(current, toolName, toolName === 'MultiEdit' ? { edits } : edits)
    return decide({
      relativePath,
      toolName,
      existingSpec: current === null ? null : parseFrontMatter(current),
      proposedSpec: proposed === null ? null : parseFrontMatter(proposed),
      committedSpec: committed === null ? null : parseFrontMatter(committed),
      ...overrides,
    })
  }
  const body = { old_string: 'Texte initial.', new_string: 'Texte corrigé.' }
  const entry = { old_string: '- 2026-11-01 : critère ajouté\n', new_string: newEntry }

  it('refuses a body or title change without a new dated entry', () => {
    const bodyOnly = edit([body])
    assert.equal(bodyOnly.allowed, false)
    assert.match(bodyOnly.reason, /Amendements/)
    assert.match(bodyOnly.reason, /même faite par l’utilisateur/)
    assert.equal(edit([{ old_string: 'title: Budget', new_string: 'title: Budget mensuel' }]).allowed, false, 'title')
    assert.equal(edit([body, { old_string: '- 2026-11-01 : critère ajouté\n', new_string: '- 2026-11-01 : critère ajouté\n- hier : oubli\n' }]).allowed, false, 'undated entry')
  })

  it('accepts a body change with a new dated entry, also over several edits', () => {
    assert.equal(edit([entry, body]).allowed, true)
    const withEntry = applyToolEdit(signedText, 'Edit', entry)
    assert.equal(edit([body], { current: withEntry }).allowed, true, 'entry written by an earlier edit, not committed yet')
    assert.equal(edit([body], { current: withEntry, committed: withEntry }).allowed, false, 'once committed, the entry no longer covers a new change')
  })

  it('keeps existing entries untouched and in front', () => {
    assert.equal(edit([{ old_string: 'critère ajouté', new_string: 'critère retiré' }]).allowed, false, 'modified')
    assert.equal(edit([{ old_string: '- 2026-11-01 : critère ajouté\n', new_string: '- 2026-11-20 : nouvelle\n' }]).allowed, false, 'deleted')
    const inserted = edit([body, { old_string: '- 2026-11-01 : critère ajouté\n', new_string: '- 2026-11-20 : nouvelle\n- 2026-11-01 : critère ajouté\n' }])
    assert.equal(inserted.allowed, false, 'inserted before')
    assert.match(inserted.reason, /à la fin/)
  })

  it('refuses a second Amendements section, and counts a renamed one as body', () => {
    assert.match(edit([entry, { old_string: '## 1. Contexte', new_string: '## Amendements\n\n## 1. Contexte' }]).reason, /plusieurs sections/)
    assert.equal(edit([{ old_string: '## Amendements', new_string: '## Amendements (historique)' }]).allowed, false)
  })

  it('creates the section with the first entry', () => {
    const withoutSection = signedText.replace(/\n## Amendements[\s\S]*$/, '\n')
    assert.equal(edit([body, { old_string: 'Texte corrigé.\n', new_string: 'Texte corrigé.\n\n## Amendements\n- 2026-11-20 : x\n' }],{ current: withoutSection, committed: withoutSection }).allowed, true)
  })

  it('freezes id, type and tdd, and every field written by the command', () => {
    for (const [field, value] of [['id: FEAT-12', 'id: FEAT-13'], ['type: FEAT', 'type: FIX'], ['tdd: yes', 'tdd: no']]) {
      assert.equal(edit([entry, { old_string: field, new_string: value }]).allowed, false, field)
    }
    assert.match(edit([entry, { old_string: 'signed_by: Ana', new_string: 'signed_by: Ana\nreviewed_commit: abc' }]).reason, /reviewed_commit/)
  })

  it('refuses a full rewrite, abandoned spec and spec deleted from disk included', () => {
    const abandoned = signedText.replace('status: signed', 'status: abandoned')
    assert.equal(edit({ content: abandoned }, { toolName: 'Write', current: abandoned, committed: abandoned }).allowed, false)
    assert.equal(edit({ content: signedText }, { toolName: 'Write', current: null }).allowed, false, 'deleted from disk, signed in HEAD')
    assert.equal(edit(body, { toolName: 'Edit', current: null }).allowed, false)
  })

  it('refuses when the committed spec cannot be read', () => {
    const decision = edit([entry, body], { committedSpecError: 'fatal: bad object' })
    assert.equal(decision.allowed, false)
    assert.match(decision.reason, /bad object/)
    assert.match(decision.reason, /brouillon/)
  })

  it('normalizes line endings and leaves a draft free', () => {
    const crlf = signedText.replace(/\n/g, '\r\n')
    assert.equal(edit([{ old_string: 'Texte initial.', new_string: 'Texte initial.' }], { current: crlf }).allowed, true)
    assert.equal(edit([body], { current: crlf }).allowed, false)
    assert.equal(edit([entry, body], { current: crlf, committed: crlf }).allowed, true)
    const draft = signedText.replace('status: signed', 'status: draft').replace('signed_by: Ana', 'signed_by:')
    assert.equal(edit([body, { old_string: 'tdd: yes', new_string: 'tdd: no' }], { current: draft, committed: draft }).allowed, true)
    assert.equal(edit({ content: 'x' }, { toolName: 'Write', current: draft, committed: draft }).allowed, true)
    assert.equal(edit([body], { current: draft, committed: null }).allowed, true, 'never committed')
  })

  it('guards a spec path written with another case', () => {
    const config = { ...DEFAULT_CONFIG, ignoreCase: true }
    assert.equal(edit([body], { relativePath: 'Docs/Chantiers/FEAT-12-x/SPEC.md', config }).allowed, false)
    assert.equal(edit([entry, body], { relativePath: 'Docs/Chantiers/FEAT-12-x/SPEC.md', config }).allowed, true, 'with a new entry')
  })

  it('never puts a spec that is no longer a draft back to draft', () => {
    for (const status of ['signed', 'done', 'abandoned']) {
      assert.match(setStatusRefusal({ ...signedChantier, spec: { data: { status } } }, 'draft'), /brouillon/, status)
    }
    assert.equal(setStatusRefusal(draftChantier, 'draft'), null)
    assert.equal(setStatusRefusal(signedChantier, 'abandoned'), null)
  })
})

describe('write guard on a spec whose committed version is a draft', () => {
  const relativePath = 'docs/chantiers/TEC-5-x/spec.md'
  const draftText = '---\nid: TEC-5\ntype: TEC\ntitle: Brouillon\nstatus: draft\ntdd: no\nsigned_by:\nsigned_at:\n---\n# TEC-5\n\n## 1. Quoi\nTexte initial.\n\n## Amendements\n<!-- Après signature : une entrée datée. -->\n'
  const signedText = draftText.replace('status: draft', 'status: signed').replace('signed_by:', 'signed_by: Ana').replace('signed_at:', 'signed_at: 2026-11-20')
  const body = { old_string: 'Texte initial.', new_string: 'Texte corrigé.' }
  const entry = { old_string: '<!-- Après signature : une entrée datée. -->\n', new_string: '<!-- Après signature : une entrée datée. -->\n- 2026-11-21 : quoi précisé\n' }

  // Asks the guard for one write on `current`, with `committed` as the version in HEAD (null: absent).
  function write(current, committed, toolName, input) {
    const proposed = applyToolEdit(current, toolName, input)
    return decide({
      relativePath,
      toolName,
      existingSpec: parseFrontMatter(current),
      proposedSpec: proposed === null ? null : parseFrontMatter(proposed),
      committedSpec: committed === null ? null : parseFrontMatter(committed),
    })
  }

  // [label, working version, tool, input, expected]; each case is checked with a committed draft (V-1, V-2)
  // and with no committed spec at all (V-3): the committed draft must change nothing.
  const reserved = [
    ['status', 'status: draft', 'status: signed'],
    ['signed_by', 'signed_by:', 'signed_by: Ana'],
    ['signed_at', 'signed_at:', 'signed_at: 2026-11-20'],
    ['done_at', 'signed_at:', 'signed_at:\ndone_at: 2026-11-21'],
    ['tests_commit', 'signed_at:', 'signed_at:\ntests_commit: abc'],
    ['reviewed_commit', 'signed_at:', 'signed_at:\nreviewed_commit: abc'],
  ]
  const cases = [
    ['draft: full rewrite [TEC-5 CA-1]', draftText, 'Write', { content: draftText.replace('Texte initial.', 'Tout réécrit.') }, true],
    ['draft: body edit [TEC-5 CA-1]', draftText, 'Edit', body, true],
    ['draft: tdd and title edits [TEC-5 CA-1]', draftText, 'MultiEdit', { edits: [{ old_string: 'tdd: no', new_string: 'tdd: yes' }, { old_string: 'title: Brouillon', new_string: 'title: Autre' }] }, true],
    ...reserved.map(([field, from, to]) => [`draft: reserved field ${field} [TEC-5 CA-1]`, draftText, 'Edit', { old_string: from, new_string: to }, false]),
    ['signed, not committed: full rewrite [TEC-5 CA-2]', signedText, 'Write', { content: signedText }, false],
    ['signed, not committed: body edit without entry [TEC-5 CA-2]', signedText, 'Edit', body, false],
    ['signed, not committed: body edit with a new entry [TEC-5 CA-2]', signedText, 'MultiEdit', { edits: [entry, body] }, true],
    ['signed, not committed: back to draft [TEC-5 CA-2]', signedText, 'MultiEdit', { edits: [entry, { old_string: 'status: signed', new_string: 'status: draft' }] }, false],
  ]

  for (const [label, current, toolName, input, expected] of cases) {
    it(label, () => {
      const withDraft = write(current, draftText, toolName, input)
      assert.equal(withDraft.allowed, expected, 'committed draft')
      assert.deepEqual(withDraft, write(current, null, toolName, input), 'V-3: same decision as with no committed spec')
    })
  }

  it('takes the signed working version as reference, not an older committed draft [TEC-5 CA-2, CA-3]', () => {
    // Draft committed, then touched up by the critical review and signed without committing in between.
    const olderDraft = draftText.replace('Texte initial.', 'Texte du premier brouillon.')
    const noChange = { old_string: 'Texte initial.', new_string: 'Texte initial.' }
    for (const [label, toolName, input, expected] of [
      ['edit leaving the body as signed', 'Edit', noChange, true],
      ['body edit without entry', 'Edit', body, false],
      ['body edit with a new entry', 'MultiEdit', { edits: [entry, body] }, true],
      ['full rewrite', 'Write', { content: signedText }, false],
    ]) {
      const withDraft = write(signedText, olderDraft, toolName, input)
      assert.equal(withDraft.allowed, expected, label)
      assert.deepEqual(withDraft, write(signedText, null, toolName, input), `${label}: same decision as with no committed spec`)
    }
  })

  it('names the reserved field and the amendment rule in its refusals', () => {
    assert.match(write(draftText, draftText, 'Edit', { old_string: 'status: draft', new_string: 'status: signed' }).reason, /« status »/)
    assert.match(write(signedText, draftText, 'Edit', body).reason, /Amendements/)
    assert.match(write(signedText, draftText, 'Write', { content: signedText }).reason, /ne se réécrit pas/)
  })
})

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

describe('stop hook', () => {
  const checksConfig = { ...DEFAULT_CONFIG, checks: [{ name: 'tests', command: 'npm test' }] }
  const failure = { check: checksConfig.checks[0], output: '1 failing' }

  function stop(overrides) {
    let checksRun = 0
    const { runChecksResult = null, ...rest } = overrides
    const decision = decideStop({
      config: checksConfig,
      chantier: signedTec,
      bypass: null,
      changedFiles: ['src/app.ts'],
      changedTests: [],
      tree: 'tree-1',
      state: {},
      runChecks: () => { checksRun += 1; return runChecksResult },
      ...rest,
    })
    return { ...decision, checksRun }
  }

  it('runs nothing while writing tests', () => {
    const decision = stop({ chantier: signedChantier, runChecksResult: failure })
    assert.equal(decision.block, false)
    assert.equal(decision.checksRun, 0)
  })

  it('blocks when frozen tests were modified', () => {
    const decision = stop({ chantier: implementingChantier, changedTests: ['src/budget.test.ts'] })
    assert.equal(decision.block, true)
    assert.match(decision.message, /git checkout abc1234/)
  })

  it('reports code changed without a signed chantier once per working tree', () => {
    const first = stop({ chantier: draftChantier })
    assert.equal(first.block, true)
    assert.match(first.message, /sans chantier signé/)
    assert.equal(stop({ chantier: draftChantier, state: first.state }).block, false)
    assert.equal(stop({ chantier: draftChantier, state: first.state, tree: 'tree-2' }).block, true)
    assert.equal(stop({ chantier: draftChantier, bypass: { reason: 'x' } }).block, false)
  })

  it('ignores free paths, chantier documents and atelier state', () => {
    const decision = stop({ changedFiles: ['README.md', 'docs/decisions/0001.md', '.atelier/gate.json'], runChecksResult: failure })
    assert.equal(decision.block, false)
    assert.equal(decision.checksRun, 0)
  })

  it('keeps the agent working while a check fails, and skips a tree already green', () => {
    assert.equal(stop({ runChecksResult: failure }).block, true)
    const green = stop({})
    assert.equal(green.block, false)
    assert.equal(green.state.lastGreen, 'tree-1')
    assert.equal(stop({ state: green.state, runChecksResult: failure }).checksRun, 0)
  })

  it('lets a stuck agent stop and tells the user, but keeps a progressing agent working', () => {
    const first = stop({ runChecksResult: failure })
    const stuck = stop({ state: first.state, runChecksResult: failure })
    assert.equal(stuck.block, false)
    assert.match(stuck.message, /sans parvenir/)
    assert.match(stuck.message, /1 failing/)
    assert.equal(stuck.checksRun, 0, 'a tree known to fail is not checked again')
    const later = stop({ state: stuck.state, runChecksResult: failure })
    assert.equal(later.block, false)
    assert.equal(later.message, undefined, 'the user is told once')
    assert.equal(later.checksRun, 0)
    assert.equal(stop({ state: first.state, tree: 'tree-2', runChecksResult: failure }).block, true)
  })
})

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


// ---------- FEAT-4: relations between chantiers, EPIC type ----------


describe('FEAT-4 dependencies checked at close', () => {
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

describe('FEAT-4 EPIC type', () => {
  it('sur un EPIC signé, aucune écriture hors des chemins libres ; docs/ et le débrayage restent permis [FEAT-4 CA-8]', () => {
    const epic = { id: 'EPIC-5', directory: '/p/docs/chantiers/EPIC-5-x', spec: { data: { status: 'signed', type: 'EPIC', tdd: 'no' } }, files: ['spec.md', 'plan.md'] }
    for (const relativePath of ['src/app.ts', 'src/app.test.ts']) {
      const decision = decide({ chantier: epic, relativePath })
      assert.equal(decision.allowed, false, relativePath)
      assert.match(decision.reason, /EPIC/)
      assert.match(decision.reason, /implémente/)
    }
    assert.equal(decide({ chantier: epic, relativePath: 'docs/notes.md' }).allowed, true)
    assert.equal(decide({ chantier: epic, bypass: { reason: 'urgence' } }).allowed, true)
  })
})

describe('FEAT-4 closing an EPIC', () => {
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

describe('FEAT-4 next step of an EPIC', () => {
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

describe('FEAT-4 relations shown by status', () => {
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

describe('FEAT-4 process section of CLAUDE.md', () => {
  const processLines = () => template('process').split(/\r?\n/).filter((line) => line.trim())

  it('le template de la section Process existe et parle de l’EPIC et des relations [FEAT-4 CA-12]', () => {
    assert.ok(processLines().includes('## Process (atelier)'))
    assert.ok(processLines().some((line) => /EPIC/.test(line) && /rel_/.test(line)))
  })

  it('liste toutes les lignes quand la section est absente [FEAT-4 CA-12]', () => {
    const directory = makeRepository('main')
    writeFileSync(join(directory, 'CLAUDE.md'), '# Projet\n\nRien sur le process.\n')
    const { status, output } = atelierRun(directory, 'check-process')
    assert.equal(status, 2)
    for (const line of processLines()) {
      assert.ok(output.includes(line.trim()), line)
    }
  })

  it('liste seulement les lignes manquantes ; rien quand tout y est, ajouts du projet compris [FEAT-4 CA-12]', () => {
    const directory = makeRepository('main')
    const lines = processLines()
    const [, missing] = lines.filter((line) => line.startsWith('- '))
    const complete = `# Projet\n\n${lines.join('\n')}\n- Règle propre au projet.\n\n## Autre\nTexte.\n`
    writeFileSync(join(directory, 'CLAUDE.md'), complete)
    const ok = atelierRun(directory, 'check-process')
    assert.equal(ok.status, 0, ok.output)
    writeFileSync(join(directory, 'CLAUDE.md'), complete.replace(`${missing}\n`, ''))
    const partial = atelierRun(directory, 'check-process')
    assert.equal(partial.status, 2)
    assert.ok(partial.output.includes(missing.trim()))
    for (const line of lines.filter((candidate) => candidate !== missing)) {
      assert.ok(!partial.output.includes(line.trim()), `présente, non signalée : ${line}`)
    }
  })

  it('la ligne des chantiers est attendue avec le chantiersDir du projet, sans / final [FEAT-4 CA-12]', () => {
    const directory = makeRepository('main')
    writeFileSync(join(directory, '.claude', 'atelier.json'), JSON.stringify({ chantiersDir: 'work/chantiers/' }))
    const lines = processLines()
    const chantiersLine = lines.find((line) => line.includes('docs/chantiers/'))
    assert.ok(chantiersLine, 'le template nomme docs/chantiers/')
    const adapted = lines.map((line) => line.replaceAll('docs/chantiers/', 'work/chantiers/'))
    writeFileSync(join(directory, 'CLAUDE.md'), `# Projet\n\n${adapted.join('\n')}\n`)
    const ok = atelierRun(directory, 'check-process')
    assert.equal(ok.status, 0, ok.output)
    writeFileSync(join(directory, 'CLAUDE.md'), `# Projet\n\n${lines.join('\n')}\n`)
    const stale = atelierRun(directory, 'check-process')
    assert.equal(stale.status, 2)
    assert.ok(stale.output.includes(chantiersLine.replaceAll('docs/chantiers/', 'work/chantiers/').trim()), stale.output)
  })
})

describe('FEAT-4 site', () => {
  const site = (relativePath) => readFileSync(fileURLToPath(new URL(`../../../site/${relativePath}`, import.meta.url)), 'utf8')

  // The build itself (`npm run build` in site/) is checked by hand at review: it needs the site's
  // dependencies and takes too long for the test suite.
  it('six types dont l’EPIC ; templates spec-epic et plan-epic inclus [FEAT-4 CA-13]', () => {
    const types = site('fondations/types.md')
    assert.match(types, /Six types/)
    assert.match(types, /^## EPIC/m)
    const templates = site('reference/templates.md')
    assert.match(templates, /@include: [^\n]*templates\/spec-epic\.md/)
    assert.match(templates, /@include: [^\n]*templates\/plan-epic\.md/)
  })
})

// ---------- FEAT-7: tests, build and review cycle per slice ----------

function amendmentEntries(directory, id) {
  return parseAmendments(parseFrontMatter(specFileText(directory, id)).body).entries
}


describe('FEAT-7 plan and current slice', () => {
  it('compte les entrées numérotées de premier niveau de « Tranches » (sous-listes, commentaires et autres sections ignorés) [FEAT-7 CA-1]', () => {
    assert.equal(core.planSliceCount(threeSlices), 3)
    assert.equal(core.planSliceCount(threeSlices.replace(/\n/g, '\r\n')), 3, 'plan en CRLF')
  })

  it('le nombre de tranches est le plus grand numéro [FEAT-7 CA-1]', () => {
    assert.equal(core.planSliceCount(planOf([1, 2, 4])), 4)
  })

  it('sans plan, sans section « Tranches » ou avec une seule entrée, une tranche unique [FEAT-7 CA-2]', () => {
    for (const plan of [null, '# Plan\n\n## Approche\nTexte.\n', planOf([1])]) {
      assert.equal(core.sliceState(slicedChantier({}, { plan })).model, 'single', String(plan))
    }
  })

  it('status --json donne slice et sliceCount null, et ne parle de tranche ni en texte ni dans la prochaine étape [FEAT-7 CA-2]', () => {
    for (const plan of [null, planOf([1])]) {
      const directory = makeSlicedRepository({ plan })
      const summary = JSON.parse(atelierOk(directory, 'status', '--json'))
      assert.equal(summary.chantier.slice, null)
      assert.equal(summary.chantier.sliceCount, null)
      assert.doesNotMatch(summary.nextStep, /tranche/i)
      assert.doesNotMatch(atelierOk(directory, 'status'), /tranche/i)
    }
  })

  it('sans champ slice ni trace de l’ancien modèle, la tranche en cours est la 1 [FEAT-7 CA-3]', () => {
    assert.deepEqual(core.sliceState(slicedChantier()), { model: 'sliced', slice: 1, sliceCount: 3 })
    const summary = JSON.parse(atelierOk(makeSlicedRepository(), 'status', '--json'))
    assert.equal(summary.chantier.slice, 1)
    assert.equal(summary.chantier.sliceCount, 3)
  })

  it('avec slice: 2, la tranche en cours est la 2 [FEAT-7 CA-3]', () => {
    assert.deepEqual(core.sliceState(slicedChantier({ slice: '2' })), { model: 'sliced', slice: 2, sliceCount: 3 })
    const summary = JSON.parse(atelierOk(makeSlicedRepository({ header: { slice: 2 } }), 'status', '--json'))
    assert.equal(summary.chantier.slice, 2)
    assert.equal(summary.chantier.sliceCount, 3)
  })

  it('un chantier de l’ancien modèle (tests_commit, reviewed_commit, tests rouverts ou regelés) est une tranche unique, quel que soit le plan [FEAT-7 CA-4]', () => {
    const withAmendment = (entry) => ({ ...slicedChantier(), spec: { data: { status: 'signed', type: 'FEAT', tdd: 'yes' }, body: `# x\n\n## Amendements\n- ${entry}\n` } })
    const legacy = [
      slicedChantier({ tests_commit: 'abc1234' }),
      slicedChantier({ reviewed_commit: 'a'.repeat(40) }, { tdd: 'no' }),
      withAmendment('2026-11-01 : tests rouverts (gel quitté : abc1234) : oubli'),
      withAmendment('2026-11-02 : tests regelés : def5678'),
    ]
    legacy.forEach((chantier, index) => assert.equal(core.sliceState(chantier).model, 'legacy', `cas ${index}`))
    const summary = JSON.parse(atelierOk(makeSlicedRepository({ header: { tests_commit: 'abc1234' } }), 'status', '--json'))
    assert.equal(summary.chantier.slice, null)
    assert.equal(summary.chantier.sliceCount, null)
  })

  it('le hook refuse que l’agent écrive ou modifie slice, slice_base ou last_slice [FEAT-7 CA-5]', () => {
    const relativePath = 'docs/chantiers/FEAT-20-x/spec.md'
    const signedText = '---\nid: FEAT-20\ntype: FEAT\ntitle: X\nstatus: signed\ntdd: yes\nslice: 2\n---\n# FEAT-20\n'
    for (const [field, newValue] of [['slice', 'slice: 3'], ['slice_base', 'slice: 2\nslice_base: abc'], ['last_slice', 'slice: 2\nlast_slice: 3']]) {
      const proposed = applyToolEdit(signedText, 'Edit', { old_string: 'slice: 2', new_string: newValue })
      const decision = decide({
        relativePath,
        existingSpec: parseFrontMatter(signedText),
        proposedSpec: parseFrontMatter(proposed),
        committedSpec: parseFrontMatter(signedText),
      })
      assert.equal(decision.allowed, false, field)
      assert.match(decision.reason, new RegExp(`« ${field} »`), field)
    }
  })
})

describe('FEAT-7 freezing the tests of a slice', () => {
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
    assert.deepEqual(core.removedTestLines(diff).sort(), ['test/gone.test.mjs', 'test/one.test.mjs'])
    assert.deepEqual(core.removedTestLines(''), [])
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

describe('FEAT-7 write guard and stop hook per slice', () => {
  const sliceTwoWriting = slicedChantier({ slice: '2', slice_base: 'a'.repeat(40) })
  const sliceTwoImplementing = slicedChantier({ slice: '2', slice_base: 'a'.repeat(40), tests_commit: 'abc1234' })
  const chantierReview = slicedChantier({ slice: 'chantier', last_slice: '3', slice_base: 'a'.repeat(40), tests_commit: 'abc1234' })

  it('en tranche 2, phase « tests d’abord », refuse le code et accepte les tests [FEAT-7 CA-12]', () => {
    assert.equal(decide({ chantier: sliceTwoWriting, relativePath: 'src/budget.ts' }).allowed, false)
    assert.equal(decide({ chantier: sliceTwoWriting, relativePath: 'test/budget.test.ts' }).allowed, true)
  })

  it('en tranche 2, phase d’implémentation, refuse l’écriture d’un test ; le contrôle de fin signale un test modifié [FEAT-7 CA-13]', () => {
    assert.equal(decide({ chantier: sliceTwoImplementing, relativePath: 'test/one.test.ts' }).allowed, false)
    const decision = decideStop({
      config: DEFAULT_CONFIG,
      chantier: sliceTwoImplementing,
      bypass: null,
      changedFiles: ['test/one.test.ts'],
      changedTests: ['test/one.test.ts'],
      tree: 'tree-1',
      state: {},
      runChecks: () => null,
    })
    assert.equal(decision.block, true)
    assert.match(decision.message, /git checkout abc1234/)
  })

  it('en revue du chantier, tests figés, refuse un test et accepte le code [FEAT-7 CA-17]', () => {
    assert.equal(decide({ chantier: chantierReview, relativePath: 'test/one.test.ts' }).allowed, false)
    assert.equal(decide({ chantier: chantierReview, relativePath: 'src/budget.ts' }).allowed, true)
  })
})

describe('FEAT-7 review and next slice', () => {
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

describe('FEAT-7 close and next step', () => {
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

  it('un SPIKE en TDD suit le cycle par tranche et sa clôture exige la revue du chantier [FEAT-7 CA-25]', () => {
    const spike = slicedChantier({ slice: '2', slice_base: 'a'.repeat(40) }, { type: 'SPIKE' })
    assert.equal(core.sliceState(spike).model, 'sliced')
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
    assert.equal(core.sliceState(spike).model, 'none')
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

  it('le rappel de début de session indique la tranche, et n’en parle pas pour une tranche unique [FEAT-7 CA-26]', () => {
    const { directory } = atSliceTwo()
    assert.match(atelierOk(directory, 'hook-session-start'), /Tranche 2\/3/)
    assert.doesNotMatch(atelierOk(makeSlicedRepository({ plan: null }), 'hook-session-start'), /tranche/i)
  })
})

describe('FEAT-7 vocabulary of the review', () => {
  const repositoryPath = (relativePath) => fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url))
  const reviewRound = /\btours? de revue\b|\btour \d+\b|\bà chaque tour\b/i

  it('plus de « tour » au sens d’un passage de revue dans les skills, l’agent, les templates, le site et le README [FEAT-7 CA-27]', () => {
    const siteFiles = readdirSync(repositoryPath('site'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !['node_modules', 'public'].includes(entry.name))
      .flatMap((entry) => readdirSync(repositoryPath(`site/${entry.name}`)).filter((name) => name.endsWith('.md')).map((name) => `site/${entry.name}/${name}`))
    const files = [
      'plugins/atelier/skills/review/SKILL.md',
      'plugins/atelier/skills/close/SKILL.md',
      'plugins/atelier/agents/reviewer.md',
      'plugins/atelier/templates/revue.md',
      'plugins/atelier/templates/bilan.md',
      'README.md',
      ...siteFiles,
    ]
    const offenders = files.filter((file) => reviewRound.test(readFileSync(repositoryPath(file), 'utf8')))
    assert.deepEqual(offenders, [])
  })
})


// The fields of each analysed row that CA-12 and CA-15 are about.
function pointsOf(parsed) {
  return parsed.sections.flatMap((section) => section.rows.map(({ id, marker, title, treatment, table }) =>
    ({ section: section.title, table, id, marker, title, treatment })))
}

describe('TEC-15 reading revue.md', () => {
  it('extrait l’identifiant, le marqueur (repris, ex-RD3 ou aucun) et l’intitulé de chaque point [TEC-15 CA-12]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB2. Intitulé', '`a.mjs`', 'corrigé (abc1234)']], discuss: [['RD3. Autre point', '`b.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB2 (repris). Intitulé', '`a.mjs`', ''], ['RB4 (ex-RD3). Intitulé', '`b.mjs`', 'écarté : hors périmètre']] },
    ])
    assert.deepEqual(pointsOf(core.parseReviewPoints(text)), [
      { section: 'Revue : tranche 1 : 2026-11-21', table: 'Bloquant', id: 'RB2', marker: null, title: 'Intitulé', treatment: 'corrigé (abc1234)' },
      { section: 'Revue : tranche 1 : 2026-11-21', table: 'À discuter', id: 'RD3', marker: null, title: 'Autre point', treatment: 'requalifié (RB4)' },
      { section: 'Revue : tranche 2 : 2026-11-22', table: 'Bloquant', id: 'RB2', marker: 'repris', title: 'Intitulé', treatment: '' },
      { section: 'Revue : tranche 2 : 2026-11-22', table: 'Bloquant', id: 'RB4', marker: 'ex-RD3', title: 'Intitulé', treatment: 'écarté : hors périmètre' },
    ])
  })

  it('lit un revue.md en CRLF, aux cellules entourées d’espaces superflus [TEC-15 CA-12]', () => {
    const text = revueOf([{ title: 'Revue : chantier : 2026-11-21', blocking: [['  RB1. Push non vérifié  ', '`a.mjs`', '   corrigé (abc1234)   ']] }])
      .replace(/\n/g, '\r\n')
    assert.deepEqual(pointsOf(core.parseReviewPoints(text)), [
      { section: 'Revue : chantier : 2026-11-21', table: 'Bloquant', id: 'RB1', marker: null, title: 'Push non vérifié', treatment: 'corrigé (abc1234)' },
    ])
  })

  it('seuls les tableaux sous « ### Bloquant » et « ### À discuter » sont des tableaux de points [TEC-15 CA-12]', () => {
    const text = `${revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Un point', '`a.mjs`', 'corrigé (abc1234)']] }])}\n### Contrôles\n| Point | Fichier | Traitement |\n|---|---|---|\n| RB9. Hors tableau de points | \`x\` | |\n`
    assert.deepEqual(pointsOf(core.parseReviewPoints(text)).map((point) => point.id), ['RB1'])
  })

  it('une ligne vide au milieu d’un tableau de points ne fait perdre aucun point [TEC-15 CA-12]', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Un', '`a.mjs`', 'corrigé (abc1234)'], ['RB2. Deux', '`b.mjs`', ''], ['RB3. Trois', '`c.mjs`', 'écarté : doublon']] }])
      .replace('corrigé (abc1234) |\n', 'corrigé (abc1234) |\n\n')
    assert.deepEqual(pointsOf(core.parseReviewPoints(text)).map(({ id, treatment }) => ({ id, treatment })), [
      { id: 'RB1', treatment: 'corrigé (abc1234)' },
      { id: 'RB2', treatment: '' },
      { id: 'RB3', treatment: 'écarté : doublon' },
    ])
  })

  it('un tableau de points sans ligne d’en-tête ne perd pas son premier point [TEC-15 CA-12]', () => {
    const text = '# Revue : TEC-30 Essai\n\n## Revue : 2026-11-21\n\n### Bloquant\n| RB1. Un | `a.mjs` | |\n| RB2. Deux | `b.mjs` | |\n'
    assert.deepEqual(pointsOf(core.parseReviewPoints(text)).map((point) => point.id), ['RB1', 'RB2'])
  })

  it('une ligne dont le nombre de cellules diffère de l’en-tête est marquée [TEC-15 CA-12]', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Pipe non échappé', '`a | b`', 'corrigé (abc1234)'], ['RB2. Normal', '`c.mjs`', '']] }])
    const rows = core.parseReviewPoints(text).sections[0].rows
    assert.deepEqual(rows.map(({ id, cellCountMismatch }) => ({ id, cellCountMismatch })), [
      { id: 'RB1', cellCountMismatch: true },
      { id: 'RB2', cellCountMismatch: false },
    ])
  })

  it('un tableau dans un commentaire HTML n’est pas lu, comme un bloc de code [TEC-15 CA-12]', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Vrai point', '`a.mjs`', '']] }])
      .replace('### Bloquant\n', '### Bloquant\n<!-- Exemple :\n| Point | Fichier | Traitement |\n|---|---|---|\n| RB9. Exemple | `x` | |\n-->\n')
    assert.deepEqual(pointsOf(core.parseReviewPoints(text)).map((point) => point.id), ['RB1'])
  })

  it('un | dans une cellule est un | littéral, pas un séparateur de colonne [TEC-15 CA-15]', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Option a \\| b', '`a \\| b`', 'corrigé (abc1234)']] }])
    const [point] = core.parseReviewPoints(text).sections[0].rows
    assert.equal(point.treatment, 'corrigé (abc1234)')
    assert.equal(point.file, '`a | b`')
    assert.equal(point.title, 'Option a | b')
  })

  it('readChantier expose le texte de revue.md (null sans fichier)', () => {
    const directory = temporaryDirectory('atelier-tec15-')
    const config = { ...DEFAULT_CONFIG, chantiersDir: 'docs/chantiers' }
    const text = revueOf([{ title: 'Revue : 2026-11-21' }])
    writeChantier(directory, { id: 'TEC-30', files: { 'revue.md': text } })
    writeChantier(directory, { id: 'TEC-31' })
    assert.equal(core.readChantier(directory, config, 'TEC-30').revue, text)
    assert.equal(core.readChantier(directory, config, 'TEC-31').revue, null)
  })
})

// The problems found by the review checks in a revue.md text.
const pointProblems = (text, options = {}) => core.reviewPointProblems(core.parseReviewPoints(text), options)
const citing = (problems, pattern) => problems.filter((problem) => pattern.test(problem))
// A revue.md with one review section whose body is given as is.
const revueWithBody = (body) => `# Revue : TEC-30 Essai\n\n## Revue : 2026-11-21\n\n${body}`
const pointTable = '| Point | Fichier | Traitement |\n|---|---|---|\n'

describe('TEC-15 checking the review points', () => {
  it('c’est la dernière occurrence d’un point qui dit s’il est ouvert [TEC-15 CA-3]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Premier', '`a.mjs`', ''], ['RB2. Second', '`b.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB1 (repris). Premier', '`a.mjs`', 'corrigé (def5678)'], ['RB2 (repris). Second', '`b.mjs`', '']] },
    ])
    const problems = pointProblems(text)
    assert.equal(citing(problems, /\bRB2\b/).length, 1)
    assert.deepEqual(citing(problems, /\bRB1\b/), [])
  })

  it('un traitement commence par un mot-clé, quelle que soit sa casse [TEC-15 CA-4]', () => {
    for (const cell of ['corrigé (abc1234)', 'Corrigé (abc1234)', 'test ajouté (abc1234)', 'Spec amendée (2026-11-21)',
      'exception acceptée par Opack : coût', 'écarté : hors périmètre', 'Écarté : doublon', 'reporté (FIX-12)',
      'reporté (tranche 3)', 'requalifié (RB4)', 'sans objet : code supprimé', 'SANS OBJET']) {
      assert.equal(core.isTreatment(cell), true, cell)
    }
    for (const cell of ['', '   ', 'À corriger au build', 'TODO', 'à voir', 'correction à faire']) {
      assert.equal(core.isTreatment(cell), false, cell)
    }
  })

  it('un point sans traitement reconnu est signalé avec son identifiant et son intitulé, RB comme RD [TEC-15 CA-4]', () => {
    const text = revueOf([{
      title: 'Revue : 2026-11-21',
      blocking: [['RB1. Push non vérifié', '`a.mjs`', ''], ['RB2. Commit non signé', '`b.mjs`', '   '], ['RB3. Bien traité', '`c.mjs`', 'Corrigé (abc1234)']],
      discuss: [['RD1. Nom ambigu', '`d.mjs`', 'À corriger au build'], ['RD2. Doublon', '`e.mjs`', 'écarté : hors périmètre']],
    }])
    const problems = pointProblems(text)
    assert.equal(problems.length, 3)
    assert.equal(citing(problems, /\bRB1\b.*Push non vérifié/).length, 1)
    assert.equal(citing(problems, /\bRB2\b.*Commit non signé/).length, 1)
    assert.equal(citing(problems, /\bRD1\b.*Nom ambigu/).length, 1)
  })

  it('un identifiant présenté comme nouveau dans deux sections est signalé avec les titres des deux sections [TEC-15 CA-5]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Premier', '`a.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB1. Autre chose', '`b.mjs`', 'corrigé (def5678)']] },
    ])
    const problems = citing(pointProblems(text), /\bRB1\b/)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /Revue : tranche 1 : 2026-11-21/)
    assert.match(problems[0], /Revue : tranche 2 : 2026-11-22/)
  })

  it('un identifiant nouveau dans deux sections de même titre est signalé, et le premier point ouvert n’est pas masqué [TEC-15 CA-5]', () => {
    const text = revueOf([
      { title: 'Revue : 2026-11-22', blocking: [['RB1. Premier', '`a.mjs`', '']] },
      { title: 'Revue : 2026-11-22', blocking: [['RB1. Autre chose', '`b.mjs`', 'corrigé (def5678)']] },
    ])
    assert.equal(citing(pointProblems(text), /présenté comme nouveau/).length, 1)
  })

  it('un identifiant présent deux fois dans une même section est signalé [TEC-15 CA-5]', () => {
    const text = revueOf([{
      title: 'Revue : 2026-11-21',
      blocking: [['RB1. Premier', '`a.mjs`', 'corrigé (abc1234)'], ['RB1. Second', '`b.mjs`', 'corrigé (abc1234)']],
    }])
    const problems = citing(pointProblems(text), /\bRB1\b/)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /Revue : 2026-11-21/)
  })

  it('une cellule Point qui n’a pas la forme définie est signalée, avec son contenu [TEC-15 CA-6]', () => {
    const cells = ['B1. Ancien format', '1. Numéro seul', 'Texte libre sans identifiant', 'RB1 Sans point final', 'RB2.Sans espace', 'Aucun']
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: cells.map((cell) => [cell, '`a.mjs`', 'corrigé (abc1234)']) }])
    const problems = pointProblems(text)
    for (const cell of cells) {
      assert.equal(citing(problems, new RegExp(cell.replace(/[.()]/g, '\\$&'))).length, 1, cell)
    }
  })

  it('la ligne « Aucun » (ou « aucun. ») seule n’est pas signalée [TEC-15 CA-6]', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['Aucun', '', '']], discuss: [['aucun.', '', '']] }])
    assert.deepEqual(pointProblems(text), [])
  })

  it('une ligne dont le nombre de cellules diffère de l’en-tête est signalée (| non échappé) [TEC-15 CA-6]', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Pipe non échappé', '`a.mjs`', 'corrigé (abc1234)', 'en trop']] }])
    assert.equal(citing(pointProblems(text), /\bRB1\b/).length, 1)
  })

  it('une ligne mal formée suivie d’un séparateur n’est jamais prise pour l’en-tête (RD6, RD10, RD11) [TEC-15 CA-6]', () => {
    const one = '| RB1. Un | `a.mjs` | corrigé (abc1234) |\n'
    const two = '| RB2. Deux | `b.mjs` | corrigé (abc1234) |\n'
    const cases = {
      'RD6, ouvre le tableau': `### Bloquant\n| B1. Ancien | \`a.mjs\` | corrigé (abc1234) |\n|---|---|---|\n${two}`,
      'RD10, en plein tableau': `### Bloquant\n${pointTable}${one}| B1. Ancien | Point | c |\n|---|---|---|\n${two}`,
      'RD11, après une ligne vide': `### Bloquant\n${pointTable}${one}\n| B1. Ancien | Point | Traitement |\n|---|---|---|\n${two}`,
      'RD11, après un commentaire': `### Bloquant\n${pointTable}${one}<!-- note -->\n| B1. Ancien | Point | Traitement |\n|---|---|---|\n${two}`,
    }
    for (const [name, body] of Object.entries(cases)) {
      assert.equal(citing(pointProblems(revueWithBody(body)), /B1\. Ancien/).length, 1, name)
    }
  })

  it('un point bien formé qui contient une cellule « Point », suivi d’un séparateur, est lu comme un point (RD7) [TEC-15 CA-6]', () => {
    const text = revueWithBody(`### Bloquant\n| RB1. x | Point | c |\n|---|---|---|\n| RB2. Deux | \`b.mjs\` | corrigé (abc1234) |\n`)
    assert.equal(citing(pointProblems(text), /\bRB1\b/).length, 1)
  })

  it('un en-tête mal écrit est signalé comme un en-tête non reconnu [TEC-15 CA-6]', () => {
    for (const header of ['| point | Fichier | Traitement |', '| **Point** | Fichier | Traitement |', '| Point | File | Traitement |']) {
      const text = revueWithBody(`### Bloquant\n${header}\n|---|---|---|\n| RB1. Un | \`a.mjs\` | corrigé (abc1234) |\n`)
      assert.equal(citing(pointProblems(text), /en-tête/i).length, 1, header)
    }
  })

  it('un revue.md aux sections « ## Tour » (antérieur à FEAT-7) n’est pas contrôlé [TEC-15 CA-7]', () => {
    const text = revueOf([
      { title: 'Tour 1', blocking: [['B1. Ancien format', '`a.mjs`', '']], discuss: [['1. Numéro seul', '`b.mjs`', '']] },
      { title: 'Tour 2', blocking: [['B1. Ancien format', '`a.mjs`', 'À corriger']] },
    ])
    assert.deepEqual(pointProblems(text), [])
    assert.deepEqual(pointProblems(text, { atClose: true }), [])
  })

  it('un revue.md qui garde une section « ## Tour » échappe au contrôle, même avec d’autres sections (RD5, spec §4) [TEC-15 CA-7]', () => {
    const text = revueOf([
      { title: 'Tour 1', blocking: [['B1. Ancien format', '`a.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : 2026-11-22', blocking: [['B2. Nouveau', '`b.mjs`', '']] },
    ])
    assert.deepEqual(pointProblems(text), [])
  })

  it('un revue.md aux autres sections, sans aucun RB/RD mais avec des points B1., est contrôlé [TEC-15 CA-7]', () => {
    const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['B1. Ancien format', '`a.mjs`', 'corrigé (abc1234)']], discuss: [['D1. Autre', '`b.mjs`', 'écarté : doublon']] }])
    const problems = pointProblems(text)
    assert.equal(citing(problems, /B1\. Ancien format/).length, 1)
    assert.equal(citing(problems, /D1\. Autre/).length, 1)
  })

  it('un RD requalifié en RB, puis traité sous son nouvel identifiant, ne laisse aucun problème [TEC-15 CA-13]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] },
    ])
    assert.deepEqual(pointProblems(text), [])
    assert.deepEqual(pointProblems(text, { atClose: true }), [])
  })

  it('un RB dans le tableau « À discuter » ou un RD dans le tableau « Bloquant » est signalé [TEC-15 CA-14]', () => {
    const text = revueOf([{
      title: 'Revue : 2026-11-21',
      blocking: [['RD1. Mal rangé', '`a.mjs`', 'corrigé (abc1234)']],
      discuss: [['RB1. Mal rangé aussi', '`b.mjs`', 'corrigé (abc1234)']],
    }])
    const problems = pointProblems(text)
    assert.equal(citing(problems, /\bRD1\b/).length, 1)
    assert.equal(citing(problems, /\bRB1\b/).length, 1)
  })

  it('un point reporté à une tranche est accepté à l’enregistrement de la revue, refusé à la clôture [TEC-15 CA-16]', () => {
    const text = revueOf([{
      title: 'Revue : tranche 1 : 2026-11-21',
      discuss: [['RD1. Reporté en tranche', '`a.mjs`', 'Reporté (tranche 2) : avec CA-6'], ['RD2. Reporté ailleurs', '`b.mjs`', 'reporté (FIX-12)']],
    }])
    assert.deepEqual(pointProblems(text), [])
    const atClose = pointProblems(text, { atClose: true })
    assert.equal(atClose.length, 1)
    assert.match(atClose[0], /\bRD1\b/)
  })

  it('un point reporté à une tranche puis traité dans une revue suivante n’est pas refusé à la clôture [TEC-15 CA-16]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD1. Reporté', '`a.mjs`', 'reporté (tranche 2)']] },
      { title: 'Revue : tranche 2 : 2026-11-22', discuss: [['RD1 (repris). Reporté', '`a.mjs`', 'corrigé (abc1234)']] },
    ])
    assert.deepEqual(pointProblems(text, { atClose: true }), [])
  })

  it('un titre ### proche de « Bloquant » ou « À discuter » est signalé [TEC-15 CA-17]', () => {
    for (const title of ['Bloquants', 'bloquant', 'A discuter', 'À discuter :', '**Bloquant**']) {
      const text = revueWithBody(`### ${title}\n${pointTable}| RB1. Un | \`a.mjs\` | corrigé (abc1234) |\n`)
      assert.equal(citing(pointProblems(text), new RegExp(title.replace(/[*]/g, '\\$&'))).length, 1, title)
    }
  })

  it('une ligne de point hors d’un tableau de points est signalée, une phrase qui cite un point ne l’est pas [TEC-15 CA-17]', () => {
    const text = `${revueOf([{ title: 'Revue : 2026-11-21', discuss: [['RD1. Un', '`a.mjs`', 'corrigé (abc1234)']] }])}\n- RD1 corrigé, voir plus haut.\n\n### Contrôles\n${pointTable}| RB1. Perdu | \`x\` | corrigé (abc1234) |\n`
    const problems = pointProblems(text)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /\bRB1\b/)
  })

  it('un identifiant repris deux fois dans une même section est signalé (OB2) [TEC-15 CA-5]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Premier', '`a.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB1 (repris). Premier', '`a.mjs`', ''], ['RB1 (repris). Premier', '`a.mjs`', 'corrigé (def5678)']] },
    ])
    const problems = citing(pointProblems(text), /\bRB1\b/)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /Revue : tranche 1 : 2026-11-22/)
  })

  it('un report à une tranche écrit librement est aussi refusé à la clôture (OD12) [TEC-15 CA-16]', () => {
    for (const treatment of ['reporté en tranche 3', 'Reporté (tranche 2, avec CA-6)']) {
      const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD1. Reporté', '`a.mjs`', treatment]] }])
      assert.deepEqual(pointProblems(text), [], treatment)
      assert.equal(citing(pointProblems(text, { atClose: true }), /\bRD1\b/).length, 1, treatment)
    }
  })

  it('un report à une tranche accordé au féminin est aussi refusé à la clôture [TEC-15 CA-16]', () => {
    for (const treatment of ['Reportée (tranche 2)', 'reportée en tranche 3']) {
      const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD1. Reporté', '`a.mjs`', treatment]] }])
      assert.deepEqual(pointProblems(text), [], treatment)
      assert.equal(citing(pointProblems(text, { atClose: true }), /\bRD1\b/).length, 1, treatment)
    }
  })

  it('un point requalifié vers un identifiant qui ne le reprend jamais (ex-) est signalé [TEC-15 CA-18]', () => {
    const alone = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] }])
    const withoutEx = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4. Autre chose', '`b.mjs`', 'corrigé (abc1234)']] },
    ])
    for (const [name, text] of Object.entries({ alone, withoutEx })) {
      assert.equal(citing(pointProblems(text), /\bRD3\b/).length, 1, name)
    }
  })

  it('un point marqué repris sans occurrence plus haut est signalé [TEC-15 CA-18]', () => {
    const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB7 (repris). Jamais présenté', '`a.mjs`', 'corrigé (abc1234)']] }])
    const problems = pointProblems(text)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /\bRB7\b/)
  })

  it('un point ex-RD3 sans RD3 plus haut est signalé [TEC-15 CA-18]', () => {
    const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] }])
    const problems = pointProblems(text)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /\bRB4\b/)
    assert.match(problems[0], /\bRD3\b/)
  })

  it('dans une même section, la requalification est reprise même si le tableau Bloquant précède (OD19) [TEC-15 CA-18]', () => {
    const text = revueOf([{
      title: 'Revue : tranche 1 : 2026-11-21',
      blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']],
      discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']],
    }])
    assert.deepEqual(pointProblems(text), [])
  })

  it('entre sections, l’ordre compte : ex- et repris avant le point d’origine sont signalés (OD22) [TEC-15 CA-18]', () => {
    const exBefore = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] },
    ])
    const exProblems = pointProblems(exBefore)
    assert.equal(citing(exProblems, /^RB4 \(ex-RD3\)/).length, 1)
    assert.equal(citing(exProblems, /^RD3\b/).length, 1)
    const reprisBefore = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB7 (repris). Push', '`a.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB7. Push', '`a.mjs`', 'corrigé (def5678)']] },
    ])
    assert.equal(citing(pointProblems(reprisBefore), /\bRB7\b/).length, 1)
  })

  it('une reprise qui renvoie à un autre point (RB4 ex-RD9) ne ferme pas la requalification de RD3 (OD22) [TEC-15 CA-18]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)'], ['RD9. Autre', '`b.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4 (ex-RD9). Autre', '`b.mjs`', 'corrigé (abc1234)']] },
    ])
    const problems = pointProblems(text)
    assert.equal(citing(problems, /^RD3\b/).length, 1)
    assert.deepEqual(citing(problems, /^RD9\b/), [])
  })

  it('un requalifié sans identifiant est signalé ; un identifiant suivi d’un commentaire est lu (OD20) [TEC-15 CA-18]', () => {
    const withoutId = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié en bloquant']] }])
    assert.equal(citing(pointProblems(withoutId), /^RD3\b/).length, 1)
    const withComment = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4, plus grave)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] },
    ])
    assert.deepEqual(pointProblems(withComment), [])
  })
})

describe('TEC-15 numbering the review points', () => {
  const noFiles = { revue: null, spec: null, decisions: null }
  const allOnes = { RB: 1, RD: 1, SB: 1, SD: 1, OB: 1, OD: 1 }

  it('le prochain numéro suit le plus grand de chaque série, toutes sections confondues [TEC-15 CA-1]', () => {
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Un', '`a.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Un', '`a.mjs`', 'écarté : doublon'], ['RD7. Sept', '`b.mjs`', 'écarté : doublon']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB3. Trois', '`c.mjs`', 'corrigé (def5678)']], discuss: [['RD2. Deux', '`d.mjs`', 'écarté : doublon']] },
    ])
    const { next } = core.nextReviewIds({ ...noFiles, revue })
    assert.equal(next.RB, 4)
    assert.equal(next.RD, 8)
  })

  it('un identifiant cité seulement dans une référence ex- compte aussi [TEC-15 CA-1]', () => {
    const revue = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB2 (ex-RD9). Requalifié', '`a.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Un', '`b.mjs`', 'écarté : doublon']] }])
    const { next } = core.nextReviewIds({ ...noFiles, revue })
    assert.equal(next.RB, 3)
    assert.equal(next.RD, 10)
  })

  it('sans aucun fichier, tous les numéros sont à 1 et aucun point n’est ouvert [TEC-15 CA-2]', () => {
    assert.deepEqual(core.nextReviewIds(noFiles), { next: allOnes, open: [] })
  })

  it('un revue.md sans point donne RB1 et RD1, sans point ouvert [TEC-15 CA-2]', () => {
    for (const revue of [revueOf([{ title: 'Revue : tranche 1 : 2026-11-21' }]), revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['Aucun', '', '']], discuss: [['aucun.', '', '']] }])]) {
      assert.deepEqual(core.nextReviewIds({ ...noFiles, revue }), { next: allOnes, open: [] })
    }
  })

  it('le prochain RD tient compte d’un RD requalifié, le prochain RB du RB qui le reprend [TEC-15 CA-13]', () => {
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] },
    ])
    const { next, open } = core.nextReviewIds({ ...noFiles, revue })
    assert.equal(next.RD, 4)
    assert.equal(next.RB, 5)
    assert.deepEqual(open, [])
  })

  it('SB, SD, OB, OD suivent le plus grand numéro cité dans spec.md et decisions.md [TEC-15 CA-10]', () => {
    const spec = '---\nid: TEC-30\n---\n\n# TEC-30\n\nAmendement : SD2 retenu, OD3 écarté. Mot collé : XSB9.\n'
    const decisions = '# Décisions\n\n- OB1 accepté.\n- OD5 reporté.\n- SD1 écarté.\n'
    const { next } = core.nextReviewIds({ revue: null, spec, decisions })
    assert.deepEqual(next, { RB: 1, RD: 1, SB: 1, SD: 3, OB: 2, OD: 6 })
  })

  it('les points ouverts sont ceux dont la dernière occurrence n’a pas de traitement, avec leur intitulé et leur section [TEC-15 CA-10]', () => {
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Premier', '`a.mjs`', ''], ['RB2. Second', '`b.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Discuté', '`c.mjs`', 'À corriger au build']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB1 (repris). Premier', '`a.mjs`', 'corrigé (def5678)'], ['RB2 (repris). Second encore', '`b.mjs`', '']] },
    ])
    assert.deepEqual(core.nextReviewIds({ ...noFiles, revue }).open, [
      { id: 'RD1', title: 'Discuté', section: 'Revue : tranche 1 : 2026-11-21' },
      { id: 'RB2', title: 'Second encore', section: 'Revue : tranche 2 : 2026-11-22' },
    ])
  })

  it('atelier review-ids --json lit revue.md, spec.md et decisions.md du chantier actif [TEC-15 CA-10]', () => {
    const directory = makeRepository('main')
    git(directory, 'switch', '-q', '-c', 'tec/TEC-30-x')
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Un', '`a.mjs`', 'corrigé (abc1234)'], ['RB2. Deux', '`b.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Un', '`c.mjs`', 'écarté : doublon']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB2 (repris). Deux', '`b.mjs`', '']] },
    ])
    writeChantier(directory, {
      id: 'TEC-30',
      body: `${completeBodies.TEC}\n## Amendements\n- 2026-11-21 : précisé (SD2 de la relecture de spec)\n`,
      files: { 'revue.md': revue, 'decisions.md': '# Décisions\n\n- OB1 accepté : coût.\n' },
    })
    git(directory, 'add', '-A')
    commit(directory, 'docs(chantiers): [TEC-30] spec')
    assert.deepEqual(JSON.parse(atelierOk(directory, 'review-ids', '--json')), {
      next: { RB: 3, RD: 2, SB: 1, SD: 3, OB: 2, OD: 1 },
      open: [{ id: 'RB2', title: 'Deux', section: 'Revue : tranche 2 : 2026-11-22' }],
    })
  })
})

describe('TEC-15 refusing open review points in the CLI', () => {
  const revuePath = (directory) => join(chantierDirectoryOf(directory, 'FEAT-20'), 'revue.md')
  const openPoint = revueOf([{ title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB1. Push non vérifié', '`src/now.mjs`', '']], discuss: [['RD1. Nom peu clair', '`src/now.mjs`', 'écarté : convention du projet']] }])
  const allTreated = revueOf([{ title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB1. Push non vérifié', '`src/now.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Nom peu clair', '`src/now.mjs`', 'écarté : convention du projet']] }])
  const postponed = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Push non vérifié', '`src/now.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Message d’erreur vague', '`src/now.mjs`', 'reporté (tranche 2)']] }])

  // Code and revue.md committed, then the review recorded at that commit (spec committed after it).
  function reviewedWithRevue(revue) {
    const directory = makeSlicedRepository({ tdd: 'no' })
    commitFiles(directory, { 'src/a.mjs': 'code\n', [path.relative(directory, revuePath(directory))]: revue }, 'feat: a')
    setHeader(directory, 'FEAT-20', { slice: 'chantier', last_slice: '3', reviewed_commit: headOf(directory) })
    return directory
  }

  for (const [label, options] of [['revue de tranche', { slice: 2 }], ['revue du chantier', { slice: 'chantier', extra: { last_slice: '3' } }]]) {
    it(`set-reviewed refuse un point ouvert de la copie de travail de revue.md (${label}), sans rien écrire dans la spec [TEC-15 CA-8]`, () => {
      const { directory } = implementedSlice(options)
      writeFileSync(revuePath(directory), openPoint)
      const before = specFileText(directory, 'FEAT-20')
      const { status, output } = atelierRun(directory, 'set-reviewed')
      assert.notEqual(status, 0, output)
      assert.match(output, /RB1\b.*Push non vérifié/)
      assert.doesNotMatch(output, /RD1\b/, 'un point traité n’est pas listé')
      assert.equal(specFileText(directory, 'FEAT-20'), before)
    })
  }

  it('set-reviewed enregistre la revue quand tous les points de la copie de travail sont traités [TEC-15 CA-8]', () => {
    const { directory } = implementedSlice({ slice: 2 })
    writeFileSync(revuePath(directory), allTreated)
    atelierOk(directory, 'set-reviewed')
    assert.equal(specData(directory, 'FEAT-20').slice, '3')
  })

  for (const command of [['close-check'], ['set-status', 'done']]) {
    it(`${command.join(' ')} refuse la clôture avec un point ouvert dans un revue.md commité [TEC-15 CA-9]`, () => {
      const directory = reviewedWithRevue(openPoint)
      const before = specFileText(directory, 'FEAT-20')
      const { status, output } = atelierRun(directory, ...command)
      assert.notEqual(status, 0, output)
      assert.match(output, /RB1\b.*Push non vérifié/)
      assert.equal(specFileText(directory, 'FEAT-20'), before)
    })

    it(`${command.join(' ')} refuse la clôture quand revue.md a des modifications non commitées [TEC-15 CA-9]`, () => {
      const directory = reviewedWithRevue(allTreated)
      writeFileSync(revuePath(directory), `${allTreated}\n- Note ajoutée après coup.\n`)
      const { status, output } = atelierRun(directory, ...command)
      assert.notEqual(status, 0, output)
      assert.match(output, /revue\.md/)
    })
  }

  it('close-check accepte la clôture avec un revue.md commité dont tous les points sont traités [TEC-15 CA-9]', () => {
    const { status, output } = atelierRun(reviewedWithRevue(allTreated), 'close-check')
    assert.equal(status, 0, output)
  })

  it('un point reporté (tranche 2) ne bloque pas set-reviewed [TEC-15 CA-16]', () => {
    const { directory } = implementedSlice({ slice: 2 })
    writeFileSync(revuePath(directory), postponed)
    atelierOk(directory, 'set-reviewed')
    assert.equal(specData(directory, 'FEAT-20').slice, '3')
  })

  it('un point dont la dernière occurrence est reporté (tranche 2) bloque la clôture et est listé [TEC-15 CA-16]', () => {
    const { status, output } = atelierRun(reviewedWithRevue(postponed), 'close-check')
    assert.notEqual(status, 0, output)
    assert.match(output, /RD1\b.*Message d’erreur vague/)
  })
})

describe('TEC-15 prefixes in agents, skills and templates', () => {
  const pluginText = (relativePath) => readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8')
  const mentions = (text, prefix) => new RegExp(`\\b${prefix}(\\d+)?\\b`).test(text)
  const expectedPrefixes = {
    'agents/reviewer.md': ['RB', 'RD'],
    'agents/spec-critic.md': ['SB', 'SD'],
    'agents/overfit-checker.md': ['OB', 'OD'],
    'skills/review/SKILL.md': ['RB', 'RD'],
    'skills/sign/SKILL.md': ['SB', 'SD'],
    'skills/build/SKILL.md': ['OB', 'OD'],
    'skills/close/SKILL.md': ['RB', 'RD'],
    'templates/revue.md': ['RB', 'RD'],
    'templates/bilan.md': ['RB', 'RD'],
  }

  for (const [file, prefixes] of Object.entries(expectedPrefixes)) {
    it(`${file} mentionne ${prefixes.join(' et ')} [TEC-15 CA-11]`, () => {
      const text = pluginText(file)
      assert.deepEqual(prefixes.filter((prefix) => !mentions(text, prefix)), [])
    })
  }

  it('la skill amend cite un identifiant de point de relecture [TEC-15 CA-11]', () => {
    assert.ok(['RB', 'RD', 'SB', 'SD', 'OB', 'OD'].some((prefix) => mentions(pluginText('skills/amend/SKILL.md'), prefix)))
  })

  for (const file of ['skills/review/SKILL.md', 'skills/sign/SKILL.md', 'skills/build/SKILL.md']) {
    it(`${file} obtient les numéros par atelier review-ids [TEC-15 CA-11]`, () => {
      assert.match(pluginText(file), /atelier review-ids/)
    })
  }

  for (const file of ['templates/revue.md', 'agents/reviewer.md', 'skills/review/SKILL.md']) {
    it(`${file} donne la forme (repris), (ex-…) et les traitements reporté et requalifié [TEC-15 CA-11]`, () => {
      const text = pluginText(file)
      assert.match(text, /\(repris\)/)
      assert.match(text, /\(ex-R[BD]\d+\)/)
      assert.match(text, /reporté/i)
      assert.match(text, /requalifié/i)
    })
  }
})

describe('TEC-15 site reference pages', () => {
  const site = (relativePath) => readFileSync(fileURLToPath(new URL(`../../../site/${relativePath}`, import.meta.url)), 'utf8')
  // The table row whose first cell starts with `start` (a command or a glossary term).
  const row = (text, start) => text.split(/\r?\n/).find((line) => line.startsWith(`| ${start}`)) ?? ''

  it('la page des commandes documente review-ids et le refus de set-reviewed et close-check sur un point ouvert [TEC-15 CA-19]', () => {
    const commands = site('reference/commandes.md')
    const reviewIds = row(commands, '`atelier review-ids')
    for (const prefix of ['RB', 'RD', 'SB', 'SD', 'OB', 'OD']) {
      assert.match(reviewIds, new RegExp(`\\b${prefix}\\d*\\b`), `${prefix} absent de la ligne review-ids`)
    }
    assert.match(reviewIds, /ouverts?/)
    assert.match(row(commands, '`atelier set-reviewed`'), /points?[^|]*(ouverts?|sans traitement)/i)
    assert.match(row(commands, '`atelier close-check`'), /points?[^|]*(ouverts?|sans traitement)/i)
  })

  it('le glossaire définit le point de relecture, ses six préfixes et le traitement [TEC-15 CA-19]', () => {
    const glossary = site('reference/glossaire.md')
    const point = row(glossary, '**Point de relecture**')
    for (const prefix of ['RB', 'RD', 'SB', 'SD', 'OB', 'OD']) {
      assert.match(point, new RegExp(`\\b${prefix}\\d*\\b`), `${prefix} absent de la définition du point de relecture`)
    }
    const treatment = row(glossary, '**Traitement**')
    for (const keyword of ['corrigé', 'écarté', 'reporté', 'requalifié']) {
      assert.match(treatment, new RegExp(keyword), `${keyword} absent de la définition du traitement`)
    }
  })
})

describe('TEC-23 checks run once per working tree', () => {
  const treated = revueOf([{ title: 'Revue : chantier : 2026-11-23', blocking: [['RB1. Push non vérifié', '`src/a.mjs`', 'corrigé (abc1234)']] }])
  const open = revueOf([{ title: 'Revue : chantier : 2026-11-23', blocking: [['RB1. Push non vérifié', '`src/a.mjs`', '']] }])

  // A signed chantier ready to close (code, revue.md and the configuration committed, then the
  // review recorded at that commit), whose only check counts its runs in a file outside the repository.
  function closableRepository({ revue = treated, fails = false } = {}) {
    const counter = join(temporaryDirectory('atelier-tec23-count-'), 'runs').replace(/\\/g, '/')
    const script = `require('fs').appendFileSync('${counter}', 'x')${fails ? ';process.exit(1)' : ''}`
    const directory = makeSlicedRepository({ tdd: 'no' })
    const revuePath = path.relative(directory, join(chantierDirectoryOf(directory, 'FEAT-20'), 'revue.md'))
    commitFiles(directory, {
      '.claude/atelier.json': JSON.stringify({ chantiersDir: 'docs/chantiers', checks: [{ name: 'compteur', command: `node -e "${script}"` }] }),
      'src/a.mjs': 'code\n',
      [revuePath]: revue,
    }, 'feat: a')
    setHeader(directory, 'FEAT-20', { slice: 'chantier', last_slice: '3', reviewed_commit: headOf(directory) })
    const runs = () => {
      try {
        return readFileSync(counter, 'utf8').length
      } catch {
        return 0
      }
    }
    return { directory, runs }
  }

  function hookGate(directory) {
    const result = spawnSync(process.execPath, [atelierBin, 'hook-gate'], {
      cwd: directory,
      encoding: 'utf8',
      input: JSON.stringify({ cwd: directory }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    })
    return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
  }

  it('le hook de fin de tour ne relance pas les contrôles que checks vient de passer [TEC-23 CA-1]', () => {
    const { directory, runs } = closableRepository()
    writeFileSync(join(directory, 'src', 'b.mjs'), 'code non commité\n')
    atelierOk(directory, 'checks')
    assert.equal(runs(), 1)
    const { status, output } = hookGate(directory)
    assert.equal(status, 0, output)
    assert.equal(runs(), 1, 'le hook réutilise le vert de checks')
  })

  it('checks ne relance pas des contrôles déjà verts sur cet état du code, et le dit [TEC-23 CA-2]', () => {
    const { directory, runs } = closableRepository()
    atelierOk(directory, 'checks')
    const output = atelierOk(directory, 'checks')
    assert.equal(runs(), 1)
    assert.match(output, /déjà verts?/i)
  })

  it('checks réutilise le vert enregistré par le hook de fin de tour [TEC-23 CA-2]', () => {
    const { directory, runs } = closableRepository()
    writeFileSync(join(directory, 'src', 'b.mjs'), 'code non commité\n')
    assert.equal(hookGate(directory).status, 0)
    assert.equal(runs(), 1)
    atelierOk(directory, 'checks')
    assert.equal(runs(), 1)
  })

  for (const command of [['checks'], ['close-check'], ['set-status', 'done']]) {
    it(`${command.join(' ')} relance les contrôles quand un fichier a changé depuis le dernier vert [TEC-23 CA-3]`, () => {
      const { directory, runs } = closableRepository()
      atelierOk(directory, 'checks')
      writeFileSync(join(directory, 'docs', 'notes.md'), 'note\n')
      atelierOk(directory, ...command)
      assert.equal(runs(), 2)
    })
  }

  it('set-status done après un close-check réussi ne relance pas les contrôles [TEC-23 CA-4]', () => {
    const { directory, runs } = closableRepository()
    atelierOk(directory, 'close-check')
    assert.equal(runs(), 1)
    atelierOk(directory, 'set-status', 'done')
    assert.equal(runs(), 1)
    assert.equal(specData(directory, 'FEAT-20').status, 'done')
  })

  it('set-status done refait les autres vérifications de clôture même quand les contrôles sont déjà verts [TEC-23 CA-4]', () => {
    const { directory, runs } = closableRepository({ revue: open })
    atelierOk(directory, 'checks')
    const { status, output } = atelierRun(directory, 'set-status', 'done')
    assert.notEqual(status, 0, output)
    assert.match(output, /RB1\b.*Push non vérifié/)
    assert.equal(runs(), 1)
    assert.equal(specData(directory, 'FEAT-20').status, 'signed')
  })

  it('checks --force relance des contrôles déjà verts [TEC-23 CA-5]', () => {
    const { directory, runs } = closableRepository()
    atelierOk(directory, 'checks')
    atelierOk(directory, 'checks', '--force')
    assert.equal(runs(), 2)
  })

  it('un échec n’est pas mémorisé, checks relance les contrôles [TEC-23 CA-6]', () => {
    const { directory, runs } = closableRepository({ fails: true })
    assert.notEqual(atelierRun(directory, 'checks').status, 0)
    assert.notEqual(atelierRun(directory, 'checks').status, 0)
    assert.equal(runs(), 2)
  })

  it('sans empreinte calculable, les contrôles sont lancés comme aujourd’hui [TEC-23 CA-7]', () => {
    const { directory, runs } = closableRepository()
    writeFileSync(join(directory, '.atelier'), 'un fichier à la place du dossier\n')
    atelierOk(directory, 'checks')
    atelierOk(directory, 'checks')
    assert.equal(runs(), 2)
    atelierOk(directory, 'close-check')
    assert.equal(runs(), 3)
  })
})
