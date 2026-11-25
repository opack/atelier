// Stop hook: whether the turn may end, given the phase, the changed files and the checks.
// Pure functions: no access to the disk, git or the environment.

import { checksGreenOn, withGreen } from './checks.mjs'
import { matchesAny } from './common.mjs'
import { testDrivenPhase } from './tdd.mjs'

// ---------- Stop hook ----------

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
    return block(`atelier : des tests figés ont été modifiés (${changedTests.join(', ')}). Restaure-les (git checkout ${chantier.spec.data.tests_commit} -- <fichier>) et corrige l’implémentation. Si la modification vient d’une fusion de la branche par défaut (résolution de conflit), ne restaure rien : elle effacerait les apports de cette branche ; rouvre les tests (/atelier:write-tests <raison>) puis fige-les à nouveau. Si un test est réellement faux, arrête-toi et signale-le à l’utilisateur au lieu de le modifier.`)
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
