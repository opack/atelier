// Relations read across branches (git cat-file) and shown by status and the session start hook.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseCatFileBatch, parseFrontMatter, shortRefName } from '../common.mjs'
import { chantierIdFromDirectoryName } from '../identifiers.mjs'
import {
  buildChantierIndex,
  chantierTreesOf,
  childrenOf,
  describeRelation,
  hasRelations,
  parseRelations,
} from '../relations.mjs'
import { gitRaw } from './common.mjs'
import { currentBranch } from './identifiers.mjs'

// ---------- Chantier index and relation summary ----------

// Spec headers of the chantiers in the current tree (from disk, uncommitted changes included).
function chantiersHere(projectRoot, config) {
  const chantiersRoot = join(projectRoot, config.chantiersDir)
  if (!existsSync(chantiersRoot)) {
    return []
  }
  return readdirSync(chantiersRoot).flatMap((name) => {
    const id = chantierIdFromDirectoryName(name)
    const specPath = join(chantiersRoot, name, 'spec.md')
    return id && existsSync(specPath) ? [{ id, data: parseFrontMatter(readFileSync(specPath, 'utf8')).data }] : []
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
// with three git calls whatever the number of branches: the refs, the chantiers tree of each ref,
// then the spec of each distinct chantier directory (branches mostly share the same ones).
export function chantierIndex(projectRoot, config) {
  const current = currentBranch(projectRoot)
  const refs = gitRaw(projectRoot, ['for-each-ref', '--format=%(refname)%00%(symref)', 'refs/heads', 'refs/remotes'])
    .split('\n')
    .map((line) => line.split('\0'))
    .filter(([ref, symref]) => ref && !symref && ref !== `refs/heads/${current}`)
    .map(([ref]) => ref)
  const chantiersTrees = catFileBatch(projectRoot, refs.map((ref) => `${ref}:${config.chantiersDir}`))
  const directories = refs.flatMap((ref, index) => {
    const tree = chantiersTrees[index]
    return tree?.type === 'tree' ? chantierTreesOf(tree.content, tree.id.length / 2).map((entry) => ({ ...entry, branch: shortRefName(ref) })) : []
  })
  const distinctTrees = [...new Set(directories.map((directory) => directory.tree))]
  const specs = catFileBatch(projectRoot, distinctTrees.map((tree) => `${tree}:spec.md`))
  const headers = new Map(distinctTrees.map((tree, index) => [tree, specs[index] && parseFrontMatter(specs[index].content.toString('utf8')).data]))
  const branchHeaders = directories
    .filter((directory) => headers.get(directory.tree))
    .map(({ id, branch, tree }) => ({ id, branch, data: headers.get(tree) }))
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
// when it has none and is not an EPIC (the index is then not built).
export function relationsSummary(projectRoot, config, chantier) {
  if (!chantier?.spec || !needsIndex(chantier)) {
    return null
  }
  const index = chantierIndex(projectRoot, config)
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
