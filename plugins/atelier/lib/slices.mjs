// Slices of a chantier: their count in the plan and the slice in progress.
// Pure functions: no access to the disk, git or the environment.

import { ENTRY_START, parseAmendments } from './spec.mjs'

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

// « Tranche N/M », or « Tranche N (absente du plan) » once the plan no longer counts it.
export function sliceLabel(slice, sliceCount) {
  return slice > sliceCount ? `Tranche ${slice} (absente du plan)` : `Tranche ${slice}/${sliceCount}`
}
