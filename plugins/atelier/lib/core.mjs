// Core logic of atelier: project configuration, chantier state, spec checks.
// Pure functions where possible so they can be tested without git or a filesystem.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import nodePath, { basename, join } from 'node:path'

export const CHANTIER_TYPES = ['FEAT', 'FIX', 'REF', 'TEC', 'SPIKE', 'EPIC']

export const DEFAULT_CONFIG = {
  chantiersDir: 'docs/chantiers',
  decisionsDir: 'docs/decisions',
  checks: [],
  checkTimeoutSeconds: 300,
  // Paths editable without a signed chantier.
  freePaths: ['docs/**', '.claude/**', 'CLAUDE.md', 'README.md', '.gitignore'],
  // Paths never editable by the agent.
  sensitivePaths: ['.env', '.env.*', '*.pem', '*.key', '**/secrets/**'],
  // Paths considered as tests (test files, fixtures, snapshots).
  testPaths: ['*.test.*', '*.spec.*', '*.snap', '**/__tests__/**', '**/__snapshots__/**', 'test/**', 'tests/**', 'e2e/**'],
}

// Recommended answer to "should this chantier follow TDD?", per type. Only a suggestion:
// the human always decides, in the `tdd` field of the spec header. An EPIC implements nothing:
// it is always `tdd: no`, without asking.
export const TDD_RECOMMENDATION = { FEAT: 'yes', FIX: 'yes', REF: 'yes', TEC: 'no', SPIKE: 'no', EPIC: 'no' }

const ID_PATTERN = new RegExp(`\\b(${CHANTIER_TYPES.join('|')})-(\\d+)\\b`, 'i')
const BRACKETED_ID_PATTERN = new RegExp(`\\[(${CHANTIER_TYPES.join('|')})-(\\d+)\\]`, 'i')

// Sections required before signature, per chantier type.
// A section matches when its heading (without its number) starts with the given title.
export const REQUIRED_SECTIONS = {
  FEAT: ['Contexte', 'Description', "Critères d'acceptation", 'Non-fonctionnel'],
  FIX: ['Problème', 'Reproduction', 'Cause probable', 'Solution proposée', 'Critère de non-régression'],
  REF: ['Périmètre', 'Pourquoi maintenant', 'État actuel', 'Preuve de non-régression', 'Stratégie', 'Critère de fin'],
  TEC: ['Quoi', 'Pourquoi', 'Vérification'],
  SPIKE: ['Question', 'Pourquoi', 'Budget', 'Ce qui compte comme réponse'],
  EPIC: ['Vision', 'Pourquoi', "Critères d'acceptation globaux", 'Cadre', 'Hors périmètre'],
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
  return gitOutput(projectRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])
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
  const planPath = join(directory, 'plan.md')
  const plan = existsSync(planPath) ? readFileSync(planPath, 'utf8') : null
  return { id: chantierId, directory, spec, files: readdirSync(directory), plan }
}

// Subjects are ordered from newest to oldest; only a bracketed identifier counts.
export function chantierIdFromCommitSubjects(subjects) {
  for (const subject of subjects) {
    const match = subject.match(BRACKETED_ID_PATTERN)
    if (match) {
      return `${match[1].toUpperCase()}-${match[2]}`
    }
  }
  return null
}

function gitOutput(projectRoot, gitArguments) {
  try {
    return execFileSync('git', gitArguments, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

// refs/remotes/origin/HEAD is missing from cloud clones, hence the fallbacks.
const BASE_REF_CANDIDATES = ['refs/remotes/origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']

export function defaultBaseRef(projectRoot) {
  return BASE_REF_CANDIDATES.find(
    (ref) => gitOutput(projectRoot, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== null,
  ) ?? null
}

export function branchCommitSubjects(projectRoot, base) {
  const output = gitOutput(projectRoot, ['log', '-n', '200', '--format=%s', `${base}..HEAD`])
  return output ? output.split('\n') : []
}

// Short name of the default branch behind a base ref: origin/HEAD → origin/main → main.
// null when origin/HEAD cannot be resolved: the default branch is then unknown.
function defaultBranchName(projectRoot, base) {
  const resolved = base === 'refs/remotes/origin/HEAD'
    ? gitOutput(projectRoot, ['rev-parse', '--abbrev-ref', base])
    : base
  return resolved ? resolved.replace(/^origin\//, '') : null
}

function chantierIdFromBranchCommits(projectRoot, branch) {
  if (!branch || branch === 'HEAD') {
    return null
  }
  const base = defaultBaseRef(projectRoot)
  const defaultBranch = base && defaultBranchName(projectRoot, base)
  if (!defaultBranch || branch === defaultBranch) {
    return null
  }
  return chantierIdFromCommitSubjects(branchCommitSubjects(projectRoot, base))
}

// The branch name wins; otherwise, off the default branch, the branch's own commits tell.
export function activeChantier(projectRoot, config) {
  const branch = currentBranch(projectRoot)
  const branchId = chantierIdFromText(branch)
  if (branchId) {
    return { branch, chantier: readChantier(projectRoot, config, branchId), source: 'branch' }
  }
  const commitsId = chantierIdFromBranchCommits(projectRoot, branch)
  if (commitsId) {
    return { branch, chantier: readChantier(projectRoot, config, commitsId), source: 'commits' }
  }
  return { branch, chantier: null, source: null }
}

// ---------- Relations between chantiers ----------

// Relation fields of the spec header. The link is declared by the child only.
export const RELATION_FIELDS = { parent: 'rel_parent', dependsOn: 'rel_depends_on', origin: 'rel_origin', replaces: 'rel_replaces' }

// Any identifier, legacy prefixes included (BUG-421, FEA-26), as accepted by the shared counter.
const RELATION_ID_PATTERN = /^[A-Za-z]{2,6}-\d+$/

const CLOSED_STATUSES = ['done', 'abandoned']

function relationValues(value) {
  return String(value ?? '').split(',').map((part) => part.trim()).filter(Boolean)
}

// { parent, dependsOn, origin, replaces }: identifiers in upper case, without duplicates.
export function parseRelations(data) {
  return Object.fromEntries(Object.entries(RELATION_FIELDS).map(([name, field]) => [
    name,
    [...new Set(relationValues(data?.[field]).map((value) => value.toUpperCase()))],
  ]))
}

export function hasRelations(data) {
  return Object.values(RELATION_FIELDS).some((field) => relationValues(data?.[field]).length)
}

// Chantier identifier at the start of a chantier directory name (`FEAT-12-budget` → FEAT-12).
export function chantierIdFromDirectoryName(name) {
  const match = name.match(new RegExp(`^(${CHANTIER_TYPES.join('|')})-(\\d+)(?:-|$)`, 'i'))
  return match ? `${match[1].toUpperCase()}-${match[2]}` : null
}

// Short name of a ref: refs/heads/x → x, refs/remotes/origin/x → origin/x.
export function shortRefName(ref) {
  return ref.replace(/^refs\/(heads|remotes)\//, '')
}

// Objects printed by `git cat-file --batch`, in the order of the requests: { id, type, content
// (Buffer) } for each object found, null for a missing one.
export function parseCatFileBatch(output) {
  const objects = []
  let offset = 0
  while (offset < output.length) {
    const end = output.indexOf(0x0a, offset)
    if (end < 0) {
      break // truncated output
    }
    const header = output.subarray(offset, end).toString('utf8')
    if (/ (missing|ambiguous)$/.test(header)) {
      objects.push(null)
      offset = end + 1
      continue
    }
    const [id, type, size] = header.split(' ')
    objects.push({ id, type, content: output.subarray(end + 1, end + 1 + Number(size)) })
    offset = end + 1 + Number(size) + 1
  }
  return objects
}

// Entries of a raw tree object (`<mode> <name>\0<binary id>`), as { mode, name, id } with a hex id.
// `idLength` is the length in bytes of an object id (20 for SHA-1, 32 for SHA-256).
export function parseTreeEntries(content, idLength = 20) {
  const entries = []
  let offset = 0
  while (offset < content.length) {
    const space = content.indexOf(0x20, offset)
    const nul = content.indexOf(0x00, space)
    entries.push({
      mode: content.subarray(offset, space).toString('utf8'),
      name: content.subarray(space + 1, nul).toString('utf8'),
      id: content.subarray(nul + 1, nul + 1 + idLength).toString('hex'),
    })
    offset = nul + 1 + idLength
  }
  return entries
}

// Chantier directories of a raw chantiers tree: [{ id, tree }], `tree` being the directory's id.
export function chantierTreesOf(content, idLength = 20) {
  return parseTreeEntries(content, idLength)
    .filter((entry) => entry.mode === '40000')
    .map((entry) => ({ id: chantierIdFromDirectoryName(entry.name), tree: entry.id }))
    .filter((entry) => entry.id)
}

// Index of the known chantiers, by identifier: { id, here (header in the current tree, or null),
// branches ([{ branch, data }] in the other branches) }. `here` is [{ id, data }].
export function buildChantierIndex(here, branchHeaders) {
  const index = new Map()
  const entry = (id) => {
    if (!index.has(id)) {
      index.set(id, { id, here: null, branches: [] })
    }
    return index.get(id)
  }
  here.forEach(({ id, data }) => { entry(id).here = data })
  branchHeaders.forEach(({ branch, id, data }) => entry(id).branches.push({ branch, data }))
  return index
}

// Status in the current tree; null for a chantier found only on other branches (not merged).
export function statusHere(entry) {
  return entry?.here ? entry.here.status || 'draft' : null
}

// Closed means closed in the current tree: a chantier closed only on its branch is still open.
export function isClosedHere(entry) {
  return CLOSED_STATUSES.includes(statusHere(entry))
}

function versions(entry) {
  return [...(entry.here ? [entry.here] : []), ...entry.branches.map((branch) => branch.data)]
}

function typeOf(entry) {
  return versions(entry).map((data) => (data.type ?? '').toUpperCase()).find(Boolean) ?? ''
}

// Ids an entry is linked to through `relation`: union of all its known versions.
function linksOf(entry, relation) {
  return new Set(versions(entry).flatMap((data) => parseRelations(data)[relation]))
}

// Direct children of a chantier: those whose header, in any version, names it as parent.
export function childrenOf(index, id) {
  return [...index.values()].filter((entry) => entry.id !== id && linksOf(entry, 'parent').has(id))
}

// A related chantier as shown to the user: { id, status (in the current tree, null when absent
// from it), closed, branches (where it lives when it is not in the current tree) }.
export function describeRelation(index, id) {
  const entry = index.get(id)
  return {
    id,
    status: statusHere(entry),
    closed: isClosedHere(entry),
    branches: entry && !entry.here ? entry.branches.map((branch) => branch.branch) : [],
  }
}

// A cycle through `id` following `relation`, as a list of ids starting and ending with `id`, or
// null. `ownLinks` replaces the links of `id` found in the index.
function findCycle(index, id, ownLinks, relation) {
  const next = (current) => (current === id ? ownLinks : index.has(current) ? [...linksOf(index.get(current), relation)] : [])
  const visited = new Set()
  const walk = (current, path) => {
    for (const target of next(current)) {
      if (target === id) {
        return [...path, id]
      }
      if (!visited.has(target)) {
        visited.add(target)
        const cycle = walk(target, [...path, target])
        if (cycle) {
          return cycle
        }
      }
    }
    return null
  }
  return walk(id, [id])
}

// Relation problems of a spec header, which block the signature. `index` comes from
// buildChantierIndex. Only `rel_parent` and `rel_depends_on` must name a known chantier:
// `rel_origin` and `rel_replaces` are traces, checked on their format only.
export function relationProblems(data, index) {
  const problems = []
  const id = (data.id ?? '').toUpperCase()
  for (const field of Object.values(RELATION_FIELDS)) {
    for (const value of relationValues(data[field])) {
      if (!RELATION_ID_PATTERN.test(value)) {
        problems.push(`${field} : « ${value} » est mal formé (attendu : un identifiant comme FEAT-12).`)
      } else if (value.toUpperCase() === id) {
        problems.push(`${field} : ${id} ne peut pas se citer lui-même.`)
      }
    }
  }
  const relations = parseRelations(data)
  const valid = (ids) => ids.filter((value) => RELATION_ID_PATTERN.test(value) && value !== id)
  if (relations.parent.length > 1) {
    problems.push(`rel_parent : un seul parent possible (${relations.parent.join(', ')}).`)
  }
  for (const [field, ids] of [['rel_parent', valid(relations.parent)], ['rel_depends_on', valid(relations.dependsOn)]]) {
    for (const target of ids.filter((value) => !index.has(value))) {
      problems.push(`${field} : ${target} est introuvable dans les branches du projet (faute de frappe ?).`)
    }
  }
  for (const parent of valid(relations.parent).filter((value) => index.has(value))) {
    const entry = index.get(parent)
    if (typeOf(entry) !== 'EPIC') {
      problems.push(`rel_parent : ${parent} n’est pas un EPIC (type : ${typeOf(entry) || '?'}) ; seul un EPIC peut être parent.`)
    } else if (isClosedHere(entry)) {
      problems.push(`rel_parent : l’EPIC ${parent} est clos (statut : ${statusHere(entry)}) ; on ne rattache pas un chantier à un EPIC clos.`)
    }
  }
  for (const [field, relation] of [['rel_parent', 'parent'], ['rel_depends_on', 'dependsOn']]) {
    const cycle = id ? findCycle(index, id, valid(relations[relation]), relation) : null
    if (cycle) {
      problems.push(`${field} : cycle ${cycle.join(' → ')}.`)
    }
  }
  return problems
}

// Children of an EPIC that are not closed in the current tree, as described by describeRelation.
export function openChildren(index, id) {
  return childrenOf(index, id).map((entry) => describeRelation(index, entry.id)).filter((child) => !child.closed)
}

function openChildProblem(child) {
  return child.status
    ? `Enfant ${child.id} encore ouvert ici (statut : ${child.status}) : une fois livré, fusionne la branche par défaut dans celle-ci.`
    : `Enfant ${child.id} pas fusionné dans cette branche (vit sur ${child.branches.join(', ')}) : fusionne la branche par défaut dans celle-ci une fois ${child.id} livré, ou supprime sa branche s’il est abandonné.`
}

// Why the relations prevent closing (`done`) a chantier, as a list. `id` is the chantier's
// identifier (from its branch and directory), `data` its spec header, `index` comes from
// buildChantierIndex. Statuses are judged in the current tree only.
export function relationCloseProblems(id, data, index) {
  const problems = []
  for (const dependency of parseRelations(data).dependsOn.map((target) => describeRelation(index, target))) {
    const { status, branches } = dependency
    const dependencyId = dependency.id
    if (status === 'done') {
      continue
    }
    if (status === 'abandoned') {
      problems.push(`Dépendance ${dependencyId} abandonnée (statut : abandoned) : retire la relation (/atelier:amend) ou dépends du chantier qui la remplace.`)
    } else if (status) {
      problems.push(`Dépendance ${dependencyId} pas livrée (statut : ${status}) : attends sa clôture, puis fusionne la branche par défaut dans celle-ci.`)
    } else if (branches.length) {
      problems.push(`Dépendance ${dependencyId} pas fusionnée dans cette branche (présente seulement sur ${branches.join(', ')}) : fusionne la branche par défaut dans celle-ci une fois ${dependencyId} livrée.`)
    } else {
      problems.push(`Dépendance ${dependencyId} introuvable dans les branches du projet.`)
    }
  }
  if ((data.type ?? '').toUpperCase() === 'EPIC') {
    const open = openChildren(index, id)
    problems.push(...open.map(openChildProblem))
    const children = childrenOf(index, id)
    if (!open.length && !children.some((entry) => statusHere(entry) === 'done')) {
      problems.push(children.length
        ? `Aucun enfant de ${id} n’est done : la vision n’a pas été réalisée. Abandonne l’EPIC (atelier set-status abandoned).`
        : `Aucun enfant rattaché à ${id} (rel_parent: ${id}) : rien n’a été réalisé. Ouvre les chantiers du plan, ou abandonne l’EPIC (atelier set-status abandoned).`)
    }
  }
  return problems
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
  if (type === 'EPIC' && data.tdd === 'yes') {
    problems.push('En-tête : un EPIC n’implémente rien, il est toujours en « tdd: no ».')
  }
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

// ---------- Process section of CLAUDE.md ----------

// Lines of the process section template missing from that section of the project's CLAUDE.md
// (null when the file does not exist), compared trimmed: all of them when the section is absent.
// The section runs from its heading (the template's first line) to the next heading of the same
// level or above. Lines added by the project are not a problem. The template names the default
// chantiers directory: the project's `chantiersDir` (without trailing `/`) is expected instead.
export function checkProcessProblems(templateText, claudeText, chantiersDir = DEFAULT_CONFIG.chantiersDir) {
  const expected = templateText
    .replaceAll(`${DEFAULT_CONFIG.chantiersDir}/`, `${chantiersDir.replace(/[\\/]+$/, '')}/`)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const lines = (claudeText ?? '').split(/\r?\n/).map((line) => line.trim())
  const start = lines.indexOf(expected[0])
  if (start < 0) {
    return expected
  }
  const end = lines.findIndex((line, index) => index > start && /^#{1,2}\s/.test(line))
  const present = new Set(lines.slice(start, end < 0 ? lines.length : end))
  return expected.filter((line) => !present.has(line))
}

// ---------- Amendments ----------

const AMENDMENTS_HEADING = /^## Amendements[ \t]*$/
const SECTION_END = /^#{1,2}\s/
const ENTRY_START = /^- \d{4}-\d{2}-\d{2} : /

// Line ranges [start, end) of every `## Amendements` section, heading included, in LF lines.
function amendmentSectionRanges(lines) {
  const ranges = []
  for (let start = 0; start < lines.length; start += 1) {
    if (!AMENDMENTS_HEADING.test(lines[start])) {
      continue
    }
    let end = start + 1
    while (end < lines.length && !SECTION_END.test(lines[end])) {
      end += 1
    }
    ranges.push([start, end])
  }
  return ranges
}

// Reads the `## Amendements` section of a spec (or of its body).
// Returns { sectionCount, entries, rest }: `entries` are the dated first-level list items with
// their indented continuation lines (HTML comments of the section ignored); `rest` is the text
// outside the entries — the rest of the file, plus any other text of the section, which counts
// as spec body. With several sections, only `sectionCount` is meaningful.
export function parseAmendments(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const ranges = amendmentSectionRanges(lines)
  if (ranges.length !== 1) {
    return { sectionCount: ranges.length, entries: [], rest: lines.join('\n') }
  }
  const [start, end] = ranges[0]
  const sectionText = lines.slice(start + 1, end).join('\n').replace(/<!--[\s\S]*?-->/g, '')
  const entries = []
  const otherLines = []
  let current = null
  for (const line of sectionText.split('\n').map((candidate) => candidate.trimEnd())) {
    if (ENTRY_START.test(line)) {
      current = [line]
      entries.push(current)
    } else if (!line) {
      continue
    } else if (current && /^\s/.test(line)) {
      current.push(line)
    } else {
      current = null
      otherLines.push(line)
    }
  }
  const rest = [...lines.slice(0, start + 1), ...otherLines, ...lines.slice(end)].join('\n')
  return { sectionCount: 1, entries: entries.map((entryLines) => entryLines.join('\n')), rest }
}

// Adds `- <entry>` at the end of the `## Amendements` section, wherever it is, or creates the
// section at the end of the file. Keeps the file's line endings.
export function appendAmendmentEntry(text, entry) {
  const lineEnding = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const [range] = amendmentSectionRanges(lines)
  let result
  if (!range) {
    result = `${lines.join('\n').replace(/\s*$/, '')}\n\n## Amendements\n- ${entry}\n`
  } else {
    // After the last non-blank line of the section, so that blank lines before the next heading stay.
    let last = range[1] - 1
    while (last > range[0] && !lines[last].trim()) {
      last -= 1
    }
    result = [...lines.slice(0, last + 1), `- ${entry}`, ...lines.slice(last + 1)].join('\n')
  }
  return result.replace(/\n/g, lineEnding)
}

// Fixed labels of the entries written by the atelier command.
export function reopenTestsEntry(date, commit, reason) {
  return `${date} : tests rouverts (gel quitté : ${commit}) : ${reason}`
}

export function refreezeTestsEntry(date, commit) {
  return `${date} : tests regelés : ${commit}`
}

// Whether freezing the tests now is a refreeze: the last "tests rouverts" entry comes after the
// last "tests regelés" entry (or there is none). Position decides, not dates. The pre-0.2.0
// format (`tests rouverts : <raison>`) starts the same way.
export function isRefreeze(entries) {
  const lastIndexOf = (label) => entries.findLastIndex((entry) => entry.replace(ENTRY_START, '').startsWith(label))
  const lastReopen = lastIndexOf('tests rouverts')
  return lastReopen >= 0 && lastReopen > lastIndexOf('tests regelés')
}

// Why `atelier reopen-tests` is refused for this chantier, or null.
export function reopenTestsRefusal(chantier) {
  const data = chantier?.spec?.data ?? {}
  if (specStatus(chantier?.spec) !== 'signed') {
    return `La spec de ${chantier?.id ?? 'ce chantier'} n’est pas signée (statut : ${specStatus(chantier?.spec)}) : ses tests ne se rouvrent pas.`
  }
  if (data.tdd !== 'yes') {
    return `${chantier?.id ?? 'Ce chantier'} ne suit pas le TDD (tdd: ${data.tdd || '?'}) : il n’a pas de tests figés à rouvrir. Ajoute ou modifie les tests avec le code (/atelier:build).`
  }
  if (!data.tests_commit) {
    // « Tests d'abord » of a slice N > 1: the tests of the previous slices are frozen.
    const { slice } = sliceState(chantier)
    if (typeof slice !== 'number' || slice < 2 || !data.slice_base) {
      return `Les tests de ${chantier.id} ne sont pas figés : ils s’écrivent encore, rien à rouvrir (/atelier:write-tests).`
    }
    if (isRefreeze(parseAmendments(chantier.spec.body ?? '').entries)) {
      return `tests déjà rouverts pour ${chantier.id} : modifie-les, commite-les puis fige-les (atelier freeze-tests).`
    }
  }
  return null
}

// Test files with removed lines in a `git diff` output (old path: a deleted or renamed file
// counts as removed). Only lines inside hunks count; headers are read before the first hunk.
export function removedTestLines(diff) {
  const files = new Set()
  let file = null
  let inHunk = false
  for (const line of diff.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('diff --git ')) {
      file = null
      inHunk = false
    } else if (!inHunk && line.startsWith('--- ')) {
      file = line === '--- /dev/null' ? null : line.slice(4).replace(/\t$/, '').replace(/^a\//, '')
    } else if (line.startsWith('@@')) {
      inHunk = true
    } else if (inHunk && line.startsWith('-') && file) {
      files.add(file)
    }
  }
  return [...files]
}

// Why `atelier freeze-tests` is refused, or null. `sliceBaseIsAncestor` is false when the
// `slice_base` of the spec is no longer an ancestor of HEAD; `removedTestFiles` are the test
// files with lines removed since `slice_base` (see removedTestLines).
export function freezeTestsRefusal({ chantier, sliceBaseIsAncestor, removedTestFiles }) {
  if (sliceBaseIsAncestor === false) {
    return `le début de la tranche (slice_base : ${chantier.spec.data.slice_base}) n’est plus un ancêtre de HEAD (rebase, historique réécrit). Seul l’utilisateur peut corriger slice_base dans l’en-tête de la spec.`
  }
  if (removedTestFiles.length && !isRefreeze(parseAmendments(chantier.spec.body ?? '').entries)) {
    return `des tests des tranches précédentes ont été modifiés ou supprimés :\n${removedTestFiles.map((file) => `- ${file}`).join('\n')}\nOn ne fait qu’ajouter des tests. Si l’un d’eux doit vraiment changer : /atelier:amend si la spec change, puis /atelier:write-tests <raison>.`
  }
  return null
}

// Spec header values written by `atelier freeze-tests` at `commit`: the first freeze of a
// chantier of the slice cycle also writes `slice: 1`.
export function freezeTestsValues(chantier, commit) {
  const { model } = sliceState(chantier)
  const firstOfCycle = ['single', 'sliced'].includes(model) && !String(chantier.spec.data.slice ?? '').trim()
  return { tests_commit: commit, ...(firstOfCycle ? { slice: '1' } : {}) }
}

// ---------- Review ----------

// Files that count as code for the review: everything outside the free paths, the chantier
// documents and the atelier state. `.claude/**` is not free here, so that checks and hooks
// cannot be weakened after the review, whatever the free path patterns. Tests count as code.
export function reviewCodeFiles(files, config) {
  const ignoredPaths = [...config.freePaths, `${config.chantiersDir}/**`, '.atelier/**']
  return files.filter((file) => matchesAny(file, ['.claude/**'], config.ignoreCase) || !matchesAny(file, ignoredPaths, config.ignoreCase))
}

// Why the review recorded in the spec no longer covers the chantier, as a list (empty when it is
// current). `facts` = { reviewedCommit, gitError, found, isAncestor, codeFilesSince,
// amendmentsChanged }, read from git by the command.
export function reviewProblems(facts) {
  const { reviewedCommit, gitError, found, isAncestor, codeFilesSince = [], amendmentsChanged } = facts
  if (!reviewedCommit) {
    return ['Aucune revue enregistrée (reviewed_commit absent).']
  }
  const commit = reviewedCommit.slice(0, 7)
  if (gitError) {
    return [`Revue obsolète : impossible d’évaluer le commit revu ${commit} (${gitError}).`]
  }
  if (!found) {
    return [`Revue obsolète : le commit revu ${commit} est introuvable (rebase ?).`]
  }
  if (!isAncestor) {
    return [`Revue obsolète : le commit revu ${commit} n’est plus un ancêtre de HEAD (rebase ?).`]
  }
  const problems = []
  if (codeFilesSince.length) {
    problems.push(`Revue obsolète : du code a été commité depuis le commit revu ${commit} (${codeFilesSince.join(', ')}).`)
  }
  if (amendmentsChanged) {
    problems.push(`Revue obsolète : la spec a été amendée depuis le commit revu ${commit}.`)
  }
  return problems
}

// 'none' (no review recorded), 'current' or 'stale'.
export function reviewState(facts) {
  if (!facts.reviewedCommit) {
    return 'none'
  }
  return reviewProblems(facts).length ? 'stale' : 'current'
}

// Whether the amendment entries differ between two versions of the spec text.
export function amendmentsDiffer(text, otherText) {
  const entries = (candidate) => parseAmendments(parseFrontMatter(candidate).body)
  const [one, other] = [entries(text), entries(otherText)]
  return one.sectionCount !== other.sectionCount || one.entries.join('\0') !== other.entries.join('\0')
}

// Why `atelier set-reviewed` is refused, or null. `context` = { chantier, uncommittedCode (code
// files changed and not committed), specUncommitted, changedTests (frozen tests changed since
// tests_commit) }.
// `sliceBaseIsAncestor` is false when `slice_base` is no longer an ancestor of HEAD;
// `sliceCodeFiles` are the code files committed since the start of the current slice, or null
// when the review is not that of a slice of a chantier with several slices.
export function setReviewedRefusal({ chantier, uncommittedCode, specUncommitted, changedTests, sliceBaseIsAncestor = null, sliceCodeFiles = null }) {
  if (specStatus(chantier?.spec) !== 'signed') {
    return `la spec de ${chantier?.id ?? 'ce chantier'} n’est pas signée.`
  }
  if (uncommittedCode.length) {
    return `du code n’est pas commité (${uncommittedCode.join(', ')}). La revue porte sur un commit : commite d’abord.`
  }
  if (specUncommitted) {
    return 'la spec a des changements non commités. Commite-la d’abord.'
  }
  const phase = testDrivenPhase(chantier)
  if (phase === 'writing-tests') {
    return 'les tests ne sont pas figés (/atelier:write-tests).'
  }
  if (phase === 'implementing' && changedTests.length) {
    return `des tests ont changé depuis leur gel (${changedTests.join(', ')}).`
  }
  if (sliceBaseIsAncestor === false) {
    return `le début de la tranche (slice_base : ${chantier.spec.data.slice_base}) n’est plus un ancêtre de HEAD (rebase, historique réécrit). Seul l’utilisateur peut corriger slice_base dans l’en-tête de la spec.`
  }
  if (sliceCodeFiles && !sliceCodeFiles.length) {
    return 'tranche vide : aucun code commité depuis le début de la tranche. Implémente-la (/atelier:build) avant de la faire valider.'
  }
  return null
}

// What `atelier set-reviewed` writes at `head` (full hash), and what it says. A validated slice
// review moves to the next slice, or to the review of the whole chantier after the last one;
// the review of the whole chantier, or of a chantier with a single slice, records
// `reviewed_commit`.
export function setReviewedUpdate(chantier, head) {
  const { model, slice, sliceCount } = sliceState(chantier)
  const commitHint = (label) => `Commite la spec et revue.md : docs(chantiers): [${chantier.id}] review ${label}`
  if (model === 'sliced' && slice !== 'chantier') {
    if (slice < sliceCount) {
      const next = chantier.spec.data.tdd === 'yes' ? 'écrire ses tests : /atelier:write-tests' : 'l’implémenter : /atelier:build'
      return {
        values: { slice: String(slice + 1), slice_base: head, tests_commit: '' },
        message: `Tranche ${slice} validée. Tranche ${slice + 1}/${sliceCount} : ${next}. ${commitHint(slice)}`,
      }
    }
    return {
      values: { slice: 'chantier', last_slice: String(slice), slice_base: head },
      message: `Tranche ${slice} validée, c’était la dernière. Revue du chantier : faire relire l’ensemble : /atelier:review. ${commitHint(slice)}`,
    }
  }
  const firstOfCycle = model === 'single' && !String(chantier.spec.data.slice ?? '').trim()
  return {
    values: { reviewed_commit: head, ...(firstOfCycle ? { slice: '1' } : {}) },
    message: `Revue enregistrée au commit ${head}. ${commitHint(slice === 'chantier' ? 'chantier' : '').trimEnd()}`,
  }
}

// ---------- Close ----------

// An EPIC (no code) and a SPIKE without TDD (throwaway code, never merged) are closed without a
// review. A SPIKE in TDD follows the whole process, review included.
export function isReviewExempt(chantier) {
  const type = (chantier?.spec?.data?.type ?? '').toUpperCase()
  return type === 'EPIC' || sliceState(chantier).model === 'none'
}

// « Tranche N/M », or « Tranche N (absente du plan) » once the plan no longer counts it.
function sliceLabel(slice, sliceCount) {
  return slice > sliceCount ? `Tranche ${slice} (absente du plan)` : `Tranche ${slice}/${sliceCount}`
}

// Close problems of the slice cycle: a slice still in progress, a slice added to the plan after
// the last slice review, or the review of the whole chantier not recorded yet.
function sliceCloseProblems(chantier) {
  const { model, slice, sliceCount } = sliceState(chantier)
  if (model !== 'sliced') {
    return []
  }
  if (slice !== 'chantier') {
    return [`${sliceLabel(slice, sliceCount)} en cours : la mener à terme et la faire valider (/atelier:review), jusqu’à la revue du chantier.`]
  }
  const problems = []
  const lastSlice = Number(chantier.spec.data.last_slice) || 0
  if (sliceCount > lastSlice) {
    problems.push(`Tranche ${sliceCount} du plan non revue (dernière tranche revue : ${lastSlice}) : elle a été ajoutée au plan après la dernière revue de tranche.`)
  }
  if (!chantier.spec.data.reviewed_commit) {
    problems.push('Revue du chantier non enregistrée : faire relire l’ensemble (/atelier:review).')
  }
  return problems
}

// Why the chantier cannot be closed, as a list (empty when it can). `context` = { chantier,
// reviewFacts (see reviewProblems), uncommittedCode (code files changed and not committed),
// checksFailure (first failing check as { check }, or null), index (see buildChantierIndex, or
// null when the chantier has no relation and is not an EPIC) }. A SPIKE (throwaway code, never
// merged) and an EPIC (no code) skip everything related to the review.
// `uncommittedError` is the git error met while listing uncommitted files, if any.
export function closeProblems({ chantier, reviewFacts, uncommittedCode, uncommittedError, checksFailure, index = null }) {
  if (specStatus(chantier?.spec) !== 'signed') {
    return [`La spec de ${chantier?.id ?? 'ce chantier'} n’est pas signée (statut : ${specStatus(chantier?.spec)}).`]
  }
  const sliceProblems = sliceCloseProblems(chantier)
  const problems = isReviewExempt(chantier) || sliceProblems.length ? sliceProblems : reviewProblems(reviewFacts)
  if (index) {
    problems.push(...relationCloseProblems(chantier.id, chantier.spec.data, index))
  }
  if (uncommittedError) {
    problems.push(`Impossible de lister les fichiers non commités (${uncommittedError}).`)
  } else if (uncommittedCode.length) {
    problems.push(`Du code n’est pas commité (${uncommittedCode.join(', ')}).`)
  }
  if (testDrivenPhase(chantier) === 'writing-tests') {
    problems.push('Les tests ne sont pas figés (/atelier:write-tests).')
  }
  if (checksFailure) {
    problems.push(`Le contrôle « ${checksFailure.check.name} » échoue (${checksFailure.check.command}).`)
  }
  return problems
}

// ---------- Next step ----------

// `review` is the state of the review ('none', 'current' or 'stale'), computed by the command.
// `children` are the direct children of an EPIC, as { id, closed } (see describeRelation).
export function nextStep(chantier, review = 'none', children = []) {
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
  const needsPlan = ['FEAT', 'REF', 'EPIC'].includes(type)
  if (needsPlan && !chantier.files.includes('plan.md')) {
    return type === 'EPIC' ? 'Concevoir le découpage en chantiers : /atelier:plan' : 'Concevoir : /atelier:plan'
  }
  if (type === 'EPIC') {
    const open = children.filter((child) => !child.closed)
    if (!children.length) {
      return `Ouvrir les chantiers prévus au plan, rattachés par « rel_parent: ${chantier.id} » : /atelier:new`
    }
    if (open.length) {
      return `${open.length} enfant(s) encore ouvert(s) : ${open.map((child) => child.id).join(', ')}. Les mener à terme (et ouvrir les lots restants du plan : /atelier:new), puis clôturer l’EPIC.`
    }
    if (!children.some((child) => child.status === 'done')) {
      return 'Tous les enfants sont clos, aucun n’est done : la vision n’a pas été réalisée. Abandonner l’EPIC : atelier set-status abandoned'
    }
    return 'Tous les enfants sont clos : clôturer l’EPIC (bilan prévu / réalisé) : /atelier:close'
  }
  const { model, slice, sliceCount } = sliceState(chantier)
  if (model === 'sliced' && slice !== 'chantier') {
    return `${sliceLabel(slice, sliceCount)} : ${phaseStep(chantier)}`
  }
  if (model === 'sliced' && review === 'none' && testDrivenPhase(chantier) !== 'writing-tests') {
    return 'Revue du chantier : faire relire l’ensemble : /atelier:review'
  }
  return phaseStep(chantier, review)
}

// Next step of the current phase (tests, build, review, close), for a slice or the chantier.
function phaseStep(chantier, review = 'none') {
  const phase = testDrivenPhase(chantier)
  if (phase === 'writing-tests') {
    return 'Tests d’abord : écrire les tests, vérifier qu’ils échouent, les commiter (aucune implémentation) : /atelier:write-tests'
  }
  const build = phase === 'implementing'
    ? 'Implémenter jusqu’à ce que tous les tests passent, sans modifier les tests, puis commiter : /atelier:build'
    : 'Implémenter (sans TDD pour ce chantier), puis commiter : /atelier:build'
  if (isReviewExempt(chantier)) {
    return `${build} ; ensuite clôturer : /atelier:close`
  }
  if (review === 'current') {
    return 'Revue à jour : clôturer (bilan, verdict) : /atelier:close'
  }
  if (review === 'stale') {
    return 'Le code ou la spec a changé depuis la revue : refaire relire : /atelier:review'
  }
  return `${build} ; ensuite faire relire : /atelier:review`
}

// ---------- Slices ----------

// Number of slices of a plan: the highest number among the first-level numbered entries of its
// « Tranches » section (HTML comments and indented sub-lists ignored); 0 without such entries.
export function planSliceCount(planText) {
  const lines = (planText ?? '').replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n')
  const start = lines.findIndex((line) => /^##\s+Tranches\s*$/.test(line))
  if (start < 0) {
    return 0
  }
  let count = 0
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) {
      break
    }
    const match = /^(\d+)\.\s/.exec(line)
    if (match) {
      count = Math.max(count, Number(match[1]))
    }
  }
  return count
}

// Where the chantier stands in its slices. `model`:
// 'none'   : SPIKE without TDD, outside the slice cycle;
// 'legacy' : signed before slices existed (no `slice`, but a freeze, a review or a reopening);
// 'single' : a single slice (no plan, or a plan with at most one slice): today's cycle;
// 'sliced' : several slices; `slice` is the current one (a number, or 'chantier' for the
//            review of the whole chantier) and `sliceCount` the number of slices of the plan.
// `slice` and `sliceCount` are null unless the model is 'sliced'.
export function sliceState(chantier) {
  const data = chantier?.spec?.data ?? {}
  const flat = (model) => ({ model, slice: null, sliceCount: null })
  if ((data.type ?? '').toUpperCase() === 'SPIKE' && data.tdd !== 'yes') {
    return flat('none')
  }
  const written = String(data.slice ?? '').trim()
  if (!written) {
    const reopenedOrRefrozen = parseAmendments(chantier?.spec?.body ?? '').entries
      .some((entry) => /^(tests rouverts|tests regelés)/.test(entry.replace(ENTRY_START, '')))
    if (data.tests_commit || data.reviewed_commit || reopenedOrRefrozen) {
      return flat('legacy')
    }
  }
  const slice = written === 'chantier' ? 'chantier' : Number(written || 1)
  const sliceCount = planSliceCount(chantier?.plan)
  if (sliceCount <= 1 && slice === 1) {
    return flat('single')
  }
  return { model: 'sliced', slice, sliceCount }
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

// Paths listed by `git status --porcelain -z`: NUL-separated and never quoted, so non-ASCII
// names come out as they are. A rename or copy is followed by its original path, skipped.
export function parsePorcelainPaths(output) {
  const entries = output.split('\0')
  const paths = []
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    if (entry.length < 4) {
      continue
    }
    paths.push(entry.slice(3))
    if (/[RC]/.test(entry.slice(0, 2))) {
      index += 1
    }
  }
  return paths
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

// Spec header fields written only by the atelier command (sign, set-status, freeze-tests,
// reopen-tests, set-reviewed).
export const COMMAND_SPEC_FIELDS = ['status', 'signed_by', 'signed_at', 'done_at', 'tests_commit', 'reviewed_commit', 'slice', 'slice_base', 'last_slice']

// Fields that cannot change through the edit tool once the spec is no longer a draft, besides
// the command fields: `tdd` changes through `atelier set-tdd`; `id` and `type` are bound to the
// branch, the directory and the next step.
const FROZEN_AFTER_SIGNATURE_FIELDS = ['tdd', 'id', 'type']

const specStatus = (spec) => spec?.data?.status || 'draft'

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

// Why `atelier set-tdd <value>` is refused for this chantier, or null.
export function setTddRefusal(chantier, value) {
  if (value === 'yes' && (chantier?.spec?.data?.type ?? '').toUpperCase() === 'EPIC') {
    return `${chantier.id} est un EPIC : il n’implémente rien, il reste en « tdd: no ».`
  }
  return null
}

// Why `atelier set-status <status>` is refused for this chantier, or null.
export function setStatusRefusal(chantier, status) {
  const current = specStatus(chantier?.spec)
  if (status === 'draft' && current !== 'draft') {
    return `la spec de ${chantier.id} est « ${current} » ; elle ne repasse pas en brouillon. Pour la modifier : /atelier:amend. Signée par erreur : abandonne ce chantier (atelier set-status abandoned) et ouvre-en un nouveau.`
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
  // Blocking again on an unchanged working tree means the agent is stuck: let it stop, and tell
  // the user once.
  const block = (message) => {
    if (tree !== null && state.lastBlock === tree) {
      if (state.reportedStuck === tree) {
        return { block: false, state }
      }
      return { block: false, message: `atelier : l’agent s’est arrêté sans parvenir à régler ce problème.\n\n${message}`, state: { ...state, reportedStuck: tree } }
    }
    return { block: true, message, state: { ...state, lastBlock: tree, lastMessage: message } }
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
  if (tree !== null && state.lastBlock === tree) {
    // Already known to fail on this exact tree: no need to run the checks again.
    return block(state.lastMessage)
  }
  const failure = runChecks()
  if (!failure) {
    return pass({ ...state, lastGreen: tree })
  }
  return block(`atelier : le contrôle « ${failure.check.name} » échoue (${failure.check.command}). Continue à corriger l’implémentation jusqu’à ce que tout passe, sans modifier les tests.\n\n${failure.output}`)
}
