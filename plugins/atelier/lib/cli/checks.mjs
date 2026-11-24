// Checks run by the checks command, the closing check and the stop hook, cached per working tree.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checksGreenOn, withGreen } from '../checks.mjs'
import { findProjectRoot, requireConfig } from './common.mjs'

// ---------- Running the checks ----------

// Runs the configured checks. Returns the first failure, or null when everything passes.
export function runChecks(projectRoot, config) {
  for (const check of config.checks) {
    const result = spawnSync(check.command, {
      cwd: projectRoot,
      shell: true,
      encoding: 'utf8',
      timeout: config.checkTimeoutSeconds * 1000,
      maxBuffer: 20 * 1024 * 1024,
    })
    if (result.status !== 0) {
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().split('\n').slice(-60).join('\n')
      return { check, output: result.error ? `${result.error.message}\n${output}` : output }
    }
  }
  return null
}

// Runs the configured checks unless they already passed on the current working tree (the state
// shared with the Stop hook), then records a pass. Without a tree id, the checks always run.
export function runChecksOnce(projectRoot, config, { force = false } = {}) {
  if (config.checks.length === 0) {
    return { failure: null, reused: false }
  }
  const tree = currentTreeId(projectRoot)
  const state = tree === null ? {} : cachedGateState(projectRoot)
  if (!force && checksGreenOn(state, tree)) {
    return { failure: null, reused: true }
  }
  const failure = runChecks(projectRoot, config)
  if (!failure && tree !== null) {
    try {
      writeFileSync(gateStatePath(projectRoot), JSON.stringify(withGreen(cachedGateState(projectRoot), tree), null, 2))
    } catch {
      // The pass is only a cache: failing to record it means running the checks again next time.
    }
  }
  return { failure, reused: false }
}

export function commandChecks(options) {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  if (config.checks.length === 0) {
    console.log('Aucun contrôle configuré dans .claude/atelier.json.')
    return
  }
  const { failure, reused } = runChecksOnce(projectRoot, config, { force: options.includes('--force') })
  if (failure) {
    console.log(`❌ ${failure.check.name} (${failure.check.command})\n${failure.output}`)
    process.exitCode = 2
    return
  }
  const names = config.checks.map((check) => check.name).join(', ')
  console.log(reused
    ? `✅ ${names} : déjà verts sur cet état du code, non relancés (atelier checks --force pour les relancer).`
    : `✅ ${names}`)
}

export function gateStatePath(projectRoot) {
  return join(projectRoot, '.atelier', 'gate.json')
}

export function readGateState(projectRoot) {
  const path = gateStatePath(projectRoot)
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
}

// The gate state read as a cache: unreadable means empty, so the checks simply run.
function cachedGateState(projectRoot) {
  try {
    return readGateState(projectRoot)
  } catch {
    return {}
  }
}

// Id of the working tree, or null when git cannot compute it (no repository, `.atelier` unusable).
function currentTreeId(projectRoot) {
  try {
    mkdirSync(join(projectRoot, '.atelier'), { recursive: true })
    return workingTreeId(projectRoot)
  } catch {
    return null
  }
}

// Identifies the content of the working tree (tracked and untracked files, `.atelier/` excluded),
// through a separate index kept in `.atelier/` so that the real index is never touched.
export function workingTreeId(projectRoot) {
  const env = { ...process.env, GIT_INDEX_FILE: join(projectRoot, '.atelier', 'gate-index') }
  // No exclude pathspec: git rejects it when `.atelier/` is ignored, as /atelier:init does.
  // When it is not ignored, `add` stages the gate's own index, which changes under git's feet:
  // `--force` lets `rm` drop it anyway (without it, rm fails and no tree id can be computed).
  execFileSync('git', ['add', '--all'], { cwd: projectRoot, env, stdio: 'ignore' })
  execFileSync('git', ['rm', '-r', '--cached', '--force', '--quiet', '--ignore-unmatch', '.atelier'], { cwd: projectRoot, env, stdio: 'ignore' })
  return execFileSync('git', ['write-tree'], { cwd: projectRoot, env, encoding: 'utf8' }).trim()
}
