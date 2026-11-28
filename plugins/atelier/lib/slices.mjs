// Slices of a chantier: their count in the plan and the slice in progress.
// Pure functions: no access to the disk, git or the environment.

import { escapeRegExp } from './common.mjs'
import { ENTRY_START, parseAmendments } from './spec.mjs'
import { VOCABULARY } from './vocabulary.mjs'

// ---------- Slices ----------

const SLICES_HEADING = new RegExp(`^##\\s+${escapeRegExp(VOCABULARY.slices)}\\s*$`)

// Segment prefixes of a slice entry; spaces inside the coverage label match any whitespace run.
const COVERAGE_SEGMENT = new RegExp(`^${escapeRegExp(VOCABULARY.plan.coverage).replace(/ +/g, '\\s+')}\\s*:`, 'i')
const TDD_SEGMENT = new RegExp(
  `^${escapeRegExp(VOCABULARY.plan.tdd)}\\s*:\\s*(${escapeRegExp(VOCABULARY.plan.yes)}|${escapeRegExp(VOCABULARY.plan.no)})\\b`,
  'i',
)

// Slices of a plan: the first-level numbered entries of its « Tranches » section (HTML comments
// and indented sub-lists ignored), in order. Each slice gives its number, the CA listed in its
// « CA couverts » segment (any suffix after an identifier ignored) and its declared TDD:
// 'yes' | 'no', or null when the entry does not declare one.
export function planSlices(planText) {
  const lines = (planText ?? '').replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n')
  const start = lines.findIndex((line) => SLICES_HEADING.test(line))
  if (start < 0) {
    return []
  }
  const slices = []
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) {
      break
    }
    const match = /^(\d+)\.\s(.*)$/.exec(line)
    if (match) {
      slices.push({ number: Number(match[1]), ...sliceAttributes(match[2]) })
    }
  }
  return slices
}

// Criteria and TDD of one slice entry, read from its « — » (or « – ») separated segments:
// identifiers normalised to upper case, any text after « oui » / « non » ignored.
function sliceAttributes(text) {
  const segments = text.split(/\s+[—–]\s+/)
  const coverage = segments.find((segment) => COVERAGE_SEGMENT.test(segment.trim()))
  const criteria = [
    ...new Set((coverage?.match(/\bCA-\d+\b/gi) ?? []).map((id) => id.toUpperCase())),
  ]
  const tddSegment = segments
    .map((segment) => TDD_SEGMENT.exec(segment.trim()))
    .find(Boolean)
  const tdd = tddSegment ? (tddSegment[1].toLowerCase() === VOCABULARY.plan.yes.toLowerCase() ? 'yes' : 'no') : null
  return { criteria, tdd }
}

// Acceptance criteria of a spec body: the `CA-n` identifiers at the head of a list item
// (`- [ ] CA-1 :` or `- CA-1 :`, any list marker, any case), HTML comments ignored.
function specCriteria(body) {
  const text = (body ?? '').replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '')
  return [...new Set([...text.matchAll(/^\s*[-*+]\s+(?:\[[ xX]\]\s+)?(CA-\d+)\b/gim)].map((match) => match[1].toUpperCase()))]
}

// Problems of the plan of a chantier, checked by `atelier check-plan` before the plan is
// committed: no slice, a gap in the numbering, a slice number used twice, a slice without
// « TDD : oui|non », a TDD slice without
// criteria, a criterion of the spec covered by no slice, a criterion cited but absent from the
// spec. An EPIC is not checked: its lots have no TDD.
export function planProblems(chantier) {
  if ((chantier?.spec?.data?.type ?? '').toUpperCase() === 'EPIC') {
    return []
  }
  const slices = planSlices(chantier?.plan)
  const specIds = specCriteria(chantier?.spec?.body)
  const problems = []
  if (!slices.length) {
    problems.push(`Aucune tranche : la section « ## ${VOCABULARY.slices} » du plan doit numéroter ses tranches (1., 2., …).`)
  }
  const numbers = [...new Set(slices.map((slice) => slice.number))].sort((a, b) => a - b)
  const missing = numbers.length ? Array.from({ length: numbers.at(-1) }, (_, index) => index + 1).filter((number) => !numbers.includes(number)) : []
  if (missing.length) {
    problems.push(`Numérotation des tranches trouée : ${missing.map((number) => `tranche ${number}`).join(', ')} absente(s) du plan.`)
  }
  const seen = new Set()
  for (const { number, criteria, tdd } of slices) {
    if (seen.has(number)) {
      problems.push(`Tranche ${number} : numéro en double dans le plan.`)
    }
    seen.add(number)
    if (tdd === null) {
      problems.push(`Tranche ${number} : TDD non déclaré (« ${VOCABULARY.plan.tdd} : ${VOCABULARY.plan.yes} » ou « ${VOCABULARY.plan.tdd} : ${VOCABULARY.plan.no} »).`)
    } else if (tdd === 'yes' && !criteria.length) {
      problems.push(`Tranche ${number} : « ${VOCABULARY.plan.tdd} : ${VOCABULARY.plan.yes} » sans CA couvert ; une tranche qui n’a rien à tester se déclare « ${VOCABULARY.plan.tdd} : ${VOCABULARY.plan.no} ».`)
    }
    for (const id of criteria.filter((criterion) => !specIds.includes(criterion))) {
      problems.push(`${id} : cité par la tranche ${number}, absent de la spec.`)
    }
  }
  const covered = new Set(slices.flatMap((slice) => slice.criteria))
  for (const id of specIds.filter((criterion) => !covered.has(criterion))) {
    problems.push(`${id} : couvert par aucune tranche.`)
  }
  return problems
}

// Spec header values written by `atelier check-plan` on a plan without problems: the TDD of
// slice 1 into `slice_tdd`, only for a chantier in the slice cycle (not an EPIC, not a SPIKE
// without TDD), while slice 1 has neither frozen tests (current, reopened or refrozen) nor a
// review, and only if `slice_tdd` is still empty (afterwards, the plan no longer changes it).
export function checkPlanValues(chantier) {
  const data = chantier?.spec?.data ?? {}
  if ((data.type ?? '').toUpperCase() === 'EPIC') {
    return {}
  }
  const written = String(data.slice ?? '').trim()
  if (String(data.slice_tdd ?? '').trim() || data.tests_commit || data.reviewed_commit || (written && written !== '1')) {
    return {}
  }
  // A reopening or a refreeze means tests were frozen (a reopening empties tests_commit).
  if (hasReopeningEntry(chantier) || sliceState(chantier).model === 'none') {
    return {}
  }
  const tdd = planSlices(chantier?.plan).find((slice) => slice.number === 1)?.tdd
  return tdd ? { slice_tdd: tdd } : {}
}

const REOPENING_ENTRY = new RegExp(`^(${escapeRegExp(VOCABULARY.amendmentEntries.reopened)}|${escapeRegExp(VOCABULARY.amendmentEntries.refrozen)})`)

// Whether the amendments of the spec record a reopening or a refreeze of the tests.
export function hasReopeningEntry(chantier) {
  return parseAmendments(chantier?.spec?.body ?? '').entries
    .some((entry) => REOPENING_ENTRY.test(entry.replace(ENTRY_START, '')))
}

// Number of slices of a plan: the highest slice number read by planSlices; 0 without slices.
export function planSliceCount(planText) {
  return planSlices(planText).reduce((count, slice) => Math.max(count, slice.number), 0)
}

// A chantier may carry `facts` ({ sliceCount, reopened, refreezing }, see versionFacts in
// chantier-facts.mjs) in place of the texts of its plan and spec. Only sliceState (sliceCount, reopened)
// and testDrivenPhase (refreezing) read them; the other rules still need the texts.
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
    if (data.tests_commit || data.reviewed_commit || (chantier?.facts?.reopened ?? hasReopeningEntry(chantier))) {
      return flat('legacy')
    }
  }
  const slice = written === 'chantier' ? 'chantier' : Number(written || 1)
  const sliceCount = chantier?.facts?.sliceCount ?? planSliceCount(chantier?.plan)
  if (sliceCount <= 1 && slice === 1) {
    return flat('single')
  }
  return { model: 'sliced', slice, sliceCount }
}

// « Tranche N/M », or « Tranche N (absente du plan) » once the plan no longer counts it.
export function sliceLabel(slice, sliceCount) {
  return slice > sliceCount ? `Tranche ${slice} (absente du plan)` : `Tranche ${slice}/${sliceCount}`
}
