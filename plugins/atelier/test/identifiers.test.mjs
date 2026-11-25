import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { activeChantier } from '../lib/cli/identifiers.mjs'
import { branchNameIdentifiers, chantierIdFromCommitSubjects, chantierIdFromText, commitSubjectIdentifiers, highestChantierNumber, nextChantierId } from '../lib/identifiers.mjs'
import { DEFAULT_CONFIG } from '../lib/common.mjs'
import { atelierBin, temporaryDirectory, git, commit, makeRepository, atelier, makeChantiersRepository } from './helpers.mjs'

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

describe('chantier id from commit subjects', () => {
  it('rend l’identifiant du commit le plus récent qui en porte un [TEC-6 CA-1]', () => {
    assert.equal(
      chantierIdFromCommitSubjects(['wip', 'docs(chantiers): [TEC-5] spec draft', 'docs(chantiers): [TEC-4] spec draft']),
      'TEC-5',
    )
  })

  it('crochets obligatoires, casse ignorée, type inconnu ignoré, liste vide [TEC-6 CA-2]', () => {
    assert.equal(chantierIdFromCommitSubjects(['merge after FEAT-4']), null)
    assert.equal(chantierIdFromCommitSubjects(['fix(x): [feat-12] typo']), 'FEAT-12')
    assert.equal(chantierIdFromCommitSubjects(['chore: [JIRA-3] bump']), null)
    assert.equal(chantierIdFromCommitSubjects(['chore: [JIRA-3] bump', 'docs: [SPIKE-2] notes']), 'SPIKE-2')
    assert.equal(chantierIdFromCommitSubjects([]), null)
  })
})

function addChantierSpec(directory, id, slug) {
  const chantierDirectory = join(directory, 'docs', 'chantiers', `${id}-${slug}`)
  mkdirSync(chantierDirectory, { recursive: true })
  writeFileSync(join(chantierDirectory, 'spec.md'), `---\nid: ${id}\ntype: TEC\ntitle: Essai ${id}\nstatus: draft\ntdd: yes\n---\n\n# ${id}\n`)
  git(directory, 'add', '.')
  commit(directory, `docs(chantiers): [${id}] spec draft`)
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

  it('sur une branche non conforme, déduit le chantier du commit [<ID>] [TEC-6 CA-3]', () => {
    const directory = makeDeductionRepository()
    const { branch, chantier, source } = activeChantier(directory, config)
    assert.equal(branch, 'claude/x')
    assert.equal(chantier?.id, 'TEC-9')
    assert.ok(chantier.directory, 'le dossier du chantier déduit est trouvé')
    assert.equal(chantier.spec?.data.status, 'draft')
    assert.equal(source, 'commits')
  })

  it('sur la branche par défaut, aucun chantier [TEC-6 CA-3]', () => {
    const directory = makeDeductionRepository()
    git(directory, 'switch', '-q', 'main')
    const { chantier, source } = activeChantier(directory, config)
    assert.equal(chantier, null)
    assert.equal(source, null)
  })

  it('le nom de branche reste prioritaire sur les commits [TEC-6 CA-3]', () => {
    const directory = makeDeductionRepository()
    git(directory, 'switch', '-q', 'tec/TEC-8-y')
    const { chantier, source } = activeChantier(directory, config)
    assert.equal(chantier?.id, 'TEC-8')
    assert.equal(source, 'branch')
  })

  it('sans branche par défaut identifiable, aucun chantier et aucune erreur [TEC-6 CA-4]', () => {
    const directory = makeRepository('trunk')
    git(directory, 'switch', '-q', '-c', 'claude/x')
    addChantierSpec(directory, 'TEC-9', 'x')
    const { branch, chantier, source } = activeChantier(directory, config)
    assert.equal(branch, 'claude/x')
    assert.equal(chantier, null)
    assert.equal(source, null)
  })

  it('HEAD détachée, aucun chantier déduit [TEC-6 CA-4]', () => {
    const directory = makeDeductionRepository()
    git(directory, 'switch', '-q', '--detach', 'claude/x')
    const { chantier } = activeChantier(directory, config)
    assert.equal(chantier, null)
  })

  it('un main local en avance sur origin/main n’a pas de chantier actif [TEC-6 CA-5]', () => {
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

  it('avec une origine, la base est origin/main pour une branche non conforme [TEC-6 CA-5]', () => {
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
  it('status --json expose chantierSource [TEC-6 CA-6]', () => {
    const directory = makeDeductionRepository()
    assert.equal(JSON.parse(atelier(directory, 'status', '--json')).chantierSource, 'commits')
    git(directory, 'switch', '-q', 'tec/TEC-8-y')
    assert.equal(JSON.parse(atelier(directory, 'status', '--json')).chantierSource, 'branch')
    git(directory, 'switch', '-q', 'main')
    assert.equal(JSON.parse(atelier(directory, 'status', '--json')).chantierSource, null)
  })

  it('status et le hook de démarrage signalent un chantier déduit des commits [TEC-6 CA-6]', () => {
    const directory = makeDeductionRepository()
    assert.match(atelier(directory, 'status'), /TEC-9.*\(déduit des commits\)/)
    assert.match(atelier(directory, 'hook-session-start'), /TEC-9.*\(déduit des commits\)/)
  })

  it('rien de tel quand le chantier vient du nom de branche [TEC-6 CA-6]', () => {
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

  it('avec origin/HEAD vers origin/main, déduit le chantier sur une branche non conforme [TEC-6 CA-7]', () => {
    const directory = makeRepositoryWithOrigin()
    git(directory, 'remote', 'set-head', 'origin', 'main')
    git(directory, 'switch', '-q', '-c', 'claude/x', 'main')
    addChantierSpec(directory, 'TEC-9', 'x')
    const { chantier, source } = activeChantier(directory, config)
    assert.equal(chantier?.id, 'TEC-9')
    assert.equal(source, 'commits')
  })

  it('origin/HEAD vers develop : aucun chantier sur develop, déduction depuis develop ailleurs [TEC-6 CA-8]', () => {
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

  it('la garde d’écriture applique les règles du chantier déduit des commits [TEC-6 CA-10]', () => {
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

  it('une branche non conforme sans commit propre n’a pas de chantier [TEC-6 CA-9]', () => {
    const directory = makeDeductionRepository()
    git(directory, 'switch', '-q', '-c', 'claude/empty', 'main')
    const { branch, chantier, source } = activeChantier(directory, config)
    assert.equal(branch, 'claude/empty')
    assert.equal(chantier, null)
    assert.equal(source, null)
  })
})

describe('EPIC identifiers', () => {
  it('next-id EPIC suit le compteur unique ; epic/EPIC-7-x et [EPIC-7] désignent EPIC-7 [FEAT-4 CA-6]', () => {
    assert.equal(nextChantierId('EPIC', ['FEAT-12-x', '[BUG-421] FIX']), 'EPIC-422')
    assert.equal(chantierIdFromText('epic/EPIC-7-x'), 'EPIC-7')
    assert.equal(chantierIdFromCommitSubjects(['docs(chantiers): [EPIC-7] plan']), 'EPIC-7')
    const directory = makeChantiersRepository({ branches: { 'epic/EPIC-7-x': [{ id: 'EPIC-7' }] }, checkout: 'epic/EPIC-7-x' })
    assert.equal(atelier(directory, 'next-id', 'EPIC').trim(), 'EPIC-8')
    assert.equal(JSON.parse(atelier(directory, 'status', '--json')).chantier.id, 'EPIC-7')
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
    assert.deepEqual(commitSubjectIdentifiers(subjects[0]), ['FEAT-7'])
    assert.deepEqual(commitSubjectIdentifiers(subjects[1]), [])
    assert.deepEqual(commitSubjectIdentifiers(subjects[2]), [])
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
    botBranches.forEach((branch) => assert.deepEqual(branchNameIdentifiers(branch), [], branch))
    assert.deepEqual(branchNameIdentifiers('origin/fix/BUG-421-x'), ['BUG-421'])
  })

  it('identifiers are read whatever their case, without a closing bracket, at the end of a branch name [FIX-18 CA-1, CA-2, CA-4]', () => {
    assert.deepEqual(commitSubjectIdentifiers('test(plugin): [feat-7] add'), ['FEAT-7'])
    assert.deepEqual(commitSubjectIdentifiers('test(plugin): [TEC-437 CA-3] cover'), ['TEC-437'])
    assert.deepEqual(branchNameIdentifiers('fix/fix-18-x'), ['FIX-18'])
    assert.deepEqual(branchNameIdentifiers('feature/JIRA-123'), ['JIRA-123'])
  })
})
