// Review of a chantier: code that counts, whether the recorded review still covers it, set-reviewed.
// Pure functions: no access to the disk, git or the environment.

import { matchesAny, specStatus } from './common.mjs'
import { parseReviewPoints, reviewPointProblems } from './review-points.mjs'
import { planSlices, sliceState } from './slices.mjs'
import { declaredSliceTdd, testDrivenPhase } from './tdd.mjs'

// ---------- Review ----------

// Files that count as code for the review: everything outside the free paths, the chantier
// documents and the atelier state. `.claude/**` is not free here, so that checks and hooks
// cannot be weakened after the review, whatever the free path patterns. Tests count as code.
export function reviewCodeFiles(files, config) {
  const ignoredPaths = [...config.freePaths, `${config.chantiersDir}/**`, '.atelier/**']
  return files.filter((file) => matchesAny(file, ['.claude/**'], config.ignoreCase) || !matchesAny(file, ignoredPaths, config.ignoreCase))
}

// Why the review recorded in the spec no longer covers the chantier, as a list (empty when it is
// current). `facts` = { reviewedCommit, gitError, found, isAncestor, codeFilesSince,
// amendmentsChanged }, read from git by the command.
export function reviewProblems(facts) {
  const { reviewedCommit, gitError, found, isAncestor, codeFilesSince = [], amendmentsChanged } = facts
  if (!reviewedCommit) {
    return ['Aucune revue enregistrée (reviewed_commit absent).']
  }
  const commit = reviewedCommit.slice(0, 7)
  if (gitError) {
    return [`Revue obsolète : impossible d’évaluer le commit revu ${commit} (${gitError}).`]
  }
  if (!found) {
    return [`Revue obsolète : le commit revu ${commit} est introuvable (rebase ?).`]
  }
  if (!isAncestor) {
    return [`Revue obsolète : le commit revu ${commit} n’est plus un ancêtre de HEAD (rebase ?).`]
  }
  const problems = []
  if (codeFilesSince.length) {
    problems.push(`Revue obsolète : du code a été commité depuis le commit revu ${commit} (${codeFilesSince.join(', ')}).`)
  }
  if (amendmentsChanged) {
    problems.push(`Revue obsolète : la spec a été amendée depuis le commit revu ${commit}.`)
  }
  return problems
}

// 'none' (no review recorded), 'current' or 'stale'.
export function reviewState(facts) {
  if (!facts.reviewedCommit) {
    return 'none'
  }
  return reviewProblems(facts).length ? 'stale' : 'current'
}

// Why `atelier set-reviewed` is refused, or null. `context` = { chantier, uncommittedCode (code
// files changed and not committed), specUncommitted, changedTests (frozen tests changed since
// tests_commit) }. The points of `chantier.revue` (working copy of revue.md) must all be treated.
// `sliceBaseIsAncestor` is false when `slice_base` is no longer an ancestor of HEAD;
// `sliceCodeFiles` are the code files committed since the start of the current slice, or null
// when the review is not that of a slice of a chantier with several slices.
export function setReviewedRefusal({ chantier, uncommittedCode, specUncommitted, changedTests, sliceBaseIsAncestor = null, sliceCodeFiles = null }) {
  if (specStatus(chantier?.spec) !== 'signed') {
    return `la spec de ${chantier?.id ?? 'ce chantier'} n’est pas signée.`
  }
  if (uncommittedCode.length) {
    return `du code n’est pas commité (${uncommittedCode.join(', ')}). La revue porte sur un commit : commite d’abord.`
  }
  if (specUncommitted) {
    return 'la spec a des changements non commités. Commite-la d’abord.'
  }
  const phase = testDrivenPhase(chantier)
  if (phase === 'writing-tests') {
    return 'les tests ne sont pas figés (/atelier:write-tests).'
  }
  if (phase === 'implementing' && changedTests.length) {
    return `des tests ont changé depuis leur gel (${changedTests.join(', ')}).`
  }
  if (sliceBaseIsAncestor === false) {
    return `le début de la tranche (slice_base : ${chantier.spec.data.slice_base}) n’est plus un ancêtre de HEAD (rebase, historique réécrit). Seul l’utilisateur peut corriger slice_base dans l’en-tête de la spec.`
  }
  if (sliceCodeFiles && !sliceCodeFiles.length) {
    return 'tranche vide : aucun code commité depuis le début de la tranche. Implémente-la (/atelier:build) avant de la faire valider.'
  }
  const pointProblems = reviewPointProblems(parseReviewPoints(chantier.revue))
  if (pointProblems.length) {
    return `revue.md a des points sans traitement ou mal formés :\n${pointProblems.map((problem) => `- ${problem}`).join('\n')}`
  }
  return null
}

// What `atelier set-reviewed` writes at `head` (full hash), and what it says. A validated slice
// review moves to the next slice, or to the review of the whole chantier after the last one;
// the review of the whole chantier, or of a chantier with a single slice, records
// `reviewed_commit`.
export function setReviewedUpdate(chantier, head) {
  const { model, slice, sliceCount } = sliceState(chantier)
  const commitHint = (label) => `Commite la spec et revue.md : docs(chantiers): [${chantier.id}] review ${label}`
  if (model === 'sliced' && slice !== 'chantier') {
    if (slice < sliceCount) {
      // The TDD declared by the plan for the next slice applies; undeclared, the chantier's.
      const sliceTdd = planSlices(chantier.plan).find((entry) => entry.number === slice + 1)?.tdd ?? ''
      const next = (declaredSliceTdd(sliceTdd) ?? chantier.spec.data.tdd) === 'yes'
        ? 'écrire ses tests : /atelier:write-tests'
        : `l’implémenter${sliceTdd === 'no' ? ' (sans TDD pour cette tranche)' : ''} : /atelier:build`
      return {
        values: { slice: String(slice + 1), slice_base: head, tests_commit: '', slice_tdd: sliceTdd },
        message: `Tranche ${slice} validée. Tranche ${slice + 1}/${sliceCount} : ${next}. ${commitHint(slice)}`,
      }
    }
    return {
      values: { slice: 'chantier', last_slice: String(slice), slice_base: head, slice_tdd: '' },
      message: `Tranche ${slice} validée, c’était la dernière. Revue du chantier : faire relire l’ensemble : /atelier:review. ${commitHint(slice)}`,
    }
  }
  const firstOfCycle = model === 'single' && !String(chantier.spec.data.slice ?? '').trim()
  return {
    values: { reviewed_commit: head, ...(firstOfCycle ? { slice: '1' } : {}) },
    message: `Revue enregistrée au commit ${head}. ${commitHint(slice === 'chantier' ? 'chantier' : '').trimEnd()}`,
  }
}
