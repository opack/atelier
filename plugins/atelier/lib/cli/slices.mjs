// Code committed by the chantier and by its slice in progress, read from git.

import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { codeLogArguments, matchesAny } from '../common.mjs'
import { reviewCodeFiles } from '../review.mjs'
import { checkPlanValues, planProblems, sliceState } from '../slices.mjs'
import { declaredSliceTdd } from '../tdd.mjs'
import { VOCABULARY } from '../vocabulary.mjs'
import { findProjectRoot, git, gitObjectExists, gitPaths, isAncestor, requireConfig } from './common.mjs'
import { defaultBaseRef, defaultBranchName, requireActiveChantier } from './identifiers.mjs'
import { baseRefOf, integrationBranchOf, integrationRefsOf } from './integration.mjs'
import { updateSpec } from './spec.mjs'

// ---------- Code of the chantier and of the slice ----------

// Current slice and number of slices, both null outside the slice cycle, and the TDD declared for
// the slice (`slice_tdd`: 'yes' | 'no', or null).
export function slicePosition(chantier) {
  const { slice, sliceCount } = sliceState(chantier)
  return { slice, sliceCount, sliceTdd: declaredSliceTdd(chantier?.spec?.data.slice_tdd) }
}

// Files changed by the chantier since `from` (see codeLogArguments in lib/common.mjs): the commits
// of the default branch brought by a merge do not count, only the resolution of the merge does.
// `fallbackDiffMerges` keeps the caller's former command without a ref to exclude. `baseRefs` are
// the refs of the integration branch of the chantier's EPIC (see integrationRefsOf), whose commits
// brought by a merge do not count either.
export function codeFilesSince(projectRoot, from, fallbackDiffMerges, baseRefs = []) {
  return gitPaths(projectRoot, codeLogArguments({
    from,
    excludedRefs: refsToExclude(projectRoot, from, baseRefs),
    fallbackDiffMerges,
  }))
}

// Existing refs of the default branch (remote-tracking and local), and `baseRefs`, that hold none of
// the chantier's commits since `from`. A ref holding one (current branch being the default branch,
// chantier branch merged into it after `from`) would hide them. The first-parent chain from HEAD is
// the branch's own history, and ancestry is monotone along it: checking its oldest commit after
// `from` is enough.
function refsToExclude(projectRoot, from, baseRefs) {
  const base = defaultBaseRef(projectRoot)
  const name = base && defaultBranchName(projectRoot, base)
  const candidates = [...new Set([...(base ? [base] : []), ...(name ? [`refs/heads/${name}`] : []), ...baseRefs])]
  if (!candidates.length) return []
  const oldest = git(projectRoot, ['rev-list', '--first-parent', '--reverse', `${from}..HEAD`]).split('\n')[0]
  if (!oldest) return []
  return candidates.filter((ref) => gitObjectExists(projectRoot, `${ref}^{commit}`) && !isAncestor(projectRoot, oldest, ref))
}

// Code files committed since the start of the current slice: `slice_base`, or for the first
// slice the merge base with the chantier's base (see baseRefOf: the default branch, or the
// integration branch of its EPIC); null (no check) without one. In TDD, test files do not count:
// each slice starts with the commit of its tests. Throws when the integration branch cannot be
// resolved. `index` reuses an index of chantiers already built.
export function sliceCodeFiles(projectRoot, config, chantier, sliceBase, testDriven, index = null) {
  const integration = integrationBranchOf(projectRoot, config, chantier, index)
  const baseRef = sliceBase ? null : baseRefOf(projectRoot, integration)
  const base = sliceBase ?? (baseRef ? git(projectRoot, ['merge-base', baseRef, 'HEAD']) : null)
  if (!base) return null
  const files = reviewCodeFiles(codeFilesSince(projectRoot, base, null, integrationRefsOf(integration)), config)
  return [...new Set(testDriven ? files.filter((file) => !matchesAny(file, config.testPaths, config.ignoreCase)) : files)]
}

// ---------- check-plan ----------

// Checks the plan of the active chantier (or the plan at `planPath`) against its spec before the
// plan is committed. Exit code: 0 without problems, 2 with problems, 1 when the plan is missing.
// On a plan without problems, writes the TDD of slice 1 into the spec (see checkPlanValues).
export function commandCheckPlan([planPath]) {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  if ((chantier.spec.data.type ?? '').toUpperCase() === 'EPIC') {
    console.log(`${chantier.id} est un EPIC : ses lots n’ont pas de TDD, le plan n’est pas contrôlé.`)
    return
  }
  const ownPlan = join(chantier.directory, 'plan.md')
  const path = planPath ? resolve(process.cwd(), planPath) : ownPlan
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
    console.error(`Plan introuvable : ${planPath ?? 'plan.md'}.`)
    process.exit(1)
  }
  const withPlan = { ...chantier, plan: readFileSync(path, 'utf8') }
  const problems = planProblems(withPlan)
  if (problems.length) {
    console.error(`Le plan de ${chantier.id} a des problèmes :\n${problems.map((problem) => `- ${problem}`).join('\n')}`)
    process.exit(2)
  }
  // Only the chantier's own plan decides the TDD of slice 1: another file is checked, nothing more.
  if (path !== resolve(ownPlan)) {
    console.log('Plan sans problème. Ce fichier n’est pas le plan.md du chantier : slice_tdd n’est pas écrit.')
    return
  }
  const values = checkPlanValues(withPlan)
  if (values.slice_tdd) {
    updateSpec(projectRoot, config, values)
    console.log(`Plan sans problème. TDD de la tranche 1 : ${values.slice_tdd === 'yes' ? VOCABULARY.plan.yes : VOCABULARY.plan.no} (slice_tdd écrit dans la spec). Commite la spec avec le plan.`)
    return
  }
  console.log('Plan sans problème.')
}
