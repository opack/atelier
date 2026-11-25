// Code committed by the chantier and by its slice in progress, read from git.

import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { codeLogArguments, matchesAny } from '../common.mjs'
import { reviewCodeFiles } from '../review.mjs'
import { checkPlanValues, planProblems, sliceState } from '../slices.mjs'
import { findProjectRoot, git, gitObjectExists, gitPaths, isAncestor, requireConfig } from './common.mjs'
import { defaultBaseRef, defaultBranchName, requireActiveChantier } from './identifiers.mjs'
import { updateSpec } from './spec.mjs'

// ---------- Code of the chantier and of the slice ----------

// Current slice and number of slices, both null outside the slice cycle.
export function slicePosition(chantier) {
  const { slice, sliceCount } = sliceState(chantier)
  return { slice, sliceCount }
}

// Files changed by the chantier since `from` (see codeLogArguments in lib/common.mjs): the commits
// of the default branch brought by a merge do not count, only the resolution of the merge does.
// `fallbackDiffMerges` keeps the caller's former command without a ref to exclude.
export function codeFilesSince(projectRoot, from, fallbackDiffMerges) {
  return gitPaths(projectRoot, codeLogArguments({
    from,
    excludedRefs: defaultBranchRefsToExclude(projectRoot, from),
    fallbackDiffMerges,
  }))
}

// Existing refs of the default branch (remote-tracking and local) that hold none of the chantier's
// commits since `from`. A ref holding one (current branch being the default branch, chantier branch
// merged into it after `from`) would hide them. The first-parent chain from HEAD is the branch's own
// history, and ancestry is monotone along it: checking its oldest commit after `from` is enough.
function defaultBranchRefsToExclude(projectRoot, from) {
  const base = defaultBaseRef(projectRoot)
  if (!base) return []
  const oldest = git(projectRoot, ['rev-list', '--first-parent', '--reverse', `${from}..HEAD`]).split('\n')[0]
  if (!oldest) return []
  const name = defaultBranchName(projectRoot, base)
  const candidates = [...new Set([base, ...(name ? [`refs/heads/${name}`] : [])])]
  return candidates.filter((ref) => gitObjectExists(projectRoot, `${ref}^{commit}`) && !isAncestor(projectRoot, oldest, ref))
}

// Code files committed since the start of the current slice: `slice_base`, or for the first
// slice the merge base with the default branch; null (no check) without one. In TDD, test files
// do not count: each slice starts with the commit of its tests.
export function sliceCodeFiles(projectRoot, config, sliceBase, testDriven) {
  const defaultRef = defaultBaseRef(projectRoot)
  const base = sliceBase ?? (defaultRef ? git(projectRoot, ['merge-base', defaultRef, 'HEAD']) : null)
  if (!base) return null
  const files = reviewCodeFiles(codeFilesSince(projectRoot, base, null), config)
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
  const path = planPath ? resolve(process.cwd(), planPath) : join(chantier.directory, 'plan.md')
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
  const values = checkPlanValues(withPlan)
  if (values.slice_tdd) {
    updateSpec(projectRoot, config, values)
    console.log(`Plan sans problème. TDD de la tranche 1 : ${values.slice_tdd === 'yes' ? 'oui' : 'non'} (slice_tdd écrit dans la spec). Commite la spec avec le plan.`)
    return
  }
  console.log('Plan sans problème.')
}
