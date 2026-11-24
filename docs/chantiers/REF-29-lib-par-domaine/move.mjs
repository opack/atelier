#!/usr/bin/env node
// REF-29: moves whole declarations between modules of plugins/atelier/lib, then rewrites the import
// header of every module so that each one imports what it uses from the module that defines it.
//   node docs/chantiers/REF-29-lib-par-domaine/move.mjs <target> [--header "<comment>"] --section "<title>" <name>...
//   node docs/chantiers/REF-29-lib-par-domaine/move.mjs --relink
// <target> is relative to lib/ (`common.mjs`, `cli/common.mjs`). A declaration moves with the comment
// lines glued above it; its text never changes (check-moves.mjs proves it). The moved declarations go
// under a section titled after their content in the target (`--section`), not after their origin (RD1).
// Imports are found by scanning the free identifiers of each declaration (outside comments, strings,
// regexes and template text, minus locally bound names); IGNORED corrects a wrong guess by hand.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { splitModule } from './check-moves.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const lib = join(root, 'plugins/atelier/lib')
const FACADE = 'core.mjs'
const ENTRY = 'cli.mjs'

// Module (relative to lib/) → names the scan wrongly takes for free uses (none known so far).
const IGNORED = {}

const SECTION = /^\/\/ -{5,} (.*) -{5,}$/
const DECLARATION = /^(export )?(async )?(function\*?|const|let|class) ([A-Za-z0-9_$]+)/

const modules = () => walk(lib).map((path) => relative(lib, path)).sort()
function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? walk(path) : name.endsWith('.mjs') ? [path] : []
  })
}
const read = (module) => readFileSync(join(lib, module), 'utf8')
const write = (module, text) => {
  mkdirSync(dirname(join(lib, module)), { recursive: true })
  writeFileSync(join(lib, module), text)
}

// ---------- moving

// Lines of `text` with the span of each unit: [start, end) in line numbers, section included.
function locate(text) {
  const lines = text.split('\n')
  const spans = []
  let section = null
  for (let index = 0; index < lines.length; index++) {
    const sectionMatch = SECTION.exec(lines[index])
    if (sectionMatch) section = sectionMatch[1]
    const match = DECLARATION.exec(lines[index])
    if (!match) continue
    let start = index
    while (start > 0 && lines[start - 1].startsWith('//') && !SECTION.test(lines[start - 1])) start--
    let end = index + 1
    while (end < lines.length && (lines[end] === '' || /^\s/.test(lines[end]) || /^[}\])`'"]/.test(lines[end]))) end++
    while (end > index + 1 && lines[end - 1].trim() === '') end--
    spans.push({ name: match[4], start, end, section })
    index = end - 1
  }
  return { lines, spans }
}

function move(target, names, header, section) {
  if (!section) throw new Error('--section "<titre>" est obligatoire : la section d’origine ne décrit pas le module cible (RD1)')
  const wanted = new Set(names)
  const moved = []
  for (const module of modules().filter((module) => module !== target)) {
    const { lines, spans } = locate(read(module))
    const taken = spans.filter((span) => wanted.has(span.name))
    if (!taken.length) continue
    for (const span of taken) moved.push({ ...span, text: lines.slice(span.start, span.end).join('\n') })
    const drop = new Set()
    for (const span of taken) {
      for (let line = span.start; line < span.end; line++) drop.add(line)
      if (lines[span.end] === '') drop.add(span.end)
    }
    write(module, lines.filter((line, index) => !drop.has(index)).join('\n'))
    taken.forEach((span) => wanted.delete(span.name))
  }
  if (wanted.size) throw new Error(`introuvable : ${[...wanted].join(', ')}`)
  const order = new Map(names.map((name, index) => [name, index]))
  moved.sort((a, b) => order.get(a.name) - order.get(b.name))
  let text = existsSync(join(lib, target)) ? read(target).replace(/\n+$/, '') : `${header ?? `// ${target}`}\n`
  text += `\n\n// ---------- ${section} ----------`
  for (const unit of moved) text += `\n\n${unit.text}`
  write(target, `${text}\n`)
}

// ---------- imports

// Code with comments, string and regex literals and template text blanked out (template
// expressions kept), so that only real identifiers remain.
function codeOnly(source) {
  let out = ''
  let index = 0
  const stack = [] // brace depth of each open template expression
  let lastSignificant = ''
  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]
    if (stack.length && char === '}' && stack.at(-1) === 0) {
      stack.pop()
      index = template(index + 1)
      continue
    }
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index++
      continue
    }
    if (char === '/' && next === '*') {
      index = source.indexOf('*/', index + 2) + 2
      continue
    }
    if (char === "'" || char === '"') {
      index++
      while (source[index] !== char) index += source[index] === '\\' ? 2 : 1
      index++
      out += ' "" '
      lastSignificant = '"'
      continue
    }
    if (char === '`') {
      index = template(index + 1)
      continue
    }
    if (char === '/' && (/[(,=:!&|?{};[+\-*%<>~^]/.test(lastSignificant) || /\breturn$/.test(out.trimEnd()) || lastSignificant === '')) {
      index++
      let inClass = false
      while (index < source.length && (source[index] !== '/' || inClass)) {
        if (source[index] === '\\') index++
        else if (source[index] === '[') inClass = true
        else if (source[index] === ']') inClass = false
        index++
      }
      index++
      while (/[a-z]/.test(source[index] ?? '')) index++
      out += ' /r/ '
      lastSignificant = '/'
      continue
    }
    if (stack.length && char === '{') stack[stack.length - 1]++
    if (stack.length && char === '}') stack[stack.length - 1]--
    out += char
    if (!/\s/.test(char)) lastSignificant = char
    index++
  }
  return out

  // Skips template text from `start` up to its end or to a `${`, whose expression is then scanned.
  function template(start) {
    let position = start
    while (position < source.length) {
      if (source[position] === '\\') position += 2
      else if (source[position] === '`') {
        out += ' "" '
        lastSignificant = '"'
        return position + 1
      } else if (source[position] === '$' && source[position + 1] === '{') {
        stack.push(0)
        out += ' '
        lastSignificant = '('
        return position + 2
      } else position++
    }
    return position
  }
}

// Names bound inside a declaration: parameters (destructured or not), const / let / var, and
// destructuring patterns. A free use of the same name in that declaration is not expected.
function boundNames(code) {
  const names = new Set()
  const addAll = (text) => {
    for (const match of text.replace(/=\s*[^,{}()[\]]+/g, '').matchAll(/(?<![.\w$:])([A-Za-z_$][\w$]*)(?!\s*:)/g)) names.add(match[1])
  }
  for (const match of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(match[1])
  for (const match of code.matchAll(/\b(?:const|let|var)\s*(\{[^{}]*\}|\[[^[\]]*\])\s*=/g)) addAll(match[1])
  for (const match of code.matchAll(/\bfunction\b[^(]*\(((?:[^()]|\([^()]*\))*)\)/g)) addAll(match[1])
  for (const match of code.matchAll(/\(((?:[^()]|\([^()]*\))*)\)\s*=>/g)) addAll(match[1])
  for (const match of code.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) names.add(match[1])
  for (const match of code.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) names.add(match[1])
  for (const match of code.matchAll(/\bfor\s*\(\s*(?:const|let)\s*([{[][^=]*?[}\]]|[A-Za-z_$][\w$]*)\s+(?:of|in)\b/g)) addAll(match[1])
  return names
}

// Free identifiers of a declaration: used, not bound locally, not a property name.
function identifiers(unitText) {
  const code = codeOnly(unitText).replaceAll('...', ' ') // a spread is not a property access
  const bound = boundNames(code.split('\n').slice(1).join('\n') + '\n' + code.split('\n')[0].replace(/^(export )?(async )?(function\*?|const|let|class) [A-Za-z0-9_$]+/, ''))
  const used = new Set()
  for (const match of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)(?!\s*:(?!:))/g)) used.add(match[1])
  // Shorthand object properties `{ name }` and `{ name, … }` are uses too: the negative lookahead
  // above only drops `name:` keys.
  return new Set([...used].filter((name) => !bound.has(name)))
}

// Names imported from node: modules, as written in the base files: name → { from, isDefault }.
function nodeImports() {
  const table = new Map()
  for (const module of modules()) {
    for (const statement of splitModule(read(module), module).statements) {
      const from = /from ['"](node:[^'"]+)['"]/.exec(statement)?.[1]
      if (!from) continue
      const clause = statement.replace(/^import\s+/, '').replace(/\s*from\s+['"][^'"]+['"]\s*$/, '')
      const defaultName = /^([A-Za-z_$][\w$]*)/.exec(clause)?.[1]
      if (defaultName) table.set(defaultName, { from, isDefault: true })
      for (const name of (/\{([^}]*)\}/.exec(clause)?.[1] ?? '').split(',').map((item) => item.trim()).filter(Boolean)) {
        table.set(name, { from, isDefault: false })
      }
    }
  }
  return table
}

function relink(baseExports) {
  const node = nodeImports()
  const all = modules()
  const parsed = Object.fromEntries(all.map((module) => [module, splitModule(read(module), module)]))
  const definedIn = new Map()
  for (const module of all) for (const unit of parsed[module].units) definedIn.set(unit.name, module)
  const uses = {}
  const usedElsewhere = new Set()
  for (const module of all) {
    const own = new Set(parsed[module].units.map((unit) => unit.name))
    const ignored = new Set(IGNORED[module] ?? [])
    const names = new Set(parsed[module].units.flatMap((unit) => [...identifiers(unit.text)]))
    uses[module] = [...names].filter((name) => !own.has(name) && !ignored.has(name) && (definedIn.has(name) || node.has(name)))
    for (const name of uses[module]) if (definedIn.has(name)) usedElsewhere.add(name)
  }
  for (const module of all) {
    const lines = []
    const nodeGroups = new Map()
    const localGroups = new Map()
    for (const name of uses[module]) {
      if (definedIn.has(name)) {
        let path = relative(dirname(join(lib, module)), join(lib, definedIn.get(name)))
        if (!path.startsWith('.')) path = `./${path}`
        localGroups.set(path, [...(localGroups.get(path) ?? []), name])
      } else {
        const { from, isDefault } = node.get(name)
        const group = nodeGroups.get(from) ?? { default: null, names: [] }
        if (isDefault) group.default = name
        else group.names.push(name)
        nodeGroups.set(from, group)
      }
    }
    for (const [from, group] of [...nodeGroups].sort(([a], [b]) => a.localeCompare(b))) {
      const named = group.names.length ? `{ ${group.names.sort().join(', ')} }` : ''
      lines.push(`import ${[group.default, named].filter(Boolean).join(', ')} from '${from}'`)
    }
    for (const [from, names] of [...localGroups].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(...importStatement('import', names.sort(), from))
    }
    if (module === FACADE) {
      const reexports = new Map()
      for (const name of baseExports) {
        if (definedIn.get(name) === FACADE) continue
        const path = `./${definedIn.get(name)}`
        reexports.set(path, [...(reexports.get(path) ?? []), name])
      }
      if (reexports.size && lines.length) lines.push('')
      for (const [from, names] of [...reexports].sort(([a], [b]) => a.localeCompare(b))) {
        lines.push(...importStatement('export', names.sort(), from))
      }
    }
    write(module, dropEmptySections(rewriteHeader(read(module), lines, (name) => baseExports.has(name) || usedElsewhere.has(name) || (module === ENTRY && name === 'main'))))
  }
}

function importStatement(keyword, names, from) {
  const single = `${keyword} { ${names.join(', ')} } from '${from}'`
  if (single.length <= 120) return [single]
  return [`${keyword} {`, ...names.map((name) => `  ${name},`), `} from '${from}'`]
}

// Removes the section titles left without content: a title followed, after blank lines, by another
// title or by the end of the module (RD7).
function dropEmptySections(text) {
  const lines = text.split('\n')
  const kept = []
  for (let index = 0; index < lines.length; index++) {
    if (SECTION.test(lines[index])) {
      let next = index + 1
      while (next < lines.length && lines[next].trim() === '') next++
      if (next === lines.length || SECTION.test(lines[next])) {
        index = next - 1
        continue
      }
    }
    kept.push(lines[index])
  }
  return kept.join('\n').replace(/\n*$/, '\n')
}

// Replaces the import / re-export statements of the module by `statements` (after its header
// comments) and sets the `export ` keyword of each declaration as `exported` says.
function rewriteHeader(text, statements, exported) {
  const lines = text.split('\n')
  let index = 0
  const header = []
  while (index < lines.length && (lines[index].startsWith('//') && !SECTION.test(lines[index]))) header.push(lines[index++])
  const rest = []
  for (; index < lines.length; index++) {
    if (/^import\b/.test(lines[index]) || /^export (\{|\*)/.test(lines[index])) {
      const start = index
      while (index < lines.length && !/\bfrom ['"][^'"]+['"]/.test(lines[index])) index++
      if (index === lines.length) throw new Error(`instruction sans « from » : ${lines[start]}`)
      continue
    }
    const match = DECLARATION.exec(lines[index])
    if (match) {
      const bare = lines[index].replace(/^export /, '')
      rest.push(exported(match[4]) ? `export ${bare}` : bare)
    } else {
      rest.push(lines[index])
    }
  }
  while (rest.length && rest[0].trim() === '') rest.shift()
  return [...header, ...(header.length ? [''] : []), ...statements, ...(statements.length ? [''] : []), ...rest].join('\n')
}

// ---------- main

const baseExports = new Set(
  readFileSync(join(root, 'docs/chantiers/REF-29-lib-par-domaine/base-exports.txt'), 'utf8').split('\n').filter(Boolean),
)
const argumentList = process.argv.slice(2)
if (argumentList[0] !== '--relink') {
  const [target, ...rest] = argumentList
  let header = null
  const headerIndex = rest.indexOf('--header')
  if (headerIndex !== -1) header = rest.splice(headerIndex, 2)[1]
  const sectionIndex = rest.indexOf('--section')
  const section = sectionIndex === -1 ? null : rest.splice(sectionIndex, 2)[1]
  move(target, rest, header, section)
}
relink(baseExports)
