// Active chantier and identifiers in use, read from the branch, its commits and the chantier folders.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontMatter } from '../common.mjs'
import {
  branchNameIdentifiers,
  chantierIdFromCommitSubjects,
  chantierIdFromText,
  commitSubjectIdentifiers,
  nextChantierId,
} from '../identifiers.mjs'
import { findProjectRoot, gitOutput, requireConfig } from './common.mjs'

// ---------- Active chantier and identifiers in use ----------

export function currentBranch(projectRoot) {
  return gitOutput(projectRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])
}

export function findChantierDirectory(projectRoot, config, chantierId) {
  const chantiersRoot = join(projectRoot, config.chantiersDir)
  if (!existsSync(chantiersRoot)) {
    return null
  }
  const match = readdirSync(chantiersRoot).find(
    (name) => name === chantierId || name.startsWith(`${chantierId}-`),
  )
  return match ? join(chantiersRoot, match) : null
}

export function readChantier(projectRoot, config, chantierId) {
  const directory = findChantierDirectory(projectRoot, config, chantierId)
  if (!directory) {
    return { id: chantierId, directory: null, spec: null, files: [] }
  }
  const specPath = join(directory, 'spec.md')
  const spec = existsSync(specPath) ? parseFrontMatter(readFileSync(specPath, 'utf8')) : null
  const planPath = join(directory, 'plan.md')
  const plan = existsSync(planPath) ? readFileSync(planPath, 'utf8') : null
  const revuePath = join(directory, 'revue.md')
  const revue = existsSync(revuePath) ? readFileSync(revuePath, 'utf8') : null
  return { id: chantierId, directory, spec, files: readdirSync(directory), plan, revue }
}

// refs/remotes/origin/HEAD is missing from cloud clones, hence the fallbacks.
const BASE_REF_CANDIDATES = ['refs/remotes/origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']

export function defaultBaseRef(projectRoot) {
  return BASE_REF_CANDIDATES.find(
    (ref) => gitOutput(projectRoot, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== null,
  ) ?? null
}

// Subjects of the branch's own commits since `base`, newest first: the first-parent chain only, so
// that commits brought by a merge (of the integration branch of an EPIC, for instance) do not pass
// in front of those of the branch.
export function branchCommitSubjects(projectRoot, base) {
  const output = gitOutput(projectRoot, ['log', '-n', '200', '--first-parent', '--format=%s', `${base}..HEAD`])
  return output ? output.split('\n') : []
}

// Short name of the default branch behind a base ref: origin/HEAD → origin/main → main.
// null when origin/HEAD cannot be resolved: the default branch is then unknown.
export function defaultBranchName(projectRoot, base) {
  const resolved = base === 'refs/remotes/origin/HEAD'
    ? gitOutput(projectRoot, ['rev-parse', '--abbrev-ref', base])
    : base
  return resolved ? resolved.replace(/^origin\//, '') : null
}

function chantierIdFromBranchCommits(projectRoot, branch) {
  if (!branch || branch === 'HEAD') {
    return null
  }
  const base = defaultBaseRef(projectRoot)
  const defaultBranch = base && defaultBranchName(projectRoot, base)
  if (!defaultBranch || branch === defaultBranch) {
    return null
  }
  return chantierIdFromCommitSubjects(branchCommitSubjects(projectRoot, base))
}

// The branch name wins; otherwise, off the default branch, the branch's own commits tell.
export function activeChantier(projectRoot, config) {
  const branch = currentBranch(projectRoot)
  const branchId = chantierIdFromText(branch)
  if (branchId) {
    return { branch, chantier: readChantier(projectRoot, config, branchId), source: 'branch' }
  }
  const commitsId = chantierIdFromBranchCommits(projectRoot, branch)
  if (commitsId) {
    return { branch, chantier: readChantier(projectRoot, config, commitsId), source: 'commits' }
  }
  return { branch, chantier: null, source: null }
}

export function requireActiveChantier(projectRoot, config) {
  const { chantier } = activeChantier(projectRoot, config)
  if (!chantier?.directory || !chantier.spec) {
    console.error('Aucun chantier actif avec une spec sur cette branche.')
    process.exit(1)
  }
  return chantier
}

function gitLines(projectRoot, gitArguments) {
  try {
    return execFileSync('git', gitArguments, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split('\n').filter(Boolean)
  } catch {
    // No git history yet: directory names are enough.
    return []
  }
}

// Each source has its own extraction rule: chantier folders as they are, bracketed identifiers of
// commit subjects, identifiers opening a segment of branch names.
export function collectUsedIdentifiers(projectRoot, config) {
  const names = []
  const chantiersRoot = join(projectRoot, config.chantiersDir)
  if (existsSync(chantiersRoot)) {
    names.push(...readdirSync(chantiersRoot))
  }
  for (const subject of gitLines(projectRoot, ['log', '--all', '--format=%s', '-n', '5000'])) {
    names.push(...commitSubjectIdentifiers(subject))
  }
  for (const branch of gitLines(projectRoot, ['branch', '--all', '--format=%(refname:short)'])) {
    names.push(...branchNameIdentifiers(branch))
  }
  return names
}

export function commandNextId([type]) {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  console.log(nextChantierId(type ?? '', collectUsedIdentifiers(projectRoot, config)))
}
