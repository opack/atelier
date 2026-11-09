// Core logic of atelier: project configuration, chantier state, spec checks.
// Pure functions where possible so they can be tested without git or a filesystem.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'

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
}

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
  return { ...DEFAULT_CONFIG, ...userConfig }
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
  if (type !== 'SPIKE' && type !== 'TEC' && chantier.spec.data.tests !== 'written') {
    return 'Écrire les tests d’abord : /atelier:tests'
  }
  return 'Construire tranche par tranche (un commit par tranche), puis clôturer : /atelier:close'
}

// ---------- Path rules for the guard hook ----------

function globToRegExp(pattern) {
  const escaped = pattern
    .split('**')
    .map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]'))
    .join('.*')
  return new RegExp(`^${escaped}$`)
}

export function matchesAny(relativePath, patterns) {
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

export function toProjectRelativePath(projectRoot, filePath) {
  return relative(projectRoot, filePath).split(sep).join('/')
}

// Decides whether the agent may write a file. Returns { allowed, reason }.
// `context` = { relativePath, toolName, config, chantier, bypass, existingSpec }.
export function decideWrite(context) {
  const { relativePath, toolName, config, chantier, bypass, existingSpec } = context
  if (relativePath.startsWith('..')) {
    return { allowed: true }
  }
  if (matchesAny(relativePath, config.sensitivePaths)) {
    return { allowed: false, reason: `atelier : « ${relativePath} » est un fichier sensible, jamais modifié par l’agent.` }
  }
  const isSpecFile = relativePath.startsWith(`${config.chantiersDir}/`) && relativePath.endsWith('/spec.md')
  if (isSpecFile && toolName === 'Write' && ['signed', 'done'].includes(existingSpec?.data?.status)) {
    return {
      allowed: false,
      reason: 'atelier : cette spec est signée, elle ne se réécrit pas. Modifie-la avec des éditions ciblées et ajoute une entrée datée dans la section « Amendements ».',
    }
  }
  if (matchesAny(relativePath, config.freePaths)) {
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
  const status = chantier.spec?.data?.status ?? 'draft'
  if (status !== 'signed') {
    return {
      allowed: false,
      reason: `atelier : la spec de ${chantier.id} n’est pas signée (statut : ${status}). Termine-la puis signe-la avec /atelier:sign avant de modifier le code.`,
    }
  }
  return { allowed: true }
}
