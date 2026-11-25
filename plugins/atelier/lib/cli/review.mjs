// Review facts read from git, the review summary of status, and the set-reviewed command.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { toProjectRelativePath } from '../common.mjs'
import { reviewCodeFiles, reviewProblems, reviewState, setReviewedRefusal, setReviewedUpdate } from '../review.mjs'
import { sliceState } from '../slices.mjs'
import { amendmentsDiffer } from '../spec.mjs'
import { effectiveTdd, testDrivenPhase } from '../tdd.mjs'
import {
  chantierFilePath,
  committedFileText,
  findProjectRoot,
  git,
  gitObjectExists,
  isAncestorOfHead,
  requireConfig,
  samePath,
  uncommittedFiles,
} from './common.mjs'
import { requireActiveChantier } from './identifiers.mjs'
import { chantierIndex, needsIndex } from './relations.mjs'
import { integrationBranchOf, integrationRefsOf } from './integration.mjs'
import { codeFilesSince, sliceCodeFiles } from './slices.mjs'
import { updateSpec } from './spec.mjs'
import { testFilesChangedSince } from './tdd.mjs'

// ---------- Review facts and set-reviewed ----------

// What git says about the review recorded in the spec (see reviewProblems in lib/core.mjs).
// Any git error makes the review stale rather than failing. Code brought by a merge of the default
// branch or of the integration branch of the chantier's EPIC does not count, only the resolution of
// the merge does. `index` reuses an index of chantiers already built.
export function reviewFacts(projectRoot, config, chantier, index = null) {
  const reviewedCommit = chantier?.spec?.data.reviewed_commit || null
  if (!reviewedCommit) {
    return { reviewedCommit }
  }
  try {
    if (!gitObjectExists(projectRoot, `${reviewedCommit}^{commit}`)) {
      return { reviewedCommit, found: false }
    }
    const ancestry = spawnSync('git', ['merge-base', '--is-ancestor', reviewedCommit, 'HEAD'], { cwd: projectRoot, encoding: 'utf8' })
    if (ancestry.status === 1) {
      return { reviewedCommit, found: true, isAncestor: false }
    }
    if (ancestry.status !== 0) {
      throw new Error(ancestry.error?.message || ancestry.stderr?.trim() || 'git merge-base')
    }
    const filesSince = codeFilesSince(projectRoot, reviewedCommit, 'first-parent', integrationRefsOf(integrationBranchOf(projectRoot, config, chantier, index)))
    const specPath = toProjectRelativePath(projectRoot, join(chantier.directory, 'spec.md'))
    const reviewedSpec = committedFileText(projectRoot, specPath, reviewedCommit)
    return {
      reviewedCommit,
      found: true,
      isAncestor: true,
      codeFilesSince: [...new Set(reviewCodeFiles(filesSince, config))],
      amendmentsChanged: reviewedSpec === null || amendmentsDiffer(readFileSync(join(chantier.directory, 'spec.md'), 'utf8'), reviewedSpec),
    }
  } catch (error) {
    return { reviewedCommit, gitError: error.message }
  }
}

// State of the review, as shown by `status` and the session start reminder.
export function reviewSummary(projectRoot, config, chantier, index = null) {
  const facts = reviewFacts(projectRoot, config, chantier, index)
  const state = reviewState(facts)
  return {
    reviewedCommit: facts.reviewedCommit,
    reviewState: state,
    reviewProblems: state === 'stale' ? reviewProblems(facts) : [],
  }
}

// Records the reviewed commit (full hash of HEAD) once every point of revue.md is treated.
export function commandSetReviewed() {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const uncommitted = uncommittedFiles(projectRoot)
  const specPath = chantierFilePath(projectRoot, chantier, 'spec.md')
  const { model, slice } = sliceState(chantier)
  const sliceBase = chantier.spec.data.slice_base || null
  const sliceBaseIsAncestor = model === 'sliced' && sliceBase ? isAncestorOfHead(projectRoot, sliceBase) : null
  const index = needsIndex(chantier) ? chantierIndex(projectRoot, config) : null
  let codeFiles = null
  try {
    codeFiles = model === 'sliced' && slice !== 'chantier' && sliceBaseIsAncestor !== false
      ? sliceCodeFiles(projectRoot, config, chantier, sliceBase, effectiveTdd(chantier) === 'yes', index)
      : null
  } catch (error) {
    console.error(`Revue non enregistrée : ${error.message}`)
    process.exit(2)
  }
  const refusal = setReviewedRefusal({
    chantier,
    sliceBaseIsAncestor,
    sliceCodeFiles: codeFiles,
    uncommittedCode: reviewCodeFiles(uncommitted, config),
    specUncommitted: uncommitted.some((file) => samePath(config, file, specPath)),
    changedTests: testDrivenPhase(chantier) === 'implementing'
      ? testFilesChangedSince(projectRoot, config, chantier.spec.data.tests_commit, chantier, index)
      : [],
  })
  if (refusal) {
    console.error(`Revue non enregistrée : ${refusal}`)
    process.exit(2)
  }
  const { values, message } = setReviewedUpdate(chantier, git(projectRoot, ['rev-parse', 'HEAD']))
  updateSpec(projectRoot, config, values)
  console.log(message)
}
