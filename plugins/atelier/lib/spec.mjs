// Spec of a chantier: required sections and their completeness, and the amendments section.
// Pure functions: no access to the disk, git or the environment.

import { CHANTIER_TYPES, normalize, parseFrontMatter } from './common.mjs'
import { integrationOptionProblems } from './integration.mjs'

// ---------- Spec completeness and amendments ----------

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
  problems.push(...integrationOptionProblems(data))
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

const AMENDMENTS_HEADING = /^## Amendements[ \t]*$/

const SECTION_END = /^#{1,2}\s/

export const ENTRY_START = /^- \d{4}-\d{2}-\d{2} : /

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

// Whether the amendment entries differ between two versions of the spec text.
export function amendmentsDiffer(text, otherText) {
  const entries = (candidate) => parseAmendments(parseFrontMatter(candidate).body)
  const [one, other] = [entries(text), entries(otherText)]
  return one.sectionCount !== other.sectionCount || one.entries.join('\0') !== other.entries.join('\0')
}
