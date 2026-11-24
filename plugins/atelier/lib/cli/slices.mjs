// Code committed by the chantier and by its slice in progress, read from git.

import { codeLogArguments, matchesAny } from '../common.mjs'
import { reviewCodeFiles } from '../review.mjs'
import { sliceState } from '../slices.mjs'
import { git, gitObjectExists, gitPaths, gitVersion, isAncestor } from './common.mjs'
import { defaultBaseRef, defaultBranchName } from './identifiers.mjs'

// ---------- Code of the chantier and of the slice ----------

// Current slice and number of slices, both null outside the slice cycle.
export function slicePosition(chantier) {
  const { slice, sliceCount } = sliceState(chantier)
  return { slice, sliceCount }
}

// Files changed by the chantier since `from` (see codeLogArguments in lib/core.mjs): the commits of
// the default branch brought by a merge do not count, only the resolution of the merge does.
// `fallbackDiffMerges` keeps the caller's former command for an old git or without a ref to exclude.
export function codeFilesSince(projectRoot, from, fallbackDiffMerges) {
  return gitPaths(projectRoot, codeLogArguments({
    from,
    gitVersion: gitVersion(),
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
