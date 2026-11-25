// Shared ground of atelier: configuration defaults, front matter, path rules, reading of git output.
// Pure functions: no access to the disk, git or the environment.

import nodePath, { basename } from 'node:path'

// ---------- Configuration defaults ----------

export const CHANTIER_TYPES = ['FEAT', 'FIX', 'REF', 'TEC', 'SPIKE', 'EPIC']

export const DEFAULT_CONFIG = {
  chantiersDir: 'docs/chantiers',
  decisionsDir: 'docs/decisions',
  checks: [],
  checkTimeoutSeconds: 300,
  // Paths editable without a signed chantier.
  freePaths: ['docs/**', '.claude/**', 'CLAUDE.md', 'README.md', '.gitignore'],
  // Paths never editable by the agent.
  sensitivePaths: ['.env', '.env.*', '*.pem', '*.key', '**/secrets/**'],
  // Paths considered as tests (test files, fixtures, snapshots).
  testPaths: ['*.test.*', '*.spec.*', '*.snap', '**/__tests__/**', '**/__snapshots__/**', 'test/**', 'tests/**', 'e2e/**'],
}

// ---------- Front matter ----------

export function parseFrontMatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) {
    return { data: {}, body: text }
  }
  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const keyValue = line.match(/^([A-Za-z_][\w-]*):\s*(.*?)\s*(#.*)?$/)
    if (keyValue) {
      data[keyValue[1]] = keyValue[2].replace(/^["']|["']$/g, '')
    }
  }
  return { data, body: text.slice(match[0].length) }
}

// Updates (or adds) keys in an existing front matter block, keeping everything else intact.
export function setFrontMatterValues(text, values) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) {
    const lines = Object.entries(values).map(([key, value]) => `${key}: ${value}`)
    return `---\n${lines.join('\n')}\n---\n\n${text}`
  }
  let lines = match[1].split(/\r?\n/)
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}:`))
    if (index >= 0) {
      lines[index] = `${key}: ${value}`
    } else {
      lines = [...lines, `${key}: ${value}`]
    }
  }
  return `---\n${lines.join('\n')}\n---${text.slice(match[0].length)}`
}

// ---------- Text ----------

export function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// ---------- Paths and tool edits ----------

function globToRegExp(pattern) {
  const escaped = pattern
    .split('**')
    .map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]'))
    .join('.*')
  return new RegExp(`^${escaped}$`)
}

export function matchesAny(relativePath, patterns, ignoreCase = false) {
  if (ignoreCase) {
    return matchesAny(relativePath.toLowerCase(), patterns.map((pattern) => pattern.toLowerCase()))
  }
  const name = basename(relativePath)
  return patterns.some((pattern) => {
    const prefix = pattern.slice(0, -3)
    if (pattern.endsWith('/**') && !prefix.includes('*')) {
      return relativePath === prefix || relativePath.startsWith(`${prefix}/`)
    }
    if (pattern.startsWith('**/') && matchesAny(relativePath, [pattern.slice(3)])) {
      return true
    }
    const regExp = globToRegExp(pattern)
    return pattern.includes('/') ? regExp.test(relativePath) : regExp.test(name)
  })
}

// Path of a file relative to the project, with forward slashes, or null when the file is
// outside the project (including another drive on Windows).
export function toProjectRelativePath(projectRoot, filePath, pathApi = nodePath) {
  const relativePath = pathApi.relative(projectRoot, filePath)
  if (relativePath === '..' || relativePath.startsWith(`..${pathApi.sep}`) || pathApi.isAbsolute(relativePath)) {
    return null
  }
  return relativePath.split(pathApi.sep).join('/')
}

// Paths listed by `git status --porcelain -z`: NUL-separated and never quoted, so non-ASCII
// names come out as they are. A rename or copy is followed by its original path, skipped.
export function parsePorcelainPaths(output) {
  const entries = output.split('\0')
  const paths = []
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    if (entry.length < 4) {
      continue
    }
    paths.push(entry.slice(3))
    if (/[RC]/.test(entry.slice(0, 2))) {
      index += 1
    }
  }
  return paths
}

// Text of a file after an Edit, MultiEdit or Write, with normalized line endings, or null when
// it cannot be known (the edit does not apply, so the tool itself will fail).
export function applyToolEdit(currentText, toolName, toolInput) {
  const unixLines = (text) => String(text ?? '').replace(/\r\n/g, '\n')
  if (toolName === 'Write') {
    return unixLines(toolInput.content)
  }
  const edits = { Edit: [toolInput], MultiEdit: toolInput.edits }[toolName]
  if (!edits || currentText === null) {
    return null
  }
  let text = unixLines(currentText)
  for (const edit of edits) {
    const oldText = unixLines(edit.old_string)
    const newText = unixLines(edit.new_string)
    if (!oldText || !text.includes(oldText)) {
      return null
    }
    text = edit.replace_all ? text.replaceAll(oldText, () => newText) : text.replace(oldText, () => newText)
  }
  return text
}

// ---------- Git output ----------

// Short name of a ref: refs/heads/x → x, refs/remotes/origin/x → origin/x.
export function shortRefName(ref) {
  return ref.replace(/^refs\/(heads|remotes)\//, '')
}

// Objects printed by `git cat-file --batch`, in the order of the requests: { id, type, content
// (Buffer) } for each object found, null for a missing one.
export function parseCatFileBatch(output) {
  const objects = []
  let offset = 0
  while (offset < output.length) {
    const end = output.indexOf(0x0a, offset)
    if (end < 0) {
      break // truncated output
    }
    const header = output.subarray(offset, end).toString('utf8')
    if (/ (missing|ambiguous)$/.test(header)) {
      objects.push(null)
      offset = end + 1
      continue
    }
    const [id, type, size] = header.split(' ')
    objects.push({ id, type, content: output.subarray(end + 1, end + 1 + Number(size)) })
    offset = end + 1 + Number(size) + 1
  }
  return objects
}

// Entries of a raw tree object (`<mode> <name>\0<binary id>`), as { mode, name, id } with a hex id.
// `idLength` is the length in bytes of an object id (20 for SHA-1, 32 for SHA-256).
export function parseTreeEntries(content, idLength = 20) {
  const entries = []
  let offset = 0
  while (offset < content.length) {
    const space = content.indexOf(0x20, offset)
    const nul = content.indexOf(0x00, space)
    entries.push({
      mode: content.subarray(offset, space).toString('utf8'),
      name: content.subarray(space + 1, nul).toString('utf8'),
      id: content.subarray(nul + 1, nul + 1 + idLength).toString('hex'),
    })
    offset = nul + 1 + idLength
  }
  return entries
}

// ---------- Spec status ----------

export const specStatus = (spec) => spec?.data?.status || 'draft'

// ---------- Git log arguments ----------

// Arguments of the `git log` listing the files changed by the chantier since `from`: its own
// commits, and of a merge commit only its resolution (what differs from the automatic merge), the
// commits of the default branch (`excludedRefs`) left out (`--diff-merges=remerge`). Without any
// ref to exclude, falls back to the caller's former command (`--diff-merges=<fallbackDiffMerges>`
// when given).
export function codeLogArguments({ from, excludedRefs = [], fallbackDiffMerges = null }) {
  const common = ['log', '--name-only', '-z', '--no-renames']
  if (excludedRefs.length) {
    return [...common, '--diff-merges=remerge', '--format=', `${from}..HEAD`, ...excludedRefs.map((ref) => `^${ref}`)]
  }
  return [...common, ...(fallbackDiffMerges ? [`--diff-merges=${fallbackDiffMerges}`] : []), '--format=', `${from}..HEAD`]
}
