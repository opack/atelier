import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { atelierBin, chantierDirectoryOf, makeChantiersRepository, temporaryDirectory } from './helpers.mjs'

// `atelier open` with a fake `xdg-open` that ends with a given exit code (OD15).

const linuxOnly = { skip: process.platform !== 'linux' && 'explorateur factice testé sous Linux seulement' }

// A PATH holding only git and a fake xdg-open ending with `exitCode`.
function fakeExplorerPath(exitCode) {
  const bin = temporaryDirectory('atelier-feat35-exit-')
  const gitPath = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim()
  symlinkSync(gitPath, join(bin, 'git'))
  const script = join(bin, 'xdg-open')
  writeFileSync(script, `#!/bin/sh\nexit ${exitCode}\n`)
  chmodSync(script, 0o755)
  return bin
}

function openWithExit(directory, exitCode) {
  const env = { ...process.env, CLAUDE_PROJECT_DIR: directory, DISPLAY: ':0', PATH: fakeExplorerPath(exitCode) }
  delete env.WAYLAND_DISPLAY
  const result = spawnSync(process.execPath, [atelierBin, 'open', 'FIX-18'], { cwd: directory, encoding: 'utf8', env })
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

describe('atelier open: exit code of the explorer', linuxOnly, () => {
  const directory = makeChantiersRepository({ main: [{ id: 'FIX-18' }] })
  const paths = [realpathSync(chantierDirectoryOf(directory, 'FIX-18')), chantierDirectoryOf(directory, 'FIX-18')]

  it('code non nul : repli avec le chemin et le code, succès [FEAT-35 AC-19]', () => {
    const result = openWithExit(directory, 3)
    assert.equal(result.status, 0, result.output)
    assert.ok(paths.some((path) => result.output.includes(path)), result.output)
    assert.match(result.output, /code 3/)
    assert.doesNotMatch(result.output, /Dossier ouvert/)
  })

  it('code 0 : dossier ouvert', () => {
    const result = openWithExit(directory, 0)
    assert.equal(result.status, 0, result.output)
    assert.match(result.output, /Dossier ouvert/)
  })
})
