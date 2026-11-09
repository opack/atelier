// Bumps the plugin version (patch, minor or major). Claude Code only fetches a new
// version of an installed plugin when this number changes: run it before merging to main.
// Usage: node scripts/bump-version.mjs [patch|minor|major]

import { readFileSync, writeFileSync } from 'node:fs'

const manifestPath = new URL('../plugins/atelier/.claude-plugin/plugin.json', import.meta.url)
const level = process.argv[2] ?? 'patch'
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const [major, minor, patch] = manifest.version.split('.').map(Number)
const nextVersions = {
  major: `${major + 1}.0.0`,
  minor: `${major}.${minor + 1}.0`,
  patch: `${major}.${minor}.${patch + 1}`,
}
if (!nextVersions[level]) {
  console.error('Usage : node scripts/bump-version.mjs [patch|minor|major]')
  process.exit(1)
}
manifest.version = nextVersions[level]
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`atelier ${manifest.version}`)
