// Core logic of atelier: project configuration, chantier state, spec checks.
// Pure functions where possible so they can be tested without git or a filesystem.

import { checksGreenOn, withGreen } from './checks.mjs'
import { matchesAny, specStatus } from './common.mjs'
import { relationCloseProblems } from './relations.mjs'
import { parseReviewPoints, reviewPointProblems } from './review-points.mjs'
import { reviewProblems } from './review.mjs'
import { sliceLabel, sliceState } from './slices.mjs'
import { parseAmendments } from './spec.mjs'
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

// ---------- Close ----------

// An EPIC (no code) and a SPIKE without TDD (throwaway code, never merged) are closed without a
// review. A SPIKE in TDD follows the whole process, review included, unless it was led under the
// model before slices (legacy), which closed a SPIKE without review.
export function isReviewExempt(chantier) {
  const type = (chantier?.spec?.data?.type ?? '').toUpperCase()
  const { model } = sliceState(chantier)
  return type === 'EPIC' || model === 'none' || (type === 'SPIKE' && model === 'legacy')
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
export function closeProblems({ chantier, reviewFacts, uncommittedCode, uncommittedError, revueUncommitted = false, checksFailure, index = null }) {
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
    problems.push(...relationCloseProblems(chantier.id, chantier.spec.data, index))
  }
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

// ---------- Next step ----------

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
  const needsPlan = ['FEAT', 'REF', 'EPIC'].includes(type)
  if (needsPlan && !chantier.files.includes('plan.md')) {
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

// Next step of the current phase (tests, build, review, close), for a slice or the chantier.
// `implemented`: code was committed in the slice and no review covers it.
function phaseStep(chantier, review = 'none', implemented = false) {
  const phase = testDrivenPhase(chantier)
  if (phase === 'writing-tests') {
    return 'Tests d’abord : écrire les tests, vérifier qu’ils échouent, les commiter (aucune implémentation) : /atelier:write-tests'
  }
  const build = phase === 'implementing'
    ? 'Implémenter jusqu’à ce que tous les tests passent, sans modifier les tests, puis commiter : /atelier:build'
    : 'Implémenter (sans TDD pour ce chantier), puis commiter : /atelier:build'
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

// ---------- Path rules for the guard hook ----------

// Spec header fields written only by the atelier command (sign, set-status, freeze-tests,
// reopen-tests, set-reviewed).
export const COMMAND_SPEC_FIELDS = ['status', 'signed_by', 'signed_at', 'done_at', 'tests_commit', 'reviewed_commit', 'slice', 'slice_base', 'last_slice']

// Fields that cannot change through the edit tool once the spec is no longer a draft, besides
// the command fields: `tdd` changes through `atelier set-tdd`; `id` and `type` are bound to the
// branch, the directory and the next step.
const FROZEN_AFTER_SIGNATURE_FIELDS = ['tdd', 'id', 'type']

// Why a write to a spec file is refused, or null. `existingSpec` and `proposedSpec` are the
// parsed spec before and after the write (null when absent or unknown); `committedSpec` is the
// parsed spec in HEAD (null when absent from HEAD) and `committedSpecError` the git error met
// while reading it, if any.
function specWriteRefusal(toolName, existingSpec, proposedSpec, committedSpec, committedSpecError) {
  if (committedSpecError) {
    return `atelier : impossible de lire la version commitée de la spec (${committedSpecError}), donc de vérifier cette écriture, même pour une spec en brouillon. Signale-le à l’utilisateur.`
  }
  const guarded = specStatus(existingSpec) !== 'draft' || (committedSpec && specStatus(committedSpec) !== 'draft')
  if (toolName === 'Write' && guarded) {
    return 'atelier : cette spec n’est plus en brouillon, elle ne se réécrit pas. Modifie-la avec des éditions ciblées et ajoute une entrée datée dans la section « Amendements » (/atelier:amend).'
  }
  if (!proposedSpec) {
    // An edit that cannot be replayed exactly cannot be checked: refuse rather than trust it.
    return (existingSpec || guarded) && ['Edit', 'MultiEdit'].includes(toolName)
      ? 'atelier : impossible de vérifier cette édition de la spec (texte introuvable tel quel). Relis le fichier et refais une édition exacte.'
      : null
  }
  const before = existingSpec?.data ?? {}
  const after = proposedSpec.data
  const valueOf = (data, field) => (field === 'status' ? data.status || 'draft' : data[field] ?? '')
  const changedFields = COMMAND_SPEC_FIELDS.filter((field) => valueOf(before, field) !== valueOf(after, field))
  if (changedFields.length) {
    return `atelier : ${changedFields.map((field) => `« ${field} »`).join(', ')} ne se modifie(nt) que par la commande atelier (la signature passe par /atelier:sign, sur accord explicite de l’utilisateur).`
  }
  if (!guarded) {
    return null
  }
  const status = specStatus(existingSpec)
  const frozenChanges = FROZEN_AFTER_SIGNATURE_FIELDS.filter((field) => valueOf(before, field) !== valueOf(after, field))
  if (frozenChanges.includes('tdd')) {
    return `atelier : la spec n’est plus en brouillon (statut : ${status}) ; « tdd » ne change plus que par « atelier set-tdd <yes|no> <raison> », tracé en amendement.`
  }
  if (frozenChanges.length) {
    return `atelier : la spec n’est plus en brouillon (statut : ${status}) ; ${frozenChanges.map((field) => `« ${field} »`).join(' et ')} ne change(nt) plus (liés à la branche et au dossier du chantier). Si c’est vraiment nécessaire, abandonne ce chantier et ouvre-en un nouveau.`
  }
  return amendmentRefusal(committedSpec && specStatus(committedSpec) !== 'draft' ? committedSpec : existingSpec, proposedSpec)
}

// A change to the body (outside "Amendements") or to a header field compared with the reference
// needs a new dated entry; the reference entries stay an exact prefix of the proposed ones.
function amendmentRefusal(referenceSpec, proposedSpec) {
  const reference = parseAmendments(referenceSpec.body ?? '')
  const proposed = parseAmendments(proposedSpec.body ?? '')
  if (proposed.sectionCount > 1) {
    return 'atelier : la spec aurait plusieurs sections « ## Amendements ». Garde une seule section et ajoute les entrées à sa fin.'
  }
  const isPrefix = reference.entries.every((entry, index) => proposed.entries[index] === entry)
  if (!isPrefix) {
    return 'atelier : les entrées existantes de la section « Amendements » ne se modifient ni ne se suppriment, et une nouvelle entrée s’ajoute à la fin de la section.'
  }
  const excluded = new Set([...COMMAND_SPEC_FIELDS, ...FROZEN_AFTER_SIGNATURE_FIELDS])
  const fields = new Set([...Object.keys(referenceSpec.data), ...Object.keys(proposedSpec.data)].filter((field) => !excluded.has(field)))
  const headerChanged = [...fields].some((field) => (referenceSpec.data[field] ?? '') !== (proposedSpec.data[field] ?? ''))
  if ((headerChanged || reference.rest !== proposed.rest) && proposed.entries.length <= reference.entries.length) {
    return 'atelier : cette spec est signée ; toute modification doit être tracée. Ajoute d’abord, à la fin de la section « ## Amendements », une entrée « - AAAA-MM-JJ : quoi, pourquoi », puis modifie la spec (/atelier:amend). La comparaison se fait avec la version commitée : une modification non commitée sans entrée, même faite par l’utilisateur, bloque les éditions jusqu’à son commit ou l’ajout d’une entrée.'
  }
  return null
}

// Why `atelier set-status <status>` is refused for this chantier, or null.
export function setStatusRefusal(chantier, status) {
  const current = specStatus(chantier?.spec)
  if (status === 'draft' && current !== 'draft') {
    return `la spec de ${chantier.id} est « ${current} » ; elle ne repasse pas en brouillon. Pour la modifier : /atelier:amend. Signée par erreur : abandonne ce chantier (atelier set-status abandoned) et ouvre-en un nouveau.`
  }
  return null
}

// Decides whether the agent may write a file. Returns { allowed, reason }. The rules apply in order.
// `context` = { relativePath (null outside the project), toolName, config, chantier, bypass,
// fileExists, existingSpec, proposedSpec, committedSpec, committedSpecError } where the specs are
// the parsed spec file before and after the write, and in HEAD (see specWriteRefusal).
export function decideWrite(context) {
  const { relativePath, toolName, config, chantier, bypass, fileExists, existingSpec, proposedSpec, committedSpec, committedSpecError } = context
  if (relativePath === null) {
    return { allowed: true }
  }
  const matches = (patterns) => matchesAny(relativePath, patterns, config.ignoreCase)
  if (matches(config.sensitivePaths)) {
    return { allowed: false, reason: `atelier : « ${relativePath} » est un fichier sensible, jamais modifié par l’agent.` }
  }
  if (matches(['.atelier/**']) || (fileExists && matches(['.claude/atelier.json']))) {
    return {
      allowed: false,
      reason: `atelier : « ${relativePath} » fait partie de l’état d’atelier ; seuls l’utilisateur et la commande atelier le modifient (débrayage : /atelier:off). Si un changement est nécessaire, demande-le à l’utilisateur.`,
    }
  }
  if (matches([`${config.chantiersDir}/**`]) && matches(['spec.md'])) {
    const refusal = specWriteRefusal(toolName, existingSpec, proposedSpec, committedSpec ?? null, committedSpecError ?? null)
    if (refusal) {
      return { allowed: false, reason: refusal }
    }
  }
  if (matches(config.freePaths)) {
    return { allowed: true }
  }
  if (bypass) {
    return { allowed: true }
  }
  if (!chantier) {
    return {
      allowed: false,
      reason: 'atelier : aucun chantier actif sur cette branche. Ouvre un chantier avec /atelier:new (ou, en urgence de production seulement, /atelier:off <raison>).',
    }
  }
  const status = chantier.spec?.data?.status || 'draft'
  if (['done', 'abandoned'].includes(status)) {
    return {
      allowed: false,
      reason: `atelier : ${chantier.id} est clos (statut : ${status}). Pour modifier le code, ouvre un nouveau chantier avec /atelier:new.`,
    }
  }
  if (status !== 'signed') {
    return {
      allowed: false,
      reason: `atelier : la spec de ${chantier.id} n’est pas signée (statut : ${status}). Termine-la puis signe-la avec /atelier:sign avant de modifier le code.`,
    }
  }
  if ((chantier.spec.data.type ?? '').toUpperCase() === 'EPIC') {
    return {
      allowed: false,
      reason: `atelier : ${chantier.id} est un EPIC : il n’implémente rien, il définit un cadre que d’autres chantiers concrétisent. Seuls les chemins libres (freePaths de .claude/atelier.json) s’écrivent ici ; pour coder, ouvre un chantier rattaché (rel_parent: ${chantier.id}) avec /atelier:new.`,
    }
  }
  const isTestFile = matches(config.testPaths)
  const phase = testDrivenPhase(chantier)
  if (phase === 'writing-tests' && !isTestFile) {
    return {
      allowed: false,
      reason: `atelier : ${chantier.id} est en phase « tests d’abord » (TDD). N’écris aucune implémentation, même factice : seulement des fichiers de test. Lance les tests, vérifie qu’ils échouent, fais-les relire et commiter (/atelier:write-tests). Si ce fichier est un test, demande à l’utilisateur d’ajouter son motif à « testPaths » dans .claude/atelier.json.`,
    }
  }
  if (phase === 'implementing' && isTestFile) {
    return {
      allowed: false,
      reason: `atelier : les tests de ${chantier.id} sont commités et figés. Ne les modifie pas : modifie l’implémentation jusqu’à ce qu’ils passent. Si un test est réellement faux, arrête-toi et signale-le ; le rouvrir se fait avec /atelier:write-tests, raison à l’appui, sur décision de l’utilisateur.`,
    }
  }
  return { allowed: true }
}

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
