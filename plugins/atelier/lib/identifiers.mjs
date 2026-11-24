// Chantier identifiers: reading them in a text, a commit subject, a branch or a directory name, and
// choosing the next one. Pure functions: no access to the disk, git or the environment.

import { CHANTIER_TYPES } from './common.mjs'

// ---------- Identifiers ----------

const ID_PATTERN = new RegExp(`\\b(${CHANTIER_TYPES.join('|')})-(\\d+)\\b`, 'i')

const BRACKETED_ID_PATTERN = new RegExp(`\\[(${CHANTIER_TYPES.join('|')})-(\\d+)\\]`, 'i')

export function chantierIdFromText(text) {
  const match = text?.match(ID_PATTERN)
  return match ? `${match[1].toUpperCase()}-${match[2]}` : null
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

// Chantier identifier at the start of a chantier directory name (`FEAT-12-budget` → FEAT-12).
export function chantierIdFromDirectoryName(name) {
  const match = name.match(new RegExp(`^(${CHANTIER_TYPES.join('|')})-(\\d+)(?:-|$)`, 'i'))
  return match ? `${match[1].toUpperCase()}-${match[2]}` : null
}

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

// Identifiers a commit subject carries: only bracketed ones (`[FEAT-7]`, `[TEC-15 CA-3]`), so that
// prose tokens such as CA-13, UTF-8 or ISO-8601 never move the counter.
export function commitSubjectIdentifiers(subject) {
  return [...subject.matchAll(/\[([A-Z]{2,6})-(\d+)\b/gi)].map((match) => `${match[1].toUpperCase()}-${match[2]}`)
}

// Identifiers a branch name carries: only one opening a segment and followed by `-` or the end
// (`fix/BUG-421-x`, `feature/JIRA-123`), so that bot branches such as `renovate/node-20.x` don't count.
export function branchNameIdentifiers(name) {
  return [...name.matchAll(/(?:^|\/)([A-Z]{2,6})-(\d+)(?=-|$)/gi)].map((match) => `${match[1].toUpperCase()}-${match[2]}`)
}

export function nextChantierId(type, usedNames) {
  const normalizedType = type.toUpperCase()
  if (!CHANTIER_TYPES.includes(normalizedType)) {
    throw new Error(`Type inconnu : ${type}. Types possibles : ${CHANTIER_TYPES.join(', ')}`)
  }
  return `${normalizedType}-${highestChantierNumber(usedNames) + 1}`
}
