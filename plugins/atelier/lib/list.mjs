// Listing of the chantiers: the step of each one, computed from the shown version alone.
// Pure functions: no access to the disk, git or the environment.

import { CHANTIER_TYPES, normalize, specStatus } from './common.mjs'
import { needsPlan } from './next-step.mjs'
import { CLOSED_STATUSES, parseRelations } from './relations.mjs'
import { hasReopeningEntry, planSliceCount, sliceLabel, sliceState } from './slices.mjs'
import { parseAmendments } from './spec.mjs'
import { isRefreeze, testDrivenPhase } from './tdd.mjs'

// ---------- Facts of a version ----------

// Facts read from a version of a chantier (header, spec body, plan.md, files of its directory);
// the texts are dropped, only the facts stay: the header, the number of slices of the plan,
// whether the spec records a reopening or a refreeze of the tests (`reopened`, what marks the
// model before slices), whether a reopening is pending (`refreezing`) and the files.
export function versionFacts({ data, specBody, planText, files }) {
  const body = specBody ?? ''
  return {
    data: data ?? {},
    sliceCount: planSliceCount(planText),
    reopened: hasReopeningEntry({ spec: { body } }),
    refreezing: isRefreeze(parseAmendments(body).entries),
    files: files ?? [],
  }
}

// ---------- Step ----------

// The step of every version, as Map id -> { step, stepLabel }. `versions` are { id, ...facts }
// of all the known chantiers: the children of an EPIC are searched among them.
export function chantierSteps(versions) {
  const steps = new Map()
  for (const version of versions) {
    steps.set(version.id, stepOf(version, versions))
  }
  return steps
}

// First case of the table that applies (same order as nextStep).
function stepOf(version, versions) {
  const { data, files } = version
  const status = data.status ?? 'draft'
  const type = (data.type ?? '').toUpperCase()
  if (status === 'abandoned') {
    return { step: 'abandoned', stepLabel: 'abandonné' }
  }
  if (status === 'done') {
    return { step: 'done', stepLabel: 'clos' }
  }
  if (status !== 'signed') {
    return { step: 'draft', stepLabel: 'brouillon' }
  }
  if (needsPlan(type, files)) {
    return { step: 'plan', stepLabel: 'à planifier' }
  }
  if (type === 'EPIC') {
    return epicStep(version, versions)
  }
  const facts = { sliceCount: version.sliceCount, reopened: version.reopened, refreezing: version.refreezing }
  const chantier = { id: version.id, spec: { data }, facts }
  const { model, slice, sliceCount } = sliceState(chantier)
  const prefix = model === 'sliced' && slice !== 'chantier' ? `${sliceLabel(slice, sliceCount)} : ` : ''
  if (testDrivenPhase(chantier) === 'writing-tests') {
    return { step: 'tests', stepLabel: `${prefix}tests d’abord` }
  }
  if (slice === 'chantier' && !data.reviewed_commit) {
    return { step: 'chantier-review', stepLabel: 'revue du chantier' }
  }
  if (data.reviewed_commit) {
    return { step: 'reviewed', stepLabel: `${prefix}revue enregistrée` }
  }
  return { step: 'build', stepLabel: `${prefix}implémentation` }
}

// Step of a signed EPIC with a plan, from its children: the versions whose `rel_parent` is its
// identifier, read as the relations read it (parseRelations: case ignored, several values).
function epicStep(version, versions) {
  const id = version.id.toUpperCase()
  const children = versions.filter((other) => other.id !== version.id && parseRelations(other.data).parent.includes(id))
  const open = children.filter((child) => !CLOSED_STATUSES.includes(child.data.status))
  if (!children.length) {
    return { step: 'epic-children', stepLabel: 'aucun enfant' }
  }
  if (open.length) {
    return { step: 'epic-children', stepLabel: `${open.length} enfant(s) ouvert(s)` }
  }
  if (children.some((child) => child.data.status === 'done')) {
    return { step: 'epic-close', stepLabel: 'enfants clos : à clôturer' }
  }
  return { step: 'epic-abandon', stepLabel: 'enfants clos, aucun livré : à abandonner' }
}

// ---------- Arguments ----------

export const LIST_STATUSES = ['draft', 'signed', 'done', 'abandoned']
export const LIST_SORTS = ['id', 'status', 'type']
const VALUE_OPTIONS = ['--status', '--type', '--parent', '--sort']
const FLAG_OPTIONS = ['--all', '--json']
const USAGE = 'Usage : atelier list [texte…] [--status <s,…>] [--type <T,…>] [--parent <ID>] [--all] [--sort id|status|type] [--json]'

function refused(message) {
  return { error: `${message}\n${USAGE}` }
}

function listValues(text) {
  return text.split(',').map((value) => value.trim()).filter(Boolean)
}

function unknownValues(option, values, admitted) {
  const unknown = values.filter((value) => !admitted.includes(value))
  return unknown.length
    ? refused(`Valeur inconnue pour ${option} : ${unknown.join(', ')}. Valeurs admises : ${admitted.join(', ')}.`)
    : null
}

// Parses the arguments of `atelier list` into { words, statuses, types, parent, all, sort, json },
// or { error } (French message naming the faulty argument and, for a value, the admitted ones).
export function parseListArguments(argumentList) {
  const seen = new Set()
  const values = {}
  const words = []
  for (let index = 0; index < argumentList.length; index++) {
    const argument = argumentList[index]
    if (!argument.startsWith('--')) {
      words.push(...argument.split(/\s+/).filter(Boolean))
      continue
    }
    if (![...VALUE_OPTIONS, ...FLAG_OPTIONS].includes(argument)) {
      return refused(`Option inconnue : ${argument}.`)
    }
    if (seen.has(argument)) {
      return refused(`Option répétée : ${argument}.`)
    }
    seen.add(argument)
    if (VALUE_OPTIONS.includes(argument)) {
      const value = argumentList[index + 1]
      if (value === undefined || value.startsWith('--') || !listValues(value).length) {
        return refused(`L’option ${argument} attend une valeur.`)
      }
      values[argument] = value
      index++
    }
  }
  const statuses = listValues(values['--status'] ?? '').map((value) => value.toLowerCase())
  const types = listValues(values['--type'] ?? '').map((value) => value.toUpperCase())
  const sort = values['--sort'] ?? 'id'
  const parent = values['--parent']?.trim().toUpperCase() ?? null
  const problem = unknownValues('--status', statuses, LIST_STATUSES)
    ?? unknownValues('--type', types, CHANTIER_TYPES)
    ?? unknownValues('--sort', [sort], LIST_SORTS)
  if (problem) {
    return problem
  }
  return { words, statuses, types, parent, all: seen.has('--all'), sort, json: seen.has('--json') }
}

// ---------- Selection and sort ----------

// Type of a chantier: its header in upper case when it is a known type, else the prefix of its identifier.
export function chantierType(id, data) {
  const declared = (data?.type || '').toUpperCase()
  return CHANTIER_TYPES.includes(declared) ? declared : id.split('-')[0].toUpperCase()
}

// Header of the shown version: type normalized (chantierType), absent status read as draft.
export function shownHeader(id, data) {
  return { ...data, type: chantierType(id, data), status: specStatus({ data }) }
}

// Entries { id, type, title, status, parent, ... } of the known chantiers, from `{ id, data }`
// where `data` is a header already passed through shownHeader.
export function listEntry({ id, data }) {
  return {
    id,
    type: data.type,
    title: data.title ?? '',
    status: data.status,
    parent: parseRelations(data).parent,
  }
}

function matches(entry, { words, statuses, types, parent }, openOnly) {
  if (statuses.length ? !statuses.includes(entry.status) : openOnly && CLOSED_STATUSES.includes(entry.status)) {
    return false
  }
  if (types.length && !types.includes(entry.type)) {
    return false
  }
  if (parent && !entry.parent.includes(parent)) {
    return false
  }
  const haystack = normalize(`${entry.id} ${entry.title}`)
  return words.every((word) => haystack.includes(normalize(word)))
}

const number = (id) => Number(id.split('-')[1])

function compare(sort) {
  const rank = (entry) => (sort === 'status' ? LIST_STATUSES.indexOf(entry.status) : CHANTIER_TYPES.indexOf(entry.type))
  return (a, b) => (sort === 'id' ? 0 : rank(a) - rank(b)) || number(a.id) - number(b.id) || a.id.localeCompare(b.id)
}

// Selected entries, sorted, and whether the default « open » filter dropped closed chantiers that
// would otherwise match (`hiddenClosed`).
export function selectChantiers(entries, options) {
  const openOnly = !options.all
  const selected = entries.filter((entry) => matches(entry, options, openOnly)).sort(compare(options.sort))
  const hiddenClosed = openOnly && !options.statuses.length && entries.some((entry) => matches(entry, options, false) && CLOSED_STATUSES.includes(entry.status))
  return { selected, hiddenClosed }
}

// ---------- Output ----------

// JSON object of a listed chantier; `location` is null for the current tree, `path` absolute.
export function listItem(entry, { step, stepLabel }, { location = null, path = null } = {}) {
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    status: entry.status,
    step,
    stepLabel,
    location,
    path,
    parent: entry.parent.join(', ') || null,
  }
}

// One line per chantier, columns aligned; or the empty-list message.
export function formatList(items, { hiddenClosed = false } = {}) {
  if (!items.length) {
    return `Aucun chantier ne correspond${hiddenClosed ? ' (les chantiers clos sont masqués : ajoute --all)' : ''}.`
  }
  const rows = items.map((item) => [item.id, item.type, item.title, item.status, item.stepLabel, item.location ?? 'ici', item.parent ? `parent ${item.parent}` : ''])
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)))
  return rows.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd()).join('\n')
}
