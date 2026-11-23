import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { after } from 'node:test'
import { fileURLToPath } from 'node:url'
import { DEFAULT_CONFIG, chantierIdFromText, decideWrite, parseFrontMatter, setFrontMatterValues } from '../lib/core.mjs'

const templatesDirectory = fileURLToPath(new URL('../templates/', import.meta.url))

function template(name) {
  return readFileSync(join(templatesDirectory, `${name}.md`), 'utf8')
    .replaceAll('{{ID}}', 'FEAT-12')
    .replaceAll('{{TITLE}}', 'Titre')
    .replaceAll('{{DATE}}', '2026-11-09')
}

const signedChantier = { id: 'FEAT-12', directory: '/p/docs/chantiers/FEAT-12-x', spec: { data: { status: 'signed', type: 'FEAT', tdd: 'yes' } }, files: ['spec.md'] }
const draftChantier = { ...signedChantier, spec: { data: { status: 'draft', type: 'FEAT', tdd: 'yes' } } }
const implementingChantier = { ...signedChantier, spec: { data: { status: 'signed', type: 'FEAT', tdd: 'yes', tests_commit: 'abc1234' } } }
const signedTec = { ...signedChantier, id: 'TEC-3', spec: { data: { status: 'signed', type: 'TEC', tdd: 'no' } } }

function decide(overrides) {
  return decideWrite({ relativePath: 'src/app.ts', toolName: 'Edit', config: DEFAULT_CONFIG, chantier: signedChantier, bypass: null, existingSpec: null, ...overrides })
}

const atelierBin = fileURLToPath(new URL('../bin/atelier', import.meta.url))
const gitIdentity = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false']

const temporaryDirectories = []
after(() => temporaryDirectories.forEach((directory) => rmSync(directory, { recursive: true, force: true })))

function temporaryDirectory(prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

function git(directory, ...gitArguments) {
  return execFileSync('git', [...gitIdentity, ...gitArguments], { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function commit(directory, subject) {
  git(directory, 'commit', '--allow-empty', '-q', '-m', subject)
}

// A repository with atelier installed and a first commit on `defaultBranch`.
function makeRepository(defaultBranch = 'main') {
  const directory = temporaryDirectory('atelier-tec6-')
  git(directory, 'init', '-q', '-b', defaultBranch)
  mkdirSync(join(directory, '.claude'))
  writeFileSync(join(directory, '.claude', 'atelier.json'), JSON.stringify({ chantiersDir: 'docs/chantiers' }))
  git(directory, 'add', '.')
  commit(directory, 'chore: init')
  return directory
}

function atelier(directory, ...cliArguments) {
  return execFileSync(process.execPath, [atelierBin, ...cliArguments], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// Bodies that satisfy the required sections, so that only relation problems remain.
const completeBodies = {
  TEC: '## 1. Quoi\nFaire X.\n\n## 2. Pourquoi\nParce que.\n\n## 3. Vérification\n- Lancer les tests.\n',
  EPIC: "## 1. Vision\nUn module de gestion client.\n\n## 2. Pourquoi\nLes clients sont gérés à la main.\n\n## 3. Critères d'acceptation globaux\n- CA-1 : un client se crée et se contacte.\n\n## 4. Cadre\nAPI REST commune.\n\n## 5. Hors périmètre\nFacturation.\n",
}

function specText({ id, type = id.split('-')[0], status = 'signed', tdd = 'no', relations = {}, body = completeBodies[type] ?? '' }) {
  const header = { id, type, title: `Essai ${id}`, status, tdd, ...relations }
  return `---\n${Object.entries(header).map(([key, value]) => `${key}: ${value}`).join('\n')}\n---\n\n# ${id}\n\n${body}`
}

function chantierDirectoryOf(directory, id) {
  return join(directory, 'docs', 'chantiers', `${id}-x`)
}

// Writes `docs/chantiers/<id>-x/spec.md` (and the extra `files`), returns the spec path.
function writeChantier(directory, { files = {}, ...spec }) {
  const chantierDirectory = chantierDirectoryOf(directory, spec.id)
  mkdirSync(chantierDirectory, { recursive: true })
  writeFileSync(join(chantierDirectory, 'spec.md'), specText(spec))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(chantierDirectory, name), content)
  }
  return join(chantierDirectory, 'spec.md')
}

// `main` holds the merged chantiers; each entry of `branches` is a branch created from main with
// its own chantiers committed; `checkout` is the branch left checked out.
function makeChantiersRepository({ main = [], branches = {}, checkout = 'main' }) {
  const directory = makeRepository('main')
  main.forEach((spec) => writeChantier(directory, spec))
  git(directory, 'add', '.')
  commit(directory, 'chore: chantiers')
  for (const [branch, specs] of Object.entries(branches)) {
    git(directory, 'switch', '-q', '-c', branch, 'main')
    specs.forEach((spec) => writeChantier(directory, spec))
    git(directory, 'add', '.')
    commit(directory, `docs(chantiers): [${chantierIdFromText(branch)}] spec`)
  }
  git(directory, 'switch', '-q', checkout)
  return directory
}

function atelierRun(directory, ...cliArguments) {
  const result = spawnSync(process.execPath, [atelierBin, ...cliArguments], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
  })
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

function specData(directory, id) {
  return parseFrontMatter(readFileSync(join(chantierDirectoryOf(directory, id), 'spec.md'), 'utf8')).data
}

// Asserts that one line of `output` matches every pattern.
function assertLine(output, patterns, label = patterns.join(' + ')) {
  const line = output.split(/\r?\n/).find((candidate) => patterns.every((pattern) => pattern.test(candidate)))
  assert.ok(line, `${label} : aucune ligne ne correspond dans\n${output}`)
}

const epicPlan = { 'plan.md': '# Plan : EPIC-5\n\n## Lots\n- FEAT-6, FEAT-7\n' }

// A plan whose « Tranches » section has first-level entries numbered `numbers` (sub-lists and
// comments around, and a numbered list in another section, which must be ignored).
function planOf(numbers) {
  const entries = numbers.map((number) => `${number}. Tranche ${number} — CA couverts : CA-${number}\n   1. sous-étape`).join('\n')
  return `# Plan : FEAT-20\n\n## Approche\nTexte.\n\n## Tranches\n<!-- 1. <tranche> — CA couverts : CA-1\n2. exemple -->\n${entries}\n\n## Risques et points d'attention\n1. pas une tranche\n2. toujours pas\n3. non\n4. non\n5. non\n`
}
const threeSlices = planOf([1, 2, 3])

// Pure chantier object, as readChantier returns it (plan text in `plan`).
function slicedChantier(data = {}, { plan = threeSlices, type = 'FEAT', tdd = 'yes' } = {}) {
  return {
    id: `${type}-20`,
    directory: `/p/docs/chantiers/${type}-20-x`,
    spec: { data: { status: 'signed', type, tdd, ...data }, body: '# x\n' },
    files: plan === null ? ['spec.md'] : ['spec.md', 'plan.md'],
    plan,
  }
}

// A repository on branch `<type>/<id>-x` with the signed chantier (and its plan) committed.
function makeSlicedRepository({ id = 'FEAT-20', tdd = 'yes', plan = threeSlices, header = {} } = {}) {
  const directory = makeRepository('main')
  git(directory, 'switch', '-q', '-c', `${id.split('-')[0].toLowerCase()}/${id}-x`)
  writeChantier(directory, { id, tdd, relations: header, files: plan === null ? {} : { 'plan.md': plan } })
  git(directory, 'add', '-A')
  commit(directory, `docs(chantiers): [${id}] spec`)
  return directory
}

// Writes (or deletes, when the content is null) files, then commits everything.
function commitFiles(directory, files, subject = 'chore: files') {
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(directory, relativePath)
    if (content === null) {
      rmSync(filePath)
    } else {
      mkdirSync(path.dirname(filePath), { recursive: true })
      writeFileSync(filePath, content)
    }
  }
  git(directory, 'add', '-A')
  commit(directory, subject)
}

function headOf(directory) {
  return git(directory, 'rev-parse', 'HEAD').trim()
}

function commitSpec(directory) {
  git(directory, 'add', '-A')
  commit(directory, 'docs(chantiers): spec')
}

// Sets spec header fields by hand (as the user would) and commits the spec.
function setHeader(directory, id, values) {
  const specPath = join(chantierDirectoryOf(directory, id), 'spec.md')
  writeFileSync(specPath, setFrontMatterValues(readFileSync(specPath, 'utf8'), values))
  commitSpec(directory)
}

function specFileText(directory, id) {
  return readFileSync(join(chantierDirectoryOf(directory, id), 'spec.md'), 'utf8')
}


function atelierOk(directory, ...cliArguments) {
  const result = atelierRun(directory, ...cliArguments)
  assert.equal(result.status, 0, result.output)
  return result.output
}

// Slice 1 done (a test and its code committed), the chantier now in slice 2 « tests d'abord »,
// slice_base at the end of slice 1.
function atSliceTwo(options = {}) {
  const directory = makeSlicedRepository(options)
  commitFiles(directory, { 'test/one.test.mjs': 'ligne a\nligne b\nligne c\n' }, 'test: one')
  commitFiles(directory, { 'src/one.mjs': 'export const one = 1\n' }, 'feat: one')
  const base = headOf(directory)
  setHeader(directory, 'FEAT-20', { slice: '2', slice_base: base })
  return { directory, base }
}

// Slice `slice` (a number or 'chantier') in implementation: tests frozen (TDD), code committed.
function implementedSlice({ slice, plan = threeSlices, tdd = 'yes', extra = {} }) {
  const directory = makeSlicedRepository({ plan, tdd })
  commitFiles(directory, { 'src/before.mjs': 'export const before = 1\n' }, 'feat: before')
  const base = headOf(directory)
  let testsCommit = ''
  if (tdd === 'yes') {
    commitFiles(directory, { 'test/now.test.mjs': 'test\n' }, 'test: now')
    testsCommit = git(directory, 'rev-parse', '--short', 'HEAD').trim()
  }
  commitFiles(directory, { 'src/now.mjs': 'export const now = 1\n' }, 'feat: now')
  setHeader(directory, 'FEAT-20', { slice: String(slice), slice_base: base, ...(testsCommit ? { tests_commit: testsCommit } : {}), ...extra })
  return { directory, base, testsCommit }
}

// A revue.md with the given sections: { title, blocking: [[point, file, treatment]], discuss: [...] }.
function revueOf(sections) {
  const table = (rows) => ['| Point | Fichier | Traitement |', '|---|---|---|', ...rows.map((cells) => `| ${cells.join(' | ')} |`)].join('\n')
  const body = sections.map(({ title, blocking = [], discuss = [] }) =>
    `## ${title}\n- Commit revu : abc1234\n\n### Bloquant\n${table(blocking)}\n\n### À discuter\n${table(discuss)}\n\n- Bilan de la revue : ok\n`)
  return `# Revue : TEC-30 Essai\n\n<!-- consigne -->\n\n${body.join('\n')}`
}

export {
  templatesDirectory, template,
  signedChantier, draftChantier, implementingChantier, signedTec, decide,
  atelierBin, gitIdentity, temporaryDirectories, temporaryDirectory, git, commit, makeRepository, atelier,
  completeBodies, specText, chantierDirectoryOf, writeChantier, makeChantiersRepository, atelierRun, specData, assertLine, epicPlan,
  planOf, threeSlices, slicedChantier, makeSlicedRepository, commitFiles, headOf, commitSpec, setHeader, specFileText, atelierOk, atSliceTwo, implementedSlice,
  revueOf,
}
