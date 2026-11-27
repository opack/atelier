// `atelier path` and `atelier open`: pure logic (argument, file explorer per platform, error
// messages). No access to the disk, git or the environment.

import { chantierIdFromDirectoryName } from './identifiers.mjs'

// The whole argument must be an identifier (no suffix such as `-slug`).
const WHOLE_IDENTIFIER_PATTERN = /^[A-Za-z]+-\d+$/

// Identifier of the argument, normalized the way directory names are read (so it matches the
// chantier index), or null when it is not the identifier of a known type.
export function parseOpenArgument(argumentList) {
  const [value] = argumentList
  if (argumentList.length !== 1 || !WHOLE_IDENTIFIER_PATTERN.test(value)) {
    return null
  }
  return chantierIdFromDirectoryName(value)
}

export function openUsage(command) {
  return `Usage : atelier ${command} <ID> (identifiant d’un chantier, par exemple FEAT-12)`
}

// The file explorer of a platform: { command, ignoreExitCode } or, without a display, { command: null, reason }.
export function explorerFor(platform, env) {
  if (platform === 'darwin') {
    return { command: 'open', ignoreExitCode: false }
  }
  if (platform === 'win32') {
    return { command: 'explorer', ignoreExitCode: true }
  }
  if (platform === 'linux' && !env.DISPLAY && !env.WAYLAND_DISPLAY) {
    return { command: null, reason: 'aucun affichage graphique n’est disponible (ni DISPLAY ni WAYLAND_DISPLAY)' }
  }
  return { command: 'xdg-open', ignoreExitCode: false }
}

// Why the chantier cannot be located in the current tree.
// `directories`: names of its directories in the current tree; `shown`: its shown version
// ({ location }) or undefined when unknown. Returns an error message, or null when exactly one directory.
export function locateError(id, directories, shown) {
  if (directories.length > 1) {
    return `${id} a plusieurs dossiers dans l’arbre courant : ${directories.join(', ')}. Supprime ou renomme l’un d’eux.`
  }
  if (directories.length === 1) {
    return null
  }
  if (shown?.location) {
    return `${id} n’existe que sur la branche ${shown.location} : bascule dessus pour l’ouvrir.`
  }
  return `${id} est inconnu : aucun chantier de ce nom dans l’arbre courant ni sur les autres branches.`
}
