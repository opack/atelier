// Slices of a chantier: their count in the plan and the slice in progress.
// Pure functions: no access to the disk, git or the environment.

import { ENTRY_START, parseAmendments } from './spec.mjs'

// ---------- Slices ----------

// Slices of a plan: the first-level numbered entries of its « Tranches » section (HTML comments
// and indented sub-lists ignored), in order. Each slice gives its number, the CA listed in its
// « CA couverts » segment (any suffix after an identifier ignored) and its declared TDD:
// 'yes' | 'no', or null when the entry does not declare one.
export function planSlices(planText) {
  const lines = (planText ?? '').replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n')
  const start = lines.findIndex((line) => /^##\s+Tranches\s*$/.test(line))
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
  const coverage = segments.find((segment) => /^CA\s+couverts\s*:/i.test(segment.trim()))
  const criteria = [
    ...new Set((coverage?.match(/\bCA-\d+\b/gi) ?? []).map((id) => id.toUpperCase())),
  ]
  const tddSegment = segments
    .map((segment) => /^TDD\s*:\s*(oui|non)\b/i.exec(segment.trim()))
    .find(Boolean)
  const tdd = tddSegment ? (tddSegment[1].toLowerCase() === 'oui' ? 'yes' : 'no') : null
  return { criteria, tdd }
}

// Number of slices of a plan: the highest slice number read by planSlices; 0 without slices.
export function planSliceCount(planText) {
  return planSlices(planText).reduce((count, slice) => Math.max(count, slice.number), 0)
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

// « Tranche N/M », or « Tranche N (absente du plan) » once the plan no longer counts it.
export function sliceLabel(slice, sliceCount) {
  return slice > sliceCount ? `Tranche ${slice} (absente du plan)` : `Tranche ${slice}/${sliceCount}`
}
