import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path, { join } from 'node:path'
import { describe, it } from 'node:test'
import { atelierBin, temporaryDirectory, commit, chantierDirectoryOf, atelierRun, specData, makeSlicedRepository, commitFiles, headOf, setHeader, atelierOk, revueOf } from './helpers.mjs'

describe('checks run once per working tree', () => {
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
