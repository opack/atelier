import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { setFrontMatterValues } from '../lib/common.mjs'
import {
  atelierBin, atelierOk, chantierDirectoryOf, epicPlan, git, listed, listedIds, makeChantiersRepository, makeRepository,
  temporaryDirectory, threeSlices, writeChantier,
} from './helpers.mjs'

// `atelier list` across branches: which version of a chantier is shown (the five rules of the
// spec), its location, and the facts read on a branch (plan, slices).

// Commits everything with a fixed date, so that « the most recent commit » does not depend on the
// speed of the test.
function commitAt(directory, day, subject = `chore: ${day}`) {
  git(directory, 'add', '-A')
  const date = `2026-01-${String(day).padStart(2, '0')}T10:00:00Z`
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-q', '-m', subject], {
    cwd: directory,
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function setSpecValues(directory, id, values) {
  const specPath = join(chantierDirectoryOf(directory, id), 'spec.md')
  writeFileSync(specPath, setFrontMatterValues(readFileSync(specPath, 'utf8'), values))
}

// A bare remote `origin` for `directory`.
function addOrigin(directory) {
  const origin = temporaryDirectory('atelier-feat35-origin-')
  git(origin, 'init', '-q', '--bare', '-b', 'main')
  git(directory, 'remote', 'add', 'origin', origin)
  return origin
}

// Pushes to `origin/<branch>` a commit made on top of `<branch>` by `change`, dated `day`, without
// moving the local branch.
function pushNewerRemote(directory, branch, day, change) {
  const back = git(directory, 'rev-parse', '--abbrev-ref', 'HEAD').trim()
  git(directory, 'switch', '-q', '-c', 'scratch-remote', branch)
  change()
  commitAt(directory, day)
  git(directory, 'push', '-q', 'origin', `scratch-remote:${branch}`)
  git(directory, 'switch', '-q', back)
  git(directory, 'branch', '-q', '-D', 'scratch-remote')
  git(directory, 'fetch', '-q', 'origin')
}

function byId(chantiers, id) {
  const chantier = chantiers.find((candidate) => candidate.id === id)
  assert.ok(chantier, `${id} absent de ${JSON.stringify(chantiers.map((candidate) => candidate.id))}`)
  return chantier
}

describe('chantiers found on other branches', () => {
  const directory = makeChantiersRepository({
    main: [{ id: 'FEAT-41', status: 'draft', relations: { title: 'Brouillon ici' } }],
    branches: {
      'feat/FEAT-40-x': [{ id: 'FEAT-40', status: 'signed' }],
      'feat/FEAT-41-y': [{ id: 'FEAT-41', status: 'signed', relations: { title: 'Signé sur sa branche' } }],
    },
  })

  it('absent de l’arbre courant : lu sur sa branche, qui est son emplacement, sans chemin [FEAT-35 CA-9]', () => {
    const feat = byId(listed(directory), 'FEAT-40')
    assert.equal(feat.status, 'signed')
    assert.equal(feat.location, 'feat/FEAT-40-x')
    assert.equal(feat.path, null)
  })

  it('en brouillon ici, signé sur la branche qui porte son identifiant : la branche l’emporte, le chemin reste celui de l’arbre courant [FEAT-35 CA-9]', () => {
    const feat = byId(listed(directory), 'FEAT-41')
    assert.equal(feat.status, 'signed')
    assert.equal(feat.title, 'Signé sur sa branche')
    assert.equal(feat.location, 'feat/FEAT-41-y')
    assert.equal(realpathSync(feat.path), realpathSync(chantierDirectoryOf(directory, 'FEAT-41')))
  })

  it('la sortie texte donne la branche comme emplacement [FEAT-35 CA-9]', () => {
    const output = atelierOk(directory, 'list')
    const line = output.split(/\r?\n/).find((candidate) => /\bFEAT-40\b/.test(candidate))
    assert.ok(line, output)
    assert.match(line, /feat\/FEAT-40-x/)
    assert.doesNotMatch(line, /\bici\b/)
  })
})

describe('the current branch carries the identifier of the chantier', () => {
  it('la copie de travail de la branche courante l’emporte sur un commit distant plus récent [FEAT-35 CA-10]', () => {
    const directory = makeRepository('main')
    addOrigin(directory)
    git(directory, 'switch', '-q', '-c', 'feat/FEAT-42-z')
    writeChantier(directory, { id: 'FEAT-42', status: 'draft' })
    commitAt(directory, 1)
    git(directory, 'push', '-q', 'origin', 'feat/FEAT-42-z')
    pushNewerRemote(directory, 'feat/FEAT-42-z', 5, () => setSpecValues(directory, 'FEAT-42', { title: 'Plus récent' }))
    setSpecValues(directory, 'FEAT-42', { status: 'signed' })
    const feat = byId(listed(directory), 'FEAT-42')
    assert.equal(feat.status, 'signed')
    assert.equal(feat.location, null)
    assert.match(atelierOk(directory, 'list'), /FEAT-42.*\bici\b/)
  })
})

describe('a chantier closed in the current tree', () => {
  it('done ici, signed sur sa branche locale : listé done, « ici », seulement avec --all [FEAT-35 CA-11]', () => {
    const directory = makeRepository('main')
    git(directory, 'switch', '-q', '-c', 'feat/FEAT-43-w')
    writeChantier(directory, { id: 'FEAT-43', status: 'signed' })
    commitAt(directory, 1)
    git(directory, 'switch', '-q', 'main')
    git(directory, 'merge', '-q', '--ff-only', 'feat/FEAT-43-w')
    setSpecValues(directory, 'FEAT-43', { status: 'done' })
    commitAt(directory, 2)
    git(directory, 'switch', '-q', 'feat/FEAT-43-w')
    setSpecValues(directory, 'FEAT-43', { title: 'Retouché après la fusion' })
    commitAt(directory, 9)
    git(directory, 'switch', '-q', 'main')
    const feat = byId(listed(directory, '--all'), 'FEAT-43')
    assert.equal(feat.status, 'done')
    assert.equal(feat.location, null)
    assert.deepEqual(listedIds(directory), [])
  })
})

describe('several branches carry the identifier: the most recent commit wins', () => {
  // FEAT-44 on the local branch (slice 1) and on origin (slice 2), from main.
  function repository({ localDay, remoteDay }) {
    const directory = makeRepository('main')
    addOrigin(directory)
    git(directory, 'switch', '-q', '-c', 'feat/FEAT-44-v')
    writeChantier(directory, { id: 'FEAT-44', tdd: 'yes', relations: { slice: '1', tests_commit: 'abc1234' }, files: { 'plan.md': threeSlices } })
    commitAt(directory, 1)
    git(directory, 'push', '-q', 'origin', 'feat/FEAT-44-v')
    pushNewerRemote(directory, 'feat/FEAT-44-v', remoteDay, () => setSpecValues(directory, 'FEAT-44', { slice: '2' }))
    writeFileSync(join(chantierDirectoryOf(directory, 'FEAT-44'), 'decisions.md'), '# Décisions\n')
    commitAt(directory, localDay)
    git(directory, 'switch', '-q', 'main')
    return directory
  }

  it('origin plus récente : lu sur origin/feat/FEAT-44-v, tranche 2 [FEAT-35 CA-12]', () => {
    const feat = byId(listed(repository({ localDay: 3, remoteDay: 6 })), 'FEAT-44')
    assert.equal(feat.location, 'origin/feat/FEAT-44-v')
    assert.equal(feat.stepLabel, 'Tranche 2/3 : implémentation')
  })

  it('branche locale plus récente : lue sur elle, tranche 1 [FEAT-35 CA-12]', () => {
    const feat = byId(listed(repository({ localDay: 8, remoteDay: 6 })), 'FEAT-44')
    assert.equal(feat.location, 'feat/FEAT-44-v')
    assert.equal(feat.stepLabel, 'Tranche 1/3 : implémentation')
  })

  it('à égalité de date, la branche locale [FEAT-35 CA-12]', () => {
    const feat = byId(listed(repository({ localDay: 6, remoteDay: 6 })), 'FEAT-44')
    assert.equal(feat.location, 'feat/FEAT-44-v')
  })

  it('les faits sont lus sur la branche : plan.md et fichiers du dossier [FEAT-35 CA-12]', () => {
    const directory = makeRepository('main')
    git(directory, 'switch', '-q', '-c', 'feat/FEAT-45-u')
    writeChantier(directory, { id: 'FEAT-45', tdd: 'yes' })
    commitAt(directory, 1)
    git(directory, 'switch', '-q', 'main')
    assert.equal(byId(listed(directory), 'FEAT-45').step, 'plan')
    git(directory, 'switch', '-q', 'feat/FEAT-45-u')
    writeFileSync(join(chantierDirectoryOf(directory, 'FEAT-45'), 'plan.md'), threeSlices)
    commitAt(directory, 2)
    git(directory, 'switch', '-q', 'main')
    assert.equal(byId(listed(directory), 'FEAT-45').stepLabel, 'Tranche 1/3 : tests d’abord')
  })
})

describe('no branch carries the identifier', () => {
  it('dans l’arbre courant : l’arbre courant, même si une autre branche a une version plus récente [FEAT-35 CA-3]', () => {
    const directory = makeChantiersRepository({
      main: [{ id: 'EPIC-17', files: epicPlan }, { id: 'FEAT-24' }],
    })
    git(directory, 'switch', '-q', '-c', 'feat/FEAT-25-x')
    setSpecValues(directory, 'FEAT-24', { rel_parent: 'EPIC-17' })
    commitAt(directory, 20)
    git(directory, 'switch', '-q', 'main')
    assert.deepEqual(listedIds(directory, '--parent', 'EPIC-17'), [])
    assert.equal(byId(listed(directory), 'FEAT-24').location, null)
  })

  it('absent de l’arbre courant : la branche dont le dernier commit est le plus récent [FEAT-35 CA-12]', () => {
    const directory = makeRepository('main')
    git(directory, 'switch', '-q', '-c', 'essais')
    writeChantier(directory, { id: 'FEAT-46', status: 'draft' })
    commitAt(directory, 2)
    git(directory, 'switch', '-q', '-c', 'autre-travail')
    setSpecValues(directory, 'FEAT-46', { status: 'signed' })
    commitAt(directory, 4)
    git(directory, 'switch', '-q', 'main')
    const feat = byId(listed(directory), 'FEAT-46')
    assert.equal(feat.location, 'autre-travail')
    assert.equal(feat.status, 'signed')
  })
})

describe('cases deferred from the review of slice 2', () => {
  it('un texte entre guillemets est découpé en mots [FEAT-35 CA-4]', () => {
    const directory = makeChantiersRepository({
      main: [
        { id: 'FEAT-1', relations: { title: 'Calibrer les relectures' } },
        { id: 'FEAT-2', relations: { title: 'Rélecture du plan' } },
      ],
    })
    assert.deepEqual(listedIds(directory, 'relecture plan'), ['FEAT-2'])
    assert.deepEqual(listedIds(directory, ' plan  relecture '), ['FEAT-2'])
  })

  it('deux dossiers du même identifiant dans l’arbre courant : une seule ligne, doublon signalé avec les deux dossiers [FEAT-35 CA-15]', () => {
    const directory = makeRepository('main')
    writeChantier(directory, { id: 'FEAT-1' })
    const duplicate = join(directory, 'docs', 'chantiers', 'FEAT-1-autre')
    cpSync(chantierDirectoryOf(directory, 'FEAT-1'), duplicate, { recursive: true })
    commitAt(directory, 1)
    const result = spawnSync(process.execPath, [atelierBin, 'list', '--json'], { cwd: directory, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: directory } })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout).map((chantier) => chantier.id), ['FEAT-1'])
    const output = atelierOk(directory, 'list')
    assert.match(output, /FEAT-1-x/)
    assert.match(output, /FEAT-1-autre/)
  })
})
