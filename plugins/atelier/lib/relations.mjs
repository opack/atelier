// Relations between chantiers (parent, dependencies, origin, replacement): reading them, the index of
// known chantiers across branches, the checks before signature and before closing.
// Pure functions: no access to the disk, git or the environment.

import { parseTreeEntries } from './common.mjs'
import { chantierIdFromDirectoryName } from './identifiers.mjs'

// ---------- Relations between chantiers ----------

// Relation fields of the spec header. The link is declared by the child only.
export const RELATION_FIELDS = { parent: 'rel_parent', dependsOn: 'rel_depends_on', origin: 'rel_origin', replaces: 'rel_replaces' }

// Any identifier, legacy prefixes included (BUG-421, FEA-26), as accepted by the shared counter.
const RELATION_ID_PATTERN = /^[A-Za-z]{2,6}-\d+$/

const CLOSED_STATUSES = ['done', 'abandoned']

function relationValues(value) {
  return String(value ?? '').split(',').map((part) => part.trim()).filter(Boolean)
}

// { parent, dependsOn, origin, replaces }: identifiers in upper case, without duplicates.
export function parseRelations(data) {
  return Object.fromEntries(Object.entries(RELATION_FIELDS).map(([name, field]) => [
    name,
    [...new Set(relationValues(data?.[field]).map((value) => value.toUpperCase()))],
  ]))
}

export function hasRelations(data) {
  return Object.values(RELATION_FIELDS).some((field) => relationValues(data?.[field]).length)
}

// Chantier directories of a raw chantiers tree: [{ id, directory, tree }], `directory` being the
// directory's name and `tree` its id.
export function chantierTreesOf(content, idLength = 20) {
  return parseTreeEntries(content, idLength)
    .filter((entry) => entry.mode === '40000')
    .map((entry) => ({ id: chantierIdFromDirectoryName(entry.name), directory: entry.name, tree: entry.id }))
    .filter((entry) => entry.id)
}

// Index of the known chantiers, by identifier: { id, directory (name of its directory, in the
// current tree first, or null), here (header in the current tree, or null), branches
// ([{ branch, data }] in the other branches) }. `here` is [{ id, directory, data }] and
// `branchHeaders` [{ branch, id, directory, data }]; `directory` may be missing.
export function buildChantierIndex(here, branchHeaders) {
  const index = new Map()
  const entry = (id) => {
    if (!index.has(id)) {
      index.set(id, { id, directory: null, here: null, branches: [] })
    }
    return index.get(id)
  }
  here.forEach(({ id, directory, data }) => Object.assign(entry(id), { here: data, directory: directory ?? null }))
  branchHeaders.forEach(({ branch, id, directory, data }) => {
    const known = entry(id)
    known.branches.push({ branch, data })
    known.directory ??= directory ?? null
  })
  return index
}

// Header of a chantier as the index knows it: in the current tree first, otherwise its first
// version found on another branch; null when unknown.
export function headerOf(entry) {
  return entry?.here ?? entry?.branches[0]?.data ?? null
}

// Status in the current tree; null for a chantier found only on other branches (not merged).
export function statusHere(entry) {
  return entry?.here ? entry.here.status || 'draft' : null
}

// Closed means closed in the current tree: a chantier closed only on its branch is still open.
export function isClosedHere(entry) {
  return CLOSED_STATUSES.includes(statusHere(entry))
}

function versions(entry) {
  return [...(entry.here ? [entry.here] : []), ...entry.branches.map((branch) => branch.data)]
}

function typeOf(entry) {
  return versions(entry).map((data) => (data.type ?? '').toUpperCase()).find(Boolean) ?? ''
}

// Ids an entry is linked to through `relation`: union of all its known versions.
function linksOf(entry, relation) {
  return new Set(versions(entry).flatMap((data) => parseRelations(data)[relation]))
}

// Direct children of a chantier: those whose header, in any version, names it as parent.
export function childrenOf(index, id) {
  return [...index.values()].filter((entry) => entry.id !== id && linksOf(entry, 'parent').has(id))
}

// A related chantier as shown to the user: { id, status (in the current tree, null when absent
// from it), closed, branches (where it lives when it is not in the current tree) }.
export function describeRelation(index, id) {
  const entry = index.get(id)
  return {
    id,
    status: statusHere(entry),
    closed: isClosedHere(entry),
    branches: entry && !entry.here ? entry.branches.map((branch) => branch.branch) : [],
  }
}

// A cycle through `id` following `relation`, as a list of ids starting and ending with `id`, or
// null. `ownLinks` replaces the links of `id` found in the index.
function findCycle(index, id, ownLinks, relation) {
  const next = (current) => (current === id ? ownLinks : index.has(current) ? [...linksOf(index.get(current), relation)] : [])
  const visited = new Set()
  const walk = (current, path) => {
    for (const target of next(current)) {
      if (target === id) {
        return [...path, id]
      }
      if (!visited.has(target)) {
        visited.add(target)
        const cycle = walk(target, [...path, target])
        if (cycle) {
          return cycle
        }
      }
    }
    return null
  }
  return walk(id, [id])
}

// Relation problems of a spec header, which block the signature. `index` comes from
// buildChantierIndex. Only `rel_parent` and `rel_depends_on` must name a known chantier:
// `rel_origin` and `rel_replaces` are traces, checked on their format only.
export function relationProblems(data, index) {
  const problems = []
  const id = (data.id ?? '').toUpperCase()
  for (const field of Object.values(RELATION_FIELDS)) {
    for (const value of relationValues(data[field])) {
      if (!RELATION_ID_PATTERN.test(value)) {
        problems.push(`${field} : « ${value} » est mal formé (attendu : un identifiant comme FEAT-12).`)
      } else if (value.toUpperCase() === id) {
        problems.push(`${field} : ${id} ne peut pas se citer lui-même.`)
      }
    }
  }
  const relations = parseRelations(data)
  const valid = (ids) => ids.filter((value) => RELATION_ID_PATTERN.test(value) && value !== id)
  if (relations.parent.length > 1) {
    problems.push(`rel_parent : un seul parent possible (${relations.parent.join(', ')}).`)
  }
  for (const [field, ids] of [['rel_parent', valid(relations.parent)], ['rel_depends_on', valid(relations.dependsOn)]]) {
    for (const target of ids.filter((value) => !index.has(value))) {
      problems.push(`${field} : ${target} est introuvable dans les branches du projet (faute de frappe ?).`)
    }
  }
  for (const parent of valid(relations.parent).filter((value) => index.has(value))) {
    const entry = index.get(parent)
    if (typeOf(entry) !== 'EPIC') {
      problems.push(`rel_parent : ${parent} n’est pas un EPIC (type : ${typeOf(entry) || '?'}) ; seul un EPIC peut être parent.`)
    } else if (isClosedHere(entry)) {
      problems.push(`rel_parent : l’EPIC ${parent} est clos (statut : ${statusHere(entry)}) ; on ne rattache pas un chantier à un EPIC clos.`)
    }
  }
  for (const [field, relation] of [['rel_parent', 'parent'], ['rel_depends_on', 'dependsOn']]) {
    const cycle = id ? findCycle(index, id, valid(relations[relation]), relation) : null
    if (cycle) {
      problems.push(`${field} : cycle ${cycle.join(' → ')}.`)
    }
  }
  return problems
}

// Children of an EPIC that are not closed in the current tree, as described by describeRelation.
export function openChildren(index, id) {
  return childrenOf(index, id).map((entry) => describeRelation(index, entry.id)).filter((child) => !child.closed)
}

// `delivery` says how a delivered chantier reaches this branch: the default branch merged into it,
// or, for the children of an EPIC with an integration branch, their own merge into it.
function openChildProblem(child, delivery) {
  return child.status
    ? `Enfant ${child.id} encore ouvert ici (statut : ${child.status}) : une fois livré, ${delivery}.`
    : `Enfant ${child.id} pas fusionné dans cette branche (vit sur ${child.branches.join(', ')}) : une fois ${child.id} livré, ${delivery} ; ou supprime sa branche s’il est abandonné.`
}

// Why the relations prevent closing (`done`) a chantier, as a list. `id` is the chantier's
// identifier (from its branch and directory), `data` its spec header, `index` comes from
// buildChantierIndex. Statuses are judged in the current tree only. `integration` = {
// branch (integration branch the chantier is based on, or null), deliveries (dependencies done only
// in the integration branch of their EPIC: Map id → { branch, epic }), ownBranch (true for an EPIC
// with an integration branch: its children are merged into it) }.
export function relationCloseProblems(id, data, index, { branch = null, deliveries = new Map(), ownBranch = false } = {}) {
  const problems = []
  const mergeHint = branch ? `fusionne la branche d’intégration ${branch} dans celle-ci` : 'fusionne la branche par défaut dans celle-ci'
  for (const dependency of parseRelations(data).dependsOn.map((target) => describeRelation(index, target))) {
    const { status, branches } = dependency
    const dependencyId = dependency.id
    if (status === 'done') {
      continue
    }
    if (status === 'abandoned') {
      problems.push(`Dépendance ${dependencyId} abandonnée (statut : abandoned) : retire la relation (/atelier:amend) ou dépends du chantier qui la remplace.`)
    } else if (status) {
      problems.push(`Dépendance ${dependencyId} pas livrée (statut : ${status}) : attends sa clôture, puis ${mergeHint}.`)
    } else if (!branch && deliveries.has(dependencyId)) {
      const delivery = deliveries.get(dependencyId)
      problems.push(`Dépendance ${dependencyId} livrée seulement dans la branche d’intégration ${delivery.branch} : attends la clôture de ${delivery.epic}, qui la fusionnera dans la branche par défaut, puis fusionne la branche par défaut dans celle-ci.`)
    } else if (branches.length) {
      problems.push(`Dépendance ${dependencyId} pas fusionnée dans cette branche (présente seulement sur ${branches.join(', ')}) : ${mergeHint} une fois ${dependencyId} livrée.`)
    } else {
      problems.push(`Dépendance ${dependencyId} introuvable dans les branches du projet.`)
    }
  }
  if ((data.type ?? '').toUpperCase() === 'EPIC') {
    const open = openChildren(index, id)
    const delivery = ownBranch ? 'fusionne-le dans cette branche par un commit de fusion' : 'fusionne la branche par défaut dans celle-ci'
    problems.push(...open.map((child) => openChildProblem(child, delivery)))
    const children = childrenOf(index, id)
    if (!open.length && !children.some((entry) => statusHere(entry) === 'done')) {
      problems.push(children.length
        ? `Aucun enfant de ${id} n’est done : la vision n’a pas été réalisée. Abandonne l’EPIC (atelier set-status abandoned).`
        : `Aucun enfant rattaché à ${id} (rel_parent: ${id}) : rien n’a été réalisé. Ouvre les chantiers du plan, ou abandonne l’EPIC (atelier set-status abandoned).`)
    }
  }
  return problems
}
