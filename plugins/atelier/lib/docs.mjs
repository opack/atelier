// Documentation that atelier installs in a project: the process section of its CLAUDE.md.
// Pure functions: no access to the disk, git or the environment.

import { DEFAULT_CONFIG } from './common.mjs'

// ---------- Process section of CLAUDE.md ----------

// Lines of the process section template missing from that section of the project's CLAUDE.md
// (null when the file does not exist), compared trimmed: all of them when the section is absent.
// The section runs from its heading (the template's first line) to the next heading of the same
// level or above. Lines added by the project are not a problem. The template names the default
// chantiers directory: the project's `chantiersDir` (without trailing `/`) is expected instead.
export function checkProcessProblems(templateText, claudeText, chantiersDir = DEFAULT_CONFIG.chantiersDir) {
  const expected = templateText
    .replaceAll(`${DEFAULT_CONFIG.chantiersDir}/`, `${chantiersDir.replace(/[\\/]+$/, '')}/`)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const lines = (claudeText ?? '').split(/\r?\n/).map((line) => line.trim())
  const start = lines.indexOf(expected[0])
  if (start < 0) {
    return expected
  }
  const end = lines.findIndex((line, index) => index > start && /^#{1,2}\s/.test(line))
  const present = new Set(lines.slice(start, end < 0 ? lines.length : end))
  return expected.filter((line) => !present.has(line))
}
