// Shared input / output of the atelier CLI: project root, configuration, git, standard input.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_CONFIG, parsePorcelainPaths, toProjectRelativePath } from '../common.mjs'

// ---------- Project and configuration ----------

export function findProjectRoot(startDirectory = process.cwd()) {
  if (process.env.CLAUDE_PROJECT_DIR) {
    return process.env.CLAUDE_PROJECT_DIR
  }
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: startDirectory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return startDirectory
  }
}

export function configPath(projectRoot) {
  return join(projectRoot, '.claude', 'atelier.json')
}

// Returns null when atelier is not installed in the project: every hook then stays silent.
export function loadConfig(projectRoot) {
  const path = configPath(projectRoot)
  if (!existsSync(path)) {
    return null
  }
  const userConfig = JSON.parse(readFileSync(path, 'utf8'))
  // Paths are compared without case where the file system usually ignores it.
  const ignoreCase = ['win32', 'darwin'].includes(process.platform)
  return { ...DEFAULT_CONFIG, ignoreCase, ...userConfig }
}

// ---------- Git output and plugin root ----------

export function gitOutput(projectRoot, gitArguments) {
  try {
    return execFileSync('git', gitArguments, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

export const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// ---------- Helpers ----------

export function requireConfig(projectRoot) {
  const config = loadConfig(projectRoot)
  if (!config) {
    console.error('atelier n’est pas installé dans ce projet (pas de .claude/atelier.json). Lance /atelier:init.')
    process.exit(1)
  }
  return config
}

export function readStandardInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    return {}
  }
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function gitUserName(projectRoot) {
  try {
    return execFileSync('git', ['config', 'user.name'], { cwd: projectRoot, encoding: 'utf8' }).trim()
  } catch {
    return 'inconnu'
  }
}

// ---------- Git and working tree ----------

export function git(projectRoot, gitArguments) {
  return gitRaw(projectRoot, gitArguments).trim()
}

// Untrimmed output: `git status --porcelain` lines start with a significant space.
export function gitRaw(projectRoot, gitArguments) {
  return execFileSync('git', gitArguments, { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 })
}

// File list printed by a git command run with -z (NUL-separated, never quoted).
export function gitPaths(projectRoot, gitArguments) {
  return gitRaw(projectRoot, gitArguments).split('\0').filter(Boolean)
}

// Whether a git object or ref exists: false when git says it does not, an error for anything else.
export function gitObjectExists(projectRoot, name) {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', name], { cwd: projectRoot, encoding: 'utf8' })
  if (result.status === 0) {
    return true
  }
  if (result.status === 1 && !result.stderr?.trim()) {
    return false
  }
  throw new Error(result.error?.message || result.stderr?.trim() || `git rev-parse ${name}`)
}

// Text of a file as committed in `commit` (HEAD by default), or null when it is absent from that
// commit (or there is no commit yet). The path is resolved without case first, as the file
// system may ignore it.
export function committedFileText(projectRoot, relativePath, commit = 'HEAD') {
  if (!gitObjectExists(projectRoot, `${commit}^{commit}`)) {
    return null
  }
  const candidates = gitPaths(projectRoot, ['ls-files', '-z', `--with-tree=${commit}`, '--', `:(icase,literal)${relativePath}`])
  const path = candidates.find((candidate) => candidate === relativePath) ?? candidates[0]
  if (!path || !gitObjectExists(projectRoot, `${commit}:${path}`)) {
    return null
  }
  return gitRaw(projectRoot, ['show', `${commit}:${path}`])
}

// Files changed in the working tree (uncommitted, including untracked).
export function uncommittedFiles(projectRoot) {
  return parsePorcelainPaths(gitRaw(projectRoot, ['status', '--porcelain', '-z', '--untracked-files=all']))
}

export function isAncestor(projectRoot, commit, of) {
  const ancestry = spawnSync('git', ['merge-base', '--is-ancestor', commit, of], { cwd: projectRoot, encoding: 'utf8' })
  if (ancestry.status === 0 || ancestry.status === 1) {
    return ancestry.status === 0
  }
  throw new Error(ancestry.error?.message || ancestry.stderr?.trim() || 'git merge-base')
}

// Whether `commit` exists and is an ancestor of HEAD; an error for anything git cannot answer.
export function isAncestorOfHead(projectRoot, commit) {
  if (!gitObjectExists(projectRoot, `${commit}^{commit}`)) {
    return false
  }
  return isAncestor(projectRoot, commit, 'HEAD')
}

// Project-relative path of a file of the chantier directory, as git lists it.
export function chantierFilePath(projectRoot, chantier, name) {
  return toProjectRelativePath(projectRoot, join(chantier.directory, name))
}

export function samePath(config, file, other) {
  return config.ignoreCase ? file.toLowerCase() === other.toLowerCase() : file === other
}
