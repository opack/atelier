// FIX-25: on Windows, PowerShell and cmd run bin/atelier.cmd instead of handing
// the extensionless bin/atelier to Explorer ("Open with…").
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const launcherPath = join(repositoryRoot, 'plugins/atelier/bin/atelier.cmd')
const gitattributesPath = join(repositoryRoot, '.gitattributes')

// Runs `git check-attr eol` in a throwaway repository holding only the project's
// .gitattributes, so the test also works outside a git clone.
const scratch = mkdtempSync(join(tmpdir(), 'atelier-fix25-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

function eolAttribute(relativePath) {
  assert.ok(existsSync(gitattributesPath), '.gitattributes absent à la racine du dépôt')
  execFileSync('git', ['init', '-q'], { cwd: scratch })
  writeFileSync(join(scratch, '.gitattributes'), readFileSync(gitattributesPath))
  const output = execFileSync('git', ['check-attr', 'eol', '--', relativePath], { cwd: scratch, encoding: 'utf8' })
  // Format: "<path>: eol: <value>"
  return output.trim().split(': ').at(-1)
}

describe('FIX-25 : lanceur Windows de la CLI', () => {
  it('CA-1 : bin/atelier.cmd lance node sur bin/atelier en transmettant les arguments', () => {
    assert.ok(existsSync(launcherPath), 'plugins/atelier/bin/atelier.cmd absent')
    // Line endings depend on the checkout (LF for its author, CRLF once extracted by git).
    const lines = readFileSync(launcherPath, 'utf8')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
    assert.equal(lines.length, 1, `une seule ligne attendue, reçu : ${JSON.stringify(lines)}`)
    assert.match(lines[0], /^@node\s+"%~dp0atelier"\s+%\*$/)
  })

  it('CA-2 : bin/atelier.cmd est extrait en CRLF', () => {
    assert.equal(eolAttribute('plugins/atelier/bin/atelier.cmd'), 'crlf')
  })

  it('CA-3 : bin/atelier reste en LF (shebang intact sous Windows avec autocrlf)', () => {
    assert.equal(eolAttribute('plugins/atelier/bin/atelier'), 'lf')
  })
})
