// FIX-22: checkSpec only flags an ellipsis that stands for missing text.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkSpec } from '../lib/spec.mjs'

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

describe('« … » dans checkSpec', () => {
  it('sanity: the complete specs used below report nothing', () => {
    for (const type of Object.keys(sections)) {
      assert.deepEqual(checkSpec(spec(type)), [], type)
    }
  })

  it('les critères de TEC-15 en code en ligne ne sont pas signalés [FIX-22 CA-1]', () => {
    const problems = checkSpec(spec('TEC', {
      'Vérification': [
        "- CA-17 : Étant donné un titre `### Bloquants` suivi d'un tableau de points, quand on contrôle, alors le titre est signalé ; étant donné une ligne `| RB1. … |` sous un autre titre `###` d'une section (`### Contrôles`), alors la ligne est signalée.",
        '- CA-18 : Étant donné un point `RD3 … requalifié (RB4)`, quand on contrôle, alors il est accepté.',
      ].join('\n'),
    }))
    assert.deepEqual(unfinished(problems), [])
  })

  describe('un bloc de code délimité fermé n’est pas contrôlé', () => {
    const blocks = {
      'backticks': '```\n- AAAA-MM-JJ : …\n```',
      'backticks with a language, indented in a list': '- Exemple :\n  ```js\n  - AAAA-MM-JJ : …\n  ```',
      'tildes': '~~~\n- AAAA-MM-JJ : …\n~~~',
      'longer closing fence': '````\n- AAAA-MM-JJ : …\n``````',
    }
    for (const [name, block] of Object.entries(blocks)) {
      it(`${name} [FIX-22 CA-2]`, () => {
        assert.deepEqual(unfinished(checkSpec(spec('FIX', { 'Solution proposée': block }))), [])
      })
    }

    it('text after a closed block is still checked [FIX-22 CA-2]', () => {
      const problems = checkSpec(spec('FIX', { 'Solution proposée': '```\nx\n```\nPuis …' }))
      assert.equal(unfinished(problems).length, 1)
    })
  })

  describe('un « … » collé au caractère qui précède n’est pas signalé', () => {
    const texts = {
      'after a word': 'Les critères CA-1, CA-2… sont repris.',
      'after a hyphen': 'Le point RB3 (ex-…) est renommé.',
      'right after inline code': 'Les champs `title`… sont comparés.',
    }
    for (const [name, text] of Object.entries(texts)) {
      it(`${name} [FIX-22 CA-3]`, () => {
        assert.deepEqual(unfinished(checkSpec(spec('FIX', { 'Cause probable': text }))), [])
      })
    }
  })

  describe('la ligne de format d’un template recopiée non remplie est signalée', () => {
    // The format line as each template writes it, taken out of its HTML comment.
    function formatLine(type) {
      const match = readTemplate(`spec-${type.toLowerCase()}`).match(/CA-1 : Étant donné.*?alors ?…/)
      assert.ok(match, `format line of spec-${type.toLowerCase()}`)
      return `- [ ] ${match[0]}`
    }
    const criteriaSection = { FEAT: "Critères d'acceptation", FIX: 'Critère de non-régression', EPIC: "Critères d'acceptation globaux" }
    for (const [type, title] of Object.entries(criteriaSection)) {
      it(`${type} [FIX-22 CA-4]`, () => {
        const problems = unfinished(checkSpec(spec(type, { [title]: formatLine(type) })))
        assert.equal(problems.length, 1)
        assert.ok(problems[0].includes(title), problems[0])
        assert.ok(problems[0].includes('code en ligne'), problems[0])
      })
    }
  })

  describe('un « … » écrit à part, hors code, est signalé', () => {
    const texts = {
      'at the start of a line': 'Cause :\n… à préciser.',
      'after a space': 'Le crash revient quand …',
      'after a tab': 'Le crash revient quand\t…',
      'after a no-break space': 'Le crash revient quand …',
      'after a narrow no-break space': 'Le crash revient quand …',
      'alone in a table cell': '| Cas | Résultat |\n|---|---|\n| démarrage | … |',
    }
    for (const [name, text] of Object.entries(texts)) {
      it(`${name} [FIX-22 CA-5]`, () => {
        const problems = unfinished(checkSpec(spec('FIX', { 'Cause probable': text })))
        assert.equal(problems.length, 1)
        assert.ok(problems[0].includes('Cause probable'), problems[0])
      })
    }
  })

  it('la ligne de format du template EPIC écrit des « … » séparés, comme FEAT et FIX [FIX-22 CA-6]', () => {
    for (const name of ['spec-epic', 'spec-feat', 'spec-fix']) {
      assert.ok(readTemplate(name).includes('Étant donné …, quand …, alors …'), name)
    }
  })

  describe('code mal formé', () => {
    it('an unmatched backtick is text: the ellipsis after it is checked [FIX-22 CA-7]', () => {
      const problems = checkSpec(spec('FIX', { 'Cause probable': 'Un accent ` orphelin, puis …' }))
      assert.equal(unfinished(problems).length, 1)
    })

    it('a block never closed runs to the end of the section [FIX-22 CA-7]', () => {
      const problems = checkSpec(spec('FIX', { 'Cause probable': '```\n- AAAA-MM-JJ : …' }))
      assert.deepEqual(unfinished(problems), [])
    })

    it('a block never closed does not hide the next sections [FIX-22 CA-7]', () => {
      const problems = checkSpec(spec('FIX', { 'Cause probable': '```\nx', 'Solution proposée': 'Puis …' }))
      assert.equal(unfinished(problems).length, 1)
      assert.ok(unfinished(problems)[0].includes('Solution proposée'))
    })
  })

  describe('les contrôles « vide » et « critère numéroté » voient le code', () => {
    it('a section holding only a code block is not empty [FIX-22 CA-8]', () => {
      const problems = checkSpec(specWithSection('FIX', 'Reproduction', '```\nnpm test\n```'))
      assert.deepEqual(problems, [])
    })

    it('a criterion written in inline code counts [FIX-22 CA-8]', () => {
      const problems = checkSpec(specWithSection('FIX', 'Critère de non-régression', '- `CA-1` : le listener est retiré.'))
      assert.deepEqual(problems, [])
    })
  })

  it('le message est exactement celui de la spec [FIX-22 CA-4]', () => {
    const problems = unfinished(checkSpec(spec('FIX', { 'Cause probable': 'Le crash revient quand …' })))
    assert.deepEqual(problems, ["Section « Cause probable » : texte à compléter (« … » isolé). S'il est voulu, mets-le en code en ligne."])
  })

  describe('la recherche porte sur le texte écrit, pas sur le contenu sans puces', () => {
    const glued = {
      'glued to a bullet': '-… suite',
      'glued to a number': '1.… suite',
      'in italics': 'Un *…* suite',
      'right after an HTML comment': 'Texte <!-- note -->… suite',
    }
    for (const [name, text] of Object.entries(glued)) {
      it(`not flagged: ${name} [FIX-22 CA-10]`, () => {
        assert.deepEqual(unfinished(checkSpec(spec('FIX', { 'Cause probable': text }))), [])
      })
    }
    const apart = { 'after a bullet and a space': '- … suite', 'after a number and a space': '1. … suite' }
    for (const [name, text] of Object.entries(apart)) {
      it(`flagged: ${name} [FIX-22 CA-10]`, () => {
        assert.equal(unfinished(checkSpec(spec('FIX', { 'Cause probable': text }))).length, 1)
      })
    }
  })

  describe('clôture et ouverture des blocs', () => {
    const stillOpen = {
      'a fence with a language does not close': '```\n```js\n- A : …\n```',
      'tildes do not close a backtick block': '```\n~~~\n- A : …\n```',
      'a shorter fence does not close': '````\n```\n- A : …\n````',
    }
    for (const [name, text] of Object.entries(stillOpen)) {
      it(`${name} [FIX-22 CA-11]`, () => {
        assert.deepEqual(unfinished(checkSpec(spec('FIX', { 'Cause probable': text }))), [])
      })
    }
    const prefixed = {
      'after a bullet': '- ```\n  - A : …\n  ```',
      'after a checkbox': '- [ ] ```\n  - A : …\n  ```',
      'in a quote': '> ```\n> - A : …\n> ```',
    }
    for (const [name, text] of Object.entries(prefixed)) {
      it(`opened ${name} [FIX-22 CA-11]`, () => {
        assert.deepEqual(unfinished(checkSpec(spec('FIX', { 'Cause probable': text }))), [])
      })
    }
  })

  describe('code en ligne à plusieurs accents graves, barre de tableau', () => {
    it('a double-backtick span holding a backtick, glued ellipsis: not flagged [FIX-22 CA-12]', () => {
      assert.deepEqual(unfinished(checkSpec(spec('FIX', { 'Cause probable': 'Le motif ``a`b``… est lu.' }))), [])
    })

    it('two backticks closed by one is not a span: the ellipsis after a space is flagged [FIX-22 CA-12]', () => {
      assert.equal(unfinished(checkSpec(spec('FIX', { 'Cause probable': 'Le motif ``a` … est lu.' }))).length, 1)
    })

    it('an ellipsis glued to a table bar is flagged [FIX-22 CA-12]', () => {
      assert.equal(unfinished(checkSpec(spec('FIX', { 'Cause probable': '| Cas | Résultat |\n|---|---|\n| démarrage |…|' }))).length, 1)
    })
  })

  it('une ligne « - ``` » dans un bloc ouvert ne le ferme pas [FIX-22 CA-11]', () => {
    const problems = checkSpec(spec('FIX', { 'Cause probable': '```md\n- ```\n- A : …\n```' }))
    assert.deepEqual(unfinished(problems), [])
  })
})
