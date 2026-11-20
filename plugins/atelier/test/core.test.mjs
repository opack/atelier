import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path, { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_CONFIG,
  amendmentsDiffer,
  appendAmendmentEntry,
  applyToolEdit,
  checkSpec,
  chantierIdFromText,
  closeProblems,
  decideStop,
  decideWrite,
  highestChantierNumber,
  isRefreeze,
  matchesAny,
  nextChantierId,
  nextStep,
  parseAmendments,
  parseFrontMatter,
  parsePorcelainPaths,
  refreezeTestsEntry,
  reopenTestsEntry,
  reopenTestsRefusal,
  reviewCodeFiles,
  reviewProblems,
  reviewState,
  setFrontMatterValues,
  setReviewedRefusal,
  setStatusRefusal,
  testDrivenPhase,
  toProjectRelativePath,
} from '../lib/core.mjs'

const templatesDirectory = fileURLToPath(new URL('../templates/', import.meta.url))

function template(name) {
  return readFileSync(join(templatesDirectory, `${name}.md`), 'utf8')
    .replaceAll('{{ID}}', 'FEAT-12')
    .replaceAll('{{TITLE}}', 'Titre')
    .replaceAll('{{DATE}}', '2026-11-09')
}

const signedChantier = { id: 'FEAT-12', directory: '/p/docs/chantiers/FEAT-12-x', spec: { data: { status: 'signed', type: 'FEAT', tdd: 'yes' } }, files: ['spec.md'] }
const draftChantier = { ...signedChantier, spec: { data: { status: 'draft', type: 'FEAT', tdd: 'yes' } } }
const implementingChantier = { ...signedChantier, spec: { data: { status: 'signed', type: 'FEAT', tdd: 'yes', tests_commit: 'abc1234' } } }
const signedTec = { ...signedChantier, id: 'TEC-3', spec: { data: { status: 'signed', type: 'TEC', tdd: 'no' } } }

function decide(overrides) {
  return decideWrite({ relativePath: 'src/app.ts', toolName: 'Edit', config: DEFAULT_CONFIG, chantier: signedChantier, bypass: null, existingSpec: null, ...overrides })
}

describe('chantier identifiers', () => {
  it('extracts the chantier id from a branch name', () => {
    assert.equal(chantierIdFromText('fix/FIX-431-ca9-reconnect'), 'FIX-431')
    assert.equal(chantierIdFromText('feat/feat-12-budget'), 'FEAT-12')
    assert.equal(chantierIdFromText('main'), null)
  })

  it('continues the shared counter, legacy prefixes included', () => {
    const used = ['FEAT-3-x', 'FEAT(ENVELOPES): [FEA-26] ADD', 'FIX(CI): [TEC-437] BUMP', '[BUG-421] FIX']
    assert.equal(highestChantierNumber(used), 437)
    assert.equal(nextChantierId('fix', used), 'FIX-438')
  })

  it('starts at 1 on an empty project and rejects unknown types', () => {
    assert.equal(nextChantierId('TEC', []), 'TEC-1')
    assert.throws(() => nextChantierId('CHORE', []))
  })
})

describe('front matter', () => {
  it('parses values and ignores trailing comments', () => {
    const { data, body } = parseFrontMatter('---\nid: FEAT-1\nstatus: draft # comment\nsigned_by:\n---\n# Body')
    assert.deepEqual(data, { id: 'FEAT-1', status: 'draft', signed_by: '' })
    assert.equal(body, '# Body')
  })

  it('updates existing keys and appends missing ones without touching the body', () => {
    const updated = setFrontMatterValues('---\nid: FEAT-1\nstatus: draft\n---\n# Body\n', { status: 'signed', signed_at: '2026-11-09' })
    assert.equal(updated, '---\nid: FEAT-1\nstatus: signed\nsigned_at: 2026-11-09\n---\n# Body\n')
  })
})

describe('spec completeness', () => {
  it('reports every required section of an untouched template as empty', () => {
    const problems = checkSpec(template('spec-feat'))
    assert.ok(problems.some((problem) => problem.includes('Contexte')))
    assert.ok(problems.some((problem) => problem.includes("Critères d'acceptation")))
    assert.ok(problems.some((problem) => problem.includes('Non-fonctionnel')))
  })

  it('accepts a complete spec', () => {
    const spec = template('spec-feat')
      .replace('## 2. Description', 'Les utilisateurs perdent du temps.\n\n## 2. Description')
      .replace('## 3. Points', 'Afficher le total.\n\n## 3. Points')
      .replace('## 6. Non-fonctionnel', '- [ ] CA-1 : Étant donné un budget, quand je l’ouvre, alors je vois le total.\n\n## 6. Non-fonctionnel')
      .replace('- Sécurité / autorisation :', '- Sécurité / autorisation : lecture réservée au propriétaire')
    assert.ok(checkSpec(spec).some((problem) => problem.includes('« tdd »')), 'the TDD decision is mandatory')
    assert.deepEqual(checkSpec(spec.replace(/^tdd:.*$/m, 'tdd: no')), [])
  })

  it('requires numbered criteria and flags unfinished text', () => {
    const spec = template('spec-fix')
      .replace('- Observé :', '- Observé : crash au démarrage')
      .replace('## 3. Cause probable', 'Ouvrir l’app.\n\n## 3. Cause probable')
      .replace('## 4. Solution proposée', 'Listener non nettoyé (trace Sentry).\n\n## 4. Solution proposée')
      .replace('## 5. Critère de non-régression', 'Nettoyer le listener.\n\n## 5. Critère de non-régression')
      .replace('## 6. Notes', 'Le crash ne revient pas, quand …\n\n## 6. Notes')
    const problems = checkSpec(spec)
    assert.ok(problems.some((problem) => problem.includes('aucun critère numéroté')))
    assert.ok(problems.some((problem) => problem.includes('à compléter')))
  })

  it('rejects an unknown type', () => {
    assert.ok(checkSpec('---\nid: X-1\ntype: CHORE\ntitle: t\ntdd: no\n---\n').some((problem) => /type « CHORE » inconnu/.test(problem)))
  })
})

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

describe('project relative paths', () => {
  it('tells files outside the project apart, other drives and case included on Windows', () => {
    assert.equal(toProjectRelativePath('C:\\proj', 'C:\\proj\\src\\a.ts', path.win32), 'src/a.ts')
    assert.equal(toProjectRelativePath('C:\\Proj', 'c:\\proj\\src\\a.ts', path.win32), 'src/a.ts')
    assert.equal(toProjectRelativePath('C:\\proj', 'D:\\proj\\src\\a.ts', path.win32), null)
    assert.equal(toProjectRelativePath('C:\\proj', 'C:\\other\\a.ts', path.win32), null)
    assert.equal(toProjectRelativePath('/proj', '/proj/..cache/a.ts', path.posix), '..cache/a.ts')
  })
})

describe('git output', () => {
  it('reads unquoted paths, non-ASCII and renames included', () => {
    const output = ' M docs/notes/réunion.md\0?? src/a b.ts\0R  src/new.ts\0src/old.ts\0'
    assert.deepEqual(parsePorcelainPaths(output), ['docs/notes/réunion.md', 'src/a b.ts', 'src/new.ts'])
    assert.deepEqual(parsePorcelainPaths(''), [])
  })
})

describe('tool edits', () => {
  it('computes the text after Edit, MultiEdit and Write', () => {
    assert.equal(applyToolEdit('a\r\nb\r\nb', 'Edit', { old_string: 'b', new_string: '$&c' }), 'a\n$&c\nb')
    assert.equal(applyToolEdit('a\nb\nb', 'Edit', { old_string: 'b', new_string: 'c', replace_all: true }), 'a\nc\nc')
    assert.equal(applyToolEdit('a\nb', 'MultiEdit', { edits: [{ old_string: 'a', new_string: 'x' }, { old_string: 'x\nb', new_string: 'y' }] }), 'y')
    assert.equal(applyToolEdit(null, 'Write', { content: 'new' }), 'new')
  })

  it('returns null when the edit cannot apply', () => {
    assert.equal(applyToolEdit('a', 'Edit', { old_string: 'z', new_string: 'y' }), null)
    assert.equal(applyToolEdit(null, 'Edit', { old_string: 'a', new_string: 'y' }), null)
    assert.equal(applyToolEdit('a', 'NotebookEdit', {}), null)
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

describe('path patterns', () => {
  it('matches directory, glob and name patterns', () => {
    assert.ok(matchesAny('docs/a/b.md', ['docs/**']))
    assert.ok(matchesAny('config/.env.local', ['.env.*']))
    assert.ok(matchesAny('src/secrets/token.txt', ['**/secrets/**']))
    assert.ok(!matchesAny('src/environment.ts', ['.env', '.env.*']))
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

describe('amendments section', () => {
  const spec = '---\nid: FEAT-12\n---\n# T\n\n## 1. Contexte\nTexte.\n\n## Amendements\n<!-- Après signature : une entrée datée. -->\n- 2026-11-01 : critère ajouté\n  suite indentée\n\n## Annexe\nFin.\n'

  it('reads dated entries with their continuation lines, comments ignored', () => {
    const { sectionCount, entries, rest } = parseAmendments(spec)
    assert.equal(sectionCount, 1)
    assert.deepEqual(entries, ['- 2026-11-01 : critère ajouté\n  suite indentée'])
    assert.equal(rest, '---\nid: FEAT-12\n---\n# T\n\n## 1. Contexte\nTexte.\n\n## Amendements\n## Annexe\nFin.\n')
  })

  it('counts undated lines of the section as body, and tells duplicate or absent sections apart', () => {
    const undated = parseAmendments('## Amendements\n- hier : oubli\n- 2026-11-01 : ok\n')
    assert.deepEqual(undated.entries, ['- 2026-11-01 : ok'])
    assert.match(undated.rest, /- hier : oubli/)
    assert.equal(parseAmendments('## Amendements\n\n## Amendements\n').sectionCount, 2)
    assert.equal(parseAmendments('## Amendement\n- 2026-11-01 : x\n').sectionCount, 0)
  })

  it('adds an entry at the end of the section, even in the middle of the file', () => {
    const updated = appendAmendmentEntry(spec, '2026-11-20 : tests regelés : abc1234')
    assert.equal(updated, spec.replace('  suite indentée\n', '  suite indentée\n- 2026-11-20 : tests regelés : abc1234\n'))
    assert.equal(
      appendAmendmentEntry('# T\r\n\r\n## Amendements\r\n<!-- x -->\r\n', '2026-11-20 : y'),
      '# T\r\n\r\n## Amendements\r\n<!-- x -->\r\n- 2026-11-20 : y\r\n',
      'line endings kept',
    )
  })

  it('creates the section when it is missing', () => {
    assert.equal(appendAmendmentEntry('# T\n\n## 1. Quoi\nX.\n\n', '2026-11-20 : y'), '# T\n\n## 1. Quoi\nX.\n\n## Amendements\n- 2026-11-20 : y\n')
  })

  it('writes entries with fixed labels', () => {
    assert.equal(reopenTestsEntry('2026-11-20', 'abc1234', 'cas oublié'), '2026-11-20 : tests rouverts (gel quitté : abc1234) : cas oublié')
    assert.equal(refreezeTestsEntry('2026-11-20', 'def5678'), '2026-11-20 : tests regelés : def5678')
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
