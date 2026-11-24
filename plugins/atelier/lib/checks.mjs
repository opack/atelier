// Checks of the project (tests, lint…) run once per state of the working tree: the cached result.
// Pure functions: no access to the disk, git or the environment.

// ---------- Checks state ----------

// Whether the checks already passed on this working tree (`tree` from the gate's index, null
// when it could not be computed). Shared by the Stop hook and the commands that run the checks.
export function checksGreenOn(state, tree) {
  return tree !== null && state?.lastGreen === tree
}

// The gate state once the checks passed on `tree`; unchanged when the tree is unknown.
export function withGreen(state, tree) {
  return tree === null ? state : { ...state, lastGreen: tree }
}
