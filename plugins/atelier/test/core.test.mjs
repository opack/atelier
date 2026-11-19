import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path, { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_CONFIG,
  applyToolEdit,
  checkSpec,
  chantierIdFromText,
  decideStop,
  decideWrite,
  highestChantierNumber,
  matchesAny,
  nextChantierId,
  nextStep,
  parseFrontMatter,
  setFrontMatterValues,
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
    assert.equal(decide({ relativePath: path, toolName: 'Edit', existingSpec }).allowed, true)
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

describe('project relative paths', () => {
  it('tells files outside the project apart, other drives and case included on Windows', () => {
    assert.equal(toProjectRelativePath('C:\\proj', 'C:\\proj\\src\\a.ts', path.win32), 'src/a.ts')
    assert.equal(toProjectRelativePath('C:\\Proj', 'c:\\proj\\src\\a.ts', path.win32), 'src/a.ts')
    assert.equal(toProjectRelativePath('C:\\proj', 'D:\\proj\\src\\a.ts', path.win32), null)
    assert.equal(toProjectRelativePath('C:\\proj', 'C:\\other\\a.ts', path.win32), null)
    assert.equal(toProjectRelativePath('/proj', '/proj/..cache/a.ts', path.posix), '..cache/a.ts')
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

describe('next step', () => {
  it('follows the process order', () => {
    assert.match(nextStep(null), /\/atelier:new/)
    assert.match(nextStep(draftChantier), /\/atelier:sign/)
    assert.match(nextStep(signedChantier), /\/atelier:plan/)
    assert.match(nextStep({ ...signedChantier, files: ['spec.md', 'plan.md'] }), /\/atelier:tests/)
    assert.match(nextStep({ ...implementingChantier, files: ['spec.md', 'plan.md'] }), /\/atelier:build/)
    const signedFix = { ...signedChantier, spec: { data: { status: 'signed', type: 'FIX', tdd: 'yes' } } }
    assert.match(nextStep(signedFix), /\/atelier:tests/)
    assert.match(nextStep(signedTec), /\/atelier:build/)
  })
})
