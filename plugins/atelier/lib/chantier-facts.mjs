// Facts of a chantier version, shared by the listing and the cross-branch index.
// Pure functions: no access to the disk, git or the environment.

import { hasReopeningEntry, planSliceCount } from './slices.mjs'
import { parseAmendments } from './spec.mjs'
import { isRefreeze } from './tdd.mjs'

// Facts read from a version of a chantier (header, spec body, plan.md, files of its directory);
// the texts are dropped, only the facts stay: the header, the number of slices of the plan,
// whether the spec records a reopening or a refreeze of the tests (`reopened`, what marks the
// model before slices), whether a reopening is pending (`refreezing`) and the files.
export function versionFacts({ data, specBody, planText, files }) {
  const body = specBody ?? ''
  return {
    data: data ?? {},
    sliceCount: planSliceCount(planText),
    reopened: hasReopeningEntry({ spec: { body } }),
    refreezing: isRefreeze(parseAmendments(body).entries),
    files: files ?? [],
  }
}
