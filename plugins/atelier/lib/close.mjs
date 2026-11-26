// Closing a chantier: why it cannot be closed yet, and why its status cannot change.
// Pure functions: no access to the disk, git or the environment.

import { specStatus } from './common.mjs'
import { chantierBase, hasIntegrationBranch, integrationDeliveries } from './integration.mjs'
import { parseRelations, relationCloseProblems } from './relations.mjs'
import { parseReviewPoints, reviewPointProblems } from './review-points.mjs'
import { reviewProblems } from './review.mjs'
import { sliceLabel, sliceState } from './slices.mjs'
import { testDrivenPhase } from './tdd.mjs'

// ---------- Close ----------

// An EPIC (no code) and a SPIKE without TDD (throwaway code, never merged) are closed without a
// review. A SPIKE in TDD follows the whole process, review included, unless it was led under the
// model before slices (legacy), which closed a SPIKE without review. An EPIC with an integration
// branch has a review of the whole assembly, like a chantier with a single slice.
export function isReviewExempt(chantier) {
  const data = chantier?.spec?.data
  const type = (data?.type ?? '').toUpperCase()
  if (type === 'EPIC') {
    return !hasIntegrationBranch(data)
  }
  const { model } = sliceState(chantier)
  return model === 'none' || (type === 'SPIKE' && model === 'legacy')
}

// Problems of the reviews of the children closed in the integration branch of an EPIC: each one
// subject to review must have its reviewed commit in the history of HEAD, which a rebase of the
// integration branch or a squash merge of the child breaks. `childReviews` = [{ id, reviewedCommit,
// inHistory }], children exempt from review left out.
export function childReviewProblems(childReviews) {
  return childReviews.flatMap(({ id, reviewedCommit, inHistory }) => {
    if (!reviewedCommit) {
      return [`Enfant ${id} done sans revue enregistrée (reviewed_commit absent) : il doit être revu avant sa fusion dans la branche d’intégration.`]
    }
    if (!inHistory) {
      return [`Enfant ${id} : son commit revu ${reviewedCommit.slice(0, 7)} n’est plus dans l’historique de cette branche (rebase de la branche d’intégration, ou enfant fusionné par squash) : rétablis l’historique (reflog, branche distante) et fusionne les enfants par un commit de fusion.`]
    }
    return []
  })
}

// Close problems of the slice cycle: a slice still in progress, a slice added to the plan after
// the last slice review, or the review of the whole chantier not recorded yet.
function sliceCloseProblems(chantier) {
  const { model, slice, sliceCount } = sliceState(chantier)
  if (model !== 'sliced') {
    return []
  }
  if (slice !== 'chantier') {
    return [`${sliceLabel(slice, sliceCount)} en cours : la mener à terme et la faire valider (/atelier:review), jusqu’à la revue du chantier.`]
  }
  const problems = []
  const lastSlice = Number(chantier.spec.data.last_slice) || 0
  if (sliceCount > lastSlice) {
    problems.push(`Tranche ${sliceCount} du plan non revue (dernière tranche revue : ${lastSlice}) : elle a été ajoutée au plan après la dernière revue de tranche.`)
  }
  if (!chantier.spec.data.reviewed_commit) {
    problems.push('Revue du chantier non enregistrée : faire relire l’ensemble (/atelier:review).')
  }
  return problems
}

// Why the chantier cannot be closed, as a list (empty when it can). `context` = { chantier,
// reviewFacts (see reviewProblems), uncommittedCode (code files changed and not committed),
// checksFailure (first failing check as { check }, or null), index (see buildChantierIndex, or
// null when the chantier has no relation and is not an EPIC) }. A SPIKE (throwaway code, never
// merged) and an EPIC (no code) skip everything related to the review.
// `uncommittedError` is the git error met while listing uncommitted files, if any.
// `revueUncommitted` is true when revue.md has uncommitted changes; the points of `chantier.revue`
// (working copy) must all be treated, a point postponed to a slice included.
// `childReviews` (see childReviewProblems) only for an EPIC with an integration branch;
// `defaultBranch` is the name of the default branch, or null when unknown.
export function closeProblems({ chantier, reviewFacts, uncommittedCode, uncommittedError, revueUncommitted = false, checksFailure, index = null, childReviews = [], defaultBranch = null }) {
  if (specStatus(chantier?.spec) !== 'signed') {
    return [`La spec de ${chantier?.id ?? 'ce chantier'} n’est pas signée (statut : ${specStatus(chantier?.spec)}).`]
  }
  const sliceProblems = sliceCloseProblems(chantier)
  const exempt = isReviewExempt(chantier)
  const problems = exempt || sliceProblems.length ? sliceProblems : reviewProblems(reviewFacts)
  if (!exempt) {
    if (revueUncommitted) {
      problems.push('revue.md a des modifications non commitées : commite-le.')
    }
    problems.push(...reviewPointProblems(parseReviewPoints(chantier.revue), { atClose: true }).map((problem) => `revue.md : ${problem}`))
  }
  if (index) {
    const data = chantier.spec.data
    const relations = parseRelations(data)
    const base = chantierBase(index, relations.parent[0] ?? null, null)
    problems.push(...relationCloseProblems(chantier.id, data, index, {
      branch: base.epic ? base.branch : null,
      deliveries: integrationDeliveries(index, relations.dependsOn, defaultBranch),
      ownBranch: hasIntegrationBranch(data),
    }))
  }
  problems.push(...childReviewProblems(childReviews))
  if (uncommittedError) {
    problems.push(`Impossible de lister les fichiers non commités (${uncommittedError}).`)
  } else if (uncommittedCode.length) {
    problems.push(`Du code n’est pas commité (${uncommittedCode.join(', ')}).`)
  }
  if (testDrivenPhase(chantier) === 'writing-tests') {
    problems.push('Les tests ne sont pas figés (/atelier:write-tests).')
  }
  if (checksFailure) {
    problems.push(`Le contrôle « ${checksFailure.check.name} » échoue (${checksFailure.check.command}).`)
  }
  return problems
}

// Why `atelier set-status <status>` is refused for this chantier, or null.
export function setStatusRefusal(chantier, status) {
  const current = specStatus(chantier?.spec)
  if (status === 'draft' && current !== 'draft') {
    return `la spec de ${chantier.id} est « ${current} » ; elle ne repasse pas en brouillon. Pour la modifier : /atelier:amend. Signée par erreur : abandonne ce chantier (atelier set-status abandoned) et ouvre-en un nouveau.`
  }
  return null
}
