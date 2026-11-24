// Core logic of atelier: project configuration, chantier state, spec checks.
// Pure functions where possible so they can be tested without git or a filesystem.

import { matchesAny, normalize, specStatus } from './common.mjs'
import { relationCloseProblems } from './relations.mjs'
import { sliceLabel, sliceState } from './slices.mjs'
import { parseAmendments } from './spec.mjs'
import { testDrivenPhase } from './tdd.mjs'

export { configPath, findProjectRoot, loadConfig } from './cli/common.mjs'
export {
  activeChantier,
  branchCommitSubjects,
  collectUsedIdentifiers,
  currentBranch,
  defaultBaseRef,
  defaultBranchName,
  findChantierDirectory,
  readChantier,
} from './cli/identifiers.mjs'
export {
  CHANTIER_TYPES,
  DEFAULT_CONFIG,
  applyToolEdit,
  codeLogArguments,
  matchesAny,
  parseCatFileBatch,
  parseFrontMatter,
  parseGitVersion,
  parsePorcelainPaths,
  parseTreeEntries,
  setFrontMatterValues,
  shortRefName,
  toProjectRelativePath,
} from './common.mjs'
export { checkProcessProblems } from './docs.mjs'
export {
  branchNameIdentifiers,
  chantierIdFromCommitSubjects,
  chantierIdFromDirectoryName,
  chantierIdFromText,
  commitSubjectIdentifiers,
  highestChantierNumber,
  nextChantierId,
} from './identifiers.mjs'
export {
  RELATION_FIELDS,
  buildChantierIndex,
  chantierTreesOf,
  childrenOf,
  describeRelation,
  hasRelations,
  isClosedHere,
  openChildren,
  parseRelations,
  relationCloseProblems,
  relationProblems,
  statusHere,
} from './relations.mjs'
export { planSliceCount, sliceState } from './slices.mjs'
export {
  REQUIRED_SECTIONS,
  TDD_RECOMMENDATION,
  amendmentsDiffer,
  appendAmendmentEntry,
  checkSpec,
  hideCode,
  meaningfulContent,
  parseAmendments,
  splitSections,
} from './spec.mjs'
export {
  freezeTestsRefusal,
  freezeTestsValues,
  isRefreeze,
  refreezeTestsEntry,
  removedTestLines,
  reopenTestsEntry,
  reopenTestsRefusal,
  setTddRefusal,
  testDrivenPhase,
} from './tdd.mjs'

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

// Why `atelier set-reviewed` is refused, or null. `context` = { chantier, uncommittedCode (code
// files changed and not committed), specUncommitted, changedTests (frozen tests changed since
// tests_commit) }. The points of `chantier.revue` (working copy of revue.md) must all be treated.
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
  const pointProblems = reviewPointProblems(parseReviewPoints(chantier.revue))
  if (pointProblems.length) {
    return `revue.md a des points sans traitement ou mal formés :\n${pointProblems.map((problem) => `- ${problem}`).join('\n')}`
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

// ---------- Review points ----------

const POINT_TABLES = ['Bloquant', 'À discuter']
const POINT_COLUMNS = ['Point', 'Fichier', 'Traitement']
const POINT_PATTERN = /^(RB|RD)(\d+)( \(repris\)| \(ex-(R[BD]\d+)\))?\. (.+)$/
const EMPTY_POINT_PATTERN = /^aucun\.?$/i

// Cells of a Markdown table row; `\|` is a literal `|`, not a column separator.
function tableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, '|').trim())
}

// Analyses the point cell of a row: `RB2. Title`, `RB2 (repris). Title`, `RB4 (ex-RD3). Title`.
// A cell of another form gives a null id (the row is then reported by the review checks).
function parsePointCell(cell) {
  const match = POINT_PATTERN.exec(cell)
  if (!match) {
    return { id: null, marker: null, title: null }
  }
  const marker = match[3] ? (match[4] ? `ex-${match[4]}` : 'repris') : null
  return { id: `${match[1]}${match[2]}`, marker, title: match[5] }
}

const isDelimiterRow = (line) => line.trim().startsWith('|') && tableCells(line).every((cell) => /^:?-+:?$/.test(cell))

// The lines of a Markdown text with code blocks and HTML comment blocks blanked out, so that line
// numbers are kept and an example table in either is not read. As in CommonMark, a fence closes on
// the same character, at least as long, and a comment block starts with `<!--` at the start of a
// line and ends with the line holding `-->`: a `<!--` inside a cell does not hide the rows after it.
function visibleLines(text) {
  let fence = null
  let comment = false
  return String(text ?? '').normalize('NFC').split(/\r?\n/).map((line) => {
    if (comment) {
      comment = !line.includes('-->')
      return ''
    }
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1]
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && !line.trim().slice(marker.length).trim()) {
        fence = null
      }
      return ''
    }
    if (marker) {
      fence = marker
      return ''
    }
    const open = /^ {0,3}<!--/.exec(line)
    if (open) {
      comment = !line.slice(open[0].length).includes('-->')
      return ''
    }
    return line
  })
}

// Reads the points of a revue.md: one section per `## ` heading, the point tables being those under
// `### Bloquant` and `### À discuter`. As in CommonMark, a table header is decided by its position:
// a row that opens a table (the line before is not a row), followed by a delimiter row; its cells
// must also be column names only (Point and any of Fichier, Traitement), so that no point can be
// taken for a header. Any other row is a point, malformed or not. A table without a
// header is read with the template columns (Point, Fichier, Traitement). Every `|` row up to the
// next heading is read, even after free text: a row read in excess is reported by the review
// checks, a row skipped would be lost. `Aucun` rows are skipped.
// Each section also lists what would make points vanish unseen: `nearTables`, the `###` titles
// close to a point table title (`### Bloquants`), and `strays`, the rows outside a point table
// whose first cell starts with a point id.
// `legacy` is true for a revue.md written before FEAT-7 (`## Tour …` sections), which the review
// checks leave alone.
export function parseReviewPoints(text) {
  const sections = []
  let section = null
  let table = null
  let nearTable = false
  let header = null
  const lines = visibleLines(text)
  lines.forEach((line, index) => {
    const heading = /^ {0,3}(#{2,3})\s+(.*?)\s*$/.exec(line)
    if (heading) {
      header = null
      table = null
      nearTable = false
      if (heading[1] === '##') {
        section = { title: heading[2], rows: [], nearTables: [], strays: [] }
        sections.push(section)
      } else if (POINT_TABLES.includes(heading[2])) {
        table = heading[2]
      } else if (section && isNearPointTableTitle(heading[2])) {
        nearTable = true
        section.nearTables.push({ title: heading[2], line: index + 1 })
      }
      return
    }
    if (!section || !line.trim().startsWith('|') || isDelimiterRow(line)) {
      return
    }
    const cells = tableCells(line)
    if (!table) {
      // Rows under a near-miss title are covered by the problem on the title.
      if (!nearTable && /^(RB|RD)\d+/.test(cells[0] ?? '')) {
        section.strays.push({ point: cells[0], line: index + 1 })
      }
      return
    }
    const opensTable = !(lines[index - 1] ?? '').trim().startsWith('|')
    const isHeader = opensTable && cells.includes('Point') && cells.every((cell) => POINT_COLUMNS.includes(cell))
    if (isHeader && isDelimiterRow(lines[index + 1] ?? '')) {
      header = cells
      return
    }
    const column = (name, fallback) => {
      const position = header ? header.indexOf(name) : -1
      return cells[position >= 0 ? position : fallback] ?? ''
    }
    const point = column('Point', 0)
    // `Aucun` alone on its row means no point; with other cells filled, it is a malformed point.
    if (EMPTY_POINT_PATTERN.test(point) && cells.every((cell) => cell === point || cell === '')) {
      return
    }
    section.rows.push({
      ...parsePointCell(point),
      point,
      file: column('Fichier', 1),
      treatment: column('Traitement', 2),
      // A `|` left unescaped in a cell shifts the columns: reported by the review checks.
      cellCountMismatch: cells.length !== (header ?? POINT_COLUMNS).length,
      // Opens a table and is followed by a delimiter row: a header the parser did not recognise.
      headerLike: opensTable && isDelimiterRow(lines[index + 1] ?? ''),
      table,
      line: index + 1,
    })
  })
  return { legacy: sections.some((candidate) => /^Tour\b/.test(candidate.title)), sections }
}

// A `###` title that reads like a point table title without being one: case, accents and `*`
// ignored, it starts with « bloquant » or « a discuter » (`### Bloquants`, `### A discuter`).
function isNearPointTableTitle(title) {
  const plain = normalize(title.replace(/\*/g, ''))
  return !POINT_TABLES.includes(title) && (plain.startsWith('bloquant') || plain.startsWith('a discuter'))
}

const TREATMENTS = ['corrigé', 'test ajouté', 'spec amendée', 'exception acceptée', 'écarté', 'reporté', 'requalifié', 'sans objet']

// A treatment cell starts with one of the treatment keywords, case ignored.
export function isTreatment(cell) {
  const text = String(cell ?? '').normalize('NFC').trim().toLowerCase()
  return TREATMENTS.some((keyword) => text.startsWith(keyword))
}

// « reporté (tranche 2) », and its loose spellings (« reporté en tranche 3 », « reporté (tranche 2, avec
// CA-6) »): at close, a point taken for a postponement to another chantier would slip through.
const isPostponedToSlice = (treatment) => /^reporté\p{L}*[^)]*?\btranche\s+\d+/iu.test(treatment.normalize('NFC').trim())

// The id a « requalifié (RB4) » treatment points to; null for a « requalifié » without one,
// undefined for another treatment.
function requalifiedTarget(treatment) {
  const text = treatment.normalize('NFC').trim()
  // Same prefix rule as isTreatment: « Requalifiée (RB4) » is a treatment, so it is checked too.
  if (!/^requalifié/iu.test(text)) {
    return undefined
  }
  return /^requalifié\p{L}*\s*\(\s*(R[BD]\d+)\b/iu.exec(text)?.[1].toUpperCase() ?? null
}

// The problems of the points of a parsed revue.md (see parseReviewPoints), as messages: a point
// whose last occurrence has no treatment, an id presented as new twice, a point in the wrong
// table, a malformed row, a near-miss table title, a point row outside a point table, a
// `(repris)` or `(ex-<ID>)` with nothing above to refer to, a `requalifié (<ID>)` that no
// `<ID> (ex-…)` takes up further down. With `atClose`, a point whose last occurrence is
// « reporté (tranche N) » is a problem too.
// A legacy revue.md (`## Tour` sections) is not checked.
export function reviewPointProblems(parsed, { atClose = false } = {}) {
  if (parsed.legacy) {
    return []
  }
  const problems = []
  const lastOccurrence = new Map()
  const newOccurrences = new Map()
  // Every row with an id and its section: what `(repris)`, `(ex-…)` and `requalifié (…)` refer to.
  // « Above » is an earlier section or the same one, « further down » the same section or a later
  // one: within a section the Bloquant table comes first, so row order there means nothing.
  const occurrences = parsed.sections.flatMap((section, sectionIndex) =>
    section.rows.filter((row) => row.id).map((row) => ({ row, sectionIndex })))
  const occursAbove = (id, sectionIndex, except) =>
    occurrences.some((other) => other.row !== except && other.row.id === id && other.sectionIndex <= sectionIndex)
  for (const [sectionIndex, section] of parsed.sections.entries()) {
    const where = (line) => `section « ${section.title} », ligne ${line}`
    // Twice in one section, whatever the marker: the last one would hide the other.
    const inSection = new Map()
    for (const { title, line } of section.nearTables) {
      problems.push(`Titre « ### ${title} » (${where(line)}) : ni « Bloquant » ni « À discuter », ses points ne sont pas lus. Corriger le titre.`)
    }
    for (const { point, line } of section.strays) {
      problems.push(`${point} (${where(line)}) : point hors d’un tableau « ### Bloquant » ou « ### À discuter », il n’est pas lu.`)
    }
    for (const row of section.rows) {
      if (!row.id) {
        const hint = row.headerLike ? ' ; si c’est l’en-tête du tableau, il n’est pas reconnu : colonnes attendues Point, Fichier, Traitement' : ''
        problems.push(`« ${row.point} » (${where(row.line)}) : la cellule Point n’a pas la forme « RB1. Intitulé »${hint}.`)
        continue
      }
      if (row.cellCountMismatch) {
        problems.push(`${row.id} (${where(row.line)}) : nombre de cellules différent de l’en-tête ; un | dans une cellule s’écrit \\|.`)
      }
      const expectedTable = row.id.startsWith('RB') ? 'Bloquant' : 'À discuter'
      if (row.table !== expectedTable) {
        problems.push(`${row.id} (${where(row.line)}) : rangé dans « ${row.table} », il va dans « ${expectedTable} ».`)
      }
      if (row.marker === 'repris' && !occursAbove(row.id, sectionIndex, row)) {
        problems.push(`${row.id} (repris) (${where(row.line)}) : aucune occurrence de ${row.id} plus haut ; un nouveau point s’écrit sans « (repris) ».`)
      }
      const formerId = row.marker?.startsWith('ex-') ? row.marker.slice(3) : null
      if (formerId && !occursAbove(formerId, sectionIndex, row)) {
        problems.push(`${row.id} (ex-${formerId}) (${where(row.line)}) : aucune occurrence de ${formerId} plus haut.`)
      }
      lastOccurrence.set(row.id, { ...row, section: section.title, sectionIndex })
      inSection.set(row.id, [...(inSection.get(row.id) ?? []), row.line])
      if (row.marker !== 'repris') {
        newOccurrences.set(row.id, [...(newOccurrences.get(row.id) ?? []), { section: section.title, sectionIndex, line: row.line }])
      }
    }
    for (const [id, lines] of inSection) {
      if (lines.length > 1) {
        problems.push(`${id} présent ${lines.length} fois dans la section « ${section.title} » (lignes ${lines.join(', ')}) : un point n’apparaît qu’une fois par revue.`)
      }
    }
  }
  for (const [id, places] of newOccurrences) {
    if (new Set(places.map((place) => place.sectionIndex)).size > 1) {
      const listed = places.map((place) => `section « ${place.section} », ligne ${place.line}`).join(' ; ')
      problems.push(`${id} présenté comme nouveau dans plusieurs sections (${listed}) : un point repris s’écrit « ${id} (repris). … », un nouveau point prend le numéro suivant.`)
    }
  }
  for (const [id, row] of lastOccurrence) {
    const where = `section « ${row.section} », ligne ${row.line}`
    const target = requalifiedTarget(row.treatment)
    if (!isTreatment(row.treatment)) {
      const found = row.treatment.trim() ? `traitement « ${row.treatment.trim()} » non reconnu` : 'pas de traitement'
      problems.push(`${id}. ${row.title} (${where}) : ${found} ; la colonne Traitement commence par l’un de ces mots : ${TREATMENTS.join(', ')}.`)
    } else if (target !== undefined) {
      const takenUp = target && occurrences.some((later) =>
        later.sectionIndex >= row.sectionIndex && later.row.id === target && later.row.marker === `ex-${id}`)
      if (!takenUp) {
        problems.push(target
          ? `${id}. ${row.title} (${where}) : requalifié, mais aucun point « ${target} (ex-${id}). … » plus loin ; le point disparaîtrait.`
          : `${id}. ${row.title} (${where}) : requalifié sans identifiant ; écrire « requalifié (<ID>) » et reprendre le point en « <ID> (ex-${id}). … ».`)
      }
    } else if (atClose && isPostponedToSlice(row.treatment)) {
      problems.push(`${id}. ${row.title} (${where}) : reporté à une tranche et jamais repris ; le traiter avant de clore.`)
    }
  }
  return problems
}

const REVIEW_ID_PREFIXES = ['RB', 'RD', 'SB', 'SD', 'OB', 'OD']

// The next number of each review point prefix and the open review points of a chantier, from the
// texts of its revue.md, spec.md and decisions.md (null when absent). RB/RD come from the table
// rows of revue.md, `ex-` references included, so that a number is never reused; SB/SD/OB/OD,
// which have no file of their own, from any mention in spec.md and decisions.md. A point is open
// when its last occurrence has no recognised treatment; open points are in file order.
export function nextReviewIds({ revue, spec, decisions }) {
  const highest = Object.fromEntries(REVIEW_ID_PREFIXES.map((prefix) => [prefix, 0]))
  const record = (id) => {
    const [, prefix, number] = /^([A-Z]{2})(\d+)$/.exec(id)
    highest[prefix] = Math.max(highest[prefix], Number(number))
  }
  // Every RB/RD on a table row counts, malformed rows, rows under a near-miss title and
  // `requalifié (<ID>)` targets included: a gap costs nothing, a reused number breaks the trace.
  for (const line of visibleLines(revue).filter((candidate) => candidate.trim().startsWith('|'))) {
    for (const [id] of line.matchAll(/\b(?:RB|RD)\d+\b/g)) {
      record(id)
    }
  }
  const lastOccurrence = new Map()
  for (const section of parseReviewPoints(revue).sections) {
    for (const row of section.rows.filter((candidate) => candidate.id)) {
      lastOccurrence.set(row.id, { ...row, section: section.title })
    }
  }
  for (const [, id] of `${spec ?? ''}\n${decisions ?? ''}`.matchAll(/\b((?:SB|SD|OB|OD)\d+)\b/g)) {
    record(id)
  }
  const open = [...lastOccurrence.values()]
    .filter((row) => !isTreatment(row.treatment))
    .sort((a, b) => a.line - b.line)
    .map(({ id, title, section }) => ({ id, title, section }))
  return { next: Object.fromEntries(REVIEW_ID_PREFIXES.map((prefix) => [prefix, highest[prefix] + 1])), open }
}

// ---------- Close ----------

// An EPIC (no code) and a SPIKE without TDD (throwaway code, never merged) are closed without a
// review. A SPIKE in TDD follows the whole process, review included, unless it was led under the
// model before slices (legacy), which closed a SPIKE without review.
export function isReviewExempt(chantier) {
  const type = (chantier?.spec?.data?.type ?? '').toUpperCase()
  const { model } = sliceState(chantier)
  return type === 'EPIC' || model === 'none' || (type === 'SPIKE' && model === 'legacy')
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
// `revueUncommitted` is true when revue.md has uncommitted changes; the points of `chantier.revue`
// (working copy) must all be treated, a point postponed to a slice included.
export function closeProblems({ chantier, reviewFacts, uncommittedCode, uncommittedError, revueUncommitted = false, checksFailure, index = null }) {
  if (specStatus(chantier?.spec) !== 'signed') {
    return [`La spec de ${chantier?.id ?? 'ce chantier'} n’est pas signée (statut : ${specStatus(chantier?.spec)}).`]
  }
  const sliceProblems = sliceCloseProblems(chantier)
  const exempt = isReviewExempt(chantier)
  const problems = exempt || sliceProblems.length ? sliceProblems : reviewProblems(reviewFacts)
  if (!exempt) {
    if (revueUncommitted) {
      problems.push('revue.md a des modifications non commitées : commite-le.')
    }
    problems.push(...reviewPointProblems(parseReviewPoints(chantier.revue), { atClose: true }).map((problem) => `revue.md : ${problem}`))
  }
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
// `codeCommitted` is true when code was committed since the start of the current slice (since
// the freeze of its tests in TDD), false when not, null when unknown (see codeCommittedMatters).
export function nextStep(chantier, review = 'none', children = [], codeCommitted = null) {
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
  const implemented = review === 'none' && codeCommitted === true
  if (model === 'sliced' && slice !== 'chantier') {
    return `${sliceLabel(slice, sliceCount)} : ${phaseStep(chantier, 'none', implemented)}`
  }
  if (model === 'sliced' && review === 'none' && testDrivenPhase(chantier) !== 'writing-tests') {
    return 'Revue du chantier : faire relire l’ensemble : /atelier:review'
  }
  return phaseStep(chantier, review, implemented)
}

// Whether the code committed in the current slice can change the next step, so whether the
// command has to compute it: a signed chantier (not an EPIC), tests frozen if in TDD, a slice in
// progress (not the review of the whole chantier) and no review recorded.
export function codeCommittedMatters(chantier, review) {
  const data = chantier?.spec?.data
  if (!data || data.status !== 'signed' || (data.type ?? '').toUpperCase() === 'EPIC') {
    return false
  }
  return review === 'none' && testDrivenPhase(chantier) !== 'writing-tests' && sliceState(chantier).slice !== 'chantier'
}

// Next step of the current phase (tests, build, review, close), for a slice or the chantier.
// `implemented`: code was committed in the slice and no review covers it.
function phaseStep(chantier, review = 'none', implemented = false) {
  const phase = testDrivenPhase(chantier)
  if (phase === 'writing-tests') {
    return 'Tests d’abord : écrire les tests, vérifier qu’ils échouent, les commiter (aucune implémentation) : /atelier:write-tests'
  }
  const build = phase === 'implementing'
    ? 'Implémenter jusqu’à ce que tous les tests passent, sans modifier les tests, puis commiter : /atelier:build'
    : 'Implémenter (sans TDD pour ce chantier), puis commiter : /atelier:build'
  const resume = '(ou reprendre /atelier:build si elle n’est pas finie)'
  if (isReviewExempt(chantier)) {
    return implemented ? `Implémentation commitée : clôturer : /atelier:close ${resume}` : `${build} ; ensuite clôturer : /atelier:close`
  }
  if (review === 'current') {
    return 'Revue à jour : clôturer (bilan, verdict) : /atelier:close'
  }
  if (review === 'stale') {
    return 'Le code ou la spec a changé depuis la revue : refaire relire : /atelier:review'
  }
  if (implemented) {
    return `Implémentation commitée : faire relire : /atelier:review ${resume}`
  }
  return `${build} ; ensuite faire relire : /atelier:review`
}

// ---------- Path rules for the guard hook ----------

// Spec header fields written only by the atelier command (sign, set-status, freeze-tests,
// reopen-tests, set-reviewed).
export const COMMAND_SPEC_FIELDS = ['status', 'signed_by', 'signed_at', 'done_at', 'tests_commit', 'reviewed_commit', 'slice', 'slice_base', 'last_slice']

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

// Whether the checks already passed on this working tree (`tree` from the gate's index, null
// when it could not be computed). Shared by the Stop hook and the commands that run the checks.
export function checksGreenOn(state, tree) {
  return tree !== null && state?.lastGreen === tree
}

// The gate state once the checks passed on `tree`; unchanged when the tree is unknown.
export function withGreen(state, tree) {
  return tree === null ? state : { ...state, lastGreen: tree }
}

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
  if (config.checks.length === 0 || checksGreenOn(state, tree)) {
    return pass()
  }
  if (tree !== null && state.lastBlock === tree) {
    // Already known to fail on this exact tree: no need to run the checks again.
    return block(state.lastMessage)
  }
  const failure = runChecks()
  if (!failure) {
    return pass(withGreen(state, tree))
  }
  return block(`atelier : le contrôle « ${failure.check.name} » échoue (${failure.check.command}). Continue à corriger l’implémentation jusqu’à ce que tout passe, sans modifier les tests.\n\n${failure.output}`)
}
