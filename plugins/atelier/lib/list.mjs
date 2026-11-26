// Listing of the chantiers: the step of each one, computed from the shown version alone.
// Pure functions: no access to the disk, git or the environment.

import { needsPlan } from './next-step.mjs'
import { parseRelations } from './relations.mjs'
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

const CLOSED = ['done', 'abandoned']

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
    return { step: 'reviewed', stepLabel: slice === 'chantier' ? 'revue enregistrée' : `${prefix}revue enregistrée` }
  }
  return { step: 'build', stepLabel: `${prefix}implémentation` }
}

// Step of a signed EPIC with a plan, from its children: the versions whose `rel_parent` is its
// identifier, read as the relations read it (parseRelations: case ignored, several values).
function epicStep(version, versions) {
  const id = version.id.toUpperCase()
  const children = versions.filter((other) => other.id !== version.id && parseRelations(other.data).parent.includes(id))
  const open = children.filter((child) => !CLOSED.includes(child.data.status))
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
