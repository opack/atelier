// Next step of the process for the active chantier, shown by status and the session start hook.
// Pure functions: no access to the disk, git or the environment.

import { isReviewExempt } from './close.mjs'
import { hasIntegrationBranch } from './integration.mjs'
import { sliceLabel, sliceState } from './slices.mjs'
import { declaredSliceTdd, numberedSlice, testDrivenPhase } from './tdd.mjs'

// ---------- Next step ----------

// Whether a signed chantier of this type still lacks its plan: FEAT, REF and EPIC are designed
// before being built.
export function needsPlan(type, files) {
  return ['FEAT', 'REF', 'EPIC'].includes(String(type ?? '').toUpperCase()) && !files.includes('plan.md')
}

// `review` is the state of the review ('none', 'current' or 'stale'), computed by the command.
// `children` are the direct children of an EPIC, as { id, closed } (see describeRelation).
// `codeCommitted` is true when code was committed since the start of the current slice (since
// the freeze of its tests in TDD), false when not, null when unknown (see codeCommittedMatters).
export function nextStep(chantier, review = 'none', children = [], codeCommitted = null) {
  if (!chantier) {
    return 'Aucun chantier actif sur cette branche. Ouvrir un chantier : /atelier:new'
  }
  if (!chantier.directory || !chantier.spec) {
    return `Pas de spec pour ${chantier.id}. Ouvrir le chantier : /atelier:new`
  }
  const status = chantier.spec.data.status ?? 'draft'
  const type = (chantier.spec.data.type ?? '').toUpperCase()
  if (status === 'done') {
    return 'Chantier clôturé. Ouvrir la PR si ce n’est pas fait.'
  }
  if (status === 'abandoned') {
    return 'Chantier abandonné.'
  }
  if (status !== 'signed') {
    return 'Compléter la spec puis la signer : /atelier:sign'
  }
  if (needsPlan(type, chantier.files)) {
    return type === 'EPIC' ? 'Concevoir le découpage en chantiers : /atelier:plan' : 'Concevoir : /atelier:plan'
  }
  if (type === 'EPIC') {
    const open = children.filter((child) => !child.closed)
    if (!children.length) {
      return `Ouvrir les chantiers prévus au plan, rattachés par « rel_parent: ${chantier.id} » : /atelier:new`
    }
    if (open.length) {
      return `${open.length} enfant(s) encore ouvert(s) : ${open.map((child) => child.id).join(', ')}. Les mener à terme (et ouvrir les lots restants du plan : /atelier:new), puis clôturer l’EPIC.`
    }
    if (!children.some((child) => child.status === 'done')) {
      return 'Tous les enfants sont clos, aucun n’est done : la vision n’a pas été réalisée. Abandonner l’EPIC : atelier set-status abandoned'
    }
    if (hasIntegrationBranch(chantier.spec.data) && review !== 'current') {
      return review === 'stale'
        ? 'Tous les enfants sont clos, mais l’EPIC a changé depuis la revue d’ensemble (code ou spec) : la refaire : /atelier:review'
        : 'Tous les enfants sont clos : revue d’ensemble de l’EPIC (cohérence entre lots, AC globaux, résolutions de conflits) : /atelier:review'
    }
    return 'Tous les enfants sont clos : clôturer l’EPIC (bilan prévu / réalisé) : /atelier:close'
  }
  const { model, slice, sliceCount } = sliceState(chantier)
  const implemented = review === 'none' && codeCommitted === true
  if (model === 'sliced' && slice !== 'chantier') {
    return `${sliceLabel(slice, sliceCount)} : ${phaseStep(chantier, 'none', implemented)}`
  }
  if (model === 'sliced' && review === 'none' && testDrivenPhase(chantier) !== 'writing-tests') {
    return 'Revue du chantier : faire relire l’ensemble : /atelier:review'
  }
  return phaseStep(chantier, review, implemented)
}

// Whether the code committed in the current slice can change the next step, so whether the
// command has to compute it: a signed chantier (not an EPIC), tests frozen if in TDD, a slice in
// progress (not the review of the whole chantier) and no review recorded.
export function codeCommittedMatters(chantier, review) {
  const data = chantier?.spec?.data
  if (!data || data.status !== 'signed' || (data.type ?? '').toUpperCase() === 'EPIC') {
    return false
  }
  return review === 'none' && testDrivenPhase(chantier) !== 'writing-tests' && sliceState(chantier).slice !== 'chantier'
}

// Whether the current numbered slice of a chantier with several slices is declared without TDD.
function sliceWithoutTdd(chantier) {
  return numberedSlice(chantier) !== null && declaredSliceTdd(chantier.spec.data.slice_tdd) === 'no'
}

// Next step of the current phase (tests, build, review, close), for a slice or the chantier.
// `implemented`: code was committed in the slice and no review covers it.
function phaseStep(chantier, review = 'none', implemented = false) {
  const phase = testDrivenPhase(chantier)
  if (phase === 'writing-tests') {
    return 'Tests d’abord : écrire les tests, vérifier qu’ils échouent, les commiter (aucune implémentation) : /atelier:write-tests'
  }
  const build = phase === 'implementing'
    ? 'Implémenter jusqu’à ce que tous les tests passent, sans modifier les tests, puis commiter : /atelier:build'
    : `Implémenter (sans TDD pour ${sliceWithoutTdd(chantier) ? 'cette tranche' : 'ce chantier'}), puis commiter : /atelier:build`
  const resume = '(ou reprendre /atelier:build si elle n’est pas finie)'
  if (isReviewExempt(chantier)) {
    return implemented ? `Implémentation commitée : clôturer : /atelier:close ${resume}` : `${build} ; ensuite clôturer : /atelier:close`
  }
  if (review === 'current') {
    return 'Revue à jour : clôturer (bilan, verdict) : /atelier:close'
  }
  if (review === 'stale') {
    return 'Le code ou la spec a changé depuis la revue : refaire relire : /atelier:review'
  }
  if (implemented) {
    return `Implémentation commitée : faire relire : /atelier:review ${resume}`
  }
  return `${build} ; ensuite faire relire : /atelier:review`
}
