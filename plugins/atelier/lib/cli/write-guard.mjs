// Write guard hook (PreToolUse) and its bypass command.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { applyToolEdit, matchesAny, parseFrontMatter, toProjectRelativePath } from '../common.mjs'
import { decideWrite } from '../write-guard.mjs'
import {
  committedFileText,
  configPath,
  findProjectRoot,
  loadConfig,
  readStandardInput,
  requireConfig,
} from './common.mjs'
import { activeChantier } from './identifiers.mjs'

// ---------- Bypass and write guard hook ----------

function bypassPath(projectRoot) {
  return join(projectRoot, '.atelier', 'bypass.json')
}

export function readBypass(projectRoot, branch) {
  const path = bypassPath(projectRoot)
  if (!existsSync(path)) {
    return null
  }
  const bypass = JSON.parse(readFileSync(path, 'utf8'))
  return bypass.branch === branch ? bypass : null
}

export function commandBypass([mode, ...reasonWords]) {
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
export function hookGuard() {
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
