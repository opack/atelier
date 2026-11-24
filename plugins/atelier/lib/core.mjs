// Core logic of atelier: project configuration, chantier state, spec checks.
// Pure functions where possible so they can be tested without git or a filesystem.

import { CHANTIER_TYPES, DEFAULT_CONFIG, matchesAny, normalize, parseFrontMatter, specStatus } from './common.mjs'
import { relationCloseProblems } from './relations.mjs'

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

// Recommended answer to "should this chantier follow TDD?", per type. Only a suggestion:
// the human always decides, in the `tdd` field of the spec header. An EPIC implements nothing:
// it is always `tdd: no`, without asking.
export const TDD_RECOMMENDATION = { FEAT: 'yes', FIX: 'yes', REF: 'yes', TEC: 'no', SPIKE: 'no', EPIC: 'no' }

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

// ---------- Front matter ----------

// ---------- Chantier identification ----------

// ---------- Relations between chantiers ----------

// ---------- Next identifier ----------

// ---------- Spec completeness ----------

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

// An ellipsis written apart (after a line start, a space or a table bar) stands for missing text.
// Glued to the previous character, it is punctuation.
const UNFINISHED_TEXT = /(?:^|[\s|])…/m

// Hides code from the search for unfinished text. Fenced blocks are removed: opened by ``` or ~~~,
// possibly indented, in a list item or in a quote; closed by a fence of the same character, at
// least as long, preceded only by indentation or quote markers; or running to the end of the text.
// Inline spans (a run of N backticks closed by exactly N on the same line) become a neutral
// character, neither a space nor a `|`, so that an ellipsis glued to a span stays glued.
export function hideCode(text) {
  const kept = []
  let fence = null
  for (const line of text.split('\n')) {
    if (fence) {
      const closing = line.match(/^\s*(?:>\s*)*(`{3,}|~{3,})\s*$/)
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) {
        fence = null
      }
      continue
    }
    const marker = line.match(/^\s*(?:>\s*)*(?:(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?)?(`{3,}|~{3,})(.*)$/)
    if (marker && !(marker[1][0] === '`' && marker[2].includes('`'))) {
      fence = marker[1]
      continue
    }
    kept.push(line.replace(/(?<!`)(`+)(?!`).+?(?<!`)\1(?!`)/g, 'x'))
  }
  return kept.join('\n')
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
    if (UNFINISHED_TEXT.test(hideCode(section.lines.join('\n').replace(/<!--[\s\S]*?-->/g, 'x')))) {
      problems.push(`Section « ${title} » : texte à compléter (« … » isolé). S'il est voulu, mets-le en code en ligne.`)
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
    // After a reopening (slice N > 1 or the whole-chantier review), the tests are already reopened.
    const { slice } = sliceState(chantier)
    if (data.slice_base && isRefreeze(parseAmendments(chantier.spec.body ?? '').entries)) {
      return `tests déjà rouverts pour ${chantier.id} : modifie-les, commite-les puis fige-les (atelier freeze-tests).`
    }
    if (typeof slice !== 'number' || slice < 2 || !data.slice_base) {
      return `Les tests de ${chantier.id} ne sont pas figés : ils s’écrivent encore, rien à rouvrir (/atelier:write-tests).`
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
