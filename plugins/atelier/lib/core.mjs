// Core logic of atelier: project configuration, chantier state, spec checks.
// Pure functions where possible so they can be tested without git or a filesystem.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import nodePath, { basename, join } from 'node:path'

export const CHANTIER_TYPES = ['FEAT', 'FIX', 'REF', 'TEC', 'SPIKE']

export const DEFAULT_CONFIG = {
  chantiersDir: 'docs/chantiers',
  decisionsDir: 'docs/decisions',
  checks: [],
  checkTimeoutSeconds: 300,
  // Paths editable without a signed chantier.
  freePaths: ['docs/**', '.claude/**', '.atelier/**', 'CLAUDE.md', 'README.md', '.gitignore'],
  // Paths never editable by the agent.
  sensitivePaths: ['.env', '.env.*', '*.pem', '*.key', '**/secrets/**'],
  // Paths considered as tests (test files, fixtures, snapshots).
  testPaths: ['*.test.*', '*.spec.*', '*.snap', '**/__tests__/**', '**/__snapshots__/**', 'test/**', 'tests/**', 'e2e/**'],
}

// Recommended answer to "should this chantier follow TDD?", per type. Only a suggestion:
// the human always decides, in the `tdd` field of the spec header.
export const TDD_RECOMMENDATION = { FEAT: 'yes', FIX: 'yes', REF: 'yes', TEC: 'no', SPIKE: 'no' }

const ID_PATTERN = new RegExp(`\\b(${CHANTIER_TYPES.join('|')})-(\\d+)\\b`, 'i')

// Sections required before signature, per chantier type.
// A section matches when its heading (without its number) starts with the given title.
export const REQUIRED_SECTIONS = {
  FEAT: ['Contexte', 'Description', "Critères d'acceptation", 'Non-fonctionnel'],
  FIX: ['Problème', 'Reproduction', 'Cause probable', 'Solution proposée', 'Critère de non-régression'],
  REF: ['Périmètre', 'Pourquoi maintenant', 'État actuel', 'Preuve de non-régression', 'Stratégie', 'Critère de fin'],
  TEC: ['Quoi', 'Pourquoi', 'Vérification'],
  SPIKE: ['Question', 'Pourquoi', 'Budget', 'Ce qui compte comme réponse'],
}

// Sections that must contain at least one numbered acceptance criterion (CA-1, CA-2...).
const CRITERIA_SECTIONS = {
  FEAT: "Critères d'acceptation",
  FIX: 'Critère de non-régression',
}

// ---------- Project and configuration ----------

export function findProjectRoot(startDirectory = process.cwd()) {
  if (process.env.CLAUDE_PROJECT_DIR) {
    return process.env.CLAUDE_PROJECT_DIR
  }
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: startDirectory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return startDirectory
  }
}

export function configPath(projectRoot) {
  return join(projectRoot, '.claude', 'atelier.json')
}

// Returns null when atelier is not installed in the project: every hook then stays silent.
export function loadConfig(projectRoot) {
  const path = configPath(projectRoot)
  if (!existsSync(path)) {
    return null
  }
  const userConfig = JSON.parse(readFileSync(path, 'utf8'))
  // Paths are compared without case where the file system usually ignores it.
  const ignoreCase = ['win32', 'darwin'].includes(process.platform)
  return { ...DEFAULT_CONFIG, ignoreCase, ...userConfig }
}

// ---------- Front matter ----------

export function parseFrontMatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) {
    return { data: {}, body: text }
  }
  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const keyValue = line.match(/^([A-Za-z_][\w-]*):\s*(.*?)\s*(#.*)?$/)
    if (keyValue) {
      data[keyValue[1]] = keyValue[2].replace(/^["']|["']$/g, '')
    }
  }
  return { data, body: text.slice(match[0].length) }
}

// Updates (or adds) keys in an existing front matter block, keeping everything else intact.
export function setFrontMatterValues(text, values) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) {
    const lines = Object.entries(values).map(([key, value]) => `${key}: ${value}`)
    return `---\n${lines.join('\n')}\n---\n\n${text}`
  }
  let lines = match[1].split(/\r?\n/)
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}:`))
    if (index >= 0) {
      lines[index] = `${key}: ${value}`
    } else {
      lines = [...lines, `${key}: ${value}`]
    }
  }
  return `---\n${lines.join('\n')}\n---${text.slice(match[0].length)}`
}

// ---------- Chantier identification ----------

export function chantierIdFromText(text) {
  const match = text?.match(ID_PATTERN)
  return match ? `${match[1].toUpperCase()}-${match[2]}` : null
}

export function currentBranch(projectRoot) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

export function findChantierDirectory(projectRoot, config, chantierId) {
  const chantiersRoot = join(projectRoot, config.chantiersDir)
  if (!existsSync(chantiersRoot)) {
    return null
  }
  const match = readdirSync(chantiersRoot).find(
    (name) => name === chantierId || name.startsWith(`${chantierId}-`),
  )
  return match ? join(chantiersRoot, match) : null
}

export function readChantier(projectRoot, config, chantierId) {
  const directory = findChantierDirectory(projectRoot, config, chantierId)
  if (!directory) {
    return { id: chantierId, directory: null, spec: null, files: [] }
  }
  const specPath = join(directory, 'spec.md')
  const spec = existsSync(specPath) ? parseFrontMatter(readFileSync(specPath, 'utf8')) : null
  return { id: chantierId, directory, spec, files: readdirSync(directory) }
}

export function activeChantier(projectRoot, config) {
  const branch = currentBranch(projectRoot)
  const chantierId = chantierIdFromText(branch)
  if (!chantierId) {
    return { branch, chantier: null }
  }
  return { branch, chantier: readChantier(projectRoot, config, chantierId) }
}

// ---------- Next identifier ----------

// The counter is shared by all types: the next number follows the highest one ever used,
// whatever its prefix (including legacy prefixes such as FEA or BUG found in commit messages).
export function highestChantierNumber(names) {
  let highest = 0
  for (const name of names) {
    for (const match of name.matchAll(/\b[A-Z]{2,6}-(\d+)\b/g)) {
      highest = Math.max(highest, Number(match[1]))
    }
  }
  return highest
}

export function collectUsedIdentifiers(projectRoot, config) {
  const names = []
  const chantiersRoot = join(projectRoot, config.chantiersDir)
  if (existsSync(chantiersRoot)) {
    names.push(...readdirSync(chantiersRoot))
  }
  const gitSources = [
    ['log', '--all', '--format=%s', '-n', '5000'],
    ['branch', '--all', '--format=%(refname:short)'],
  ]
  for (const gitArguments of gitSources) {
    try {
      const output = execFileSync('git', gitArguments, {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      names.push(...output.split('\n').map((line) => line.toUpperCase()))
    } catch {
      // No git history yet: directory names are enough.
    }
  }
  return names
}

export function nextChantierId(type, usedNames) {
  const normalizedType = type.toUpperCase()
  if (!CHANTIER_TYPES.includes(normalizedType)) {
    throw new Error(`Type inconnu : ${type}. Types possibles : ${CHANTIER_TYPES.join(', ')}`)
  }
  return `${normalizedType}-${highestChantierNumber(usedNames) + 1}`
}

// ---------- Spec completeness ----------

function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function splitSections(body) {
  const sections = []
  let current = null
  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(?:\d+\.\s*)?(.+?)\s*$/)
    if (heading && !line.startsWith('###')) {
      current = { title: heading[1], lines: [] }
      sections.push(current)
    } else if (current) {
      current.lines.push(line)
    }
  }
  return sections
}

// Content that only consists of template guidance or empty list markers counts as empty.
export function meaningfulContent(lines) {
  return lines
    .join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*]|\d+\.)\s*(?:\[[ xX]\])?\s*/, '').trim())
    .filter((line) => line.length > 0 && !/^[A-Za-zÀ-ÿ' /]+ :$/.test(line))
    .join('\n')
}

export function checkSpec(text) {
  const problems = []
  const { data, body } = parseFrontMatter(text)
  for (const key of ['id', 'type', 'title']) {
    if (!data[key]) {
      problems.push(`En-tête : « ${key} » manquant.`)
    }
  }
  if (!['yes', 'no'].includes(data.tdd)) {
    problems.push('En-tête : « tdd » doit valoir yes ou no. C’est une décision humaine : ce chantier suit-il le TDD (tests écrits, commités et figés avant l’implémentation) ?')
  }
  const type = (data.type ?? '').toUpperCase()
  const required = REQUIRED_SECTIONS[type]
  if (!required) {
    problems.push(`En-tête : type « ${data.type ?? ''} » inconnu (attendu : ${CHANTIER_TYPES.join(', ')}).`)
    return problems
  }
  const sections = splitSections(body)
  for (const title of required) {
    const section = sections.find((candidate) => normalize(candidate.title).startsWith(normalize(title)))
    if (!section) {
      problems.push(`Section « ${title} » absente.`)
      continue
    }
    const content = meaningfulContent(section.lines)
    if (!content) {
      problems.push(`Section « ${title} » vide.`)
      continue
    }
    if (content.includes('…')) {
      problems.push(`Section « ${title} » : texte à compléter (« … »).`)
    }
    if (CRITERIA_SECTIONS[type] === title && !/\bCA-\d+\b/.test(content)) {
      problems.push(`Section « ${title} » : aucun critère numéroté (CA-1, CA-2…).`)
    }
  }
  return problems
}

// ---------- Next step ----------

export function nextStep(chantier) {
  if (!chantier) {
    return 'Aucun chantier actif sur cette branche. Ouvrir un chantier : /atelier:new'
  }
  if (!chantier.directory || !chantier.spec) {
    return `Pas de spec pour ${chantier.id}. Ouvrir le chantier : /atelier:new`
  }
  const status = chantier.spec.data.status ?? 'draft'
  const type = (chantier.spec.data.type ?? '').toUpperCase()
  if (status === 'done') {
    return 'Chantier clôturé. Ouvrir la PR si ce n’est pas fait.'
  }
  if (status === 'abandoned') {
    return 'Chantier abandonné.'
  }
  if (status !== 'signed') {
    return 'Compléter la spec puis la signer : /atelier:sign'
  }
  const needsPlan = ['FEAT', 'REF'].includes(type)
  if (needsPlan && !chantier.files.includes('plan.md')) {
    return 'Concevoir : /atelier:plan'
  }
  const phase = testDrivenPhase(chantier)
  if (phase === 'writing-tests') {
    return 'Tests d’abord : écrire les tests, vérifier qu’ils échouent, les commiter (aucune implémentation) : /atelier:tests'
  }
  if (phase === 'implementing') {
    return 'Implémenter jusqu’à ce que tous les tests passent, sans modifier les tests, puis commiter : /atelier:build ; ensuite clôturer : /atelier:close'
  }
  return 'Implémenter (sans TDD pour ce chantier), puis commiter : /atelier:build ; ensuite clôturer : /atelier:close'
}

// ---------- Test-driven phases ----------

// 'none'          : the chantier does not follow TDD (`tdd: no`, decided by the human).
// 'writing-tests' : TDD, tests are being written; implementation code is forbidden.
// 'implementing'  : TDD, tests are committed and frozen; only implementation code may change.
export function testDrivenPhase(chantier) {
  const data = chantier?.spec?.data ?? {}
  if (data.tdd !== 'yes') {
    return 'none'
  }
  return data.tests_commit ? 'implementing' : 'writing-tests'
}

// ---------- Path rules for the guard hook ----------

function globToRegExp(pattern) {
  const escaped = pattern
    .split('**')
    .map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]'))
    .join('.*')
  return new RegExp(`^${escaped}$`)
}

export function matchesAny(relativePath, patterns, ignoreCase = false) {
  if (ignoreCase) {
    return matchesAny(relativePath.toLowerCase(), patterns.map((pattern) => pattern.toLowerCase()))
  }
  const name = basename(relativePath)
  return patterns.some((pattern) => {
    const prefix = pattern.slice(0, -3)
    if (pattern.endsWith('/**') && !prefix.includes('*')) {
      return relativePath === prefix || relativePath.startsWith(`${prefix}/`)
    }
    if (pattern.startsWith('**/') && matchesAny(relativePath, [pattern.slice(3)])) {
      return true
    }
    const regExp = globToRegExp(pattern)
    return pattern.includes('/') ? regExp.test(relativePath) : regExp.test(name)
  })
}

// Path of a file relative to the project, with forward slashes, or null when the file is
// outside the project (including another drive on Windows).
export function toProjectRelativePath(projectRoot, filePath, pathApi = nodePath) {
  const relativePath = pathApi.relative(projectRoot, filePath)
  if (relativePath === '..' || relativePath.startsWith(`..${pathApi.sep}`) || pathApi.isAbsolute(relativePath)) {
    return null
  }
  return relativePath.split(pathApi.sep).join('/')
}

// Text of a file after an Edit, MultiEdit or Write, with normalized line endings, or null when
// it cannot be known (the edit does not apply, so the tool itself will fail).
export function applyToolEdit(currentText, toolName, toolInput) {
  const unixLines = (text) => String(text ?? '').replace(/\r\n/g, '\n')
  if (toolName === 'Write') {
    return unixLines(toolInput.content)
  }
  const edits = { Edit: [toolInput], MultiEdit: toolInput.edits }[toolName]
  if (!edits || currentText === null) {
    return null
  }
  let text = unixLines(currentText)
  for (const edit of edits) {
    const oldText = unixLines(edit.old_string)
    const newText = unixLines(edit.new_string)
    if (!oldText || !text.includes(oldText)) {
      return null
    }
    text = edit.replace_all ? text.replaceAll(oldText, () => newText) : text.replace(oldText, () => newText)
  }
  return text
}

// Spec header fields written only by the atelier command (sign, set-status, freeze-tests, reopen-tests).
export const COMMAND_SPEC_FIELDS = ['status', 'signed_by', 'signed_at', 'done_at', 'tests_commit']

// Why a write to a spec file is refused, or null. `existingSpec` and `proposedSpec` are the
// parsed spec before and after the write (null when absent or unknown).
function specWriteRefusal(toolName, existingSpec, proposedSpec) {
  const before = existingSpec?.data ?? {}
  const status = before.status || 'draft'
  if (toolName === 'Write' && ['signed', 'done'].includes(status)) {
    return 'atelier : cette spec est signée, elle ne se réécrit pas. Modifie-la avec des éditions ciblées et ajoute une entrée datée dans la section « Amendements ».'
  }
  if (!proposedSpec) {
    return null
  }
  const after = proposedSpec.data
  const valueOf = (data, field) => (field === 'status' ? data.status || 'draft' : data[field] ?? '')
  const changedFields = COMMAND_SPEC_FIELDS.filter((field) => valueOf(before, field) !== valueOf(after, field))
  if (changedFields.length) {
    return `atelier : ${changedFields.map((field) => `« ${field} »`).join(', ')} ne se modifie(nt) que par la commande atelier (la signature passe par /atelier:sign, sur accord explicite de l’utilisateur).`
  }
  if (status !== 'draft' && (before.tdd ?? '') !== (after.tdd ?? '')) {
    return `atelier : la spec n’est plus en brouillon (statut : ${status}) ; « tdd » ne change plus que par « atelier set-tdd <yes|no> <raison> », tracé en amendement.`
  }
  return null
}

// Decides whether the agent may write a file. Returns { allowed, reason }. The rules apply in order.
// `context` = { relativePath (null outside the project), toolName, config, chantier, bypass,
// fileExists, existingSpec, proposedSpec } where the specs are the parsed spec file before and
// after the write (see specWriteRefusal).
export function decideWrite(context) {
  const { relativePath, toolName, config, chantier, bypass, fileExists, existingSpec, proposedSpec } = context
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
    const refusal = specWriteRefusal(toolName, existingSpec, proposedSpec)
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
  const isTestFile = matches(config.testPaths)
  const phase = testDrivenPhase(chantier)
  if (phase === 'writing-tests' && !isTestFile) {
    return {
      allowed: false,
      reason: `atelier : ${chantier.id} est en phase « tests d’abord » (TDD). N’écris aucune implémentation, même factice : seulement des fichiers de test. Lance les tests, vérifie qu’ils échouent, fais-les relire et commiter (/atelier:tests). Si ce fichier est un test, demande à l’utilisateur d’ajouter son motif à « testPaths » dans .claude/atelier.json.`,
    }
  }
  if (phase === 'implementing' && isTestFile) {
    return {
      allowed: false,
      reason: `atelier : les tests de ${chantier.id} sont commités et figés. Ne les modifie pas : modifie l’implémentation jusqu’à ce qu’ils passent. Si un test est réellement faux, arrête-toi et signale-le ; le rouvrir se fait avec /atelier:tests, raison à l’appui.`,
    }
  }
  return { allowed: true }
}

// ---------- Stop hook ----------

// Decides what happens when the agent wants to stop. Returns { block, message, state }: when
// `block` is true the agent keeps working on `message`; otherwise `message`, if any, is for the user.
// `state` ({ lastGreen, lastBlock, reportedUnsigned }) is persisted between calls.
// `context` = { config, chantier, bypass, changedFiles (uncommitted), changedTests (frozen tests
// modified since tests_commit), tree (identifies the working tree content, null when unknown),
// state, runChecks (returns the first failing check as { check, output }, or null) }.
export function decideStop(context) {
  const { config, chantier, bypass, changedFiles, changedTests, tree, runChecks } = context
  const state = { ...context.state }
  const signed = chantier?.spec?.data?.status === 'signed'
  const phase = signed ? testDrivenPhase(chantier) : 'none'
  if (phase === 'writing-tests') {
    return { block: false, state }
  }
  // Blocking again on an unchanged working tree means the agent is stuck: let it stop.
  const block = (message) => {
    if (tree !== null && state.lastBlock === tree) {
      return { block: false, message: `atelier : l’agent s’est arrêté sans parvenir à régler ce problème.\n\n${message}`, state }
    }
    return { block: true, message, state: { ...state, lastBlock: tree } }
  }
  const pass = (newState = state) => ({ block: false, state: { ...newState, lastBlock: null } })
  if (phase === 'implementing' && changedTests.length) {
    return block(`atelier : des tests figés ont été modifiés (${changedTests.join(', ')}). Restaure-les (git checkout ${chantier.spec.data.tests_commit} -- <fichier>) et corrige l’implémentation. Si un test est réellement faux, arrête-toi et signale-le à l’utilisateur au lieu de le modifier.`)
  }
  const ignoredPaths = [...config.freePaths, `${config.chantiersDir}/**`, '.atelier/**']
  const codeFiles = changedFiles.filter((file) => !matchesAny(file, ignoredPaths, config.ignoreCase))
  if (codeFiles.length === 0) {
    return pass()
  }
  if (!signed && !bypass && tree !== null && state.reportedUnsigned !== tree) {
    return {
      block: true,
      message: `atelier : du code a changé sans chantier signé (${codeFiles.join(', ')}). Si c’est toi, par une commande shell par exemple, signale-le à l’utilisateur : ce code n’aurait pas dû être écrit avant la signature de la spec. Sinon, ignore ce message.`,
      state: { ...state, reportedUnsigned: tree },
    }
  }
  if (config.checks.length === 0 || (tree !== null && state.lastGreen === tree)) {
    return pass()
  }
  const failure = runChecks()
  if (!failure) {
    return pass({ ...state, lastGreen: tree })
  }
  return block(`atelier : le contrôle « ${failure.check.name} » échoue (${failure.check.command}). Continue à corriger l’implémentation jusqu’à ce que tout passe, sans modifier les tests.\n\n${failure.output}`)
}
