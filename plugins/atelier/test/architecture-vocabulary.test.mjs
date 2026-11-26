import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { escapeRegExp } from '../lib/common.mjs'
import { VOCABULARY } from '../lib/vocabulary.mjs'

// Vocabulary rule of lib/ (REF-34): the French terms of the documents live in lib/vocabulary.mjs only.
// The rule is a plain function of a source text, so that each position can be shown failing on a
// fabricated example. The small reader below tells comments, strings, template parts, regular
// expression literals and code apart; it is not a full JS parser.

const libDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib')
const COMMON_WORDS = new Set(['Description', 'Point', 'Fichier', 'Question', 'Budget', 'Cadre', 'Quoi', 'Pourquoi'])
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await'])
const WORD = /[\p{L}\p{N}_$]/u
const SPACE = '[\\s\\u00a0\\u202f]*'

// source → tokens { type: 'comment' | 'string' | 'template' | 'regex' | 'code', text }. `template` is a
// static part of a template literal; the code of its ${…} expressions is read like any other code.
function readSource(source) {
  const tokens = []
  let i = 0
  let previous = null // last significant token: { kind: 'word' | 'punct' | 'value', text }
  const push = (type, text) => tokens.push({ type, text })
  const readQuoted = (quote) => {
    const start = ++i
    while (i < source.length && source[i] !== quote && source[i] !== '\n') i += source[i] === '\\' ? 2 : 1
    push('string', source.slice(start, i))
    i++
    previous = { kind: 'value' }
  }
  const readTemplate = () => {
    let start = ++i
    while (i < source.length && source[i] !== '`') {
      if (source[i] === '\\') i += 2
      else if (source[i] === '$' && source[i + 1] === '{') {
        push('template', source.slice(start, i))
        i += 2
        previous = { kind: 'punct', text: '{' }
        readCode(true)
        start = i
      } else i++
    }
    push('template', source.slice(start, i))
    i++
    previous = { kind: 'value' }
  }
  const readRegex = () => {
    const start = ++i
    let inClass = false
    while (i < source.length && source[i] !== '\n' && (inClass || source[i] !== '/')) {
      if (source[i] === '\\') i++
      else if (source[i] === '[') inClass = true
      else if (source[i] === ']') inClass = false
      i++
    }
    push('regex', source.slice(start, i))
    i++
    while (i < source.length && WORD.test(source[i])) i++ // flags
    previous = { kind: 'value' }
  }
  const regexAllowed = () => !previous || (previous.kind === 'punct' && !')]}'.includes(previous.text))
    || (previous.kind === 'word' && REGEX_KEYWORDS.has(previous.text))
  // Reads code up to the end of the source or, inside a template expression, up to its closing brace.
  function readCode(inTemplate) {
    let depth = 0
    while (i < source.length) {
      const char = source[i]
      if (char === '/' && source[i + 1] === '/') {
        const start = i
        while (i < source.length && source[i] !== '\n') i++
        push('comment', source.slice(start, i))
      } else if (char === '/' && source[i + 1] === '*') {
        const start = i
        const end = source.indexOf('*/', i + 2)
        i = end === -1 ? source.length : end + 2
        push('comment', source.slice(start, i))
      } else if (char === "'" || char === '"') readQuoted(char)
      else if (char === '`') readTemplate()
      else if (char === '/' && regexAllowed()) readRegex()
      else if (WORD.test(char)) {
        const start = i
        while (i < source.length && WORD.test(source[i])) i++
        const text = source.slice(start, i)
        push('code', text)
        previous = { kind: /^\d/.test(text) ? 'value' : 'word', text }
      } else {
        if (char === '{') depth++
        if (char === '}') {
          if (inTemplate && depth === 0) {
            i++
            return
          }
          depth--
        }
        if (!/\s/.test(char)) previous = { kind: 'punct', text: char }
        push('code', char)
        i++
      }
    }
  }
  readCode(false)
  return tokens
}

// VOCABULARY → every string value, except the `criteria` values (they are keys, not terms).
function vocabularyTerms(vocabulary = VOCABULARY) {
  const terms = new Set()
  const walk = (value, key) => {
    if (key === 'criteria') return
    if (typeof value === 'string') terms.add(value)
    else if (value && typeof value === 'object') for (const [childKey, child] of Object.entries(value)) walk(child, childKey)
  }
  walk(vocabulary, '')
  return [...terms]
}

// Whole term: word boundaries only where the term starts or ends with a word character ("ex-").
function termPattern(term, prefix = '', suffix = '', flags = 'u') {
  const before = WORD.test(term[0]) ? '(?<![\\p{L}\\p{N}_])' : ''
  const after = WORD.test(term.at(-1)) ? '(?![\\p{L}\\p{N}_])' : ''
  return new RegExp(`${prefix}${before}${escapeRegExp(term)}${after}${suffix}`, flags)
}

// source → problems: a term of the vocabulary written in grammar position outside lib/vocabulary.mjs.
function vocabularyProblems(source, terms = vocabularyTerms()) {
  const problems = []
  for (const { type, text } of readSource(source)) {
    if (type === 'string' || type === 'template') {
      const content = text.replace(/\\(['"`\\])/g, '$1')
      const lines = content.replace(/\\n/g, '\n') // `\n` written in the source counts as a line break
      for (const term of terms) {
        if (content === term && !COMMON_WORDS.has(term)) problems.push(`« ${term} » est le contenu entier d'une chaîne`)
        else if (termPattern(term, '(?:^|\\n)#{2,3} ').test(lines)) problems.push(`« ${term} » est un titre dans une chaîne`)
        else if (termPattern(term, `«${SPACE}(?:#{2,3} )?`, `${SPACE}»`).test(content)) problems.push(`« ${term} » est cité entre « » dans une chaîne`)
      }
    } else if (type === 'regex') {
      const plain = text.replace(/\\[A-Za-z\\]/g, ' ') // escape pairs (\b, \s, \n, \\…) are not letters of a term
      for (const term of terms) if (termPattern(term).test(plain)) problems.push(`« ${term} » figure dans l'expression régulière /${text}/`)
    }
  }
  return problems
}

// vocabulary.mjs text → problems: the module must import nothing.
function vocabularyImportProblems(source) {
  const code = readSource(source).filter(({ type }) => type === 'code').map(({ text }) => text).join(' ')
  return /(?<![\w$])import(?![\w$])(?!\s*\.\s*meta)|(?<![\w$])export\s*(?:\*(?:\s*as\s*[\w$]+)?|\{[^}]*\})\s*from(?![\w$])/.test(code) ? ['lib/vocabulary.mjs importe un module'] : []
}

function mjsFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return mjsFiles(path)
    return entry.name.endsWith('.mjs') ? [path] : []
  })
}

const terms = vocabularyTerms()
const flagged = (source) => vocabularyProblems(source, terms)

describe('vocabulaire des documents dans lib/', () => {
  it('lit les commentaires, chaînes, gabarits et expressions régulières [REF-34 CA-2]', () => {
    const tokens = readSource("const a = 'x' // c1\n/* c2 */ const b = `p${ \"in\" + `q${1}` }r` ; const c = /[/]'/g; const d = 6 / 2 / 1; return /e/")
    const of = (type) => tokens.filter((token) => token.type === type).map(({ text }) => text)
    assert.deepEqual(of('comment'), ['// c1', '/* c2 */'])
    assert.deepEqual(of('string'), ['x', 'in'])
    assert.deepEqual(of('template'), ['p', 'q', '', 'r'])
    assert.deepEqual(of('regex'), ["[/]'", 'e'])
  })

  it('calcule la liste des termes depuis VOCABULARY, sans les clés de criteria [REF-34 CA-2]', () => {
    const list = vocabularyTerms({ a: 'Un', criteria: { FEAT: 'cleSeule' }, b: { c: 'Deux' } })
    assert.deepEqual(list, ['Un', 'Deux'])
    assert.ok(vocabularyTerms().includes('Amendements'))
    assert.ok(!vocabularyTerms().includes('acceptanceCriteria'))
  })

  it('signale un terme qui est le contenu entier d\'une chaîne [REF-34 CA-2]', () => {
    assert.equal(flagged("const a = 'Amendements'").length, 1)
    assert.equal(flagged('const a = "Critères d\'acceptation"').length, 1)
    assert.equal(flagged("const a = 'Pourquoi maintenant'").length, 1)
  })

  it('signale un terme qui est la partie statique d\'un gabarit [REF-34 CA-2]', () => {
    assert.equal(flagged('const a = `Amendements`').length, 1)
    assert.equal(flagged('const a = `${x}${`Tranches`}`').length, 1)
  })

  it('signale un terme dans une expression régulière [REF-34 CA-2]', () => {
    assert.equal(flagged('const a = /^## Amendements$/m').length, 1)
    assert.equal(flagged('const a = text.match(/(?:reporté|écarté)/)').length, 2)
    assert.equal(flagged('return /Tranches/.test(x)').length, 1)
    assert.equal(flagged('const a = /\\bTranches\\b/').length, 1)
    assert.equal(flagged('const a = /^##\\sAmendements$/m').length, 1)
    assert.equal(flagged('const a = /\\nAmendements/').length, 1)
    assert.equal(flagged('const a = /\\\\Tranches/').length, 1)
    assert.equal(flagged('const a = `${b} ${/Tranches/.test(x)}`').length, 1)
  })

  it('signale un terme cité entre « » dans une chaîne ou un gabarit [REF-34 CA-2]', () => {
    assert.equal(flagged("const a = 'la section « Amendements » manque'").length, 1)
    assert.equal(flagged('const a = `la section « Amendements » de ${x}`').length, 1)
    assert.equal(flagged("const a = 'la section « ## Amendements » manque'").length, 1)
    assert.equal(flagged("const a = 'la section « ### Tranches » manque'").length, 1)
  })

  it('signale un terme en titre « ## » ou « ### » dans une chaîne ou un gabarit [REF-34 CA-2]', () => {
    assert.equal(flagged('const a = `${x}\n\n## Amendements\n`').length, 1)
    assert.equal(flagged("const a = `${x}\\n\\n## Amendements\\n`").length, 1)
    assert.equal(flagged("const a = '## Tranches'").length, 1)
    assert.equal(flagged("const a = 'x\\n### Tranches'").length, 1)
    assert.deepEqual(flagged("const a = '## Tranchesx et # Tranches'"), [])
  })

  it('ne signale ni les mots d\'une phrase, ni les mots courants entiers, ni les commentaires [REF-34 CA-2]', () => {
    assert.deepEqual(flagged("const a = 'reporté à une tranche'"), [])
    assert.deepEqual(flagged("const a = 'Aucun tour en retard'"), [])
    assert.deepEqual(flagged("const a = 'Description'"), [])
    assert.deepEqual(flagged("const a = 'Point'"), [])
    assert.deepEqual(flagged("// 'Amendements' et /Tranches/ et « Amendements »\nconst a = 1"), [])
    assert.deepEqual(flagged("/* const a = 'Amendements' */ const b = 1"), [])
    assert.deepEqual(flagged('const a = 6 / 2 + x / Amendements'), [])
  })

  it('échoue si lib/vocabulary.mjs importe un module [REF-34 CA-2]', () => {
    assert.equal(vocabularyImportProblems("import { x } from './common.mjs'\nexport const A = 1").length, 1)
    assert.equal(vocabularyImportProblems("export { x } from './common.mjs'").length, 1)
    assert.equal(vocabularyImportProblems("export * as ns from './common.mjs'").length, 1)
    assert.deepEqual(vocabularyImportProblems('const a = import.meta.url'), [])
    assert.equal(vocabularyImportProblems("const a = await import('./x.mjs')").length, 1)
    assert.deepEqual(vocabularyImportProblems("// import x\nexport const A = 'import'"), [])
  })

  it('ne trouve aucun terme du vocabulaire en position de grammaire dans lib/ et lib/cli/ [REF-34 CA-2]', () => {
    const problems = mjsFiles(libDirectory)
      .filter((path) => relative(libDirectory, path).split(sep).join('/') !== 'vocabulary.mjs')
      .flatMap((path) => flagged(readFileSync(path, 'utf8')).map((problem) => `${relative(libDirectory, path)} : ${problem}`))
    assert.deepEqual(problems, [])
    assert.deepEqual(vocabularyImportProblems(readFileSync(join(libDirectory, 'vocabulary.mjs'), 'utf8')), [])
  })
})
