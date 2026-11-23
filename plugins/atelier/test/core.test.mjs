import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_CONFIG,
  activeChantier,
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
import * as core from '../lib/core.mjs'

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
    ['V-1 draft: full rewrite', draftText, 'Write', { content: draftText.replace('Texte initial.', 'Tout réécrit.') }, true],
    ['V-1 draft: body edit', draftText, 'Edit', body, true],
    ['V-1 draft: tdd and title edits', draftText, 'MultiEdit', { edits: [{ old_string: 'tdd: no', new_string: 'tdd: yes' }, { old_string: 'title: Brouillon', new_string: 'title: Autre' }] }, true],
    ...reserved.map(([field, from, to]) => [`V-1 draft: reserved field ${field}`, draftText, 'Edit', { old_string: from, new_string: to }, false]),
    ['V-2 signed, not committed: full rewrite', signedText, 'Write', { content: signedText }, false],
    ['V-2 signed, not committed: body edit without entry', signedText, 'Edit', body, false],
    ['V-2 signed, not committed: body edit with a new entry', signedText, 'MultiEdit', { edits: [entry, body] }, true],
    ['V-2 signed, not committed: back to draft', signedText, 'MultiEdit', { edits: [entry, { old_string: 'status: signed', new_string: 'status: draft' }] }, false],
  ]

  for (const [label, current, toolName, input, expected] of cases) {
    it(label, () => {
      const withDraft = write(current, draftText, toolName, input)
      assert.equal(withDraft.allowed, expected, 'committed draft')
      assert.deepEqual(withDraft, write(current, null, toolName, input), 'V-3: same decision as with no committed spec')
    })
  }

  it('V-2/V-3 takes the signed working version as reference, not an older committed draft', () => {
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

// ---------- TEC-6: chantier deduced from the branch's own commits ----------

describe('chantier id from commit subjects', () => {
  it('V-1 : rend l’identifiant du commit le plus récent qui en porte un', () => {
    assert.equal(
      core.chantierIdFromCommitSubjects(['wip', 'docs(chantiers): [TEC-5] spec draft', 'docs(chantiers): [TEC-4] spec draft']),
      'TEC-5',
    )
  })

  it('V-2 : crochets obligatoires, casse ignorée, type inconnu ignoré, liste vide', () => {
    assert.equal(core.chantierIdFromCommitSubjects(['merge after FEAT-4']), null)
    assert.equal(core.chantierIdFromCommitSubjects(['fix(x): [feat-12] typo']), 'FEAT-12')
    assert.equal(core.chantierIdFromCommitSubjects(['chore: [JIRA-3] bump']), null)
    assert.equal(core.chantierIdFromCommitSubjects(['chore: [JIRA-3] bump', 'docs: [SPIKE-2] notes']), 'SPIKE-2')
    assert.equal(core.chantierIdFromCommitSubjects([]), null)
  })
})

const atelierBin = fileURLToPath(new URL('../bin/atelier', import.meta.url))
const gitIdentity = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false']

const temporaryDirectories = []
after(() => temporaryDirectories.forEach((directory) => rmSync(directory, { recursive: true, force: true })))

function temporaryDirectory(prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

function git(directory, ...gitArguments) {
  return execFileSync('git', [...gitIdentity, ...gitArguments], { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function commit(directory, subject) {
  git(directory, 'commit', '--allow-empty', '-q', '-m', subject)
}

// A repository with atelier installed and a first commit on `defaultBranch`.
function makeRepository(defaultBranch = 'main') {
  const directory = temporaryDirectory('atelier-tec6-')
  git(directory, 'init', '-q', '-b', defaultBranch)
  mkdirSync(join(directory, '.claude'))
  writeFileSync(join(directory, '.claude', 'atelier.json'), JSON.stringify({ chantiersDir: 'docs/chantiers' }))
  git(directory, 'add', '.')
  commit(directory, 'chore: init')
  return directory
}

function addChantierSpec(directory, id, slug) {
  const chantierDirectory = join(directory, 'docs', 'chantiers', `${id}-${slug}`)
  mkdirSync(chantierDirectory, { recursive: true })
  writeFileSync(join(chantierDirectory, 'spec.md'), `---\nid: ${id}\ntype: TEC\ntitle: Essai ${id}\nstatus: draft\ntdd: yes\n---\n\n# ${id}\n`)
  git(directory, 'add', '.')
  commit(directory, `docs(chantiers): [${id}] spec draft`)
}

function atelier(directory, ...cliArguments) {
  return execFileSync(process.execPath, [atelierBin, ...cliArguments], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// main ← claude/x (commit [TEC-9] + its chantier folder) ← tec/TEC-8-y (no own commit)
function makeDeductionRepository() {
  const directory = makeRepository('main')
  git(directory, 'switch', '-q', '-c', 'claude/x')
  addChantierSpec(directory, 'TEC-9', 'x')
  git(directory, 'branch', 'tec/TEC-8-y')
  return directory
}

describe('active chantier deduced from commits', () => {
  const config = { ...DEFAULT_CONFIG, chantiersDir: 'docs/chantiers' }

  it('V-3 : sur une branche non conforme, déduit le chantier du commit [<ID>]', () => {
    const directory = makeDeductionRepository()
    const { branch, chantier, source } = activeChantier(directory, config)
    assert.equal(branch, 'claude/x')
    assert.equal(chantier?.id, 'TEC-9')
    assert.ok(chantier.directory, 'le dossier du chantier déduit est trouvé')
    assert.equal(chantier.spec?.data.status, 'draft')
    assert.equal(source, 'commits')
  })

  it('V-3 : sur la branche par défaut, aucun chantier', () => {
    const directory = makeDeductionRepository()
    git(directory, 'switch', '-q', 'main')
    const { chantier, source } = activeChantier(directory, config)
    assert.equal(chantier, null)
    assert.equal(source, null)
  })

  it('V-3 : le nom de branche reste prioritaire sur les commits', () => {
    const directory = makeDeductionRepository()
    git(directory, 'switch', '-q', 'tec/TEC-8-y')
    const { chantier, source } = activeChantier(directory, config)
    assert.equal(chantier?.id, 'TEC-8')
    assert.equal(source, 'branch')
  })

  it('V-4 : sans branche par défaut identifiable, aucun chantier et aucune erreur', () => {
    const directory = makeRepository('trunk')
    git(directory, 'switch', '-q', '-c', 'claude/x')
    addChantierSpec(directory, 'TEC-9', 'x')
    const { branch, chantier, source } = activeChantier(directory, config)
    assert.equal(branch, 'claude/x')
    assert.equal(chantier, null)
    assert.equal(source, null)
  })

  it('V-4 : HEAD détachée, aucun chantier déduit', () => {
    const directory = makeDeductionRepository()
    git(directory, 'switch', '-q', '--detach', 'claude/x')
    const { chantier } = activeChantier(directory, config)
    assert.equal(chantier, null)
  })

  it('V-5 : un main local en avance sur origin/main n’a pas de chantier actif', () => {
    const origin = temporaryDirectory('atelier-tec6-origin-')
    git(origin, 'init', '-q', '--bare', '-b', 'main')
    const directory = makeRepository('main')
    git(directory, 'remote', 'add', 'origin', origin)
    git(directory, 'push', '-q', 'origin', 'main')
    git(directory, 'fetch', '-q', 'origin')
    addChantierSpec(directory, 'TEC-9', 'x')
    // Without refs/remotes/origin/HEAD (as in cloud clones), then with it.
    assert.equal(activeChantier(directory, config).chantier, null)
    git(directory, 'remote', 'set-head', 'origin', 'main')
    assert.equal(activeChantier(directory, config).chantier, null)
  })

  it('V-5 : avec une origine, la base est origin/main pour une branche non conforme', () => {
    const origin = temporaryDirectory('atelier-tec6-origin-')
    git(origin, 'init', '-q', '--bare', '-b', 'main')
    const directory = makeRepository('main')
    git(directory, 'remote', 'add', 'origin', origin)
    git(directory, 'push', '-q', 'origin', 'main')
    git(directory, 'fetch', '-q', 'origin')
    git(directory, 'switch', '-q', '-c', 'claude/x')
    addChantierSpec(directory, 'TEC-9', 'x')
    const { chantier, source } = activeChantier(directory, config)
    assert.equal(chantier?.id, 'TEC-9')
    assert.equal(source, 'commits')
  })
})

describe('chantier source shown to the user', () => {
  it('V-6 : status --json expose chantierSource', () => {
    const directory = makeDeductionRepository()
    assert.equal(JSON.parse(atelier(directory, 'status', '--json')).chantierSource, 'commits')
    git(directory, 'switch', '-q', 'tec/TEC-8-y')
    assert.equal(JSON.parse(atelier(directory, 'status', '--json')).chantierSource, 'branch')
    git(directory, 'switch', '-q', 'main')
    assert.equal(JSON.parse(atelier(directory, 'status', '--json')).chantierSource, null)
  })

  it('V-6 : status et le hook de démarrage signalent un chantier déduit des commits', () => {
    const directory = makeDeductionRepository()
    assert.match(atelier(directory, 'status'), /TEC-9.*\(déduit des commits\)/)
    assert.match(atelier(directory, 'hook-session-start'), /TEC-9.*\(déduit des commits\)/)
  })

  it('V-6 : rien de tel quand le chantier vient du nom de branche', () => {
    const directory = makeDeductionRepository()
    git(directory, 'switch', '-q', 'tec/TEC-8-y')
    assert.doesNotMatch(atelier(directory, 'status'), /déduit des commits/)
    assert.doesNotMatch(atelier(directory, 'hook-session-start'), /déduit des commits/)
  })
})

// A repository whose origin (local bare repository) holds `main` and the given extra branches.
function makeRepositoryWithOrigin(extraBranches = []) {
  const origin = temporaryDirectory('atelier-tec6-origin-')
  git(origin, 'init', '-q', '--bare', '-b', 'main')
  const directory = makeRepository('main')
  git(directory, 'remote', 'add', 'origin', origin)
  for (const [branch, subject] of extraBranches) {
    git(directory, 'switch', '-q', '-c', branch, 'main')
    commit(directory, subject)
  }
  git(directory, 'push', '-q', 'origin', 'main', ...extraBranches.map(([branch]) => branch))
  git(directory, 'fetch', '-q', 'origin')
  return directory
}

describe('default branch resolved through origin/HEAD', () => {
  const config = { ...DEFAULT_CONFIG, chantiersDir: 'docs/chantiers' }

  it('V-7 : avec origin/HEAD vers origin/main, déduit le chantier sur une branche non conforme', () => {
    const directory = makeRepositoryWithOrigin()
    git(directory, 'remote', 'set-head', 'origin', 'main')
    git(directory, 'switch', '-q', '-c', 'claude/x', 'main')
    addChantierSpec(directory, 'TEC-9', 'x')
    const { chantier, source } = activeChantier(directory, config)
    assert.equal(chantier?.id, 'TEC-9')
    assert.equal(source, 'commits')
  })

  it('V-8 : origin/HEAD vers develop : aucun chantier sur develop, déduction depuis develop ailleurs', () => {
    // develop carries a merged chantier commit that main does not have.
    const directory = makeRepositoryWithOrigin([['develop', 'feat(x): [TEC-7] merged work']])
    git(directory, 'remote', 'set-head', 'origin', 'develop')

    git(directory, 'switch', '-q', 'develop')
    assert.deepEqual(
      (({ chantier, source }) => ({ chantier, source }))(activeChantier(directory, config)),
      { chantier: null, source: null },
    )

    git(directory, 'switch', '-q', '-c', 'claude/empty', 'develop')
    assert.equal(activeChantier(directory, config).chantier, null, 'la base est origin/develop, pas origin/main')

    git(directory, 'switch', '-q', '-c', 'claude/x', 'develop')
    addChantierSpec(directory, 'TEC-9', 'x')
    const { chantier, source } = activeChantier(directory, config)
    assert.equal(chantier?.id, 'TEC-9')
    assert.equal(source, 'commits')
  })

  it('V-10 : la garde d’écriture applique les règles du chantier déduit des commits', () => {
    const directory = makeDeductionRepository()
    const guard = () => execFileSync(process.execPath, [atelierBin, 'hook-guard'], {
      cwd: directory,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
      input: JSON.stringify({
        cwd: directory,
        tool_name: 'Write',
        tool_input: { file_path: join(directory, 'src', 'app.js'), content: 'export const a = 1\n' },
      }),
    })

    // Draft spec: code is refused, with the deduced chantier named.
    const draftDecision = JSON.parse(guard()).hookSpecificOutput
    assert.equal(draftDecision.permissionDecision, 'deny')
    assert.match(draftDecision.permissionDecisionReason, /TEC-9/)

    // Signed spec (no TDD), committed on the same imposed branch: code is allowed.
    writeFileSync(
      join(directory, 'docs', 'chantiers', 'TEC-9-x', 'spec.md'),
      '---\nid: TEC-9\ntype: TEC\ntitle: Essai TEC-9\nstatus: signed\ntdd: no\nsigned_by: Test\nsigned_at: 2026-11-20\n---\n\n# TEC-9\n',
    )
    git(directory, 'add', '.')
    commit(directory, 'docs(chantiers): [TEC-9] sign spec')
    assert.equal(guard().trim(), '')
  })

  it('V-9 : une branche non conforme sans commit propre n’a pas de chantier', () => {
    const directory = makeDeductionRepository()
    git(directory, 'switch', '-q', '-c', 'claude/empty', 'main')
    const { branch, chantier, source } = activeChantier(directory, config)
    assert.equal(branch, 'claude/empty')
    assert.equal(chantier, null)
    assert.equal(source, null)
  })
})

// ---------- FEAT-4: relations between chantiers, EPIC type ----------

// Bodies that satisfy the required sections, so that only relation problems remain.
const completeBodies = {
  TEC: '## 1. Quoi\nFaire X.\n\n## 2. Pourquoi\nParce que.\n\n## 3. Vérification\n- Lancer les tests.\n',
  EPIC: "## 1. Vision\nUn module de gestion client.\n\n## 2. Pourquoi\nLes clients sont gérés à la main.\n\n## 3. Critères d'acceptation globaux\n- CA-1 : un client se crée et se contacte.\n\n## 4. Cadre\nAPI REST commune.\n\n## 5. Hors périmètre\nFacturation.\n",
}

function specText({ id, type = id.split('-')[0], status = 'signed', tdd = 'no', relations = {}, body = completeBodies[type] ?? '' }) {
  const header = { id, type, title: `Essai ${id}`, status, tdd, ...relations }
  return `---\n${Object.entries(header).map(([key, value]) => `${key}: ${value}`).join('\n')}\n---\n\n# ${id}\n\n${body}`
}

function chantierDirectoryOf(directory, id) {
  return join(directory, 'docs', 'chantiers', `${id}-x`)
}

// Writes `docs/chantiers/<id>-x/spec.md` (and the extra `files`), returns the spec path.
function writeChantier(directory, { files = {}, ...spec }) {
  const chantierDirectory = chantierDirectoryOf(directory, spec.id)
  mkdirSync(chantierDirectory, { recursive: true })
  writeFileSync(join(chantierDirectory, 'spec.md'), specText(spec))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(chantierDirectory, name), content)
  }
  return join(chantierDirectory, 'spec.md')
}

// `main` holds the merged chantiers; each entry of `branches` is a branch created from main with
// its own chantiers committed; `checkout` is the branch left checked out.
function makeChantiersRepository({ main = [], branches = {}, checkout = 'main' }) {
  const directory = makeRepository('main')
  main.forEach((spec) => writeChantier(directory, spec))
  git(directory, 'add', '.')
  commit(directory, 'chore: chantiers')
  for (const [branch, specs] of Object.entries(branches)) {
    git(directory, 'switch', '-q', '-c', branch, 'main')
    specs.forEach((spec) => writeChantier(directory, spec))
    git(directory, 'add', '.')
    commit(directory, `docs(chantiers): [${chantierIdFromText(branch)}] spec`)
  }
  git(directory, 'switch', '-q', checkout)
  return directory
}

function atelierRun(directory, ...cliArguments) {
  const result = spawnSync(process.execPath, [atelierBin, ...cliArguments], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
  })
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

function specData(directory, id) {
  return parseFrontMatter(readFileSync(join(chantierDirectoryOf(directory, id), 'spec.md'), 'utf8')).data
}

// Asserts that one line of `output` matches every pattern.
function assertLine(output, patterns, label = patterns.join(' + ')) {
  const line = output.split(/\r?\n/).find((candidate) => patterns.every((pattern) => pattern.test(candidate)))
  assert.ok(line, `${label} : aucune ligne ne correspond dans\n${output}`)
}

const epicPlan = { 'plan.md': '# Plan : EPIC-5\n\n## Lots\n- FEAT-6, FEAT-7\n' }

describe('FEAT-4 relations read from the spec header', () => {
  it('CA-1 : lit les relations en listes normalisées (espaces, casse, doublons), vides si absentes', () => {
    const relations = core.parseRelations({
      rel_parent: 'epic-5',
      rel_depends_on: 'FEAT-12,  tec-15',
      rel_origin: 'SPIKE-3, spike-3',
      rel_replaces: '',
    })
    assert.deepEqual(relations, { parent: ['EPIC-5'], dependsOn: ['FEAT-12', 'TEC-15'], origin: ['SPIKE-3'], replaces: [] })
    assert.deepEqual(core.parseRelations({ id: 'FEAT-1' }), { parent: [], dependsOn: [], origin: [], replaces: [] })
  })
})

describe('FEAT-4 children of an EPIC across branches', () => {
  it('CA-2 : enfants découverts dans l’arbre courant et sur les autres branches, statut jugé dans l’arbre courant', () => {
    const directory = makeChantiersRepository({
      main: [
        { id: 'EPIC-5', files: epicPlan },
        { id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } },
        { id: 'TEC-8' },
      ],
      branches: {
        'feat/FEAT-7-x': [{ id: 'FEAT-7', status: 'done', relations: { rel_parent: 'EPIC-5' } }],
        'epic/EPIC-5-x': [],
      },
      checkout: 'epic/EPIC-5-x',
    })
    const children = JSON.parse(atelier(directory, 'status', '--json')).chantier.relations.children
    assert.deepEqual(children.map((child) => child.id).sort(), ['FEAT-6', 'FEAT-7'])
    assert.equal(children.find((child) => child.id === 'FEAT-6').closed, true)
    assert.equal(children.find((child) => child.id === 'FEAT-7').closed, false, 'done sur sa branche seulement : ouvert')
  })

  it('CA-2 : un enfant présent seulement sur une branche distante connue est découvert', () => {
    const origin = temporaryDirectory('atelier-feat4-origin-')
    git(origin, 'init', '-q', '--bare', '-b', 'main')
    const directory = makeChantiersRepository({
      main: [{ id: 'EPIC-5', files: epicPlan }],
      branches: { 'feat/FEAT-16-x': [{ id: 'FEAT-16', relations: { rel_parent: 'EPIC-5' } }], 'epic/EPIC-5-x': [] },
    })
    git(directory, 'remote', 'add', 'origin', origin)
    git(directory, 'push', '-q', 'origin', 'main', 'feat/FEAT-16-x')
    git(directory, 'fetch', '-q', 'origin')
    git(directory, 'branch', '-q', '-D', 'feat/FEAT-16-x')
    git(directory, 'switch', '-q', 'epic/EPIC-5-x')
    const children = JSON.parse(atelier(directory, 'status', '--json')).chantier.relations.children
    assert.deepEqual(children.map((child) => child.id), ['FEAT-16'])
    assert.equal(children[0].closed, false)
  })
})

describe('FEAT-4 dependencies checked at close', () => {
  it('CA-3 : refuse la clôture tant qu’une dépendance n’est pas done dans l’arbre courant, en la nommant avec son statut', () => {
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

  it('CA-4 : laisse clore quand toutes les dépendances sont done dans l’arbre courant', () => {
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

describe('FEAT-4 relations checked before signature', () => {
  // main: EPIC-5 (open), EPIC-15 (done), EPIC-34 (child of EPIC-33), TEC-32 (depends on TEC-31);
  // FEAT-7 only on its branch.
  const directory = makeChantiersRepository({
    main: [
      { id: 'EPIC-5' },
      { id: 'EPIC-15', status: 'done' },
      { id: 'EPIC-34', relations: { rel_parent: 'EPIC-33' } },
      { id: 'TEC-32', relations: { rel_depends_on: 'TEC-31' } },
    ],
    branches: { 'feat/FEAT-7-x': [{ id: 'FEAT-7' }] },
  })
  const check = (spec) => atelierRun(directory, 'check-spec', writeChantier(directory, { status: 'draft', ...spec }))

  it('CA-5 : accepte des relations valides, une dépendance présente seulement sur une branche et une origine historique', () => {
    const { status, output } = check({ id: 'TEC-30', relations: { rel_parent: 'EPIC-5', rel_depends_on: 'FEAT-7', rel_origin: 'BUG-421', rel_replaces: 'FEA-26' } })
    assert.equal(status, 0, output)
  })

  it('CA-5 : signale un parent ou une dépendance introuvable dans toutes les branches', () => {
    const { status, output } = check({ id: 'TEC-30', relations: { rel_parent: 'EPIC-98', rel_depends_on: 'FEAT-99' } })
    assert.equal(status, 2)
    assertLine(output, [/EPIC-98/, /introuvable/])
    assertLine(output, [/FEAT-99/, /introuvable/])
  })

  it('CA-5 : signale un identifiant mal formé dans n’importe quel champ rel_*', () => {
    const { status, output } = check({ id: 'TEC-30', relations: { rel_origin: 'ticket 12', rel_replaces: 'FEAT-' } })
    assert.equal(status, 2)
    assertLine(output, [/ticket 12/, /mal formé/])
    assertLine(output, [/FEAT-/, /mal formé/])
  })

  it('CA-5 : signale plusieurs parents, un parent qui n’est pas un EPIC, un EPIC clos', () => {
    assertLine(check({ id: 'TEC-30', relations: { rel_parent: 'EPIC-5, EPIC-34' } }).output, [/rel_parent/, /plusieurs|un seul|une seule/])
    assertLine(check({ id: 'TEC-30', relations: { rel_parent: 'FEAT-7' } }).output, [/FEAT-7/, /EPIC/])
    assertLine(check({ id: 'TEC-30', relations: { rel_parent: 'EPIC-15' } }).output, [/EPIC-15/, /clos/])
  })

  it('CA-5 : signale une auto-référence et un cycle sur rel_depends_on comme sur rel_parent', () => {
    assertLine(check({ id: 'TEC-30', relations: { rel_depends_on: 'TEC-30' } }).output, [/TEC-30/, /lui-même|auto-référence/])
    assertLine(check({ id: 'TEC-31', relations: { rel_depends_on: 'TEC-32' } }).output, [/cycle/, /TEC-31/, /TEC-32/])
    assertLine(check({ id: 'EPIC-33', relations: { rel_parent: 'EPIC-34' } }).output, [/cycle/, /EPIC-33/, /EPIC-34/])
  })

  it('CA-5 : ces manques bloquent la signature', () => {
    const signDirectory = makeChantiersRepository({
      branches: { 'tec/TEC-40-x': [{ id: 'TEC-40', status: 'draft', relations: { rel_depends_on: 'FEAT-99' } }] },
      checkout: 'tec/TEC-40-x',
    })
    const { status, output } = atelierRun(signDirectory, 'sign')
    assert.notEqual(status, 0)
    assertLine(output, [/FEAT-99/, /introuvable/])
    assert.equal(specData(signDirectory, 'TEC-40').status, 'draft')
  })

  it('décision : sans .claude/atelier.json, check-spec ne vérifie pas les relations et le dit', () => {
    const bare = temporaryDirectory('atelier-feat4-noconfig-')
    const path = join(bare, 'spec.md')
    writeFileSync(path, specText({ id: 'TEC-30', status: 'draft', relations: { rel_depends_on: 'FEAT-99' } }))
    const { status, output } = atelierRun(bare, 'check-spec', path)
    assert.equal(status, 0, output)
    assert.match(output, /relations/i)
  })
})

describe('FEAT-4 EPIC type', () => {
  it('CA-6 : next-id EPIC suit le compteur unique ; epic/EPIC-7-x et [EPIC-7] désignent EPIC-7', () => {
    assert.equal(nextChantierId('EPIC', ['FEAT-12-x', '[BUG-421] FIX']), 'EPIC-422')
    assert.equal(chantierIdFromText('epic/EPIC-7-x'), 'EPIC-7')
    assert.equal(core.chantierIdFromCommitSubjects(['docs(chantiers): [EPIC-7] plan']), 'EPIC-7')
    const directory = makeChantiersRepository({ branches: { 'epic/EPIC-7-x': [{ id: 'EPIC-7' }] }, checkout: 'epic/EPIC-7-x' })
    assert.equal(atelier(directory, 'next-id', 'EPIC').trim(), 'EPIC-8')
    assert.equal(JSON.parse(atelier(directory, 'status', '--json')).chantier.id, 'EPIC-7')
  })

  it('CA-7 : le template spec-epic porte tdd: no et les sections exigées avant signature', () => {
    const epicTemplate = template('spec-epic')
    assert.equal(parseFrontMatter(epicTemplate).data.tdd, 'no')
    const sections = ['Vision', 'Pourquoi', "Critères d'acceptation globaux", 'Cadre', 'Hors périmètre']
    const problems = checkSpec(epicTemplate)
    for (const section of sections) {
      assert.match(epicTemplate, new RegExp(`^## (\\d+\\. )?${section}`, 'm'), section)
      assert.ok(problems.some((problem) => problem.includes(section)), `section vide signalée : ${section}`)
    }
    assert.deepEqual(checkSpec(specText({ id: 'EPIC-5', status: 'draft' })), [])
    const withoutFrame = specText({ id: 'EPIC-5', status: 'draft', body: completeBodies.EPIC.replace(/## 4\. Cadre\n.*\n\n/, '') })
    assert.ok(checkSpec(withoutFrame).some((problem) => problem.includes('Cadre')))
  })

  it('CA-7 : check-spec signale un EPIC en tdd: yes', () => {
    assert.ok(checkSpec(specText({ id: 'EPIC-5', status: 'draft', tdd: 'yes' })).some((problem) => /tdd/.test(problem) && /EPIC/.test(problem)))
  })

  it('CA-7 : le template plan-epic décrit le découpage', () => {
    const directory = makeRepository('main')
    const plan = atelier(directory, 'template', 'plan-epic')
    for (const word of [/lot/i, /type/i, /ordre/i, /dépendance/i]) {
      assert.match(plan, word)
    }
  })

  it('CA-7 : set-tdd yes est refusé sur un EPIC', () => {
    const directory = makeChantiersRepository({ branches: { 'epic/EPIC-5-x': [{ id: 'EPIC-5' }] }, checkout: 'epic/EPIC-5-x' })
    const { status, output } = atelierRun(directory, 'set-tdd', 'yes', 'essai')
    assert.notEqual(status, 0)
    assert.match(output, /EPIC/, 'refusé parce que c’est un EPIC')
    assert.equal(specData(directory, 'EPIC-5').tdd, 'no')
  })

  it('CA-8 : sur un EPIC signé, aucune écriture hors des chemins libres ; docs/ et le débrayage restent permis', () => {
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

  it('CA-9 : refuse avec la liste des enfants ouverts, sans exiger de revue', () => {
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

  it('CA-9 : refuse sans enfant done (aucun enfant, ou tous abandonnés)', () => {
    for (const main of [[], [{ id: 'FEAT-6', status: 'abandoned', relations: { rel_parent: 'EPIC-5' } }, { id: 'FEAT-17', status: 'abandoned', relations: { rel_parent: 'EPIC-5' } }]]) {
      const directory = epicOn(main)
      const { status, output } = atelierRun(directory, 'set-status', 'done')
      assert.notEqual(status, 0, `${main.length} enfant(s)`)
      assert.match(output, /enfant/, 'refusé faute d’enfant done')
      assert.equal(specData(directory, 'EPIC-5').status, 'signed', output)
    }
  })

  it('CA-9 : permet la clôture quand tous les enfants sont clos et au moins un est done, sans revue enregistrée', () => {
    const directory = epicOn([
      { id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } },
      { id: 'FEAT-17', status: 'abandoned', relations: { rel_parent: 'EPIC-5' } },
    ])
    const { status, output } = atelierRun(directory, 'set-status', 'done')
    assert.equal(status, 0, output)
    assert.equal(specData(directory, 'EPIC-5').status, 'done')
  })

  it('CA-9 : un EPIC enfant ouvert bloque la clôture de son EPIC parent', () => {
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

  it('CA-9 : l’abandon reste permis avec des enfants ouverts, qui sont listés', () => {
    const directory = epicOn([{ id: 'TEC-18', relations: { rel_parent: 'EPIC-5' } }])
    const { status, output } = atelierRun(directory, 'set-status', 'abandoned')
    assert.equal(status, 0, output)
    assert.match(output, /TEC-18/)
    assert.equal(specData(directory, 'EPIC-5').status, 'abandoned')
  })
})

describe('FEAT-4 next step of an EPIC', () => {
  const nextStepOf = (directory) => JSON.parse(atelier(directory, 'status', '--json')).nextStep

  it('CA-10 : concevoir le découpage sans plan, puis les enfants ouverts et leur nombre, puis la clôture ; jamais la revue', () => {
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

  it('CA-10 : tous les enfants clos sans aucun done : propose l’abandon, pas la clôture', () => {
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
  it('CA-11 : affiche parent, dépendances avec leur statut, origine, remplacement', () => {
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

  it('CA-11 : pour un EPIC, affiche ses enfants directs calculés avec leur statut', () => {
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

  it('CA-10, CA-11 : le hook de démarrage affiche les enfants d’un EPIC et sa prochaine étape', () => {
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

  it('CA-12 : le template de la section Process existe et parle de l’EPIC et des relations', () => {
    assert.ok(processLines().includes('## Process (atelier)'))
    assert.ok(processLines().some((line) => /EPIC/.test(line) && /rel_/.test(line)))
  })

  it('CA-12 : liste toutes les lignes quand la section est absente', () => {
    const directory = makeRepository('main')
    writeFileSync(join(directory, 'CLAUDE.md'), '# Projet\n\nRien sur le process.\n')
    const { status, output } = atelierRun(directory, 'check-process')
    assert.equal(status, 2)
    for (const line of processLines()) {
      assert.ok(output.includes(line.trim()), line)
    }
  })

  it('CA-12 : liste seulement les lignes manquantes ; rien quand tout y est, ajouts du projet compris', () => {
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

  it('CA-12 : la ligne des chantiers est attendue avec le chantiersDir du projet, sans / final', () => {
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
  it('CA-13 : six types dont l’EPIC ; templates spec-epic et plan-epic inclus', () => {
    const types = site('fondations/types.md')
    assert.match(types, /Six types/)
    assert.match(types, /^## EPIC/m)
    const templates = site('reference/templates.md')
    assert.match(templates, /@include: [^\n]*templates\/spec-epic\.md/)
    assert.match(templates, /@include: [^\n]*templates\/plan-epic\.md/)
  })
})

// ---------- FEAT-7: tests, build and review cycle per slice ----------

// A plan whose « Tranches » section has first-level entries numbered `numbers` (sub-lists and
// comments around, and a numbered list in another section, which must be ignored).
function planOf(numbers) {
  const entries = numbers.map((number) => `${number}. Tranche ${number} — CA couverts : CA-${number}\n   1. sous-étape`).join('\n')
  return `# Plan : FEAT-20\n\n## Approche\nTexte.\n\n## Tranches\n<!-- 1. <tranche> — CA couverts : CA-1\n2. exemple -->\n${entries}\n\n## Risques et points d'attention\n1. pas une tranche\n2. toujours pas\n3. non\n4. non\n5. non\n`
}
const threeSlices = planOf([1, 2, 3])

// Pure chantier object, as readChantier returns it (plan text in `plan`).
function slicedChantier(data = {}, { plan = threeSlices, type = 'FEAT', tdd = 'yes' } = {}) {
  return {
    id: `${type}-20`,
    directory: `/p/docs/chantiers/${type}-20-x`,
    spec: { data: { status: 'signed', type, tdd, ...data }, body: '# x\n' },
    files: plan === null ? ['spec.md'] : ['spec.md', 'plan.md'],
    plan,
  }
}

// A repository on branch `<type>/<id>-x` with the signed chantier (and its plan) committed.
function makeSlicedRepository({ id = 'FEAT-20', tdd = 'yes', plan = threeSlices, header = {} } = {}) {
  const directory = makeRepository('main')
  git(directory, 'switch', '-q', '-c', `${id.split('-')[0].toLowerCase()}/${id}-x`)
  writeChantier(directory, { id, tdd, relations: header, files: plan === null ? {} : { 'plan.md': plan } })
  git(directory, 'add', '-A')
  commit(directory, `docs(chantiers): [${id}] spec`)
  return directory
}

// Writes (or deletes, when the content is null) files, then commits everything.
function commitFiles(directory, files, subject = 'chore: files') {
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(directory, relativePath)
    if (content === null) {
      rmSync(filePath)
    } else {
      mkdirSync(path.dirname(filePath), { recursive: true })
      writeFileSync(filePath, content)
    }
  }
  git(directory, 'add', '-A')
  commit(directory, subject)
}

function headOf(directory) {
  return git(directory, 'rev-parse', 'HEAD').trim()
}

function commitSpec(directory) {
  git(directory, 'add', '-A')
  commit(directory, 'docs(chantiers): spec')
}

// Sets spec header fields by hand (as the user would) and commits the spec.
function setHeader(directory, id, values) {
  const specPath = join(chantierDirectoryOf(directory, id), 'spec.md')
  writeFileSync(specPath, setFrontMatterValues(readFileSync(specPath, 'utf8'), values))
  commitSpec(directory)
}

function specFileText(directory, id) {
  return readFileSync(join(chantierDirectoryOf(directory, id), 'spec.md'), 'utf8')
}

function amendmentEntries(directory, id) {
  return parseAmendments(parseFrontMatter(specFileText(directory, id)).body).entries
}

function atelierOk(directory, ...cliArguments) {
  const result = atelierRun(directory, ...cliArguments)
  assert.equal(result.status, 0, result.output)
  return result.output
}

// Slice 1 done (a test and its code committed), the chantier now in slice 2 « tests d'abord »,
// slice_base at the end of slice 1.
function atSliceTwo(options = {}) {
  const directory = makeSlicedRepository(options)
  commitFiles(directory, { 'test/one.test.mjs': 'ligne a\nligne b\nligne c\n' }, 'test: one')
  commitFiles(directory, { 'src/one.mjs': 'export const one = 1\n' }, 'feat: one')
  const base = headOf(directory)
  setHeader(directory, 'FEAT-20', { slice: '2', slice_base: base })
  return { directory, base }
}

// Slice `slice` (a number or 'chantier') in implementation: tests frozen (TDD), code committed.
function implementedSlice({ slice, plan = threeSlices, tdd = 'yes', extra = {} }) {
  const directory = makeSlicedRepository({ plan, tdd })
  commitFiles(directory, { 'src/before.mjs': 'export const before = 1\n' }, 'feat: before')
  const base = headOf(directory)
  let testsCommit = ''
  if (tdd === 'yes') {
    commitFiles(directory, { 'test/now.test.mjs': 'test\n' }, 'test: now')
    testsCommit = git(directory, 'rev-parse', '--short', 'HEAD').trim()
  }
  commitFiles(directory, { 'src/now.mjs': 'export const now = 1\n' }, 'feat: now')
  setHeader(directory, 'FEAT-20', { slice: String(slice), slice_base: base, ...(testsCommit ? { tests_commit: testsCommit } : {}), ...extra })
  return { directory, base, testsCommit }
}

describe('FEAT-7 plan and current slice', () => {
  it('CA-1 : compte les entrées numérotées de premier niveau de « Tranches » (sous-listes, commentaires et autres sections ignorés)', () => {
    assert.equal(core.planSliceCount(threeSlices), 3)
    assert.equal(core.planSliceCount(threeSlices.replace(/\n/g, '\r\n')), 3, 'plan en CRLF')
  })

  it('CA-1 : le nombre de tranches est le plus grand numéro', () => {
    assert.equal(core.planSliceCount(planOf([1, 2, 4])), 4)
  })

  it('CA-2 : sans plan, sans section « Tranches » ou avec une seule entrée, une tranche unique', () => {
    for (const plan of [null, '# Plan\n\n## Approche\nTexte.\n', planOf([1])]) {
      assert.equal(core.sliceState(slicedChantier({}, { plan })).model, 'single', String(plan))
    }
  })

  it('CA-2 : status --json donne slice et sliceCount null, et ne parle de tranche ni en texte ni dans la prochaine étape', () => {
    for (const plan of [null, planOf([1])]) {
      const directory = makeSlicedRepository({ plan })
      const summary = JSON.parse(atelierOk(directory, 'status', '--json'))
      assert.equal(summary.chantier.slice, null)
      assert.equal(summary.chantier.sliceCount, null)
      assert.doesNotMatch(summary.nextStep, /tranche/i)
      assert.doesNotMatch(atelierOk(directory, 'status'), /tranche/i)
    }
  })

  it('CA-3 : sans champ slice ni trace de l’ancien modèle, la tranche en cours est la 1', () => {
    assert.deepEqual(core.sliceState(slicedChantier()), { model: 'sliced', slice: 1, sliceCount: 3 })
    const summary = JSON.parse(atelierOk(makeSlicedRepository(), 'status', '--json'))
    assert.equal(summary.chantier.slice, 1)
    assert.equal(summary.chantier.sliceCount, 3)
  })

  it('CA-3 : avec slice: 2, la tranche en cours est la 2', () => {
    assert.deepEqual(core.sliceState(slicedChantier({ slice: '2' })), { model: 'sliced', slice: 2, sliceCount: 3 })
    const summary = JSON.parse(atelierOk(makeSlicedRepository({ header: { slice: 2 } }), 'status', '--json'))
    assert.equal(summary.chantier.slice, 2)
    assert.equal(summary.chantier.sliceCount, 3)
  })

  it('CA-4 : un chantier de l’ancien modèle (tests_commit, reviewed_commit, tests rouverts ou regelés) est une tranche unique, quel que soit le plan', () => {
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

  it('CA-5 : le hook refuse que l’agent écrive ou modifie slice, slice_base ou last_slice', () => {
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
  it('CA-6 : le premier gel écrit tests_commit et slice: 1, avec ou sans plan, SPIKE compris', () => {
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
    it(`CA-7 : en tranche 2, refuse le gel quand une ligne de test antérieure a changé (${label})`, () => {
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

  it('CA-7 : en tranche 2, un fichier de test renommé compte comme supprimé', () => {
    const { directory } = atSliceTwo()
    git(directory, 'mv', 'test/one.test.mjs', 'test/renamed.test.mjs')
    commit(directory, 'test: rename')
    const before = specFileText(directory, 'FEAT-20')
    const { status, output } = atelierRun(directory, 'freeze-tests')
    assert.notEqual(status, 0)
    assert.match(output, /test\/one\.test\.mjs/)
    assert.equal(specFileText(directory, 'FEAT-20'), before)
  })

  it('CA-7 : extrait du diff les fichiers dont des lignes sont retirées', () => {
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

  it('CA-8 : en tranche 2, la réouverture trace le gel quitté (slice_base) ; le gel suivant accepte les modifications et trace le regel', () => {
    const { directory, base } = atSliceTwo()
    atelierOk(directory, 'reopen-tests', 'test', 'faux')
    assert.match(amendmentEntries(directory, 'FEAT-20').at(-1), new RegExp(`tests rouverts \\(gel quitté : ${base.slice(0, 7)}[0-9a-f]*\\) : test faux`))
    commitSpec(directory)
    commitFiles(directory, { 'test/one.test.mjs': 'ligne a\nligne B\nligne c\n' }, 'test: fix one')
    atelierOk(directory, 'freeze-tests')
    assert.match(amendmentEntries(directory, 'FEAT-20').at(-1), /tests regelés/)
    assert.ok(specData(directory, 'FEAT-20').tests_commit)
  })

  it('CA-8 : une seconde réouverture avant le regel est refusée', () => {
    const { directory } = atSliceTwo()
    atelierOk(directory, 'reopen-tests', 'première')
    commitSpec(directory)
    const { status, output } = atelierRun(directory, 'reopen-tests', 'seconde')
    assert.notEqual(status, 0)
    assert.match(output, /tests déjà rouverts/)
  })

  it('CA-8 : en phase « tests d’abord » de la tranche 1, la réouverture reste refusée ; en tranche 2 elle est possible', () => {
    assert.match(reopenTestsRefusal(slicedChantier({ slice: '1' })), /pas figés/)
    assert.match(reopenTestsRefusal(slicedChantier()), /pas figés/)
    assert.equal(reopenTestsRefusal(slicedChantier({ slice: '2', slice_base: 'a'.repeat(40) })), null)
  })

  it('CA-9 : en tranche 2, des tests seulement ajoutés (lignes, fichiers ; espaces et fins de ligne changés) se figent sans raison', () => {
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

  it('CA-10 : en revue du chantier, la réouverture vide tests_commit, garde slice: chantier ; le gel suivant accepte les modifications', () => {
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

  it('CA-11 : refuse le gel et la revue quand slice_base n’est plus un ancêtre de HEAD', () => {
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

  it('CA-12 : en tranche 2, phase « tests d’abord », refuse le code et accepte les tests', () => {
    assert.equal(decide({ chantier: sliceTwoWriting, relativePath: 'src/budget.ts' }).allowed, false)
    assert.equal(decide({ chantier: sliceTwoWriting, relativePath: 'test/budget.test.ts' }).allowed, true)
  })

  it('CA-13 : en tranche 2, phase d’implémentation, refuse l’écriture d’un test ; le contrôle de fin signale un test modifié', () => {
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

  it('CA-17 : en revue du chantier, tests figés, refuse un test et accepte le code', () => {
    assert.equal(decide({ chantier: chantierReview, relativePath: 'test/one.test.ts' }).allowed, false)
    assert.equal(decide({ chantier: chantierReview, relativePath: 'src/budget.ts' }).allowed, true)
  })
})

describe('FEAT-7 review and next slice', () => {
  it('CA-14 : la revue validée de la tranche 2 sur 3 passe à la tranche 3', () => {
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
    it(`CA-15 : la revue validée de la dernière tranche passe à la revue du chantier (${label})`, () => {
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

  it('CA-15 : status signale une tranche en cours absente du plan', () => {
    const { directory } = implementedSlice({ slice: 3, plan: planOf([1, 2]) })
    assert.match(atelierOk(directory, 'status'), /tranche 3 absente du plan/i)
  })

  it('CA-16 : en revue du chantier, set-reviewed écrit reviewed_commit sans toucher à slice', () => {
    const { directory } = implementedSlice({ slice: 'chantier', extra: { last_slice: '3' } })
    const head = headOf(directory)
    atelierOk(directory, 'set-reviewed')
    const data = specData(directory, 'FEAT-20')
    assert.equal(data.reviewed_commit, head)
    assert.equal(data.slice, 'chantier')
  })

  it('CA-16 : un chantier à tranche unique enregistre reviewed_commit comme aujourd’hui', () => {
    for (const plan of [null, planOf([1])]) {
      const directory = makeSlicedRepository({ tdd: 'no', plan })
      commitFiles(directory, { 'src/a.mjs': 'code\n' }, 'feat: a')
      const head = headOf(directory)
      atelierOk(directory, 'set-reviewed')
      assert.equal(specData(directory, 'FEAT-20').reviewed_commit, head, String(plan))
    }
  })

  it('CA-18 : sans TDD, la revue de la tranche 1 sur 2 passe à la tranche 2 ; prochaine étape /atelier:build', () => {
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

  it('CA-19 : les refus actuels de set-reviewed ne changent pas de tranche', () => {
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

  it('CA-20 : refuse de passer une tranche sans commit de code depuis son début', () => {
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

  it('CA-20 : en TDD, une tranche dont seuls les tests ont été commités est vide', () => {
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

  it('CA-21 : refuse la clôture tant qu’une tranche est en cours', () => {
    for (const slice of ['2', '3']) {
      const { directory } = implementedSlice({ slice, tdd: 'no' })
      const { status, output } = atelierRun(directory, 'close-check')
      assert.notEqual(status, 0, slice)
      assert.match(output, new RegExp(`tranche ${slice}/3 en cours`, 'i'), slice)
    }
  })

  it('CA-21 : en revue du chantier sans reviewed_commit, demande la revue du chantier', () => {
    const { directory } = implementedSlice({ slice: 'chantier', tdd: 'no', extra: { last_slice: '3' } })
    const { status, output } = atelierRun(directory, 'close-check')
    assert.notEqual(status, 0)
    assert.match(output, /revue du chantier/i)
  })

  it('CA-22 : refuse la clôture quand le plan compte une tranche après last_slice', () => {
    const directory = reviewedChantier({ plan: planOf([1, 2, 3, 4]), header: { slice: 'chantier', last_slice: '3' } })
    const { status, output } = atelierRun(directory, 'close-check')
    assert.notEqual(status, 0)
    assert.match(output, /tranche 4 du plan non revue/i)
  })

  it('CA-23 : clôture possible avec la revue du chantier à jour, et pour un chantier de l’ancien modèle revu', () => {
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

  it('CA-24 : la prochaine étape préfixe le message de la phase par « Tranche N/3 : »', () => {
    assert.match(nextStep(slicedChantier()), /^Tranche 1\/3 : .*\/atelier:write-tests/)
    assert.match(nextStep(slicedChantier({ slice: '2', slice_base: 'a'.repeat(40) })), /^Tranche 2\/3 : .*\/atelier:write-tests/)
    assert.match(nextStep(slicedChantier({ slice: '2', slice_base: 'a'.repeat(40), tests_commit: 'abc1234' })), /^Tranche 2\/3 : .*\/atelier:build.*\/atelier:review/)
  })

  it('CA-24 : en revue du chantier, demande la revue de l’ensemble, puis la clôture', () => {
    const chantier = slicedChantier({ slice: 'chantier', last_slice: '3', slice_base: 'a'.repeat(40), tests_commit: 'abc1234' })
    assert.match(nextStep(chantier, 'none'), /^Revue du chantier : faire relire l.ensemble : \/atelier:review/)
    assert.match(nextStep(chantier, 'current'), /\/atelier:close/)
  })

  it('CA-25 : un SPIKE en TDD suit le cycle par tranche et sa clôture exige la revue du chantier', () => {
    const spike = slicedChantier({ slice: '2', slice_base: 'a'.repeat(40) }, { type: 'SPIKE' })
    assert.equal(core.sliceState(spike).model, 'sliced')
    assert.match(nextStep(spike), /^Tranche 2\/3 : .*\/atelier:write-tests/)
    const directory = makeSlicedRepository({ id: 'SPIKE-20', tdd: 'yes', header: { slice: 'chantier', last_slice: '3', tests_commit: 'abc1234' } })
    const { status, output } = atelierRun(directory, 'close-check')
    assert.notEqual(status, 0)
    assert.match(output, /revue du chantier/i)
  })

  it('CA-25 : un SPIKE en TDD de l’ancien modèle se clôt sans revue exigée', () => {
    const directory = makeSlicedRepository({ id: 'SPIKE-20', tdd: 'yes' })
    commitFiles(directory, { 'test/a.test.mjs': 'test\n' }, 'test: a')
    const testsCommit = git(directory, 'rev-parse', '--short', 'HEAD').trim()
    commitFiles(directory, { 'src/a.mjs': 'code\n' }, 'feat: a')
    setHeader(directory, 'SPIKE-20', { tests_commit: testsCommit })
    const { status, output } = atelierRun(directory, 'close-check')
    assert.equal(status, 0, output)
  })

  it('CA-25 : un SPIKE sans TDD reste hors tranches : pas de slice, pas de message de tranche, clôture sans revue', () => {
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

  it('CA-26 : le rappel de début de session indique la tranche, et n’en parle pas pour une tranche unique', () => {
    const { directory } = atSliceTwo()
    assert.match(atelierOk(directory, 'hook-session-start'), /Tranche 2\/3/)
    assert.doesNotMatch(atelierOk(makeSlicedRepository({ plan: null }), 'hook-session-start'), /tranche/i)
  })
})

describe('FEAT-7 vocabulary of the review', () => {
  const repositoryPath = (relativePath) => fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url))
  const reviewRound = /\btours? de revue\b|\btour \d+\b|\bà chaque tour\b/i

  it('CA-27 : plus de « tour » au sens d’un passage de revue dans les skills, l’agent, les templates, le site et le README', () => {
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

// A revue.md with the given sections: { title, blocking: [[point, file, treatment]], discuss: [...] }.
function revueOf(sections) {
  const table = (rows) => ['| Point | Fichier | Traitement |', '|---|---|---|', ...rows.map((cells) => `| ${cells.join(' | ')} |`)].join('\n')
  const body = sections.map(({ title, blocking = [], discuss = [] }) =>
    `## ${title}\n- Commit revu : abc1234\n\n### Bloquant\n${table(blocking)}\n\n### À discuter\n${table(discuss)}\n\n- Bilan de la revue : ok\n`)
  return `# Revue : TEC-30 Essai\n\n<!-- consigne -->\n\n${body.join('\n')}`
}

// The fields of each analysed row that CA-12 and CA-15 are about.
function pointsOf(parsed) {
  return parsed.sections.flatMap((section) => section.rows.map(({ id, marker, title, treatment, table }) =>
    ({ section: section.title, table, id, marker, title, treatment })))
}

describe('TEC-15 reading revue.md', () => {
  it('CA-12 : extrait l’identifiant, le marqueur (repris, ex-RD3 ou aucun) et l’intitulé de chaque point', () => {
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

  it('CA-12 : lit un revue.md en CRLF, aux cellules entourées d’espaces superflus', () => {
    const text = revueOf([{ title: 'Revue : chantier : 2026-11-21', blocking: [['  RB1. Push non vérifié  ', '`a.mjs`', '   corrigé (abc1234)   ']] }])
      .replace(/\n/g, '\r\n')
    assert.deepEqual(pointsOf(core.parseReviewPoints(text)), [
      { section: 'Revue : chantier : 2026-11-21', table: 'Bloquant', id: 'RB1', marker: null, title: 'Push non vérifié', treatment: 'corrigé (abc1234)' },
    ])
  })

  it('CA-12 : seuls les tableaux sous « ### Bloquant » et « ### À discuter » sont des tableaux de points', () => {
    const text = `${revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Un point', '`a.mjs`', 'corrigé (abc1234)']] }])}\n### Contrôles\n| Point | Fichier | Traitement |\n|---|---|---|\n| RB9. Hors tableau de points | \`x\` | |\n`
    assert.deepEqual(pointsOf(core.parseReviewPoints(text)).map((point) => point.id), ['RB1'])
  })

  it('CA-12 : une ligne vide au milieu d’un tableau de points ne fait perdre aucun point', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Un', '`a.mjs`', 'corrigé (abc1234)'], ['RB2. Deux', '`b.mjs`', ''], ['RB3. Trois', '`c.mjs`', 'écarté : doublon']] }])
      .replace('corrigé (abc1234) |\n', 'corrigé (abc1234) |\n\n')
    assert.deepEqual(pointsOf(core.parseReviewPoints(text)).map(({ id, treatment }) => ({ id, treatment })), [
      { id: 'RB1', treatment: 'corrigé (abc1234)' },
      { id: 'RB2', treatment: '' },
      { id: 'RB3', treatment: 'écarté : doublon' },
    ])
  })

  it('CA-12 : un tableau de points sans ligne d’en-tête ne perd pas son premier point', () => {
    const text = '# Revue : TEC-30 Essai\n\n## Revue : 2026-11-21\n\n### Bloquant\n| RB1. Un | `a.mjs` | |\n| RB2. Deux | `b.mjs` | |\n'
    assert.deepEqual(pointsOf(core.parseReviewPoints(text)).map((point) => point.id), ['RB1', 'RB2'])
  })

  it('CA-12 : une ligne dont le nombre de cellules diffère de l’en-tête est marquée', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Pipe non échappé', '`a | b`', 'corrigé (abc1234)'], ['RB2. Normal', '`c.mjs`', '']] }])
    const rows = core.parseReviewPoints(text).sections[0].rows
    assert.deepEqual(rows.map(({ id, cellCountMismatch }) => ({ id, cellCountMismatch })), [
      { id: 'RB1', cellCountMismatch: true },
      { id: 'RB2', cellCountMismatch: false },
    ])
  })

  it('CA-12 : un tableau dans un commentaire HTML n’est pas lu, comme un bloc de code', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Vrai point', '`a.mjs`', '']] }])
      .replace('### Bloquant\n', '### Bloquant\n<!-- Exemple :\n| Point | Fichier | Traitement |\n|---|---|---|\n| RB9. Exemple | `x` | |\n-->\n')
    assert.deepEqual(pointsOf(core.parseReviewPoints(text)).map((point) => point.id), ['RB1'])
  })

  it('CA-15 : un \| dans une cellule est un | littéral, pas un séparateur de colonne', () => {
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
  it('CA-3 : c’est la dernière occurrence d’un point qui dit s’il est ouvert', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Premier', '`a.mjs`', ''], ['RB2. Second', '`b.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB1 (repris). Premier', '`a.mjs`', 'corrigé (def5678)'], ['RB2 (repris). Second', '`b.mjs`', '']] },
    ])
    const problems = pointProblems(text)
    assert.equal(citing(problems, /\bRB2\b/).length, 1)
    assert.deepEqual(citing(problems, /\bRB1\b/), [])
  })

  it('CA-4 : un traitement commence par un mot-clé, quelle que soit sa casse', () => {
    for (const cell of ['corrigé (abc1234)', 'Corrigé (abc1234)', 'test ajouté (abc1234)', 'Spec amendée (2026-11-21)',
      'exception acceptée par Opack : coût', 'écarté : hors périmètre', 'Écarté : doublon', 'reporté (FIX-12)',
      'reporté (tranche 3)', 'requalifié (RB4)', 'sans objet : code supprimé', 'SANS OBJET']) {
      assert.equal(core.isTreatment(cell), true, cell)
    }
    for (const cell of ['', '   ', 'À corriger au build', 'TODO', 'à voir', 'correction à faire']) {
      assert.equal(core.isTreatment(cell), false, cell)
    }
  })

  it('CA-4 : un point sans traitement reconnu est signalé avec son identifiant et son intitulé, RB comme RD', () => {
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

  it('CA-5 : un identifiant présenté comme nouveau dans deux sections est signalé avec les titres des deux sections', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Premier', '`a.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB1. Autre chose', '`b.mjs`', 'corrigé (def5678)']] },
    ])
    const problems = citing(pointProblems(text), /\bRB1\b/)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /Revue : tranche 1 : 2026-11-21/)
    assert.match(problems[0], /Revue : tranche 2 : 2026-11-22/)
  })

  it('CA-5 : un identifiant nouveau dans deux sections de même titre est signalé, et le premier point ouvert n’est pas masqué', () => {
    const text = revueOf([
      { title: 'Revue : 2026-11-22', blocking: [['RB1. Premier', '`a.mjs`', '']] },
      { title: 'Revue : 2026-11-22', blocking: [['RB1. Autre chose', '`b.mjs`', 'corrigé (def5678)']] },
    ])
    assert.equal(citing(pointProblems(text), /présenté comme nouveau/).length, 1)
  })

  it('CA-5 : un identifiant présent deux fois dans une même section est signalé', () => {
    const text = revueOf([{
      title: 'Revue : 2026-11-21',
      blocking: [['RB1. Premier', '`a.mjs`', 'corrigé (abc1234)'], ['RB1. Second', '`b.mjs`', 'corrigé (abc1234)']],
    }])
    const problems = citing(pointProblems(text), /\bRB1\b/)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /Revue : 2026-11-21/)
  })

  it('CA-6 : une cellule Point qui n’a pas la forme définie est signalée, avec son contenu', () => {
    const cells = ['B1. Ancien format', '1. Numéro seul', 'Texte libre sans identifiant', 'RB1 Sans point final', 'RB2.Sans espace', 'Aucun']
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: cells.map((cell) => [cell, '`a.mjs`', 'corrigé (abc1234)']) }])
    const problems = pointProblems(text)
    for (const cell of cells) {
      assert.equal(citing(problems, new RegExp(cell.replace(/[.()]/g, '\\$&'))).length, 1, cell)
    }
  })

  it('CA-6 : la ligne « Aucun » (ou « aucun. ») seule n’est pas signalée', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['Aucun', '', '']], discuss: [['aucun.', '', '']] }])
    assert.deepEqual(pointProblems(text), [])
  })

  it('CA-6 : une ligne dont le nombre de cellules diffère de l’en-tête est signalée (| non échappé)', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Pipe non échappé', '`a.mjs`', 'corrigé (abc1234)', 'en trop']] }])
    assert.equal(citing(pointProblems(text), /\bRB1\b/).length, 1)
  })

  it('CA-6 : une ligne mal formée suivie d’un séparateur n’est jamais prise pour l’en-tête (RD6, RD10, RD11)', () => {
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

  it('CA-6 : un point bien formé qui contient une cellule « Point », suivi d’un séparateur, est lu comme un point (RD7)', () => {
    const text = revueWithBody(`### Bloquant\n| RB1. x | Point | c |\n|---|---|---|\n| RB2. Deux | \`b.mjs\` | corrigé (abc1234) |\n`)
    assert.equal(citing(pointProblems(text), /\bRB1\b/).length, 1)
  })

  it('CA-6 : un en-tête mal écrit est signalé comme un en-tête non reconnu', () => {
    for (const header of ['| point | Fichier | Traitement |', '| **Point** | Fichier | Traitement |', '| Point | File | Traitement |']) {
      const text = revueWithBody(`### Bloquant\n${header}\n|---|---|---|\n| RB1. Un | \`a.mjs\` | corrigé (abc1234) |\n`)
      assert.equal(citing(pointProblems(text), /en-tête/i).length, 1, header)
    }
  })

  it('CA-7 : un revue.md aux sections « ## Tour » (antérieur à FEAT-7) n’est pas contrôlé', () => {
    const text = revueOf([
      { title: 'Tour 1', blocking: [['B1. Ancien format', '`a.mjs`', '']], discuss: [['1. Numéro seul', '`b.mjs`', '']] },
      { title: 'Tour 2', blocking: [['B1. Ancien format', '`a.mjs`', 'À corriger']] },
    ])
    assert.deepEqual(pointProblems(text), [])
    assert.deepEqual(pointProblems(text, { atClose: true }), [])
  })

  it('CA-7 : un revue.md qui garde une section « ## Tour » échappe au contrôle, même avec d’autres sections (RD5, spec §4)', () => {
    const text = revueOf([
      { title: 'Tour 1', blocking: [['B1. Ancien format', '`a.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : 2026-11-22', blocking: [['B2. Nouveau', '`b.mjs`', '']] },
    ])
    assert.deepEqual(pointProblems(text), [])
  })

  it('CA-7 : un revue.md aux autres sections, sans aucun RB/RD mais avec des points B1., est contrôlé', () => {
    const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['B1. Ancien format', '`a.mjs`', 'corrigé (abc1234)']], discuss: [['D1. Autre', '`b.mjs`', 'écarté : doublon']] }])
    const problems = pointProblems(text)
    assert.equal(citing(problems, /B1\. Ancien format/).length, 1)
    assert.equal(citing(problems, /D1\. Autre/).length, 1)
  })

  it('CA-13 : un RD requalifié en RB, puis traité sous son nouvel identifiant, ne laisse aucun problème', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] },
    ])
    assert.deepEqual(pointProblems(text), [])
    assert.deepEqual(pointProblems(text, { atClose: true }), [])
  })

  it('CA-14 : un RB dans le tableau « À discuter » ou un RD dans le tableau « Bloquant » est signalé', () => {
    const text = revueOf([{
      title: 'Revue : 2026-11-21',
      blocking: [['RD1. Mal rangé', '`a.mjs`', 'corrigé (abc1234)']],
      discuss: [['RB1. Mal rangé aussi', '`b.mjs`', 'corrigé (abc1234)']],
    }])
    const problems = pointProblems(text)
    assert.equal(citing(problems, /\bRD1\b/).length, 1)
    assert.equal(citing(problems, /\bRB1\b/).length, 1)
  })

  it('CA-16 : un point reporté à une tranche est accepté à l’enregistrement de la revue, refusé à la clôture', () => {
    const text = revueOf([{
      title: 'Revue : tranche 1 : 2026-11-21',
      discuss: [['RD1. Reporté en tranche', '`a.mjs`', 'Reporté (tranche 2) : avec CA-6'], ['RD2. Reporté ailleurs', '`b.mjs`', 'reporté (FIX-12)']],
    }])
    assert.deepEqual(pointProblems(text), [])
    const atClose = pointProblems(text, { atClose: true })
    assert.equal(atClose.length, 1)
    assert.match(atClose[0], /\bRD1\b/)
  })

  it('CA-16 : un point reporté à une tranche puis traité dans une revue suivante n’est pas refusé à la clôture', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD1. Reporté', '`a.mjs`', 'reporté (tranche 2)']] },
      { title: 'Revue : tranche 2 : 2026-11-22', discuss: [['RD1 (repris). Reporté', '`a.mjs`', 'corrigé (abc1234)']] },
    ])
    assert.deepEqual(pointProblems(text, { atClose: true }), [])
  })

  it('CA-17 : un titre ### proche de « Bloquant » ou « À discuter » est signalé', () => {
    for (const title of ['Bloquants', 'bloquant', 'A discuter', 'À discuter :', '**Bloquant**']) {
      const text = revueWithBody(`### ${title}\n${pointTable}| RB1. Un | \`a.mjs\` | corrigé (abc1234) |\n`)
      assert.equal(citing(pointProblems(text), new RegExp(title.replace(/[*]/g, '\\$&'))).length, 1, title)
    }
  })

  it('CA-17 : une ligne de point hors d’un tableau de points est signalée, une phrase qui cite un point ne l’est pas', () => {
    const text = `${revueOf([{ title: 'Revue : 2026-11-21', discuss: [['RD1. Un', '`a.mjs`', 'corrigé (abc1234)']] }])}\n- RD1 corrigé, voir plus haut.\n\n### Contrôles\n${pointTable}| RB1. Perdu | \`x\` | corrigé (abc1234) |\n`
    const problems = pointProblems(text)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /\bRB1\b/)
  })

  it('CA-5 : un identifiant repris deux fois dans une même section est signalé (OB2)', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Premier', '`a.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB1 (repris). Premier', '`a.mjs`', ''], ['RB1 (repris). Premier', '`a.mjs`', 'corrigé (def5678)']] },
    ])
    const problems = citing(pointProblems(text), /\bRB1\b/)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /Revue : tranche 1 : 2026-11-22/)
  })

  it('CA-16 : un report à une tranche écrit librement est aussi refusé à la clôture (OD12)', () => {
    for (const treatment of ['reporté en tranche 3', 'Reporté (tranche 2, avec CA-6)']) {
      const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD1. Reporté', '`a.mjs`', treatment]] }])
      assert.deepEqual(pointProblems(text), [], treatment)
      assert.equal(citing(pointProblems(text, { atClose: true }), /\bRD1\b/).length, 1, treatment)
    }
  })

  it('CA-16 : un report à une tranche accordé au féminin est aussi refusé à la clôture', () => {
    for (const treatment of ['Reportée (tranche 2)', 'reportée en tranche 3']) {
      const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD1. Reporté', '`a.mjs`', treatment]] }])
      assert.deepEqual(pointProblems(text), [], treatment)
      assert.equal(citing(pointProblems(text, { atClose: true }), /\bRD1\b/).length, 1, treatment)
    }
  })

  it('CA-18 : un point requalifié vers un identifiant qui ne le reprend jamais (ex-) est signalé', () => {
    const alone = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] }])
    const withoutEx = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4. Autre chose', '`b.mjs`', 'corrigé (abc1234)']] },
    ])
    for (const [name, text] of Object.entries({ alone, withoutEx })) {
      assert.equal(citing(pointProblems(text), /\bRD3\b/).length, 1, name)
    }
  })

  it('CA-18 : un point marqué repris sans occurrence plus haut est signalé', () => {
    const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB7 (repris). Jamais présenté', '`a.mjs`', 'corrigé (abc1234)']] }])
    const problems = pointProblems(text)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /\bRB7\b/)
  })

  it('CA-18 : un point ex-RD3 sans RD3 plus haut est signalé', () => {
    const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] }])
    const problems = pointProblems(text)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /\bRB4\b/)
    assert.match(problems[0], /\bRD3\b/)
  })

  it('CA-18 : dans une même section, la requalification est reprise même si le tableau Bloquant précède (OD19)', () => {
    const text = revueOf([{
      title: 'Revue : tranche 1 : 2026-11-21',
      blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']],
      discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']],
    }])
    assert.deepEqual(pointProblems(text), [])
  })

  it('CA-18 : entre sections, l’ordre compte : ex- et repris avant le point d’origine sont signalés (OD22)', () => {
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

  it('CA-18 : une reprise qui renvoie à un autre point (RB4 ex-RD9) ne ferme pas la requalification de RD3 (OD22)', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)'], ['RD9. Autre', '`b.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4 (ex-RD9). Autre', '`b.mjs`', 'corrigé (abc1234)']] },
    ])
    const problems = pointProblems(text)
    assert.equal(citing(problems, /^RD3\b/).length, 1)
    assert.deepEqual(citing(problems, /^RD9\b/), [])
  })

  it('CA-18 : un requalifié sans identifiant est signalé ; un identifiant suivi d’un commentaire est lu (OD20)', () => {
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

  it('CA-1 : le prochain numéro suit le plus grand de chaque série, toutes sections confondues', () => {
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Un', '`a.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Un', '`a.mjs`', 'écarté : doublon'], ['RD7. Sept', '`b.mjs`', 'écarté : doublon']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB3. Trois', '`c.mjs`', 'corrigé (def5678)']], discuss: [['RD2. Deux', '`d.mjs`', 'écarté : doublon']] },
    ])
    const { next } = core.nextReviewIds({ ...noFiles, revue })
    assert.equal(next.RB, 4)
    assert.equal(next.RD, 8)
  })

  it('CA-1 : un identifiant cité seulement dans une référence ex- compte aussi', () => {
    const revue = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB2 (ex-RD9). Requalifié', '`a.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Un', '`b.mjs`', 'écarté : doublon']] }])
    const { next } = core.nextReviewIds({ ...noFiles, revue })
    assert.equal(next.RB, 3)
    assert.equal(next.RD, 10)
  })

  it('CA-2 : sans aucun fichier, tous les numéros sont à 1 et aucun point n’est ouvert', () => {
    assert.deepEqual(core.nextReviewIds(noFiles), { next: allOnes, open: [] })
  })

  it('CA-2 : un revue.md sans point donne RB1 et RD1, sans point ouvert', () => {
    for (const revue of [revueOf([{ title: 'Revue : tranche 1 : 2026-11-21' }]), revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['Aucun', '', '']], discuss: [['aucun.', '', '']] }])]) {
      assert.deepEqual(core.nextReviewIds({ ...noFiles, revue }), { next: allOnes, open: [] })
    }
  })

  it('CA-13 : le prochain RD tient compte d’un RD requalifié, le prochain RB du RB qui le reprend', () => {
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] },
    ])
    const { next, open } = core.nextReviewIds({ ...noFiles, revue })
    assert.equal(next.RD, 4)
    assert.equal(next.RB, 5)
    assert.deepEqual(open, [])
  })

  it('CA-10 : SB, SD, OB, OD suivent le plus grand numéro cité dans spec.md et decisions.md', () => {
    const spec = '---\nid: TEC-30\n---\n\n# TEC-30\n\nAmendement : SD2 retenu, OD3 écarté. Mot collé : XSB9.\n'
    const decisions = '# Décisions\n\n- OB1 accepté.\n- OD5 reporté.\n- SD1 écarté.\n'
    const { next } = core.nextReviewIds({ revue: null, spec, decisions })
    assert.deepEqual(next, { RB: 1, RD: 1, SB: 1, SD: 3, OB: 2, OD: 6 })
  })

  it('CA-10 : les points ouverts sont ceux dont la dernière occurrence n’a pas de traitement, avec leur intitulé et leur section', () => {
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Premier', '`a.mjs`', ''], ['RB2. Second', '`b.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Discuté', '`c.mjs`', 'À corriger au build']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB1 (repris). Premier', '`a.mjs`', 'corrigé (def5678)'], ['RB2 (repris). Second encore', '`b.mjs`', '']] },
    ])
    assert.deepEqual(core.nextReviewIds({ ...noFiles, revue }).open, [
      { id: 'RD1', title: 'Discuté', section: 'Revue : tranche 1 : 2026-11-21' },
      { id: 'RB2', title: 'Second encore', section: 'Revue : tranche 2 : 2026-11-22' },
    ])
  })

  it('CA-10 : atelier review-ids --json lit revue.md, spec.md et decisions.md du chantier actif', () => {
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
    it(`CA-8 : set-reviewed refuse un point ouvert de la copie de travail de revue.md (${label}), sans rien écrire dans la spec`, () => {
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

  it('CA-8 : set-reviewed enregistre la revue quand tous les points de la copie de travail sont traités', () => {
    const { directory } = implementedSlice({ slice: 2 })
    writeFileSync(revuePath(directory), allTreated)
    atelierOk(directory, 'set-reviewed')
    assert.equal(specData(directory, 'FEAT-20').slice, '3')
  })

  for (const command of [['close-check'], ['set-status', 'done']]) {
    it(`CA-9 : ${command.join(' ')} refuse la clôture avec un point ouvert dans un revue.md commité`, () => {
      const directory = reviewedWithRevue(openPoint)
      const before = specFileText(directory, 'FEAT-20')
      const { status, output } = atelierRun(directory, ...command)
      assert.notEqual(status, 0, output)
      assert.match(output, /RB1\b.*Push non vérifié/)
      assert.equal(specFileText(directory, 'FEAT-20'), before)
    })

    it(`CA-9 : ${command.join(' ')} refuse la clôture quand revue.md a des modifications non commitées`, () => {
      const directory = reviewedWithRevue(allTreated)
      writeFileSync(revuePath(directory), `${allTreated}\n- Note ajoutée après coup.\n`)
      const { status, output } = atelierRun(directory, ...command)
      assert.notEqual(status, 0, output)
      assert.match(output, /revue\.md/)
    })
  }

  it('CA-9 : close-check accepte la clôture avec un revue.md commité dont tous les points sont traités', () => {
    const { status, output } = atelierRun(reviewedWithRevue(allTreated), 'close-check')
    assert.equal(status, 0, output)
  })

  it('CA-16 : un point reporté (tranche 2) ne bloque pas set-reviewed', () => {
    const { directory } = implementedSlice({ slice: 2 })
    writeFileSync(revuePath(directory), postponed)
    atelierOk(directory, 'set-reviewed')
    assert.equal(specData(directory, 'FEAT-20').slice, '3')
  })

  it('CA-16 : un point dont la dernière occurrence est reporté (tranche 2) bloque la clôture et est listé', () => {
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
    it(`CA-11 : ${file} mentionne ${prefixes.join(' et ')}`, () => {
      const text = pluginText(file)
      assert.deepEqual(prefixes.filter((prefix) => !mentions(text, prefix)), [])
    })
  }

  it('CA-11 : la skill amend cite un identifiant de point de relecture', () => {
    assert.ok(['RB', 'RD', 'SB', 'SD', 'OB', 'OD'].some((prefix) => mentions(pluginText('skills/amend/SKILL.md'), prefix)))
  })

  for (const file of ['skills/review/SKILL.md', 'skills/sign/SKILL.md', 'skills/build/SKILL.md']) {
    it(`CA-11 : ${file} obtient les numéros par atelier review-ids`, () => {
      assert.match(pluginText(file), /atelier review-ids/)
    })
  }

  for (const file of ['templates/revue.md', 'agents/reviewer.md', 'skills/review/SKILL.md']) {
    it(`CA-11 : ${file} donne la forme (repris), (ex-…) et les traitements reporté et requalifié`, () => {
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

  it('CA-19 : la page des commandes documente review-ids et le refus de set-reviewed et close-check sur un point ouvert', () => {
    const commands = site('reference/commandes.md')
    const reviewIds = row(commands, '`atelier review-ids')
    for (const prefix of ['RB', 'RD', 'SB', 'SD', 'OB', 'OD']) {
      assert.match(reviewIds, new RegExp(`\\b${prefix}\\d*\\b`), `${prefix} absent de la ligne review-ids`)
    }
    assert.match(reviewIds, /ouverts?/)
    assert.match(row(commands, '`atelier set-reviewed`'), /points?[^|]*(ouverts?|sans traitement)/i)
    assert.match(row(commands, '`atelier close-check`'), /points?[^|]*(ouverts?|sans traitement)/i)
  })

  it('CA-19 : le glossaire définit le point de relecture, ses six préfixes et le traitement', () => {
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

  it('CA-1 : le hook de fin de tour ne relance pas les contrôles que checks vient de passer', () => {
    const { directory, runs } = closableRepository()
    writeFileSync(join(directory, 'src', 'b.mjs'), 'code non commité\n')
    atelierOk(directory, 'checks')
    assert.equal(runs(), 1)
    const { status, output } = hookGate(directory)
    assert.equal(status, 0, output)
    assert.equal(runs(), 1, 'le hook réutilise le vert de checks')
  })

  it('CA-2 : checks ne relance pas des contrôles déjà verts sur cet état du code, et le dit', () => {
    const { directory, runs } = closableRepository()
    atelierOk(directory, 'checks')
    const output = atelierOk(directory, 'checks')
    assert.equal(runs(), 1)
    assert.match(output, /déjà verts?/i)
  })

  it('CA-2 : checks réutilise le vert enregistré par le hook de fin de tour', () => {
    const { directory, runs } = closableRepository()
    writeFileSync(join(directory, 'src', 'b.mjs'), 'code non commité\n')
    assert.equal(hookGate(directory).status, 0)
    assert.equal(runs(), 1)
    atelierOk(directory, 'checks')
    assert.equal(runs(), 1)
  })

  for (const command of [['checks'], ['close-check'], ['set-status', 'done']]) {
    it(`CA-3 : ${command.join(' ')} relance les contrôles quand un fichier a changé depuis le dernier vert`, () => {
      const { directory, runs } = closableRepository()
      atelierOk(directory, 'checks')
      writeFileSync(join(directory, 'docs', 'notes.md'), 'note\n')
      atelierOk(directory, ...command)
      assert.equal(runs(), 2)
    })
  }

  it('CA-4 : set-status done après un close-check réussi ne relance pas les contrôles', () => {
    const { directory, runs } = closableRepository()
    atelierOk(directory, 'close-check')
    assert.equal(runs(), 1)
    atelierOk(directory, 'set-status', 'done')
    assert.equal(runs(), 1)
    assert.equal(specData(directory, 'FEAT-20').status, 'done')
  })

  it('CA-4 : set-status done refait les autres vérifications de clôture même quand les contrôles sont déjà verts', () => {
    const { directory, runs } = closableRepository({ revue: open })
    atelierOk(directory, 'checks')
    const { status, output } = atelierRun(directory, 'set-status', 'done')
    assert.notEqual(status, 0, output)
    assert.match(output, /RB1\b.*Push non vérifié/)
    assert.equal(runs(), 1)
    assert.equal(specData(directory, 'FEAT-20').status, 'signed')
  })

  it('CA-5 : checks --force relance des contrôles déjà verts', () => {
    const { directory, runs } = closableRepository()
    atelierOk(directory, 'checks')
    atelierOk(directory, 'checks', '--force')
    assert.equal(runs(), 2)
  })

  it('CA-6 : un échec n’est pas mémorisé, checks relance les contrôles', () => {
    const { directory, runs } = closableRepository({ fails: true })
    assert.notEqual(atelierRun(directory, 'checks').status, 0)
    assert.notEqual(atelierRun(directory, 'checks').status, 0)
    assert.equal(runs(), 2)
  })

  it('CA-7 : sans empreinte calculable, les contrôles sont lancés comme aujourd’hui', () => {
    const { directory, runs } = closableRepository()
    writeFileSync(join(directory, '.atelier'), 'un fichier à la place du dossier\n')
    atelierOk(directory, 'checks')
    atelierOk(directory, 'checks')
    assert.equal(runs(), 2)
    atelierOk(directory, 'close-check')
    assert.equal(runs(), 3)
  })
})

// A repository with atelier installed, the given chantier folders (not committed), one empty
// commit per subject on main, and the given extra branches pointing at main.
function makeCounterRepository({ folders = [], subjects = [], branches = [] }) {
  const directory = makeRepository('main')
  folders.forEach((folder) => mkdirSync(join(directory, 'docs', 'chantiers', folder), { recursive: true }))
  subjects.forEach((subject) => commit(directory, subject))
  branches.forEach((branch) => git(directory, 'branch', branch))
  return directory
}

describe('Next identifier: where the counter reads identifiers', () => {
  it('commit subjects count only bracketed identifiers [FIX-18 CA-1]', () => {
    const subjects = [
      'test(plugin): [FEAT-7] add failing tests for CA-13',
      'fix: support UTF-8 and ISO-8601 dates',
      'docs: follow RFC-7231',
    ]
    const directory = makeCounterRepository({ folders: ['FEAT-7-x'], subjects })
    assert.equal(atelier(directory, 'next-id', 'EPIC').trim(), 'EPIC-8')
    assert.deepEqual(core.commitSubjectIdentifiers(subjects[0]), ['FEAT-7'])
    assert.deepEqual(core.commitSubjectIdentifiers(subjects[1]), [])
    assert.deepEqual(core.commitSubjectIdentifiers(subjects[2]), [])
  })

  it('bracketed identifiers keep the counter going, legacy prefixes included [FIX-18 CA-2]', () => {
    const directory = makeCounterRepository({
      subjects: ['feat(envelopes): [FEA-26] add', '[BUG-421] fix', 'test(plugin): [TEC-437 CA-3] cover'],
    })
    assert.equal(atelier(directory, 'next-id', 'FIX').trim(), 'FIX-438')
  })

  it('branch names and chantier folders count without any bracketed commit [FIX-18 CA-3]', () => {
    const directory = makeCounterRepository({
      folders: ['FEA-26-y'],
      subjects: ['docs: CA-900 checked'],
      branches: ['fix/BUG-421-x'],
    })
    assert.equal(atelier(directory, 'next-id', 'FEAT').trim(), 'FEAT-422')
  })

  it('branch names count only an identifier opening a segment [FIX-18 CA-4]', () => {
    const botBranches = ['renovate/node-20.x', 'dependabot/npm_and_yarn/vite-5.4.12']
    const directory = makeCounterRepository({ folders: ['FEAT-7-x'], branches: botBranches })
    assert.equal(atelier(directory, 'next-id', 'FEAT').trim(), 'FEAT-8')
    botBranches.forEach((branch) => assert.deepEqual(core.branchNameIdentifiers(branch), [], branch))
    assert.deepEqual(core.branchNameIdentifiers('origin/fix/BUG-421-x'), ['BUG-421'])
  })

  it('identifiers are read whatever their case, without a closing bracket, at the end of a branch name [FIX-18 CA-1, CA-2, CA-4]', () => {
    assert.deepEqual(core.commitSubjectIdentifiers('test(plugin): [feat-7] add'), ['FEAT-7'])
    assert.deepEqual(core.commitSubjectIdentifiers('test(plugin): [TEC-437 CA-3] cover'), ['TEC-437'])
    assert.deepEqual(core.branchNameIdentifiers('fix/fix-18-x'), ['FIX-18'])
    assert.deepEqual(core.branchNameIdentifiers('feature/JIRA-123'), ['JIRA-123'])
  })
})
