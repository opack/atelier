import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { setStatusRefusal } from '../lib/close.mjs'
import { DEFAULT_CONFIG, applyToolEdit, parseFrontMatter } from '../lib/common.mjs'
import { decideStop } from '../lib/stop-hook.mjs'
import { signedChantier, draftChantier, signedTec, decide, git, slicedChantier } from './helpers.mjs'

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

  it('gèle integration_branch après la signature (changé, ajouté, retiré), le laisse libre en brouillon [FEAT-21 CA-3]', () => {
    const withOption = signedText.replace('type: FEAT', 'type: EPIC').replace('tdd: yes', 'tdd: no\nintegration_branch: yes')
    const withoutOption = signedText.replace('type: FEAT', 'type: EPIC').replace('tdd: yes', 'tdd: no')
    const cases = [
      ['changé', withOption, { old_string: 'integration_branch: yes', new_string: 'integration_branch: no' }],
      ['ajouté', withoutOption, { old_string: 'tdd: no', new_string: 'tdd: no\nintegration_branch: yes' }],
      ['retiré', withOption, { old_string: 'tdd: no\nintegration_branch: yes', new_string: 'tdd: no' }],
    ]
    for (const [label, text, change] of cases) {
      const decision = edit([entry, change], { current: text, committed: text })
      assert.equal(decision.allowed, false, label)
      assert.match(decision.reason, /« integration_branch »/, label)
      const draft = text.replace('status: signed', 'status: draft')
      assert.equal(edit([change], { current: draft, committed: draft }).allowed, true, `${label} en brouillon`)
    }
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

describe('write guard and stop hook per slice', () => {
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

describe('slice fields written by the command', () => {
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

describe('slice TDD written by the command', () => {
  it('le hook refuse que l’agent change ou retire slice_tdd d’une spec signée [FIX-20 CA-8]', () => {
    const relativePath = 'docs/chantiers/FIX-20-x/spec.md'
    const signedText = '---\nid: FIX-20\ntype: FIX\ntitle: X\nstatus: signed\ntdd: yes\nslice: 2\nslice_tdd: yes\n---\n# FIX-20\n'
    for (const newValue of ['slice_tdd: no', 'slice_tdd:']) {
      const proposed = applyToolEdit(signedText, 'Edit', { old_string: 'slice_tdd: yes', new_string: newValue })
      const decision = decide({
        relativePath,
        existingSpec: parseFrontMatter(signedText),
        proposedSpec: parseFrontMatter(proposed),
        committedSpec: parseFrontMatter(signedText),
      })
      assert.equal(decision.allowed, false, newValue)
      assert.match(decision.reason, /« slice_tdd »/, newValue)
    }
  })
})

describe('write guard on an EPIC', () => {
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
