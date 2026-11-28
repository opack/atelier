// Acceptance criteria prefix and its expressions. Pure: only the shared base (common.mjs) is imported.

import { CHANTIER_TYPES } from './common.mjs'

export const CRITERION_PREFIX = 'AC'

// A criterion identifier in prose, any case (`ac-3` is detected so that a lower-case tag is refused).
export const CRITERION_ID = new RegExp(`\\b${CRITERION_PREFIX}-\\d+\\b`, 'i')
// Global expressions keep a `lastIndex` state: kept private, read only through the functions below.
const CRITERION_ID_GLOBAL = new RegExp(CRITERION_ID.source, 'gi')

// Criterion at the head of a spec list item: `- [ ] AC-1 :` or `- AC-1 :` (any marker, any case).
const CRITERION_ITEM = new RegExp(`^\\s*[-*+]\\s+(?:\\[[ xX]\\]\\s+)?(${CRITERION_PREFIX}-\\d+)\\b`, 'gim')

// Final tag of a test name: `[<ID> AC-n]` or `[<ID> AC-n, AC-m]` (upper case).
export const FINAL_TAG = new RegExp(
  `\\s\\[(?:${CHANTIER_TYPES.join('|')})-\\d+ ${CRITERION_PREFIX}-\\d+(?:, ${CRITERION_PREFIX}-\\d+)*\\]$`,
)

// Criterion identifiers cited in a text, in order of appearance, upper case.
export function criterionIds(text) {
  return (text ?? '').match(CRITERION_ID_GLOBAL)?.map((id) => id.toUpperCase()) ?? []
}

// Criteria at the head of the list items of a text, in order of appearance, upper case.
export function listedCriteria(text) {
  return [...(text ?? '').matchAll(CRITERION_ITEM)].map((match) => match[1].toUpperCase())
}

// Example shown in messages.
export const CRITERION_EXAMPLE = `${CRITERION_PREFIX}-1, ${CRITERION_PREFIX}-2…`
