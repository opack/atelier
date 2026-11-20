// Command-line entry point of atelier, used by the skills (through `atelier <command>`)
// and by the hooks. Every user-facing message is in French, like the rest of the method.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  activeChantier,
  amendmentsDiffer,
  appendAmendmentEntry,
  applyToolEdit,
  checkSpec,
  closeProblems,
  collectUsedIdentifiers,
  configPath,
  decideStop,
  decideWrite,
  findProjectRoot,
  isRefreeze,
  loadConfig,
  nextChantierId,
  matchesAny,
  nextStep,
  testDrivenPhase,
  parseAmendments,
  parseFrontMatter,
  parsePorcelainPaths,
  refreezeTestsEntry,
  reopenTestsEntry,
  reopenTestsRefusal,
  reviewCodeFiles,
  reviewProblems,
  reviewState,
  setFrontMatterValues,
  setReviewedRefusal,
  setStatusRefusal,
  toProjectRelativePath,
} from './core.mjs'

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const commands = {
  'next-id': commandNextId,
  status: commandStatus,
  'check-spec': commandCheckSpec,
  template: commandTemplate,
  sign: commandSign,
  'set-status': commandSetStatus,
  'freeze-tests': commandFreezeTests,
  'reopen-tests': commandReopenTests,
  'set-tdd': commandSetTdd,
  'set-reviewed': commandSetReviewed,
  'close-check': commandCloseCheck,
  'tests-changed': commandTestsChanged,
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

function requireConfig(projectRoot) {
  const config = loadConfig(projectRoot)
  if (!config) {
    console.error('atelier n’est pas installé dans ce projet (pas de .claude/atelier.json). Lance /atelier:init.')
    process.exit(1)
  }
  return config
}

function requireActiveChantier(projectRoot, config) {
  const { chantier } = activeChantier(projectRoot, config)
  if (!chantier?.directory || !chantier.spec) {
    console.error('Aucun chantier actif avec une spec sur cette branche.')
    process.exit(1)
  }
  return chantier
}

function readStandardInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    return {}
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function gitUserName(projectRoot) {
  try {
    return execFileSync('git', ['config', 'user.name'], { cwd: projectRoot, encoding: 'utf8' }).trim()
  } catch {
    return 'inconnu'
  }
}

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

function commandNextId([type]) {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  console.log(nextChantierId(type ?? '', collectUsedIdentifiers(projectRoot, config)))
}

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
          ...review,
          files: chantier.files,
          specProblems: chantier.spec ? checkSpec(readFileSync(join(chantier.directory, 'spec.md'), 'utf8')) : [],
        }
      : null,
    bypass,
    nextStep: nextStep(chantier, review.reviewState),
  }
  if (options.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }
  console.log(formatStatus(summary))
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
    const phaseLabels = {
      'writing-tests': 'tests d’abord — aucune implémentation tant que les tests ne sont pas commités',
      implementing: 'implémentation — tests figés, ne pas les modifier',
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

function commandCheckSpec([path]) {
  const problems = checkSpec(readFileSync(path, 'utf8'))
  if (problems.length === 0) {
    console.log('Spec complète.')
    return
  }
  console.log(problems.map((problem) => `- ${problem}`).join('\n'))
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
  const problems = checkSpec(readFileSync(join(chantier.directory, 'spec.md'), 'utf8'))
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
      console.error(formatCloseProblems(problems))
      process.exit(2)
    }
  }
  const values = status === 'done' ? { status, done_at: today() } : { status }
  const { specPath } = updateSpec(projectRoot, config, values)
  console.log(toProjectRelativePath(projectRoot, specPath))
}

function git(projectRoot, gitArguments) {
  return gitRaw(projectRoot, gitArguments).trim()
}

// Untrimmed output: `git status --porcelain` lines start with a significant space.
function gitRaw(projectRoot, gitArguments) {
  return execFileSync('git', gitArguments, { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

// File list printed by a git command run with -z (NUL-separated, never quoted).
function gitPaths(projectRoot, gitArguments) {
  return gitRaw(projectRoot, gitArguments).split('\0').filter(Boolean)
}

// Whether a git object or ref exists: false when git says it does not, an error for anything else.
function gitObjectExists(projectRoot, name) {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', name], { cwd: projectRoot, encoding: 'utf8' })
  if (result.status === 0) {
    return true
  }
  if (result.status === 1 && !result.stderr?.trim()) {
    return false
  }
  throw new Error(result.error?.message || result.stderr?.trim() || `git rev-parse ${name}`)
}

// Text of a file as committed in `commit` (HEAD by default), or null when it is absent from that
// commit (or there is no commit yet). The path is resolved without case first, as the file
// system may ignore it.
function committedFileText(projectRoot, relativePath, commit = 'HEAD') {
  if (!gitObjectExists(projectRoot, `${commit}^{commit}`)) {
    return null
  }
  const candidates = gitPaths(projectRoot, ['ls-files', '-z', `--with-tree=${commit}`, '--', `:(icase,literal)${relativePath}`])
  const path = candidates.find((candidate) => candidate === relativePath) ?? candidates[0]
  if (!path || !gitObjectExists(projectRoot, `${commit}:${path}`)) {
    return null
  }
  return gitRaw(projectRoot, ['show', `${commit}:${path}`])
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
    const filesSince = gitPaths(projectRoot, ['log', '--name-only', '-z', '--no-renames', '--diff-merges=first-parent', '--format=', `${reviewedCommit}..HEAD`])
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

// Files changed in the working tree (uncommitted, including untracked).
function uncommittedFiles(projectRoot) {
  return parsePorcelainPaths(gitRaw(projectRoot, ['status', '--porcelain', '-z', '--untracked-files=all']))
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
  const { specPath } = updateSpec(projectRoot, config, { tests_commit: commit })
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
  appendAmendment(specPath, reopenTestsEntry(today(), chantier.spec.data.tests_commit, reason))
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

// Records the reviewed commit (full hash of HEAD) once the review has no blocking point left.
function commandSetReviewed() {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const uncommitted = uncommittedFiles(projectRoot)
  const specPath = toProjectRelativePath(projectRoot, join(chantier.directory, 'spec.md'))
  const refusal = setReviewedRefusal({
    chantier,
    uncommittedCode: reviewCodeFiles(uncommitted, config),
    specUncommitted: uncommitted.some((file) => (config.ignoreCase ? file.toLowerCase() === specPath.toLowerCase() : file === specPath)),
    changedTests: testDrivenPhase(chantier) === 'implementing'
      ? testFilesChangedSince(projectRoot, config, chantier.spec.data.tests_commit)
      : [],
  })
  if (refusal) {
    console.error(`Revue non enregistrée : ${refusal}`)
    process.exit(2)
  }
  const commit = git(projectRoot, ['rev-parse', 'HEAD'])
  updateSpec(projectRoot, config, { reviewed_commit: commit })
  console.log(`Revue enregistrée au commit ${commit}. Commite la spec : docs(chantiers): [${chantier.id}] review`)
}

// Deterministic checks before closing (see closeProblems in lib/core.mjs). Runs the project checks.
function closeCheckProblems(projectRoot, config, chantier) {
  let uncommittedCode = []
  let uncommittedError = null
  try {
    uncommittedCode = reviewCodeFiles(uncommittedFiles(projectRoot), config)
  } catch (error) {
    uncommittedError = error.message
  }
  return closeProblems({
    chantier,
    reviewFacts: reviewFacts(projectRoot, config, chantier),
    uncommittedCode,
    uncommittedError,
    checksFailure: runChecks(projectRoot, config),
  })
}

function formatCloseProblems(problems) {
  return `Clôture refusée :\n${problems.map((problem) => `- ${problem}`).join('\n')}\nCorrige, puis refais relire : /atelier:review`
}

function commandCloseCheck() {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const problems = closeCheckProblems(projectRoot, config, requireActiveChantier(projectRoot, config))
  if (problems.length) {
    console.error(formatCloseProblems(problems))
    process.exitCode = 2
    return
  }
  console.log('Clôture possible : revue à jour, travail commité, contrôles verts.')
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

function commandChecks() {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  if (config.checks.length === 0) {
    console.log('Aucun contrôle configuré dans .claude/atelier.json.')
    return
  }
  const failure = runChecks(projectRoot, config)
  if (failure) {
    console.log(`❌ ${failure.check.name} (${failure.check.command})\n${failure.output}`)
    process.exitCode = 2
    return
  }
  console.log(`✅ ${config.checks.map((check) => check.name).join(', ')}`)
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

// Identifies the content of the working tree (tracked and untracked files, `.atelier/` excluded),
// through a separate index kept in `.atelier/` so that the real index is never touched.
function workingTreeId(projectRoot) {
  const env = { ...process.env, GIT_INDEX_FILE: join(projectRoot, '.atelier', 'gate-index') }
  // No exclude pathspec: git rejects it when `.atelier/` is ignored, as /atelier:init does.
  execFileSync('git', ['add', '--all'], { cwd: projectRoot, env, stdio: 'ignore' })
  execFileSync('git', ['rm', '-r', '--cached', '--quiet', '--ignore-unmatch', '.atelier'], { cwd: projectRoot, env, stdio: 'ignore' })
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
    state: existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {},
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
  const summary = {
    branch,
    chantierSource: source,
    chantier: chantier ? { id: chantier.id, title: chantier.spec?.data.title, type: chantier.spec?.data.type, status: chantier.spec?.data.status, files: chantier.files, ...review } : null,
    bypass: readBypass(projectRoot, branch),
    nextStep: nextStep(chantier, review.reviewState),
  }
  const statusText = summary.chantier
    ? formatStatus({ ...summary, chantier: { ...summary.chantier, specProblems: [] } })
    : formatStatus(summary)
  console.log(`Projet géré avec atelier (process IA : chantiers, spec signée avant le code, tests d'abord, bilan).\n${statusText}`)
}
