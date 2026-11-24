// Command-line entry point of atelier, used by the skills (through `atelier <command>`)
// and by the hooks. Every user-facing message is in French, like the rest of the method.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { commandChecks, gateStatePath, readGateState, runChecks, workingTreeId } from './cli/checks.mjs'
import { commandCloseCheck, commandSetStatus } from './cli/close.mjs'
import { findProjectRoot, loadConfig, readStandardInput, uncommittedFiles } from './cli/common.mjs'
import { commandCheckProcess, commandTemplate } from './cli/docs.mjs'
import { activeChantier, commandNextId } from './cli/identifiers.mjs'
import { commandStatus, hookSessionStart } from './cli/next-step.mjs'
import { commandReviewIds } from './cli/review-points.mjs'
import { commandSetReviewed } from './cli/review.mjs'
import { commandCheckSpec, commandSign } from './cli/spec.mjs'
import {
  commandFreezeTests,
  commandReopenTests,
  commandSetTdd,
  commandTestsChanged,
  testFilesChangedSince,
} from './cli/tdd.mjs'
import { commandBypass, hookGuard, readBypass } from './cli/write-guard.mjs'
import { decideStop } from './core.mjs'
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

// ---------- Hooks ----------

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
