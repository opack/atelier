// Model and effort of the atelier subagents: resolved from the command argument,
// then the user's plugin option, then the default. Pure logic, no I/O.

export const MODELS = ['sonnet', 'opus', 'haiku', 'fable']
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']

export const AGENT_DEFAULTS = {
  implementer: { model: 'sonnet', effort: 'medium' },
  'overfit-checker': { model: 'opus', effort: 'medium' },
  reviewer: { model: 'opus', effort: 'high' },
  'spec-critic': { model: 'opus', effort: 'high' },
}

// Agents whose command takes other arguments (the slice of a SPIKE for build).
const AGENTS_WITH_REST = new Set(['implementer'])

const SOURCE = { argument: 'argument', user: 'utilisateur', default: 'recommandé' }

// An option left unset reaches the skill as the literal placeholder, empty, or
// "recommandé (…)" (follows the recommended value, whatever is in the parentheses).
function isUnset(value) {
  if (value === undefined || value === null) return true
  const text = String(value).trim()
  return text === '' || /^\$\{user_config\.[^}]*\}$/.test(text) || /^recommandé\s*\(.*\)$/i.test(text)
}

function optionName(agent, kind) {
  return `${agent.replaceAll('-', '_')}_${kind}`
}

function userValue(agent, kind, value, allowed, warnings) {
  if (isUnset(value)) return null
  const normalized = String(value).trim().toLowerCase()
  if (allowed.includes(normalized)) return normalized
  warnings.push(`Option ${optionName(agent, kind)} : valeur « ${String(value).trim()} » inconnue, ignorée (valeurs possibles : ${allowed.join(', ')}).`)
  return null
}

function parseArgument(args) {
  const found = { model: [], effort: [] }
  const rest = []
  for (const word of String(args ?? '').split(/\s+/).filter(Boolean)) {
    const lower = word.toLowerCase()
    if (MODELS.includes(lower)) found.model.push(lower)
    else if (EFFORTS.includes(lower)) found.effort.push(lower)
    else rest.push(word)
  }
  return { found, rest: rest.join(' ') }
}

function argumentRefusal(kind, values) {
  const distinct = [...new Set(values)]
  if (distinct.length < 2) return null
  const label = kind === 'model' ? 'modèles' : 'efforts'
  return `Argument : plusieurs ${label} différents (${distinct.join(', ')}). Indique-en un seul.`
}

export function resolveAgentSettings(agent, { userModel, userEffort, args } = {}) {
  const defaults = Object.hasOwn(AGENT_DEFAULTS, agent) ? AGENT_DEFAULTS[agent] : null
  if (!defaults) {
    return { model: null, effort: null, sources: { model: null, effort: null }, rest: '', warnings: [], refusal: `Sous-agent inconnu : ${agent} (connus : ${Object.keys(AGENT_DEFAULTS).join(', ')}).` }
  }
  const warnings = []
  const { found, rest } = parseArgument(args)
  const refusal = argumentRefusal('model', found.model) ?? argumentRefusal('effort', found.effort)
  if (refusal) {
    return { model: null, effort: null, sources: { model: null, effort: null }, rest, warnings, refusal }
  }
  const user = {
    model: userValue(agent, 'model', userModel, MODELS, warnings),
    effort: userValue(agent, 'effort', userEffort, EFFORTS, warnings),
  }
  const result = { sources: {} }
  for (const kind of ['model', 'effort']) {
    if (found[kind].length) {
      result[kind] = found[kind][0]
      result.sources[kind] = SOURCE.argument
    } else if (user[kind]) {
      result[kind] = user[kind]
      result.sources[kind] = SOURCE.user
    } else {
      result[kind] = defaults[kind]
      result.sources[kind] = SOURCE.default
    }
  }
  if (rest && !AGENTS_WITH_REST.has(agent)) {
    warnings.push(`Argument « ${rest} » ignoré : seuls un modèle (${MODELS.join(', ')}) et un effort (${EFFORTS.join(', ')}) sont attendus.`)
  }
  return { model: result.model, effort: result.effort, sources: result.sources, rest, warnings, refusal: null }
}
