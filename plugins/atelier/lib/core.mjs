// Core logic of atelier: project configuration, chantier state, spec checks.
// Pure functions where possible so they can be tested without git or a filesystem.


export { checksGreenOn, withGreen } from './checks.mjs'
export { configPath, findProjectRoot, loadConfig } from './cli/common.mjs'
export {
  activeChantier,
  branchCommitSubjects,
  collectUsedIdentifiers,
  currentBranch,
  defaultBaseRef,
  defaultBranchName,
  findChantierDirectory,
  readChantier,
} from './cli/identifiers.mjs'
export { closeProblems, isReviewExempt, setStatusRefusal } from './close.mjs'
export {
  CHANTIER_TYPES,
  DEFAULT_CONFIG,
  applyToolEdit,
  codeLogArguments,
  matchesAny,
  parseCatFileBatch,
  parseFrontMatter,
  parseGitVersion,
  parsePorcelainPaths,
  parseTreeEntries,
  setFrontMatterValues,
  shortRefName,
  toProjectRelativePath,
} from './common.mjs'
export { checkProcessProblems } from './docs.mjs'
export {
  branchNameIdentifiers,
  chantierIdFromCommitSubjects,
  chantierIdFromDirectoryName,
  chantierIdFromText,
  commitSubjectIdentifiers,
  highestChantierNumber,
  nextChantierId,
} from './identifiers.mjs'
export { codeCommittedMatters, nextStep } from './next-step.mjs'
export {
  RELATION_FIELDS,
  buildChantierIndex,
  chantierTreesOf,
  childrenOf,
  describeRelation,
  hasRelations,
  isClosedHere,
  openChildren,
  parseRelations,
  relationCloseProblems,
  relationProblems,
  statusHere,
} from './relations.mjs'
export { isTreatment, nextReviewIds, parseReviewPoints, reviewPointProblems } from './review-points.mjs'
export { reviewCodeFiles, reviewProblems, reviewState, setReviewedRefusal, setReviewedUpdate } from './review.mjs'
export { planSliceCount, sliceState } from './slices.mjs'
export {
  REQUIRED_SECTIONS,
  TDD_RECOMMENDATION,
  amendmentsDiffer,
  appendAmendmentEntry,
  checkSpec,
  hideCode,
  meaningfulContent,
  parseAmendments,
  splitSections,
} from './spec.mjs'
export { decideStop } from './stop-hook.mjs'
export {
  freezeTestsRefusal,
  freezeTestsValues,
  isRefreeze,
  refreezeTestsEntry,
  removedTestLines,
  reopenTestsEntry,
  reopenTestsRefusal,
  setTddRefusal,
  testDrivenPhase,
} from './tdd.mjs'
export { COMMAND_SPEC_FIELDS, decideWrite } from './write-guard.mjs'
