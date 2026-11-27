// Command-line entry point of atelier, used by the skills (through `atelier <command>`)
// and by the hooks. Every user-facing message is in French, like the rest of the method.

import { commandAgentSettings } from './cli/agent-settings.mjs'
import { commandChecks } from './cli/checks.mjs'
import { commandCloseCheck, commandSetStatus } from './cli/close.mjs'
import { commandCheckProcess, commandTemplate } from './cli/docs.mjs'
import { commandNextId } from './cli/identifiers.mjs'
import { commandList } from './cli/list.mjs'
import { commandBase } from './cli/integration.mjs'
import { commandStatus, hookSessionStart } from './cli/next-step.mjs'
import { commandReviewIds } from './cli/review-points.mjs'
import { commandSetReviewed } from './cli/review.mjs'
import { commandCheckPlan } from './cli/slices.mjs'
import { commandCheckSpec, commandSign } from './cli/spec.mjs'
import { hookGate } from './cli/stop-hook.mjs'
import { commandFreezeTests, commandReopenTests, commandSetTdd, commandTestsChanged } from './cli/tdd.mjs'
import { commandBypass, hookGuard } from './cli/write-guard.mjs'

const commands = {
  'next-id': commandNextId,
  status: commandStatus,
  list: commandList,
  base: commandBase,
  'check-spec': commandCheckSpec,
  'check-plan': commandCheckPlan,
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
  'agent-settings': commandAgentSettings,
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
