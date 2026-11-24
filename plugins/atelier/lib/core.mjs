// Core logic of atelier: project configuration, chantier state, spec checks.
// Pure functions where possible so they can be tested without git or a filesystem.

import { checksGreenOn, withGreen } from './checks.mjs'
import { matchesAny } from './common.mjs'
import { testDrivenPhase } from './tdd.mjs'

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

// ---------- Stop hook ----------

// Decides what happens when the agent wants to stop. Returns { block, message, state }: when
// `block` is true the agent keeps working on `message`; otherwise `message`, if any, is for the user.
// `state` ({ lastGreen, lastBlock, reportedUnsigned }) is persisted between calls.
// `context` = { config, chantier, bypass, changedFiles (uncommitted), changedTests (frozen tests
// modified since tests_commit), tree (identifies the working tree content, null when unknown),
// state, runChecks (returns the first failing check as { check, output }, or null) }.
export function decideStop(context) {
  const { config, chantier, bypass, changedFiles, changedTests, tree, runChecks } = context
  const state = { ...context.state }
  const signed = chantier?.spec?.data?.status === 'signed'
  const phase = signed ? testDrivenPhase(chantier) : 'none'
  if (phase === 'writing-tests') {
    return { block: false, state }
  }
  // Blocking again on an unchanged working tree means the agent is stuck: let it stop, and tell
  // the user once.
  const block = (message) => {
    if (tree !== null && state.lastBlock === tree) {
      if (state.reportedStuck === tree) {
        return { block: false, state }
      }
      return { block: false, message: `atelier : l’agent s’est arrêté sans parvenir à régler ce problème.\n\n${message}`, state: { ...state, reportedStuck: tree } }
    }
    return { block: true, message, state: { ...state, lastBlock: tree, lastMessage: message } }
  }
  const pass = (newState = state) => ({ block: false, state: { ...newState, lastBlock: null } })
  if (phase === 'implementing' && changedTests.length) {
    return block(`atelier : des tests figés ont été modifiés (${changedTests.join(', ')}). Restaure-les (git checkout ${chantier.spec.data.tests_commit} -- <fichier>) et corrige l’implémentation. Si un test est réellement faux, arrête-toi et signale-le à l’utilisateur au lieu de le modifier.`)
  }
  const ignoredPaths = [...config.freePaths, `${config.chantiersDir}/**`, '.atelier/**']
  const codeFiles = changedFiles.filter((file) => !matchesAny(file, ignoredPaths, config.ignoreCase))
  if (codeFiles.length === 0) {
    return pass()
  }
  if (!signed && !bypass && tree !== null && state.reportedUnsigned !== tree) {
    return {
      block: true,
      message: `atelier : du code a changé sans chantier signé (${codeFiles.join(', ')}). Si c’est toi, par une commande shell par exemple, signale-le à l’utilisateur : ce code n’aurait pas dû être écrit avant la signature de la spec. Sinon, ignore ce message.`,
      state: { ...state, reportedUnsigned: tree },
    }
  }
  if (config.checks.length === 0 || checksGreenOn(state, tree)) {
    return pass()
  }
  if (tree !== null && state.lastBlock === tree) {
    // Already known to fail on this exact tree: no need to run the checks again.
    return block(state.lastMessage)
  }
  const failure = runChecks()
  if (!failure) {
    return pass(withGreen(state, tree))
  }
  return block(`atelier : le contrôle « ${failure.check.name} » échoue (${failure.check.command}). Continue à corriger l’implémentation jusqu’à ce que tout passe, sans modifier les tests.\n\n${failure.output}`)
}
