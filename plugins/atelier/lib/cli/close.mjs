// Closing commands: close-check and set-status.

import { closeProblems, isReviewExempt, setStatusRefusal } from '../close.mjs'
import { toProjectRelativePath } from '../common.mjs'
import { openChildren } from '../relations.mjs'
import { reviewCodeFiles } from '../review.mjs'
import { runChecksOnce } from './checks.mjs'
import { chantierFilePath, findProjectRoot, requireConfig, samePath, today, uncommittedFiles } from './common.mjs'
import { requireActiveChantier } from './identifiers.mjs'
import { chantierIndex, isEpic, needsIndex } from './relations.mjs'
import { reviewFacts } from './review.mjs'
import { updateSpec } from './spec.mjs'

// ---------- Close commands ----------

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
  const index = needsIndex(chantier) ? chantierIndex(projectRoot, config) : null
  return closeProblems({
    chantier,
    reviewFacts: reviewFacts(projectRoot, config, chantier, index),
    uncommittedCode,
    uncommittedError,
    revueUncommitted,
    checksFailure: runChecksOnce(projectRoot, config).failure,
    index,
  })
}

function formatCloseProblems(chantier, problems) {
  const after = isReviewExempt(chantier) ? 'Corrige, puis relance la clôture : /atelier:close' : 'Corrige, puis refais relire : /atelier:review'
  return `Clôture refusée :\n${problems.map((problem) => `- ${problem}`).join('\n')}\n${after}`
}

export function commandCloseCheck() {
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

export function commandSetStatus([status]) {
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
