// list command: the chantiers of the project, one per line (or as JSON).

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontMatter } from '../common.mjs'
import { chantierIdFromDirectoryName } from '../identifiers.mjs'
import { chantierSteps, chantierType, formatList, listEntry, listItem, parseListArguments, selectChantiers, versionFacts } from '../list.mjs'
import { findProjectRoot, requireConfig } from './common.mjs'

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

// Shown versions of the chantiers of the current tree (working copy included): the facts of each
// one plus its location (null: current tree) and path. Directories without spec.md are ignored.
function currentTreeVersions(projectRoot, config) {
  const chantiersRoot = join(projectRoot, config.chantiersDir)
  if (!existsSync(chantiersRoot)) {
    return []
  }
  return readdirSync(chantiersRoot).flatMap((name) => {
    const id = chantierIdFromDirectoryName(name)
    const directory = join(chantiersRoot, name)
    const specText = id && readIfExists(join(directory, 'spec.md'))
    if (specText === null || specText === false || !id) {
      return []
    }
    const { data, body } = parseFrontMatter(specText)
    const shown = { ...data, type: chantierType(id, data), status: data.status || 'draft' }
    const facts = versionFacts({ data: shown, specBody: body, planText: readIfExists(join(directory, 'plan.md')), files: readdirSync(directory) })
    return [{ id, ...facts, location: null, path: directory }]
  })
}

export function commandList(argumentList) {
  const options = parseListArguments(argumentList)
  if (options.error) {
    console.error(options.error)
    process.exit(1)
  }
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  // Steps are computed on all the known versions, before any filter (an EPIC looks at its children).
  const versions = currentTreeVersions(projectRoot, config)
  const steps = chantierSteps(versions)
  const byId = new Map(versions.map((version) => [version.id, version]))
  const { selected, hiddenClosed } = selectChantiers(versions.map((version) => listEntry(version)), options)
  const items = selected.map((entry) => {
    const { location, path } = byId.get(entry.id)
    return listItem(entry, steps.get(entry.id), { location, path })
  })
  console.log(options.json ? JSON.stringify(items, null, 2) : formatList(items, { hiddenClosed }))
}
