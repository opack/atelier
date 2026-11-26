// Stop hook (gate): reads the state of the working tree and runs the checks when needed.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { decideStop } from '../stop-hook.mjs'
import { testDrivenPhase } from '../tdd.mjs'
import { gateStatePath, readGateState, runChecks, workingTreeId } from './checks.mjs'
import { findProjectRoot, loadConfig, readStandardInput, uncommittedFiles } from './common.mjs'
import { activeChantier } from './identifiers.mjs'
import { testFilesChangedSince } from './tdd.mjs'
import { readBypass } from './write-guard.mjs'

// ---------- Stop hook ----------

// Stop hook: the decision itself is decideStop (lib/core.mjs). A failure does not block the
// agent, but the user is told that the end-of-turn checks did not run.
export function hookGate() {
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
      ? testFilesChangedSince(projectRoot, config, chantier.spec.data.tests_commit, chantier)
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
