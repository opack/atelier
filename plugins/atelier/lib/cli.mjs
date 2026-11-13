// Command-line entry point of atelier, used by the skills (through `atelier <command>`)
// and by the hooks. Every user-facing message is in French, like the rest of the method.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  activeChantier,
  checkSpec,
  collectUsedIdentifiers,
  decideWrite,
  findProjectRoot,
  loadConfig,
  nextChantierId,
  matchesAny,
  nextStep,
  testDrivenPhase,
  parseFrontMatter,
  setFrontMatterValues,
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
  const { branch, chantier } = activeChantier(projectRoot, config)
  const bypass = readBypass(projectRoot, branch)
  const summary = {
    installed: true,
    branch,
    chantier: chantier
      ? {
          id: chantier.id,
          directory: chantier.directory ? toProjectRelativePath(projectRoot, chantier.directory) : null,
          title: chantier.spec?.data.title ?? null,
          type: chantier.spec?.data.type ?? null,
          status: chantier.spec?.data.status ?? null,
          testDrivenPhase: chantier.spec ? testDrivenPhase(chantier) : null,
          testsCommit: chantier.spec?.data.tests_commit || null,
          files: chantier.files,
          specProblems: chantier.spec ? checkSpec(readFileSync(join(chantier.directory, 'spec.md'), 'utf8')) : [],
        }
      : null,
    bypass,
    nextStep: nextStep(chantier),
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
    lines.push(`Chantier : ${id}${title ? ` — ${title}` : ''} (${type ?? '?'}, ${status ?? 'pas de spec'})`)
    lines.push(`Documents : ${files.length ? files.join(', ') : 'aucun'}`)
    const phaseLabels = {
      'writing-tests': 'tests d’abord — aucune implémentation tant que les tests ne sont pas commités',
      implementing: 'implémentation — tests figés, ne pas les modifier',
    }
    if (status === 'signed' && phaseLabels[summary.chantier.testDrivenPhase]) {
      lines.push(`Phase TDD : ${phaseLabels[summary.chantier.testDrivenPhase]}`)
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
  const allowedStatuses = ['draft', 'signed', 'done', 'abandoned']
  if (!allowedStatuses.includes(status)) {
    console.error(`Statut attendu : ${allowedStatuses.join(', ')}`)
    process.exit(1)
  }
  const projectRoot = findProjectRoot()
  const values = status === 'done' ? { status, done_at: today() } : { status }
  const { specPath } = updateSpec(projectRoot, requireConfig(projectRoot), values)
  console.log(toProjectRelativePath(projectRoot, specPath))
}

function git(projectRoot, gitArguments) {
  return gitRaw(projectRoot, gitArguments).trim()
}

// Untrimmed output: `git status --porcelain` lines start with a significant space.
function gitRaw(projectRoot, gitArguments) {
  return execFileSync('git', gitArguments, { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function porcelainPaths(output) {
  return output
    .split('\n')
    .filter((line) => line.length > 3)
    .map((line) => line.slice(3).replace(/^.* -> /, '').trim())
}

// Test files changed in the working tree (uncommitted, including untracked).
function uncommittedTestFiles(projectRoot, config) {
  return porcelainPaths(gitRaw(projectRoot, ['status', '--porcelain', '--untracked-files=all']))
    .filter((file) => matchesAny(file, config.testPaths))
}

// Test files changed since the tests were frozen (committed or not).
function testFilesChangedSince(projectRoot, config, commit) {
  const committed = git(projectRoot, ['diff', '--name-only', commit, '--'])
    .split('\n')
    .filter((file) => file && matchesAny(file, config.testPaths))
  return [...new Set([...committed, ...uncommittedTestFiles(projectRoot, config)])]
}

function appendAmendment(specPath, text) {
  const content = readFileSync(specPath, 'utf8').replace(/\s*$/, '')
  writeFileSync(specPath, `${content}\n- ${today()} : ${text}\n`)
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
  const lastCommitFiles = git(projectRoot, ['show', '--name-only', '--format=', 'HEAD']).split('\n')
  if (!lastCommitFiles.some((file) => file && matchesAny(file, config.testPaths))) {
    console.error('Le dernier commit ne contient aucun fichier de test. Commite les tests (et seulement les tests) avant de les figer.')
    process.exit(2)
  }
  updateSpec(projectRoot, config, { tests_commit: commit })
  console.log(`Tests figés au commit ${commit}. Phase suivante : implémentation, sans modifier les tests (/atelier:build).`)
}

function commandReopenTests(reasonWords) {
  const reason = reasonWords.join(' ').trim()
  if (!reason) {
    console.error('Usage : atelier reopen-tests <raison>')
    process.exit(1)
  }
  const projectRoot = findProjectRoot()
  const { specPath } = updateSpec(projectRoot, requireConfig(projectRoot), { tests_commit: '' })
  appendAmendment(specPath, `tests rouverts : ${reason}`)
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
    appendAmendment(specPath, `TDD ${value === 'yes' ? 'activé' : 'désactivé'}${reason ? ` : ${reason}` : ''}`)
  }
  console.log(value === 'yes'
    ? 'Chantier en TDD : tests écrits, commités et figés avant l’implémentation.'
    : 'Chantier sans TDD : pas de phase tests d’abord imposée.')
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

function hookGuard() {
  const input = readStandardInput()
  const projectRoot = input.cwd ? findProjectRoot(input.cwd) : findProjectRoot()
  const config = loadConfig(projectRoot)
  const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path
  if (!config || !filePath) {
    return
  }
  const relativePath = toProjectRelativePath(projectRoot, filePath)
  const { branch, chantier } = activeChantier(projectRoot, config)
  const existingSpec = existsSync(filePath) && filePath.endsWith('spec.md')
    ? parseFrontMatter(readFileSync(filePath, 'utf8'))
    : null
  const decision = decideWrite({
    relativePath,
    toolName: input.tool_name,
    config,
    chantier,
    bypass: readBypass(projectRoot, branch),
    existingSpec,
  })
  if (!decision.allowed) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: decision.reason,
      },
    }))
  }
}

// Runs the checks when the agent wants to stop, but only if code changed outside the docs.
// Stop hook. While implementing, the frozen tests must be untouched and every check green:
// the agent keeps iterating until then (TDD step 4). While writing tests, failing tests are
// the expected outcome, so the checks are not run.
function hookGate() {
  const input = readStandardInput()
  const projectRoot = input.cwd ? findProjectRoot(input.cwd) : findProjectRoot()
  const config = loadConfig(projectRoot)
  if (!config) {
    return
  }
  const { chantier } = activeChantier(projectRoot, config)
  const phase = chantier?.spec?.data?.status === 'signed' ? testDrivenPhase(chantier) : 'none'
  if (phase === 'writing-tests') {
    return
  }
  if (phase === 'implementing') {
    const testsCommit = chantier.spec.data.tests_commit
    const changedTests = testFilesChangedSince(projectRoot, config, testsCommit)
    if (changedTests.length) {
      console.error(`atelier : des tests figés ont été modifiés (${changedTests.join(', ')}). Restaure-les (git checkout ${testsCommit} -- <fichier>) et corrige l’implémentation. Si un test est réellement faux, arrête-toi et signale-le à l’utilisateur au lieu de le modifier.`)
      process.exit(2)
    }
  }
  if (config.checks.length === 0) {
    return
  }
  let changedFiles = []
  try {
    changedFiles = porcelainPaths(gitRaw(projectRoot, ['status', '--porcelain', '--untracked-files=all']))
  } catch {
    return
  }
  const codeChanged = changedFiles.some((file) => !file.startsWith(`${config.chantiersDir}/`) && !file.startsWith('.atelier/'))
  if (!codeChanged) {
    return
  }
  const failure = runChecks(projectRoot, config)
  if (failure) {
    console.error(`atelier : le contrôle « ${failure.check.name} » échoue (${failure.check.command}). Continue à corriger l’implémentation jusqu’à ce que tout passe, sans modifier les tests.\n\n${failure.output}`)
    process.exit(2)
  }
}

function hookSessionStart() {
  const projectRoot = findProjectRoot()
  const config = loadConfig(projectRoot)
  if (!config) {
    return
  }
  const { branch, chantier } = activeChantier(projectRoot, config)
  const summary = {
    branch,
    chantier: chantier ? { id: chantier.id, title: chantier.spec?.data.title, type: chantier.spec?.data.type, status: chantier.spec?.data.status, files: chantier.files } : null,
    bypass: readBypass(projectRoot, branch),
    nextStep: nextStep(chantier),
  }
  const statusText = summary.chantier
    ? formatStatus({ ...summary, chantier: { ...summary.chantier, specProblems: [] } })
    : formatStatus(summary)
  console.log(`Projet géré avec atelier (process IA : chantiers, spec signée avant le code, tests d'abord, bilan).\n${statusText}`)
}
