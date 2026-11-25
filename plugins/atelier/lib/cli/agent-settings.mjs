// Subagent settings command: agent-settings.

import { AGENT_DEFAULTS, resolveAgentSettings } from '../agent-settings.mjs'

// ---------- Model and effort of a subagent ----------

const OPTION_FLAGS = { '--user-model': 'userModel', '--user-effort': 'userEffort', '--args': 'args' }

function usage(message) {
  console.error(`${message}\nUsage : atelier agent-settings <${Object.keys(AGENT_DEFAULTS).join(' | ')}> [--user-model <modèle>] [--user-effort <effort>] [--args <arguments>]`)
  process.exit(1)
}

export function commandAgentSettings([agent, ...rest]) {
  if (!agent || agent.startsWith('--')) usage('Sous-agent manquant.')
  const values = {}
  for (let index = 0; index < rest.length; index += 2) {
    const key = OPTION_FLAGS[rest[index]]
    if (!key) usage(`Option inconnue : ${rest[index]}.`)
    if (Object.hasOwn(values, key)) usage(`Option répétée : ${rest[index]}.`)
    if (index + 1 >= rest.length) usage(`Valeur manquante pour ${rest[index]}.`)
    values[key] = rest[index + 1]
  }
  const result = resolveAgentSettings(agent, values)
  if (result.refusal) {
    console.error(`atelier : ${result.refusal}`)
    process.exit(2)
  }
  const { model, effort, sources, rest: remaining, warnings } = result
  console.log(JSON.stringify({ agent, model, effort, sources, rest: remaining, warnings }, null, 2))
}
