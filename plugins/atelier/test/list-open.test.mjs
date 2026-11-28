import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  atelierBin, chantierDirectoryOf, commitOnDay, git, listed, makeChantiersRepository, makeRepository, temporaryDirectory, writeChantier,
} from './helpers.mjs'

// `atelier path` and `atelier open`: the absolute path of a chantier directory, the errors, the
// file explorer chosen per platform and the fallback on the path. Also the cases of the listing
// deferred from the reviews of slice 3.

// Runs atelier from `cwd` with exactly `env` (CLAUDE_PROJECT_DIR is not added).
function run(cwd, cliArguments, env = { ...process.env, CLAUDE_PROJECT_DIR: cwd }) {
  const result = spawnSync(process.execPath, [atelierBin, ...cliArguments], { cwd, encoding: 'utf8', env })
  return { status: result.status, stdout: result.stdout ?? '', output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

function withoutProjectDirectory(env = process.env) {
  const copy = { ...env }
  delete copy.CLAUDE_PROJECT_DIR
  return copy
}

const samePath = (actual, expected) => assert.equal(realpathSync(actual.trim()), realpathSync(expected))

describe('atelier path', () => {
  it('chemin absolu du dossier, identifiant sans casse, depuis un sous-dossier du projet [FEAT-35 AC-16]', () => {
    const directory = makeChantiersRepository({ main: [{ id: 'FIX-18' }, { id: 'FIX-180' }] })
    const subdirectory = join(directory, 'src', 'deep')
    mkdirSync(subdirectory, { recursive: true })
    for (const id of ['fix-18', 'FIX-18', 'Fix-18']) {
      const result = run(subdirectory, ['path', id], withoutProjectDirectory())
      assert.equal(result.status, 0, result.output)
      samePath(result.stdout, chantierDirectoryOf(directory, 'FIX-18'))
    }
  })

  it('le chantiersDir configuré est respecté [FEAT-35 AC-16]', () => {
    const directory = makeRepository('main')
    writeFileSync(join(directory, '.claude', 'atelier.json'), JSON.stringify({ chantiersDir: 'suivi/chantiers' }))
    mkdirSync(join(directory, 'suivi', 'chantiers', 'FIX-18-gel'), { recursive: true })
    writeFileSync(join(directory, 'suivi', 'chantiers', 'FIX-18-gel', 'spec.md'), '---\nid: FIX-18\ntype: FIX\ntitle: Gel\nstatus: signed\ntdd: yes\n---\n')
    const result = run(directory, ['path', 'FIX-18'])
    assert.equal(result.status, 0, result.output)
    samePath(result.stdout, join(directory, 'suivi', 'chantiers', 'FIX-18-gel'))
  })
})

describe('atelier path and atelier open: errors', () => {
  const directory = makeChantiersRepository({
    main: [{ id: 'FIX-18' }],
    branches: { 'feat/FEAT-40-x': [{ id: 'FEAT-40' }] },
  })

  for (const command of ['path', 'open']) {
    it(`${command} : chantier présent seulement sur une branche, le message nomme la branche [FEAT-35 AC-17]`, () => {
      const result = run(directory, [command, 'FEAT-40'])
      assert.notEqual(result.status, 0, result.output)
      assert.match(result.output, /feat\/FEAT-40-x/)
    })

    it(`${command} : identifiant inconnu partout, le message le dit [FEAT-35 AC-17]`, () => {
      const result = run(directory, [command, 'FEAT-99'])
      assert.notEqual(result.status, 0, result.output)
      assert.match(result.output, /FEAT-99/)
    })

    it(`${command} : sans argument ou avec un argument qui n’est pas un identifiant, l’usage [FEAT-35 AC-17]`, () => {
      for (const cliArguments of [[command], [command, 'bonjour'], [command, 'FIX-']]) {
        const result = run(directory, cliArguments)
        assert.notEqual(result.status, 0, result.output)
        assert.match(result.output, new RegExp(`usage.*atelier ${command}`, 'i'), cliArguments.join(' '))
      }
    })
  }

  it('deux dossiers du même identifiant dans l’arbre courant : échec qui les nomme [FEAT-35 AC-17]', () => {
    const duplicated = makeChantiersRepository({ main: [{ id: 'FIX-18' }] })
    mkdirSync(join(duplicated, 'docs', 'chantiers', 'FIX-18-autre'))
    writeFileSync(join(duplicated, 'docs', 'chantiers', 'FIX-18-autre', 'spec.md'), '---\nid: FIX-18\ntype: FIX\ntitle: Autre\nstatus: draft\n---\n')
    for (const command of ['path', 'open']) {
      const result = run(duplicated, [command, 'FIX-18'])
      assert.notEqual(result.status, 0, result.output)
      assert.match(result.output, /FIX-18-x/)
      assert.match(result.output, /FIX-18-autre/)
    }
  })
})

describe('file explorer per platform', () => {
  // Imported in the tests, so that the other tests of the file run before the module exists.
  const explorerFor = async (...parameters) => (await import('../lib/list-open.mjs')).explorerFor(...parameters)

  it('darwin : open ; win32 : explorer, code de sortie ignoré ; linux avec affichage : xdg-open [FEAT-35 AC-18]', async () => {
    assert.deepEqual(await explorerFor('darwin', {}), { command: 'open', ignoreExitCode: false })
    assert.deepEqual(await explorerFor('win32', {}), { command: 'explorer', ignoreExitCode: true })
    assert.deepEqual(await explorerFor('linux', { DISPLAY: ':0' }), { command: 'xdg-open', ignoreExitCode: false })
    assert.deepEqual(await explorerFor('linux', { WAYLAND_DISPLAY: 'wayland-0' }), { command: 'xdg-open', ignoreExitCode: false })
    assert.deepEqual(await explorerFor('freebsd', {}), { command: 'xdg-open', ignoreExitCode: false })
  })

  it('linux sans DISPLAY ni WAYLAND_DISPLAY (ou vides) : ne rien lancer, avec la raison [FEAT-35 AC-18]', async () => {
    for (const env of [{}, { DISPLAY: '', WAYLAND_DISPLAY: '' }]) {
      const choice = await explorerFor('linux', env)
      assert.equal(choice.command, null)
      assert.match(choice.reason, /affichage/i)
    }
  })
})

describe('atelier open: fallback on the path', { skip: process.platform !== 'linux' && 'repli testé sous Linux seulement' }, () => {
  const directory = makeChantiersRepository({ main: [{ id: 'FIX-18' }] })
  const expected = realpathSync(chantierDirectoryOf(directory, 'FIX-18'))

  it('sans affichage : chemin absolu et raison, succès [FEAT-35 AC-19]', () => {
    const env = { ...process.env, CLAUDE_PROJECT_DIR: directory }
    delete env.DISPLAY
    delete env.WAYLAND_DISPLAY
    const result = run(directory, ['open', 'FIX-18'], env)
    assert.equal(result.status, 0, result.output)
    assert.ok(result.output.includes(expected) || result.output.includes(chantierDirectoryOf(directory, 'FIX-18')), result.output)
    assert.match(result.output, /affichage/i)
  })

  it('explorateur absent : chemin absolu et raison, succès [FEAT-35 AC-19]', () => {
    const bin = temporaryDirectory('atelier-feat35-bin-')
    const gitPath = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim()
    symlinkSync(gitPath, join(bin, 'git'))
    const env = { ...process.env, CLAUDE_PROJECT_DIR: directory, DISPLAY: ':0', PATH: bin }
    delete env.WAYLAND_DISPLAY
    const result = run(directory, ['open', 'FIX-18'], env)
    assert.equal(result.status, 0, result.output)
    assert.ok(result.output.includes(expected) || result.output.includes(chantierDirectoryOf(directory, 'FIX-18')), result.output)
    assert.match(result.output, /xdg-open/)
  })
})

describe('atelier list: cases deferred from the reviews of slice 3', () => {
  it('hors d’un dépôt git : les chantiers de l’arbre courant [FEAT-35 AC-15]', () => {
    const directory = temporaryDirectory('atelier-feat35-nogit-')
    mkdirSync(join(directory, '.claude'))
    writeFileSync(join(directory, '.claude', 'atelier.json'), JSON.stringify({ chantiersDir: 'docs/chantiers' }))
    writeChantier(directory, { id: 'FEAT-1' })
    assert.deepEqual(listed(directory).map((chantier) => [chantier.id, chantier.location]), [['FEAT-1', null]])
  })

  it('la branche qui porte l’identifiant l’emporte sur une branche plus récente qui ne le porte pas [FEAT-35 AC-9]', () => {
    const directory = makeRepository('main')
    git(directory, 'switch', '-q', '-c', 'feat/FEAT-40-x')
    writeChantier(directory, { id: 'FEAT-40', status: 'signed' })
    commitOnDay(directory, 1)
    git(directory, 'switch', '-q', '-c', 'essais')
    writeChantier(directory, { id: 'FEAT-40', status: 'draft' })
    commitOnDay(directory, 5)
    git(directory, 'switch', '-q', 'main')
    const [feat] = listed(directory)
    assert.equal(feat.location, 'feat/FEAT-40-x')
    assert.equal(feat.status, 'signed')
  })

  it('sur une branche sans commit, les autres branches sont lues, y compris une branche nommée null [FEAT-35 AC-9]', () => {
    const directory = makeRepository('main')
    git(directory, 'switch', '-q', '-c', 'feat/FEAT-1-x')
    writeChantier(directory, { id: 'FEAT-1' })
    commitOnDay(directory, 1)
    git(directory, 'switch', '-q', '-c', 'null', 'main')
    writeChantier(directory, { id: 'FEAT-2' })
    commitOnDay(directory, 2)
    git(directory, 'switch', '-q', '--orphan', 'vide')
    rmSync(join(directory, 'docs'), { recursive: true, force: true })
    mkdirSync(join(directory, '.claude'), { recursive: true })
    writeFileSync(join(directory, '.claude', 'atelier.json'), JSON.stringify({ chantiersDir: 'docs/chantiers' }))
    const chantiers = listed(directory).map((chantier) => [chantier.id, chantier.location])
    assert.deepEqual(chantiers, [['FEAT-1', 'feat/FEAT-1-x'], ['FEAT-2', 'null']])
  })
})
