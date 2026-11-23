import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  template,
  makeRepository, atelier,
  atelierRun,
} from './helpers.mjs'


// ---------- FEAT-4: relations between chantiers, EPIC type ----------


describe('FEAT-4 process section of CLAUDE.md', () => {
  const processLines = () => template('process').split(/\r?\n/).filter((line) => line.trim())

  it('le template de la section Process existe et parle de l’EPIC et des relations [FEAT-4 CA-12]', () => {
    assert.ok(processLines().includes('## Process (atelier)'))
    assert.ok(processLines().some((line) => /EPIC/.test(line) && /rel_/.test(line)))
  })

  it('liste toutes les lignes quand la section est absente [FEAT-4 CA-12]', () => {
    const directory = makeRepository('main')
    writeFileSync(join(directory, 'CLAUDE.md'), '# Projet\n\nRien sur le process.\n')
    const { status, output } = atelierRun(directory, 'check-process')
    assert.equal(status, 2)
    for (const line of processLines()) {
      assert.ok(output.includes(line.trim()), line)
    }
  })

  it('liste seulement les lignes manquantes ; rien quand tout y est, ajouts du projet compris [FEAT-4 CA-12]', () => {
    const directory = makeRepository('main')
    const lines = processLines()
    const [, missing] = lines.filter((line) => line.startsWith('- '))
    const complete = `# Projet\n\n${lines.join('\n')}\n- Règle propre au projet.\n\n## Autre\nTexte.\n`
    writeFileSync(join(directory, 'CLAUDE.md'), complete)
    const ok = atelierRun(directory, 'check-process')
    assert.equal(ok.status, 0, ok.output)
    writeFileSync(join(directory, 'CLAUDE.md'), complete.replace(`${missing}\n`, ''))
    const partial = atelierRun(directory, 'check-process')
    assert.equal(partial.status, 2)
    assert.ok(partial.output.includes(missing.trim()))
    for (const line of lines.filter((candidate) => candidate !== missing)) {
      assert.ok(!partial.output.includes(line.trim()), `présente, non signalée : ${line}`)
    }
  })

  it('la ligne des chantiers est attendue avec le chantiersDir du projet, sans / final [FEAT-4 CA-12]', () => {
    const directory = makeRepository('main')
    writeFileSync(join(directory, '.claude', 'atelier.json'), JSON.stringify({ chantiersDir: 'work/chantiers/' }))
    const lines = processLines()
    const chantiersLine = lines.find((line) => line.includes('docs/chantiers/'))
    assert.ok(chantiersLine, 'le template nomme docs/chantiers/')
    const adapted = lines.map((line) => line.replaceAll('docs/chantiers/', 'work/chantiers/'))
    writeFileSync(join(directory, 'CLAUDE.md'), `# Projet\n\n${adapted.join('\n')}\n`)
    const ok = atelierRun(directory, 'check-process')
    assert.equal(ok.status, 0, ok.output)
    writeFileSync(join(directory, 'CLAUDE.md'), `# Projet\n\n${lines.join('\n')}\n`)
    const stale = atelierRun(directory, 'check-process')
    assert.equal(stale.status, 2)
    assert.ok(stale.output.includes(chantiersLine.replaceAll('docs/chantiers/', 'work/chantiers/').trim()), stale.output)
  })
})

describe('FEAT-4 site', () => {
  const site = (relativePath) => readFileSync(fileURLToPath(new URL(`../../../site/${relativePath}`, import.meta.url)), 'utf8')

  // The build itself (`npm run build` in site/) is checked by hand at review: it needs the site's
  // dependencies and takes too long for the test suite.
  it('six types dont l’EPIC ; templates spec-epic et plan-epic inclus [FEAT-4 CA-13]', () => {
    const types = site('fondations/types.md')
    assert.match(types, /Six types/)
    assert.match(types, /^## EPIC/m)
    const templates = site('reference/templates.md')
    assert.match(templates, /@include: [^\n]*templates\/spec-epic\.md/)
    assert.match(templates, /@include: [^\n]*templates\/plan-epic\.md/)
  })
})

// ---------- FEAT-7: tests, build and review cycle per slice ----------


describe('FEAT-7 vocabulary of the review', () => {
  const repositoryPath = (relativePath) => fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url))
  const reviewRound = /\btours? de revue\b|\btour \d+\b|\bà chaque tour\b/i

  it('plus de « tour » au sens d’un passage de revue dans les skills, l’agent, les templates, le site et le README [FEAT-7 CA-27]', () => {
    const siteFiles = readdirSync(repositoryPath('site'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !['node_modules', 'public'].includes(entry.name))
      .flatMap((entry) => readdirSync(repositoryPath(`site/${entry.name}`)).filter((name) => name.endsWith('.md')).map((name) => `site/${entry.name}/${name}`))
    const files = [
      'plugins/atelier/skills/review/SKILL.md',
      'plugins/atelier/skills/close/SKILL.md',
      'plugins/atelier/agents/reviewer.md',
      'plugins/atelier/templates/revue.md',
      'plugins/atelier/templates/bilan.md',
      'README.md',
      ...siteFiles,
    ]
    const offenders = files.filter((file) => reviewRound.test(readFileSync(repositoryPath(file), 'utf8')))
    assert.deepEqual(offenders, [])
  })
})

describe('TEC-15 prefixes in agents, skills and templates', () => {
  const pluginText = (relativePath) => readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8')
  const mentions = (text, prefix) => new RegExp(`\\b${prefix}(\\d+)?\\b`).test(text)
  const expectedPrefixes = {
    'agents/reviewer.md': ['RB', 'RD'],
    'agents/spec-critic.md': ['SB', 'SD'],
    'agents/overfit-checker.md': ['OB', 'OD'],
    'skills/review/SKILL.md': ['RB', 'RD'],
    'skills/sign/SKILL.md': ['SB', 'SD'],
    'skills/build/SKILL.md': ['OB', 'OD'],
    'skills/close/SKILL.md': ['RB', 'RD'],
    'templates/revue.md': ['RB', 'RD'],
    'templates/bilan.md': ['RB', 'RD'],
  }

  for (const [file, prefixes] of Object.entries(expectedPrefixes)) {
    it(`${file} mentionne ${prefixes.join(' et ')} [TEC-15 CA-11]`, () => {
      const text = pluginText(file)
      assert.deepEqual(prefixes.filter((prefix) => !mentions(text, prefix)), [])
    })
  }

  it('la skill amend cite un identifiant de point de relecture [TEC-15 CA-11]', () => {
    assert.ok(['RB', 'RD', 'SB', 'SD', 'OB', 'OD'].some((prefix) => mentions(pluginText('skills/amend/SKILL.md'), prefix)))
  })

  for (const file of ['skills/review/SKILL.md', 'skills/sign/SKILL.md', 'skills/build/SKILL.md']) {
    it(`${file} obtient les numéros par atelier review-ids [TEC-15 CA-11]`, () => {
      assert.match(pluginText(file), /atelier review-ids/)
    })
  }

  for (const file of ['templates/revue.md', 'agents/reviewer.md', 'skills/review/SKILL.md']) {
    it(`${file} donne la forme (repris), (ex-…) et les traitements reporté et requalifié [TEC-15 CA-11]`, () => {
      const text = pluginText(file)
      assert.match(text, /\(repris\)/)
      assert.match(text, /\(ex-R[BD]\d+\)/)
      assert.match(text, /reporté/i)
      assert.match(text, /requalifié/i)
    })
  }
})

describe('TEC-15 site reference pages', () => {
  const site = (relativePath) => readFileSync(fileURLToPath(new URL(`../../../site/${relativePath}`, import.meta.url)), 'utf8')
  // The table row whose first cell starts with `start` (a command or a glossary term).
  const row = (text, start) => text.split(/\r?\n/).find((line) => line.startsWith(`| ${start}`)) ?? ''

  it('la page des commandes documente review-ids et le refus de set-reviewed et close-check sur un point ouvert [TEC-15 CA-19]', () => {
    const commands = site('reference/commandes.md')
    const reviewIds = row(commands, '`atelier review-ids')
    for (const prefix of ['RB', 'RD', 'SB', 'SD', 'OB', 'OD']) {
      assert.match(reviewIds, new RegExp(`\\b${prefix}\\d*\\b`), `${prefix} absent de la ligne review-ids`)
    }
    assert.match(reviewIds, /ouverts?/)
    assert.match(row(commands, '`atelier set-reviewed`'), /points?[^|]*(ouverts?|sans traitement)/i)
    assert.match(row(commands, '`atelier close-check`'), /points?[^|]*(ouverts?|sans traitement)/i)
  })

  it('le glossaire définit le point de relecture, ses six préfixes et le traitement [TEC-15 CA-19]', () => {
    const glossary = site('reference/glossaire.md')
    const point = row(glossary, '**Point de relecture**')
    for (const prefix of ['RB', 'RD', 'SB', 'SD', 'OB', 'OD']) {
      assert.match(point, new RegExp(`\\b${prefix}\\d*\\b`), `${prefix} absent de la définition du point de relecture`)
    }
    const treatment = row(glossary, '**Traitement**')
    for (const keyword of ['corrigé', 'écarté', 'reporté', 'requalifié']) {
      assert.match(treatment, new RegExp(keyword), `${keyword} absent de la définition du traitement`)
    }
  })
})
