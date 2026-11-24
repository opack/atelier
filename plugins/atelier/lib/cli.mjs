// Command-line entry point of atelier, used by the skills (through `atelier <command>`)
// and by the hooks. Every user-facing message is in French, like the rest of the method.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import {
  chantierFilePath,
  committedFileText,
  configPath,
  findProjectRoot,
  git,
  gitObjectExists,
  gitPaths,
  gitRaw,
  gitUserName,
  gitVersion,
  isAncestor,
  isAncestorOfHead,
  loadConfig,
  pluginRoot,
  readStandardInput,
  requireConfig,
  samePath,
  today,
  uncommittedFiles,
} from './cli/common.mjs'
import {
  activeChantier,
  commandNextId,
  defaultBaseRef,
  defaultBranchName,
  requireActiveChantier,
} from './cli/identifiers.mjs'
import { chantierIndex, formatRelations, isEpic, needsIndex, relationsSummary } from './cli/relations.mjs'
import {
  applyToolEdit,
  codeLogArguments,
  matchesAny,
  parseFrontMatter,
  setFrontMatterValues,
  toProjectRelativePath,
} from './common.mjs'
import {
  amendmentsDiffer,
  appendAmendmentEntry,
  checkProcessProblems,
  checkSpec,
  checksGreenOn,
  closeProblems,
  codeCommittedMatters,
  decideStop,
  decideWrite,
  freezeTestsRefusal,
  freezeTestsValues,
  isRefreeze,
  isReviewExempt,
  nextReviewIds,
  nextStep,
  parseAmendments,
  refreezeTestsEntry,
  removedTestLines,
  reopenTestsEntry,
  reopenTestsRefusal,
  reviewCodeFiles,
  reviewProblems,
  reviewState,
  setReviewedRefusal,
  setReviewedUpdate,
  setStatusRefusal,
  setTddRefusal,
  sliceState,
  testDrivenPhase,
  withGreen,
} from './core.mjs'
import { hasRelations, openChildren, relationProblems } from './relations.mjs'

const commands = {
  'next-id': commandNextId,
  status: commandStatus,
  'check-spec': commandCheckSpec,
  'check-process': commandCheckProcess,
  template: commandTemplate,
  sign: commandSign,
  'set-status': commandSetStatus,
  'freeze-tests': commandFreezeTests,
  'reopen-tests': commandReopenTests,
  'set-tdd': commandSetTdd,
  'set-reviewed': commandSetReviewed,
  'close-check': commandCloseCheck,
  'tests-changed': commandTestsChanged,
  'review-ids': commandReviewIds,
  bypass: commandBypass,
  checks: commandChecks,
  'hook-guard': hookGuard,
  'hook-gate': hookGate,
  'hook-session-start': hookSessionStart,
}

export function main(argumentList) {
  const [commandName, ...rest] = argumentList
  const command = commands[commandName]
  if (!command) {
    console.error(`Usage : atelier <${Object.keys(commands).join(' | ')}>`)
    process.exit(1)
  }
  command(rest)
}

// ---------- Helpers ----------

function bypassPath(projectRoot) {
  return join(projectRoot, '.atelier', 'bypass.json')
}

function readBypass(projectRoot, branch) {
  const path = bypassPath(projectRoot)
  if (!existsSync(path)) {
    return null
  }
  const bypass = JSON.parse(readFileSync(path, 'utf8'))
  return bypass.branch === branch ? bypass : null
}

function updateSpec(projectRoot, config, values) {
  const chantier = requireActiveChantier(projectRoot, config)
  const specPath = join(chantier.directory, 'spec.md')
  writeFileSync(specPath, setFrontMatterValues(readFileSync(specPath, 'utf8'), values))
  return { chantier, specPath }
}

// ---------- Commands ----------

function commandStatus(options) {
  const projectRoot = findProjectRoot()
  const config = loadConfig(projectRoot)
  if (!config) {
    console.log(JSON.stringify({ installed: false }))
    return
  }
  const { branch, chantier, source } = activeChantier(projectRoot, config)
  const bypass = readBypass(projectRoot, branch)
  const review = reviewSummary(projectRoot, config, chantier)
  const relations = relationsSummary(projectRoot, config, chantier)
  const codeCommitted = codeCommittedFact(projectRoot, config, chantier, review.reviewState)
  const summary = {
    installed: true,
    branch,
    chantierSource: source,
    chantier: chantier
      ? {
          id: chantier.id,
          directory: chantier.directory ? toProjectRelativePath(projectRoot, chantier.directory) : null,
          title: chantier.spec?.data.title ?? null,
          type: chantier.spec?.data.type ?? null,
          status: chantier.spec?.data.status ?? null,
          testDrivenPhase: chantier.spec ? testDrivenPhase(chantier) : null,
          testsCommit: chantier.spec?.data.tests_commit || null,
          ...slicePosition(chantier),
          ...review,
          codeCommitted,
          relations,
          files: chantier.files,
          specProblems: chantier.spec ? checkSpec(readFileSync(join(chantier.directory, 'spec.md'), 'utf8')) : [],
        }
      : null,
    bypass,
    nextStep: nextStep(chantier, review.reviewState, relations?.children, codeCommitted),
  }
  if (options.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }
  console.log(formatStatus(summary))
}

// Current slice and number of slices, both null outside the slice cycle.
function slicePosition(chantier) {
  const { slice, sliceCount } = sliceState(chantier)
  return { slice, sliceCount }
}

// State of the review, as shown by `status` and the session start reminder.
function reviewSummary(projectRoot, config, chantier) {
  const facts = reviewFacts(projectRoot, config, chantier)
  const state = reviewState(facts)
  return {
    reviewedCommit: facts.reviewedCommit,
    reviewState: state,
    reviewProblems: state === 'stale' ? reviewProblems(facts) : [],
  }
}

function formatStatus(summary) {
  const lines = [`Branche : ${summary.branch ?? '(aucune)'}`]
  if (summary.chantier) {
    const { id, title, type, status, files, specProblems } = summary.chantier
    const deduced = summary.chantierSource === 'commits' ? ' (déduit des commits)' : ''
    lines.push(`Chantier : ${id}${deduced}${title ? ` — ${title}` : ''} (${type ?? '?'}, ${status ?? 'pas de spec'})`)
    lines.push(`Documents : ${files.length ? files.join(', ') : 'aucun'}`)
    if (summary.chantier.relations) {
      lines.push(...formatRelations(summary.chantier.relations))
    }
    const phaseLabels = {
      'writing-tests': 'tests d’abord — aucune implémentation tant que les tests ne sont pas commités',
      implementing: 'implémentation — tests figés, ne pas les modifier',
    }
    const { slice, sliceCount } = summary.chantier
    if (typeof slice === 'number' && slice > sliceCount) {
      lines.push(`Tranche ${slice} absente du plan : la revue de la tranche mène à la revue du chantier.`)
    }
    if (status === 'signed' && phaseLabels[summary.chantier.testDrivenPhase]) {
      lines.push(`Phase TDD : ${phaseLabels[summary.chantier.testDrivenPhase]}`)
    }
    const { reviewedCommit, reviewState: state, reviewProblems: problems = [] } = summary.chantier
    if (reviewedCommit) {
      lines.push(state === 'current'
        ? `Revue : commit ${reviewedCommit.slice(0, 7)}, à jour (aucun code commité depuis)`
        : `Revue : commit ${reviewedCommit.slice(0, 7)}, obsolète\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
    }
    if (status !== 'signed' && status !== 'done' && specProblems.length) {
      lines.push(`À compléter dans la spec : ${specProblems.length} point(s)`)
    }
  }
  if (summary.bypass) {
    lines.push(`⚠️ Débrayage actif depuis ${summary.bypass.at} : ${summary.bypass.reason}. Spec et bilan à écrire après coup.`)
  }
  lines.push(`Prochaine étape : ${summary.nextStep}`)
  return lines.join('\n')
}

// Spec problems, relations included when atelier is installed: { problems, notes }.
function specProblems(projectRoot, config, text) {
  const problems = checkSpec(text)
  const { data } = parseFrontMatter(text)
  if (!hasRelations(data)) {
    return { problems, notes: [] }
  }
  if (!config) {
    return { problems, notes: ['Relations (rel_*) non vérifiées : atelier n’est pas installé dans ce projet (pas de .claude/atelier.json).'] }
  }
  return { problems: [...problems, ...relationProblems(data, chantierIndex(projectRoot, config))], notes: [] }
}

function commandCheckSpec([path]) {
  const projectRoot = findProjectRoot()
  const { problems, notes } = specProblems(projectRoot, loadConfig(projectRoot), readFileSync(path, 'utf8'))
  notes.forEach((note) => console.log(note))
  if (problems.length === 0) {
    console.log('Spec complète.')
    return
  }
  console.log(problems.map((problem) => `- ${problem}`).join('\n'))
  process.exitCode = 2
}

// Lines of the « Process (atelier) » section missing from the project's CLAUDE.md.
function commandCheckProcess() {
  const projectRoot = findProjectRoot()
  const claudePath = join(projectRoot, 'CLAUDE.md')
  const missing = checkProcessProblems(
    readFileSync(join(pluginRoot, 'templates', 'process.md'), 'utf8'),
    existsSync(claudePath) ? readFileSync(claudePath, 'utf8') : null,
    loadConfig(projectRoot)?.chantiersDir,
  )
  if (missing.length === 0) {
    console.log('Section « Process (atelier) » du CLAUDE.md à jour.')
    return
  }
  console.log(`Lignes de la section « Process (atelier) » absentes du CLAUDE.md :\n${missing.join('\n')}`)
  process.exitCode = 2
}

function commandTemplate([name]) {
  const path = join(pluginRoot, 'templates', `${name}.md`)
  if (!existsSync(path)) {
    console.error(`Template inconnu : ${name}`)
    process.exit(1)
  }
  process.stdout.write(readFileSync(path, 'utf8'))
}

function commandSign() {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const status = chantier.spec.data.status || 'draft'
  if (status !== 'draft') {
    console.error(`Signature refusée : la spec de ${chantier.id} est déjà « ${status} ». Seule une spec en brouillon se signe.`)
    process.exit(2)
  }
  const { problems } = specProblems(projectRoot, config, readFileSync(join(chantier.directory, 'spec.md'), 'utf8'))
  if (problems.length) {
    console.error(`Spec incomplète, signature refusée :\n${problems.map((problem) => `- ${problem}`).join('\n')}`)
    process.exit(2)
  }
  const { specPath } = updateSpec(projectRoot, config, {
    status: 'signed',
    signed_by: gitUserName(projectRoot),
    signed_at: today(),
  })
  console.log(toProjectRelativePath(projectRoot, specPath))
}

function commandSetStatus([status]) {
  // `signed` only through `atelier sign`, which checks the spec and records who signed.
  const allowedStatuses = ['draft', 'done', 'abandoned']
  if (!allowedStatuses.includes(status)) {
    console.error(`Statut attendu : ${allowedStatuses.join(', ')} (pour signer : atelier sign)`)
    process.exit(1)
  }
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const refusal = setStatusRefusal(chantier, status)
  if (refusal) {
    console.error(`Statut refusé : ${refusal}`)
    process.exit(2)
  }
  if (status === 'done') {
    const problems = closeCheckProblems(projectRoot, config, chantier)
    if (problems.length) {
      console.error(formatCloseProblems(chantier, problems))
      process.exit(2)
    }
  }
  // Abandoning an EPIC does not cascade: its open children are only listed.
  const open = status === 'abandoned' && isEpic(chantier) ? openChildren(chantierIndex(projectRoot, config), chantier.id) : []
  const values = status === 'done' ? { status, done_at: today() } : { status }
  const { specPath } = updateSpec(projectRoot, config, values)
  console.log(toProjectRelativePath(projectRoot, specPath))
  if (open.length) {
    const lines = open.map((child) => `- ${child.id} (${child.status ?? `sur ${child.branches.join(', ')}`})`)
    console.log(`Enfants encore ouverts de ${chantier.id}, à clore ou abandonner un par un :\n${lines.join('\n')}`)
  }
}

// What git says about the review recorded in the spec (see reviewProblems in lib/core.mjs).
// Any git error makes the review stale rather than failing.
function reviewFacts(projectRoot, config, chantier) {
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
    const filesSince = codeFilesSince(projectRoot, reviewedCommit, 'first-parent')
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

function uncommittedTestFiles(projectRoot, config) {
  return uncommittedFiles(projectRoot).filter((file) => matchesAny(file, config.testPaths, config.ignoreCase))
}

// Test files changed since the tests were frozen (committed or not).
function testFilesChangedSince(projectRoot, config, commit) {
  const committed = gitPaths(projectRoot, ['diff', '--name-only', '-z', commit, '--'])
    .filter((file) => matchesAny(file, config.testPaths, config.ignoreCase))
  return [...new Set([...committed, ...uncommittedTestFiles(projectRoot, config)])]
}

// Test files present at `base` whose lines were changed or removed in HEAD (whitespace and line
// endings ignored). Deleted files and binary files are taken from git's file lists, as the text
// diff has no removed line for an empty or binary file and quotes unusual paths.
function testFilesWithRemovedLines(projectRoot, config, base) {
  const range = [base, 'HEAD', '--']
  const fromDiff = removedTestLines(gitRaw(projectRoot, ['-c', 'core.quotePath=false', 'diff', '--no-renames', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '--ignore-all-space', '--ignore-cr-at-eol', ...range]))
  const deleted = gitPaths(projectRoot, ['diff', '--no-renames', '--name-only', '-z', '--diff-filter=D', ...range])
  // `--numstat -z` entries: "<added>\t<removed>\t<path>", "-" for both counts on a binary file.
  const binary = gitPaths(projectRoot, ['diff', '--no-renames', '--numstat', '-z', ...range])
    .filter((entry) => entry.startsWith('-\t-\t'))
    .map((entry) => entry.slice(4))
  return [...new Set([...fromDiff, ...deleted, ...binary])].filter((file) => matchesAny(file, config.testPaths, config.ignoreCase))
}

function appendAmendment(specPath, entry) {
  writeFileSync(specPath, appendAmendmentEntry(readFileSync(specPath, 'utf8'), entry))
}

// Step 3 of the TDD workflow: the tests must be committed before implementation starts.
function commandFreezeTests() {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  if (testDrivenPhase(chantier) !== 'writing-tests') {
    console.error('Ce chantier n’est pas en phase « tests d’abord ».')
    process.exit(1)
  }
  const pending = uncommittedTestFiles(projectRoot, config)
  if (pending.length) {
    console.error(`Tests non commités, impossible de les figer :\n${pending.map((file) => `- ${file}`).join('\n')}\nCommite-les d’abord.`)
    process.exit(2)
  }
  const commit = git(projectRoot, ['rev-parse', '--short', 'HEAD'])
  const lastCommitFiles = gitPaths(projectRoot, ['show', '--name-only', '-z', '--format=', 'HEAD'])
  if (!lastCommitFiles.some((file) => matchesAny(file, config.testPaths, config.ignoreCase))) {
    console.error('Le dernier commit ne contient aucun fichier de test. Commite les tests (et seulement les tests) avant de les figer.')
    process.exit(2)
  }
  const sliceBase = chantier.spec.data.slice_base || null
  const sliceBaseIsAncestor = sliceBase ? isAncestorOfHead(projectRoot, sliceBase) : null
  const removedTestFiles = sliceBase && sliceBaseIsAncestor ? testFilesWithRemovedLines(projectRoot, config, sliceBase) : []
  const refusal = freezeTestsRefusal({ chantier, sliceBaseIsAncestor, removedTestFiles })
  if (refusal) {
    console.error(`Gel refusé : ${refusal}`)
    process.exit(2)
  }
  const { specPath } = updateSpec(projectRoot, config, freezeTestsValues(chantier, commit))
  if (isRefreeze(parseAmendments(chantier.spec.body).entries)) {
    appendAmendment(specPath, refreezeTestsEntry(today(), commit))
  }
  console.log(`Tests figés au commit ${commit}. Phase suivante : implémentation, sans modifier les tests (/atelier:build).`)
}

function commandReopenTests(reasonWords) {
  const reason = reasonWords.join(' ').trim()
  if (!reason) {
    console.error('Usage : atelier reopen-tests <raison>')
    process.exit(1)
  }
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const refusal = reopenTestsRefusal(chantier)
  if (refusal) {
    console.error(`Réouverture refusée : ${refusal}`)
    process.exit(2)
  }
  const { specPath } = updateSpec(projectRoot, config, { tests_commit: '' })
  appendAmendment(specPath, reopenTestsEntry(today(), chantier.spec.data.tests_commit || chantier.spec.data.slice_base, reason))
  console.log('Tests rouverts. Retour en phase « tests d’abord » : aucune implémentation jusqu’au prochain commit des tests.')
}

// Records the human decision on TDD. After signature, the change is traced as an amendment.
function commandSetTdd([value, ...reasonWords]) {
  if (!['yes', 'no'].includes(value)) {
    console.error('Usage : atelier set-tdd <yes|no> [raison]')
    process.exit(1)
  }
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const refusal = setTddRefusal(chantier, value)
  if (refusal) {
    console.error(`TDD refusé : ${refusal}`)
    process.exit(2)
  }
  const wasSigned = chantier.spec.data.status === 'signed'
  const { specPath } = updateSpec(projectRoot, config, { tdd: value })
  const reason = reasonWords.join(' ').trim()
  if (wasSigned) {
    appendAmendment(specPath, `${today()} : TDD ${value === 'yes' ? 'activé' : 'désactivé'}${reason ? ` : ${reason}` : ''}`)
  }
  console.log(value === 'yes'
    ? 'Chantier en TDD : tests écrits, commités et figés avant l’implémentation.'
    : 'Chantier sans TDD : pas de phase tests d’abord imposée.')
}

// Records the reviewed commit (full hash of HEAD) once every point of revue.md is treated.
function commandSetReviewed() {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const uncommitted = uncommittedFiles(projectRoot)
  const specPath = chantierFilePath(projectRoot, chantier, 'spec.md')
  const { model, slice } = sliceState(chantier)
  const sliceBase = chantier.spec.data.slice_base || null
  const sliceBaseIsAncestor = model === 'sliced' && sliceBase ? isAncestorOfHead(projectRoot, sliceBase) : null
  const refusal = setReviewedRefusal({
    chantier,
    sliceBaseIsAncestor,
    sliceCodeFiles: model === 'sliced' && slice !== 'chantier' && sliceBaseIsAncestor !== false
      ? sliceCodeFiles(projectRoot, config, sliceBase, chantier.spec.data.tdd === 'yes')
      : null,
    uncommittedCode: reviewCodeFiles(uncommitted, config),
    specUncommitted: uncommitted.some((file) => samePath(config, file, specPath)),
    changedTests: testDrivenPhase(chantier) === 'implementing'
      ? testFilesChangedSince(projectRoot, config, chantier.spec.data.tests_commit)
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

// Whether code was committed in the current slice, for the next step (see nextStep): since the
// freeze of its tests in TDD (test files excluded), otherwise since `slice_base` or the merge base
// with the default branch. null when it cannot change the next step, or cannot be computed (no
// base, git error, start of the slice no longer an ancestor of HEAD).
function codeCommittedFact(projectRoot, config, chantier, review) {
  if (!codeCommittedMatters(chantier, review)) return null
  try {
    const testDriven = chantier.spec.data.tdd === 'yes'
    const start = (testDriven ? chantier.spec.data.tests_commit : chantier.spec.data.slice_base) || null
    if (start && !isAncestorOfHead(projectRoot, start)) return null
    const files = sliceCodeFiles(projectRoot, config, start, testDriven)
    return files === null ? null : files.length > 0
  } catch {
    return null
  }
}

// Files changed by the chantier since `from` (see codeLogArguments in lib/core.mjs): the commits of
// the default branch brought by a merge do not count, only the resolution of the merge does.
// `fallbackDiffMerges` keeps the caller's former command for an old git or without a ref to exclude.
function codeFilesSince(projectRoot, from, fallbackDiffMerges) {
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
function sliceCodeFiles(projectRoot, config, sliceBase, testDriven) {
  const defaultRef = defaultBaseRef(projectRoot)
  const base = sliceBase ?? (defaultRef ? git(projectRoot, ['merge-base', defaultRef, 'HEAD']) : null)
  if (!base) return null
  const files = reviewCodeFiles(codeFilesSince(projectRoot, base, null), config)
  return [...new Set(testDriven ? files.filter((file) => !matchesAny(file, config.testPaths, config.ignoreCase)) : files)]
}

// Deterministic checks before closing (see closeProblems in lib/core.mjs). Runs the project checks.
function closeCheckProblems(projectRoot, config, chantier) {
  let uncommittedCode = []
  let uncommittedError = null
  let revueUncommitted = false
  const revuePath = chantierFilePath(projectRoot, chantier, 'revue.md')
  try {
    const uncommitted = uncommittedFiles(projectRoot)
    uncommittedCode = reviewCodeFiles(uncommitted, config)
    revueUncommitted = uncommitted.some((file) => samePath(config, file, revuePath))
  } catch (error) {
    uncommittedError = error.message
  }
  return closeProblems({
    chantier,
    reviewFacts: reviewFacts(projectRoot, config, chantier),
    uncommittedCode,
    uncommittedError,
    revueUncommitted,
    checksFailure: runChecksOnce(projectRoot, config).failure,
    index: needsIndex(chantier) ? chantierIndex(projectRoot, config) : null,
  })
}

function formatCloseProblems(chantier, problems) {
  const after = isReviewExempt(chantier) ? 'Corrige, puis relance la clôture : /atelier:close' : 'Corrige, puis refais relire : /atelier:review'
  return `Clôture refusée :\n${problems.map((problem) => `- ${problem}`).join('\n')}\n${after}`
}

function commandCloseCheck() {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const problems = closeCheckProblems(projectRoot, config, chantier)
  if (problems.length) {
    console.error(formatCloseProblems(chantier, problems))
    process.exitCode = 2
    return
  }
  console.log('Clôture possible : revue à jour, travail commité, contrôles verts.')
}

function commandReviewIds(options) {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const readText = (name) => {
    const filePath = join(chantier.directory, name)
    return existsSync(filePath) ? readFileSync(filePath, 'utf8') : null
  }
  const ids = nextReviewIds({ revue: chantier.revue, spec: readText('spec.md'), decisions: readText('decisions.md') })
  if (options.includes('--json')) {
    console.log(JSON.stringify(ids, null, 2))
    return
  }
  const next = Object.entries(ids.next).map(([prefix, number]) => `${prefix}${number}`).join(', ')
  const open = ids.open.map(({ id, title, section }) => `- ${id}. ${title} (section « ${section} »)`)
  console.log(`Prochains identifiants : ${next}.`)
  console.log(open.length ? `Points de revue ouverts :\n${open.join('\n')}` : 'Aucun point de revue ouvert.')
}

function commandTestsChanged() {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const commit = chantier.spec.data.tests_commit
  if (!commit) {
    console.log('Tests pas encore figés.')
    return
  }
  const changed = testFilesChangedSince(projectRoot, config, commit)
  if (changed.length === 0) {
    console.log(`Aucun test modifié depuis le commit ${commit}.`)
    return
  }
  console.log(`Tests modifiés depuis le commit ${commit} :\n${changed.map((file) => `- ${file}`).join('\n')}`)
  process.exitCode = 2
}

function commandBypass([mode, ...reasonWords]) {
  const projectRoot = findProjectRoot()
  requireConfig(projectRoot)
  const path = bypassPath(projectRoot)
  if (mode === 'off') {
    rmSync(path, { force: true })
    console.log('Débrayage levé.')
    return
  }
  const reason = reasonWords.join(' ').trim()
  if (mode !== 'on' || !reason) {
    console.error('Usage : atelier bypass on <raison> | atelier bypass off')
    process.exit(1)
  }
  mkdirSync(dirname(path), { recursive: true })
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim()
  writeFileSync(path, JSON.stringify({ branch, reason, at: new Date().toISOString() }, null, 2))
  console.log(`Débrayage actif sur ${branch}. Ajoute « Atelier-Bypass: ${reason} » à chaque commit.`)
}

// Runs the configured checks. Returns the first failure, or null when everything passes.
function runChecks(projectRoot, config) {
  for (const check of config.checks) {
    const result = spawnSync(check.command, {
      cwd: projectRoot,
      shell: true,
      encoding: 'utf8',
      timeout: config.checkTimeoutSeconds * 1000,
      maxBuffer: 20 * 1024 * 1024,
    })
    if (result.status !== 0) {
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().split('\n').slice(-60).join('\n')
      return { check, output: result.error ? `${result.error.message}\n${output}` : output }
    }
  }
  return null
}

// Runs the configured checks unless they already passed on the current working tree (the state
// shared with the Stop hook), then records a pass. Without a tree id, the checks always run.
function runChecksOnce(projectRoot, config, { force = false } = {}) {
  if (config.checks.length === 0) {
    return { failure: null, reused: false }
  }
  const tree = currentTreeId(projectRoot)
  const state = tree === null ? {} : cachedGateState(projectRoot)
  if (!force && checksGreenOn(state, tree)) {
    return { failure: null, reused: true }
  }
  const failure = runChecks(projectRoot, config)
  if (!failure && tree !== null) {
    try {
      writeFileSync(gateStatePath(projectRoot), JSON.stringify(withGreen(cachedGateState(projectRoot), tree), null, 2))
    } catch {
      // The pass is only a cache: failing to record it means running the checks again next time.
    }
  }
  return { failure, reused: false }
}

function commandChecks(options) {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  if (config.checks.length === 0) {
    console.log('Aucun contrôle configuré dans .claude/atelier.json.')
    return
  }
  const { failure, reused } = runChecksOnce(projectRoot, config, { force: options.includes('--force') })
  if (failure) {
    console.log(`❌ ${failure.check.name} (${failure.check.command})\n${failure.output}`)
    process.exitCode = 2
    return
  }
  const names = config.checks.map((check) => check.name).join(', ')
  console.log(reused
    ? `✅ ${names} : déjà verts sur cet état du code, non relancés (atelier checks --force pour les relancer).`
    : `✅ ${names}`)
}

// ---------- Hooks ----------

function denyWrite(reason) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }))
}

// PreToolUse hook. A failure must not let the write through: in a project using atelier,
// the write is refused with the error.
function hookGuard() {
  const input = readStandardInput()
  const projectRoot = input.cwd ? findProjectRoot(input.cwd) : findProjectRoot()
  try {
    guardWrite(input, projectRoot)
  } catch (error) {
    if (existsSync(configPath(projectRoot))) {
      denyWrite(`atelier : impossible de vérifier cette écriture (${error.message}). Vérifie .claude/atelier.json et .atelier/, ou signale-le à l’utilisateur.`)
    }
  }
}

function guardWrite(input, projectRoot) {
  const config = loadConfig(projectRoot)
  const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path
  if (!config || !filePath) {
    return
  }
  const { branch, chantier } = activeChantier(projectRoot, config)
  const fileExists = existsSync(filePath)
  const relativePath = toProjectRelativePath(projectRoot, filePath)
  const isSpec = basename(filePath).toLowerCase() === 'spec.md'
  const currentText = isSpec && fileExists ? readFileSync(filePath, 'utf8') : null
  const proposedText = isSpec ? applyToolEdit(currentText, input.tool_name, input.tool_input) : null
  let committedText = null
  let committedSpecError = null
  if (isSpec && relativePath !== null && matchesAny(relativePath, [`${config.chantiersDir}/**`], config.ignoreCase)) {
    try {
      committedText = committedFileText(projectRoot, relativePath)
    } catch (error) {
      committedSpecError = error.message
    }
  }
  const decision = decideWrite({
    relativePath,
    toolName: input.tool_name,
    config,
    chantier,
    bypass: readBypass(projectRoot, branch),
    fileExists,
    existingSpec: currentText === null ? null : parseFrontMatter(currentText),
    proposedSpec: proposedText === null ? null : parseFrontMatter(proposedText),
    committedSpec: committedText === null ? null : parseFrontMatter(committedText),
    committedSpecError,
  })
  if (!decision.allowed) {
    denyWrite(decision.reason)
  }
}

function gateStatePath(projectRoot) {
  return join(projectRoot, '.atelier', 'gate.json')
}

function readGateState(projectRoot) {
  const path = gateStatePath(projectRoot)
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
}

// The gate state read as a cache: unreadable means empty, so the checks simply run.
function cachedGateState(projectRoot) {
  try {
    return readGateState(projectRoot)
  } catch {
    return {}
  }
}

// Id of the working tree, or null when git cannot compute it (no repository, `.atelier` unusable).
function currentTreeId(projectRoot) {
  try {
    mkdirSync(join(projectRoot, '.atelier'), { recursive: true })
    return workingTreeId(projectRoot)
  } catch {
    return null
  }
}

// Identifies the content of the working tree (tracked and untracked files, `.atelier/` excluded),
// through a separate index kept in `.atelier/` so that the real index is never touched.
function workingTreeId(projectRoot) {
  const env = { ...process.env, GIT_INDEX_FILE: join(projectRoot, '.atelier', 'gate-index') }
  // No exclude pathspec: git rejects it when `.atelier/` is ignored, as /atelier:init does.
  // When it is not ignored, `add` stages the gate's own index, which changes under git's feet:
  // `--force` lets `rm` drop it anyway (without it, rm fails and no tree id can be computed).
  execFileSync('git', ['add', '--all'], { cwd: projectRoot, env, stdio: 'ignore' })
  execFileSync('git', ['rm', '-r', '--cached', '--force', '--quiet', '--ignore-unmatch', '.atelier'], { cwd: projectRoot, env, stdio: 'ignore' })
  return execFileSync('git', ['write-tree'], { cwd: projectRoot, env, encoding: 'utf8' }).trim()
}

// Stop hook: the decision itself is decideStop (lib/core.mjs). A failure does not block the
// agent, but the user is told that the end-of-turn checks did not run.
function hookGate() {
  const input = readStandardInput()
  const projectRoot = input.cwd ? findProjectRoot(input.cwd) : findProjectRoot()
  try {
    gate(projectRoot)
  } catch (error) {
    console.log(JSON.stringify({ systemMessage: `atelier : contrôle de fin de tour impossible (${error.message}).` }))
  }
}

function gate(projectRoot) {
  const config = loadConfig(projectRoot)
  if (!config) {
    return
  }
  const { branch, chantier } = activeChantier(projectRoot, config)
  const statePath = gateStatePath(projectRoot)
  mkdirSync(dirname(statePath), { recursive: true })
  const decision = decideStop({
    config,
    chantier,
    bypass: readBypass(projectRoot, branch),
    changedFiles: uncommittedFiles(projectRoot),
    tree: workingTreeId(projectRoot),
    changedTests: testDrivenPhase(chantier) === 'implementing'
      ? testFilesChangedSince(projectRoot, config, chantier.spec.data.tests_commit)
      : [],
    state: readGateState(projectRoot),
    runChecks: () => runChecks(projectRoot, config),
  })
  writeFileSync(statePath, JSON.stringify(decision.state, null, 2))
  if (decision.block) {
    console.error(decision.message)
    process.exit(2)
  }
  if (decision.message) {
    console.log(JSON.stringify({ systemMessage: decision.message }))
  }
}

function hookSessionStart() {
  const projectRoot = findProjectRoot()
  const config = loadConfig(projectRoot)
  if (!config) {
    return
  }
  const { branch, chantier, source } = activeChantier(projectRoot, config)
  const review = reviewSummary(projectRoot, config, chantier)
  const relations = relationsSummary(projectRoot, config, chantier)
  const summary = {
    branch,
    chantierSource: source,
    chantier: chantier ? { id: chantier.id, title: chantier.spec?.data.title, type: chantier.spec?.data.type, status: chantier.spec?.data.status, files: chantier.files, ...(chantier.spec ? slicePosition(chantier) : {}), ...review, relations } : null,
    bypass: readBypass(projectRoot, branch),
    nextStep: nextStep(chantier, review.reviewState, relations?.children, codeCommittedFact(projectRoot, config, chantier, review.reviewState)),
  }
  const statusText = summary.chantier
    ? formatStatus({ ...summary, chantier: { ...summary.chantier, specProblems: [] } })
    : formatStatus(summary)
  console.log(`Projet géré avec atelier (process IA : chantiers, spec signée avant le code, tests d'abord, bilan).\n${statusText}`)
}
