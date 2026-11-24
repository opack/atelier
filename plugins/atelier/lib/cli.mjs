// Command-line entry point of atelier, used by the skills (through `atelier <command>`)
// and by the hooks. Every user-facing message is in French, like the rest of the method.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { commandChecks, gateStatePath, readGateState, runChecks, workingTreeId } from './cli/checks.mjs'
import { commandCloseCheck, commandSetStatus } from './cli/close.mjs'
import {
  committedFileText,
  configPath,
  findProjectRoot,
  isAncestorOfHead,
  loadConfig,
  readStandardInput,
  requireConfig,
  uncommittedFiles,
} from './cli/common.mjs'
import { commandCheckProcess, commandTemplate } from './cli/docs.mjs'
import { activeChantier, commandNextId } from './cli/identifiers.mjs'
import { formatRelations, relationsSummary } from './cli/relations.mjs'
import { commandReviewIds } from './cli/review-points.mjs'
import { commandSetReviewed, reviewSummary } from './cli/review.mjs'
import { sliceCodeFiles, slicePosition } from './cli/slices.mjs'
import { commandCheckSpec, commandSign } from './cli/spec.mjs'
import {
  commandFreezeTests,
  commandReopenTests,
  commandSetTdd,
  commandTestsChanged,
  testFilesChangedSince,
} from './cli/tdd.mjs'
import { applyToolEdit, matchesAny, parseFrontMatter, toProjectRelativePath } from './common.mjs'
import { codeCommittedMatters, decideStop, decideWrite, nextStep } from './core.mjs'
import { checkSpec } from './spec.mjs'
import { testDrivenPhase } from './tdd.mjs'

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
