// Write guard: which writes to the spec and the code the process allows at each phase.
// Pure functions: no access to the disk, git or the environment.

import { matchesAny, specStatus } from './common.mjs'
import { parseAmendments } from './spec.mjs'
import { testDrivenPhase } from './tdd.mjs'

// ---------- Write guard ----------

// Spec header fields written only by the atelier command (sign, set-status, freeze-tests,
// reopen-tests, set-reviewed, check-plan, set-tdd).
export const COMMAND_SPEC_FIELDS = ['status', 'signed_by', 'signed_at', 'done_at', 'tests_commit', 'reviewed_commit', 'slice', 'slice_base', 'last_slice', 'slice_tdd']

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
