import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { template, makeRepository, atelier, atelierRun } from './helpers.mjs'

describe('process section of CLAUDE.md', () => {
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

describe('site chantier types', () => {
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

describe('vocabulary of the review', () => {
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

describe('prefixes in agents, skills and templates', () => {
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

describe('site reference pages', () => {
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

describe('calibrated review points', () => {
  const pluginText = (relativePath) => readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8')
  const reviewers = ['agents/spec-critic.md', 'agents/overfit-checker.md', 'agents/reviewer.md']
  const presenters = ['skills/sign/SKILL.md', 'skills/build/SKILL.md', 'skills/review/SKILL.md']
  const missing = (text, patterns) => patterns.filter((pattern) => !pattern.test(text)).map(String)

  for (const file of reviewers) {
    it(`${file} demande le bilan de chaque point : deux coûts, silencieux ou bruyant, verdict, question [FEAT-30 CA-1]`, () => {
      assert.deepEqual(missing(pluginText(file), [/bloquant ou à discuter/, /coût de la correction/i, /coût de la non-correction/i, /silencieux/, /bruyant/, /verdict/i, /toujours à corriger/, /point qui est une question/]), [])
    })

    it(`${file} tire l'usage réel de CLAUDE.md et du README [FEAT-30 CA-2]`, () => {
      assert.deepEqual(missing(pluginText(file), [/usage réel/, /`CLAUDE\.md`/, /`README`/, /signale-le une fois/]), [])
    })

    it(`${file} énonce la règle de proportion [FEAT-30 CA-3]`, () => {
      assert.deepEqual(missing(pluginText(file), [/option la moins chère/, /supprimer le problème bloquant/]), [])
    })

    it(`${file} distingue premier passage et relance, avec les idées sans identifiant [FEAT-30 CA-4]`, () => {
      assert.deepEqual(missing(pluginText(file), [/premier passage/, /relance/, /causé par une correction/, /n'est retenu que s'il est bloquant/, /\*\*Idées\*\*/, /sans identifiant/]), [])
    })
  }

  it('review définit la relance, transmet le commit précédent, garde les idées hors de revue.md et associe chaque issue à un traitement [FEAT-30 CA-5]', () => {
    assert.deepEqual(missing(pluginText('skills/review/SKILL.md'), [
      /\*\*relance\*\*/, /sont des premiers passages/, /commit de la revue précédente/, /liste des corrections faites depuis/, /## Revue 2 : tranche 1/, /Corrections depuis la revue 1 :/,
      /idée[^\n]*n'entre jamais dans ces tableaux/i,
      /ne pas corriger[^\n]*`exception acceptée`/, /chantier séparé → `reporté`/, /limite documentée → `corrigé`/,
    ]), [])
  })

  for (const file of ['skills/sign/SKILL.md', 'skills/build/SKILL.md']) {
    it(`${file} transmet la relance et traite une nouvelle session comme un premier passage [FEAT-30 CA-5]`, () => {
      assert.deepEqual(missing(pluginText(file), [/\*\*relance\*\*/, /points du passage précédent/, /nouvelle session est un premier passage/]), [])
    })
  }

  for (const file of presenters) {
    it(`${file} présente chaque point avec un résumé, les deux coûts, le verdict et l'avis [FEAT-30 CA-6]`, () => {
      assert.deepEqual(missing(pluginText(file), [/résumé du problème/, /deux coûts/, /verdict du relecteur/, /ton avis/]), [])
    })
  }
})

describe('calibrated review points in the documentation', () => {
  const repositoryText = (relativePath) => readFileSync(fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url)), 'utf8')
  const pages = {
    'site/cycle/revue.md': [/### Bilan de chaque point/, /coût de la non-correction/, /silencieux/, /option la moins chère/, /### Relance/, /que s’il est bloquant/, /idées/],
    'site/cycle/signature.md': [/revue#bilan-de-chaque-point/, /revue#relance/],
    'site/cycle/implementation.md': [/option la moins chère/, /revue#bilan-de-chaque-point/, /revue#relance/],
    'README.md': [/coût de la non-correction/, /option la moins chère/, /relance/],
  }

  for (const [file, patterns] of Object.entries(pages)) {
    it(`${file} décrit le bilan des points, la proportion et la relance [FEAT-30 CA-7]`, () => {
      const text = repositoryText(file)
      assert.deepEqual(patterns.filter((pattern) => !pattern.test(text)).map(String), [])
    })
  }
})

describe('EPIC with an integration branch in the skills, the agent, the template and the site', () => {
  const repositoryText = (relativePath) => readFileSync(fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url)), 'utf8')
  const pluginText = (relativePath) => repositoryText(`plugins/atelier/${relativePath}`)
  const integration = /branche d['’]intégration/

  for (const file of ['skills/review/SKILL.md', 'skills/close/SKILL.md']) {
    it(`${file} : la règle « chaque commit porte [<ID>] » compte les commits en --first-parent depuis baseBranch [FEAT-21 CA-11]`, () => {
      const rule = pluginText(file).split('\n').filter((line) => line.includes('[<ID>]') && /chaque commit/.test(line))
      assert.ok(rule.length > 0, 'règle des commits introuvable')
      assert.ok(rule.some((line) => line.includes('--first-parent') && line.includes('baseBranch')), rule.join('\n'))
    })
  }

  it('review et close lisent la base dans baseBranch ; new part de atelier base --parent ; plan parle de la branche d’intégration [FEAT-21 CA-12]', () => {
    assert.match(pluginText('skills/review/SKILL.md'), /baseBranch/)
    assert.match(pluginText('skills/close/SKILL.md'), /baseBranch/)
    assert.match(pluginText('skills/new/SKILL.md'), /atelier base --parent/)
    assert.match(pluginText('skills/plan/SKILL.md'), integration)
  })

  it('close : fusion par commit de fusion dans la branche d’intégration, revue d’ensemble, enfant correctif, fusion de la branche par défaut sans rebase [FEAT-21 CA-12]', () => {
    const close = pluginText('skills/close/SKILL.md')
    assert.deepEqual([integration, /commit de fusion/, /revue d['’]ensemble/, /enfant correctif/, /rebase/].filter((pattern) => !pattern.test(close)).map(String), [])
  })

  it('l’agent reviewer connaît la portée « revue d’ensemble » ; le template spec-epic propose integration_branch [FEAT-21 CA-12]', () => {
    assert.match(pluginText('agents/reviewer.md'), /revue d['’]ensemble/)
    assert.match(pluginText('templates/spec-epic.md'), /integration_branch/)
  })

  const pages = ['fondations/chantier.md', 'fondations/types.md', 'cycle/conception.md', 'cycle/revue.md', 'cycle/cloture.md', 'reference/commandes.md']
  it('le site décrit l’EPIC à branche d’intégration, et la commande atelier base [FEAT-21 CA-12]', () => {
    assert.deepEqual(pages.filter((page) => !integration.test(repositoryText(`site/${page}`))), [])
    assert.match(repositoryText('site/reference/commandes.md'), /atelier base --parent/)
    assert.match(repositoryText('site/cycle/revue.md'), /revue d['’]ensemble/)
  })
})
