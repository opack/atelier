// Documentation commands: templates of the plugin and the process section of CLAUDE.md.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkProcessProblems } from '../docs.mjs'
import { findProjectRoot, loadConfig, pluginRoot } from './common.mjs'

// ---------- Templates and process section ----------

// Lines of the « Process (atelier) » section missing from the project's CLAUDE.md.
export function commandCheckProcess() {
  const projectRoot = findProjectRoot()
  const claudePath = join(projectRoot, 'CLAUDE.md')
  const missing = checkProcessProblems(
    readFileSync(join(pluginRoot, 'templates', 'process.md'), 'utf8'),
    existsSync(claudePath) ? readFileSync(claudePath, 'utf8') : null,
    loadConfig(projectRoot)?.chantiersDir,
  )
  if (missing.length === 0) {
    console.log('Section « Process (atelier) » du CLAUDE.md à jour.')
    return
  }
  console.log(`Lignes de la section « Process (atelier) » absentes du CLAUDE.md :\n${missing.join('\n')}`)
  process.exitCode = 2
}

export function commandTemplate([name]) {
  const path = join(pluginRoot, 'templates', `${name}.md`)
  if (!existsSync(path)) {
    console.error(`Template inconnu : ${name}`)
    process.exit(1)
  }
  process.stdout.write(readFileSync(path, 'utf8'))
}
