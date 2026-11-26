// Review points of revue.md: reading the point tables, checking their treatments, next identifiers.
// Pure functions: no access to the disk, git or the environment.

import { escapeRegExp, normalize } from './common.mjs'
import { VOCABULARY } from './vocabulary.mjs'

// ---------- Review points ----------

const REVIEW = VOCABULARY.review

const POINT_TABLES = [REVIEW.tables.blocking, REVIEW.tables.discuss]

// The titles close to a point table title are compared normalized (case, accents ignored).
const NORMALIZED_POINT_TABLES = POINT_TABLES.map(normalize)

const POINT_COLUMNS = [REVIEW.columns.point, REVIEW.columns.file, REVIEW.columns.treatment]

const LEGACY_ROUND = new RegExp(`^${escapeRegExp(REVIEW.legacyRound)}\\b`)

const RESUMED = REVIEW.markers.resumed
const FORMER_PREFIX = REVIEW.markers.formerly

const POINT_PATTERN = new RegExp(`^(RB|RD)(\\d+)( \\(${escapeRegExp(RESUMED)}\\)| \\(${escapeRegExp(FORMER_PREFIX)}(R[BD]\\d+)\\))?\\. (.+)$`)

const EMPTY_POINT_PATTERN = new RegExp(`^${escapeRegExp(REVIEW.empty)}\\.?$`, 'i')

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
  const marker = match[3] ? (match[4] ? `${FORMER_PREFIX}${match[4]}` : RESUMED) : null
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
    const isHeader = opensTable && cells.includes(REVIEW.columns.point) && cells.every((cell) => POINT_COLUMNS.includes(cell))
    if (isHeader && isDelimiterRow(lines[index + 1] ?? '')) {
      header = cells
      return
    }
    const column = (name, fallback) => {
      const position = header ? header.indexOf(name) : -1
      return cells[position >= 0 ? position : fallback] ?? ''
    }
    const point = column(REVIEW.columns.point, 0)
    // `Aucun` alone on its row means no point; with other cells filled, it is a malformed point.
    if (EMPTY_POINT_PATTERN.test(point) && cells.every((cell) => cell === point || cell === '')) {
      return
    }
    section.rows.push({
      ...parsePointCell(point),
      point,
      file: column(REVIEW.columns.file, 1),
      treatment: column(REVIEW.columns.treatment, 2),
      // A `|` left unescaped in a cell shifts the columns: reported by the review checks.
      cellCountMismatch: cells.length !== (header ?? POINT_COLUMNS).length,
      // Opens a table and is followed by a delimiter row: a header the parser did not recognise.
      headerLike: opensTable && isDelimiterRow(lines[index + 1] ?? ''),
      table,
      line: index + 1,
    })
  })
  return { legacy: sections.some((candidate) => LEGACY_ROUND.test(candidate.title)), sections }
}

// A `###` title that reads like a point table title without being one: case, accents and `*`
// ignored, it starts with « bloquant » or « a discuter » (`### Bloquants`, `### A discuter`).
function isNearPointTableTitle(title) {
  const plain = normalize(title.replace(/\*/g, ''))
  return !POINT_TABLES.includes(title) && NORMALIZED_POINT_TABLES.some((prefix) => plain.startsWith(prefix))
}

const TREATMENTS = Object.values(REVIEW.treatments)

// A treatment cell starts with one of the treatment keywords, case ignored.
export function isTreatment(cell) {
  const text = String(cell ?? '').normalize('NFC').trim().toLowerCase()
  return TREATMENTS.some((keyword) => text.startsWith(keyword))
}

// « reporté (tranche 2) », and its loose spellings (« reporté en tranche 3 », « reporté (tranche 2, avec
// CA-6) »): at close, a point taken for a postponement to another chantier would slip through.
const POSTPONED_TO_SLICE = new RegExp(`^${escapeRegExp(REVIEW.treatments.postponed)}\\p{L}*[^)]*?\\b${escapeRegExp(REVIEW.postponedSlice)}\\s+\\d+`, 'iu')

const isPostponedToSlice = (treatment) => POSTPONED_TO_SLICE.test(treatment.normalize('NFC').trim())

const REQUALIFIED = new RegExp(`^${escapeRegExp(REVIEW.treatments.requalified)}`, 'iu')

const REQUALIFIED_TARGET = new RegExp(`^${escapeRegExp(REVIEW.treatments.requalified)}\\p{L}*\\s*\\(\\s*(R[BD]\\d+)\\b`, 'iu')

// The id a « requalifié (RB4) » treatment points to; null for a « requalifié » without one,
// undefined for another treatment.
function requalifiedTarget(treatment) {
  const text = treatment.normalize('NFC').trim()
  // Same prefix rule as isTreatment: « Requalifiée (RB4) » is a treatment, so it is checked too.
  if (!REQUALIFIED.test(text)) {
    return undefined
  }
  return REQUALIFIED_TARGET.exec(text)?.[1].toUpperCase() ?? null
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
      problems.push(`Titre « ### ${title} » (${where(line)}) : ni « ${POINT_TABLES[0]} » ni « ${POINT_TABLES[1]} », ses points ne sont pas lus. Corriger le titre.`)
    }
    for (const { point, line } of section.strays) {
      problems.push(`${point} (${where(line)}) : point hors d’un tableau « ### ${POINT_TABLES[0]} » ou « ### ${POINT_TABLES[1]} », il n’est pas lu.`)
    }
    for (const row of section.rows) {
      if (!row.id) {
        const hint = row.headerLike ? ` ; si c’est l’en-tête du tableau, il n’est pas reconnu : colonnes attendues ${POINT_COLUMNS.join(', ')}` : ''
        problems.push(`« ${row.point} » (${where(row.line)}) : la cellule Point n’a pas la forme « RB1. Intitulé »${hint}.`)
        continue
      }
      if (row.cellCountMismatch) {
        problems.push(`${row.id} (${where(row.line)}) : nombre de cellules différent de l’en-tête ; un | dans une cellule s’écrit \\|.`)
      }
      const expectedTable = row.id.startsWith('RB') ? POINT_TABLES[0] : POINT_TABLES[1]
      if (row.table !== expectedTable) {
        problems.push(`${row.id} (${where(row.line)}) : rangé dans « ${row.table} », il va dans « ${expectedTable} ».`)
      }
      if (row.marker === RESUMED && !occursAbove(row.id, sectionIndex, row)) {
        problems.push(`${row.id} (${RESUMED}) (${where(row.line)}) : aucune occurrence de ${row.id} plus haut ; un nouveau point s’écrit sans « (${RESUMED}) ».`)
      }
      const formerId = row.marker?.startsWith(FORMER_PREFIX) ? row.marker.slice(FORMER_PREFIX.length) : null
      if (formerId && !occursAbove(formerId, sectionIndex, row)) {
        problems.push(`${row.id} (${FORMER_PREFIX}${formerId}) (${where(row.line)}) : aucune occurrence de ${formerId} plus haut.`)
      }
      lastOccurrence.set(row.id, { ...row, section: section.title, sectionIndex })
      inSection.set(row.id, [...(inSection.get(row.id) ?? []), row.line])
      if (row.marker !== RESUMED) {
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
      problems.push(`${id} présenté comme nouveau dans plusieurs sections (${listed}) : un point repris s’écrit « ${id} (${RESUMED}). … », un nouveau point prend le numéro suivant.`)
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
        later.sectionIndex >= row.sectionIndex && later.row.id === target && later.row.marker === `${FORMER_PREFIX}${id}`)
      if (!takenUp) {
        problems.push(target
          ? `${id}. ${row.title} (${where}) : requalifié, mais aucun point « ${target} (${FORMER_PREFIX}${id}). … » plus loin ; le point disparaîtrait.`
          : `${id}. ${row.title} (${where}) : requalifié sans identifiant ; écrire « ${REVIEW.treatments.requalified} (<ID>) » et reprendre le point en « <ID> (${FORMER_PREFIX}${id}). … ».`)
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
