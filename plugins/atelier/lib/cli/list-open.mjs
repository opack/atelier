// path and open commands: the absolute path of a chantier directory, and its opening in the file explorer.

import { spawn } from 'node:child_process'
import { shownVersions } from '../list-versions.mjs'
import { explorerFor, locateError, openUsage, parseOpenArgument } from '../list-open.mjs'
import { findProjectRoot, requireConfig } from './common.mjs'
import { currentBranch } from './identifiers.mjs'
import { chantierIndex } from './relations.mjs'

function fail(message) {
  console.error(message)
  process.exit(1)
}

// Absolute path of the directory of the chantier named by the arguments; exits on failure.
function resolveDirectory(command, argumentList) {
  const id = parseOpenArgument(argumentList)
  if (!id) {
    fail(openUsage(command))
  }
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const branch = currentBranch(projectRoot)
  const index = chantierIndex(projectRoot, config, branch)
  const entry = index.get(id)
  const directories = entry?.hereDirectories ?? []
  const shown = entry ? shownVersions(new Map([[id, entry]]), branch)[0] : undefined
  const error = locateError(id, directories, shown)
  if (error) {
    fail(error)
  }
  return entry.herePath
}

export function commandPath(argumentList) {
  console.log(resolveDirectory('path', argumentList))
}

// Longest wait for the explorer to end; a slower one is considered to have opened the folder.
const EXPLORER_WAIT_MS = 1500

// Launches the explorer detached and resolves { error } when it cannot be launched,
// { code } when it ended within the wait, or {} when still running (then released).
function launch(command, path) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, [path], { detached: true, stdio: 'ignore', shell: false })
    let timer = null
    const settle = (outcome) => {
      clearTimeout(timer)
      resolvePromise(outcome)
    }
    child.once('error', (error) => settle({ error }))
    child.once('exit', (code) => settle({ code }))
    child.once('spawn', () => {
      timer = setTimeout(() => {
        child.unref()
        settle({})
      }, EXPLORER_WAIT_MS)
    })
  })
}

export async function commandOpen(argumentList) {
  const path = resolveDirectory('open', argumentList)
  const explorer = explorerFor(process.platform, process.env)
  if (!explorer.command) {
    console.log(`${path}\nLe dossier n’a pas été ouvert : ${explorer.reason}.`)
    return
  }
  const { error, code } = await launch(explorer.command, path)
  if (error) {
    console.log(`${path}\n${explorer.command} n’a pas pu être lancé : ${error.message}.`)
    return
  }
  if (code && !explorer.ignoreExitCode) {
    console.log(`${path}\n${explorer.command} a échoué (code ${code}) : le dossier n’a pas été ouvert.`)
    return
  }
  console.log(`Dossier ouvert : ${path}`)
}
