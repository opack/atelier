// Relations read across branches (git cat-file) and shown by status and the session start hook.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseCatFileBatch, parseFrontMatter, parseTreeEntries, shortRefName } from '../common.mjs'
import { versionFacts } from '../chantier-facts.mjs'
import { chantierIdFromDirectoryName } from '../identifiers.mjs'
import {
  buildChantierIndex,
  chantierTreesOf,
  childrenOf,
  describeRelation,
  hasRelations,
  parseRelations,
} from '../relations.mjs'
import { gitOutput, gitRaw } from './common.mjs'
import { currentBranch } from './identifiers.mjs'

// ---------- Chantier index and relation summary ----------

// Chantiers of the current tree, read from disk (uncommitted changes included): [{ id, directory,
// data (spec header), facts (see versionFacts), path (absolute) }], sorted by directory name.
// Directories without spec.md are ignored.
function chantiersHere(projectRoot, config) {
  const chantiersRoot = resolve(projectRoot, config.chantiersDir)
  if (!existsSync(chantiersRoot)) {
    return []
  }
  return readdirSync(chantiersRoot).sort().flatMap((name) => {
    const id = chantierIdFromDirectoryName(name)
    const path = join(chantiersRoot, name)
    const specPath = join(path, 'spec.md')
    if (!id || !existsSync(specPath)) {
      return []
    }
    const { data, body } = parseFrontMatter(readFileSync(specPath, 'utf8'))
    const planPath = join(path, 'plan.md')
    const planText = existsSync(planPath) ? readFileSync(planPath, 'utf8') : null
    return [{ id, directory: name, data, path, facts: versionFacts({ data, specBody: body, planText, files: readdirSync(path) }) }]
  })
}

// Objects requested through `git cat-file --batch` (requests on stdin, so no command line limit).
function catFileBatch(projectRoot, requests) {
  if (!requests.length) {
    return []
  }
  const result = spawnSync('git', ['cat-file', '--batch'], { cwd: projectRoot, input: `${requests.join('\n')}\n`, maxBuffer: 256 * 1024 * 1024 })
  if (result.status !== 0) {
    throw new Error(result.error?.message || result.stderr?.toString().trim() || 'git cat-file')
  }
  return parseCatFileBatch(result.stdout)
}

// Every chantier known in the current tree and in the other branches (local and remote), read
// with a constant number of git calls whatever the number of branches: a repository check, the
// refs (with the date of their last commit), the chantiers tree of each ref, then, for each
// distinct chantier directory (branches mostly share the same ones), its file list, its spec
// and its plan. Only the facts of each
// version are kept (header, slice count, files...), not the texts. A branch entry carries
// `date` (unix time of the last commit) and `local` (a local branch, not a remote-tracking one).
// `current` (the current branch) can be passed by a caller that already has it. Outside a git
// repository there is no ref: only the current tree is indexed. Inside a repository the refs are
// read even without a current branch (orphan branch before its first commit).
export function chantierIndex(projectRoot, config, current = null) {
  current ??= currentBranch(projectRoot)
  const refsOutput = gitOutput(projectRoot, ['rev-parse', '--git-dir']) === null
    ? ''
    : gitRaw(projectRoot, ['for-each-ref', '--format=%(refname)%00%(symref)%00%(committerdate:unix)', 'refs/heads', 'refs/remotes'])
  const refs = refsOutput
    .split('\n')
    .map((line) => line.split('\0'))
    .filter(([ref, symref]) => ref && !symref && (current === null || ref !== `refs/heads/${current}`))
    .map(([ref, , date]) => ({ ref, date: Number(date) || 0 }))
  const chantiersTrees = catFileBatch(projectRoot, refs.map(({ ref }) => `${ref}:${config.chantiersDir}`))
  const directories = refs.flatMap(({ ref, date }, index) => {
    const tree = chantiersTrees[index]
    const version = { branch: shortRefName(ref), date, local: ref.startsWith('refs/heads/') }
    return tree?.type === 'tree' ? chantierTreesOf(tree.content, tree.id.length / 2).map((entry) => ({ ...entry, ...version })) : []
  })
  const distinctTrees = [...new Set(directories.map((directory) => directory.tree))]
  const objects = catFileBatch(projectRoot, distinctTrees.flatMap((tree) => [tree, `${tree}:spec.md`, `${tree}:plan.md`]))
  const facts = new Map(distinctTrees.map((tree, index) => {
    const [listing, spec, plan] = objects.slice(index * 3, index * 3 + 3)
    if (!spec) {
      return [tree, null]
    }
    const { data, body } = parseFrontMatter(spec.content.toString('utf8'))
    const files = parseTreeEntries(listing.content, listing.id.length / 2).map((entry) => entry.name)
    return [tree, versionFacts({ data, specBody: body, planText: plan?.content.toString('utf8') ?? null, files })]
  }))
  const branchHeaders = directories
    .filter((directory) => facts.get(directory.tree))
    .map(({ id, branch, date, local, directory, tree }) => ({ id, branch, date, local, directory, data: facts.get(tree).data, facts: facts.get(tree) }))
  return buildChantierIndex(chantiersHere(projectRoot, config), branchHeaders)
}

export function isEpic(chantier) {
  return (chantier?.spec?.data?.type ?? '').toUpperCase() === 'EPIC'
}

// The index of all chantiers is only built when the chantier needs it.
export function needsIndex(chantier) {
  return isEpic(chantier) || hasRelations(chantier?.spec?.data)
}

// Relations of the chantier, with the status of the related chantiers in the current tree; null
// when it has none and is not an EPIC (the index is then not built). `index` reuses one already built.
export function relationsSummary(projectRoot, config, chantier, index = null) {
  if (!chantier?.spec || !needsIndex(chantier)) {
    return null
  }
  index ??= chantierIndex(projectRoot, config)
  const { parent, dependsOn, origin, replaces } = parseRelations(chantier.spec.data)
  const describe = (ids) => ids.map((id) => describeRelation(index, id))
  return {
    parent: describe(parent),
    dependsOn: describe(dependsOn),
    origin,
    replaces,
    children: isEpic(chantier) ? childrenOf(index, chantier.id).map((entry) => describeRelation(index, entry.id)) : [],
  }
}

function formatRelation({ id, status, branches }) {
  return `${id} (${status ?? (branches.length ? `pas fusionné ici : ${branches.join(' ')}` : 'introuvable')})`
}

export function formatRelations(relations) {
  const lines = [
    ['Parent', relations.parent.map(formatRelation)],
    ['Dépendances', relations.dependsOn.map(formatRelation)],
    ['Origine', relations.origin],
    ['Remplace', relations.replaces],
    ['Enfants', relations.children.map(formatRelation)],
  ]
  return lines.filter(([, values]) => values.length).map(([label, values]) => `${label} : ${values.join(', ')}`)
}
