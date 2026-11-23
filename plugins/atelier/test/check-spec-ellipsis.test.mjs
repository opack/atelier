// FIX-22: checkSpec only flags an ellipsis that stands for missing text.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkSpec } from '../lib/core.mjs'

const templatesDirectory = fileURLToPath(new URL('../templates/', import.meta.url))

function readTemplate(name) {
  return readFileSync(join(templatesDirectory, `${name}.md`), 'utf8')
}

// Complete sections per type: checkSpec reports nothing on them.
const sections = {
  FIX: {
    'Problème': 'Crash au démarrage.',
    'Reproduction': 'Ouvrir l’app.',
    'Cause probable': 'Listener non nettoyé (trace Sentry).',
    'Solution proposée': 'Nettoyer le listener.',
    'Critère de non-régression': '- [ ] CA-1 : Étant donné l’app ouverte, quand on la ferme, alors le listener est retiré.',
  },
  FEAT: {
    'Contexte': 'Les utilisateurs perdent du temps.',
    'Description': 'Afficher le total.',
    "Critères d'acceptation": '- [ ] CA-1 : Étant donné un budget, quand je l’ouvre, alors je vois le total.',
    'Non-fonctionnel': 'Lecture réservée au propriétaire.',
  },
  TEC: {
    'Quoi': 'Contrôler les identifiants des points de relecture.',
    'Pourquoi': 'Les points se renumérotent.',
    'Vérification': '- CA-1 : les tests passent.',
  },
  EPIC: {
    'Vision': 'Un module de gestion client.',
    'Pourquoi': 'Les clients sont gérés à la main.',
    "Critères d'acceptation globaux": '- CA-1 : un client se crée et se contacte.',
    'Cadre': 'API REST commune.',
    'Hors périmètre': 'Facturation.',
  },
}

// A spec of `type` whose sections are complete, with `additions` appended to the named sections.
function spec(type, additions = {}) {
  const body = Object.entries(sections[type])
    .map(([title, content], index) => {
      const extra = additions[title] === undefined ? '' : `\n${additions[title]}`
      return `## ${index + 1}. ${title}\n${content}${extra}\n`
    })
    .join('\n')
  return `---\nid: ${type}-1\ntype: ${type}\ntitle: Essai\nstatus: draft\ntdd: no\n---\n\n# ${type}-1 Essai\n\n${body}`
}

// A spec whose section `title` holds `content` only.
function specWithSection(type, title, content) {
  return spec(type).replace(`${sections[type][title]}\n`, `${content}\n`)
}

const unfinished = (problems) => problems.filter((problem) => problem.includes('à compléter'))

describe('FIX-22 : « … » dans checkSpec', () => {
  it('sanity: the complete specs used below report nothing', () => {
    for (const type of Object.keys(sections)) {
      assert.deepEqual(checkSpec(spec(type)), [], type)
    }
  })

  it('CA-1 : les critères CA-17 et CA-18 de TEC-15, en code en ligne, ne sont pas signalés', () => {
    const problems = checkSpec(spec('TEC', {
      'Vérification': [
        "- CA-17 : Étant donné un titre `### Bloquants` suivi d'un tableau de points, quand on contrôle, alors le titre est signalé ; étant donné une ligne `| RB1. … |` sous un autre titre `###` d'une section (`### Contrôles`), alors la ligne est signalée.",
        '- CA-18 : Étant donné un point `RD3 … requalifié (RB4)`, quand on contrôle, alors il est accepté.',
      ].join('\n'),
    }))
    assert.deepEqual(unfinished(problems), [])
  })

  describe('CA-2 : un bloc de code délimité fermé n’est pas contrôlé', () => {
    const blocks = {
      'backticks': '```\n- AAAA-MM-JJ : …\n```',
      'backticks with a language, indented in a list': '- Exemple :\n  ```js\n  - AAAA-MM-JJ : …\n  ```',
      'tildes': '~~~\n- AAAA-MM-JJ : …\n~~~',
      'longer closing fence': '````\n- AAAA-MM-JJ : …\n``````',
    }
    for (const [name, block] of Object.entries(blocks)) {
      it(name, () => {
        assert.deepEqual(unfinished(checkSpec(spec('FIX', { 'Solution proposée': block }))), [])
      })
    }

    it('text after a closed block is still checked', () => {
      const problems = checkSpec(spec('FIX', { 'Solution proposée': '```\nx\n```\nPuis …' }))
      assert.equal(unfinished(problems).length, 1)
    })
  })

  describe('CA-3 : un « … » collé au caractère qui précède n’est pas signalé', () => {
    const texts = {
      'after a word': 'Les critères CA-1, CA-2… sont repris.',
      'after a hyphen': 'Le point RB3 (ex-…) est renommé.',
      'right after inline code': 'Les champs `title`… sont comparés.',
    }
    for (const [name, text] of Object.entries(texts)) {
      it(name, () => {
        assert.deepEqual(unfinished(checkSpec(spec('FIX', { 'Cause probable': text }))), [])
      })
    }
  })

  describe('CA-4 : la ligne de format d’un template recopiée non remplie est signalée', () => {
    // The format line as each template writes it, taken out of its HTML comment.
    function formatLine(type) {
      const match = readTemplate(`spec-${type.toLowerCase()}`).match(/CA-1 : Étant donné.*?alors ?…/)
      assert.ok(match, `format line of spec-${type.toLowerCase()}`)
      return `- [ ] ${match[0]}`
    }
    const criteriaSection = { FEAT: "Critères d'acceptation", FIX: 'Critère de non-régression', EPIC: "Critères d'acceptation globaux" }
    for (const [type, title] of Object.entries(criteriaSection)) {
      it(type, () => {
        const problems = unfinished(checkSpec(spec(type, { [title]: formatLine(type) })))
        assert.equal(problems.length, 1)
        assert.ok(problems[0].includes(title), problems[0])
        assert.ok(problems[0].includes('code en ligne'), problems[0])
      })
    }
  })

  describe('CA-5 : un « … » écrit à part, hors code, est signalé', () => {
    const texts = {
      'at the start of a line': 'Cause :\n… à préciser.',
      'after a space': 'Le crash revient quand …',
      'after a tab': 'Le crash revient quand\t…',
      'after a no-break space': 'Le crash revient quand …',
      'after a narrow no-break space': 'Le crash revient quand …',
      'alone in a table cell': '| Cas | Résultat |\n|---|---|\n| démarrage | … |',
    }
    for (const [name, text] of Object.entries(texts)) {
      it(name, () => {
        const problems = unfinished(checkSpec(spec('FIX', { 'Cause probable': text })))
        assert.equal(problems.length, 1)
        assert.ok(problems[0].includes('Cause probable'), problems[0])
      })
    }
  })

  it('CA-6 : la ligne de format du template EPIC écrit des « … » séparés, comme FEAT et FIX', () => {
    for (const name of ['spec-epic', 'spec-feat', 'spec-fix']) {
      assert.ok(readTemplate(name).includes('Étant donné …, quand …, alors …'), name)
    }
  })

  describe('CA-7 : code mal formé', () => {
    it('an unmatched backtick is text: the ellipsis after it is checked', () => {
      const problems = checkSpec(spec('FIX', { 'Cause probable': 'Un accent ` orphelin, puis …' }))
      assert.equal(unfinished(problems).length, 1)
    })

    it('a block never closed runs to the end of the section', () => {
      const problems = checkSpec(spec('FIX', { 'Cause probable': '```\n- AAAA-MM-JJ : …' }))
      assert.deepEqual(unfinished(problems), [])
    })

    it('a block never closed does not hide the next sections', () => {
      const problems = checkSpec(spec('FIX', { 'Cause probable': '```\nx', 'Solution proposée': 'Puis …' }))
      assert.equal(unfinished(problems).length, 1)
      assert.ok(unfinished(problems)[0].includes('Solution proposée'))
    })
  })

  describe('CA-8 : les contrôles « vide » et « critère numéroté » voient le code', () => {
    it('a section holding only a code block is not empty', () => {
      const problems = checkSpec(specWithSection('FIX', 'Reproduction', '```\nnpm test\n```'))
      assert.deepEqual(problems, [])
    })

    it('a criterion written in inline code counts', () => {
      const problems = checkSpec(specWithSection('FIX', 'Critère de non-régression', '- `CA-1` : le listener est retiré.'))
      assert.deepEqual(problems, [])
    })
  })
})
