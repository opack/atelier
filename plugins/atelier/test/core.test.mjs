import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  nextStep,
} from '../lib/core.mjs'
import {
  template,
  signedChantier, draftChantier, implementingChantier, signedTec,
  makeRepository, atelier,
  makeChantiersRepository, atelierRun, assertLine, epicPlan,
  slicedChantier, makeSlicedRepository, atelierOk, atSliceTwo,
} from './helpers.mjs'


describe('next step', () => {
  it('follows the process order', () => {
    assert.match(nextStep(null), /\/atelier:new/)
    assert.match(nextStep(draftChantier), /\/atelier:sign/)
    assert.match(nextStep(signedChantier), /\/atelier:plan/)
    assert.match(nextStep({ ...signedChantier, files: ['spec.md', 'plan.md'] }), /\/atelier:write-tests/)
    assert.match(nextStep({ ...implementingChantier, files: ['spec.md', 'plan.md'] }), /\/atelier:build.*\/atelier:review/)
    const signedFix = { ...signedChantier, spec: { data: { status: 'signed', type: 'FIX', tdd: 'yes' } } }
    assert.match(nextStep(signedFix), /\/atelier:write-tests/)
    assert.match(nextStep(signedTec), /\/atelier:build.*\/atelier:review/)
  })

  it('goes to close once the review is current, back to review when it is stale', () => {
    assert.match(nextStep(signedTec, 'current'), /\/atelier:close/)
    assert.doesNotMatch(nextStep(signedTec, 'current'), /\/atelier:review/)
    assert.match(nextStep(signedTec, 'stale'), /\/atelier:review/)
    assert.match(nextStep({ ...signedChantier, files: ['spec.md', 'plan.md'] }, 'current'), /\/atelier:write-tests/, 'tests reopened after the review')
  })

  it('takes a SPIKE from build to close, without review', () => {
    const spike = { ...signedTec, id: 'SPIKE-4', spec: { data: { status: 'signed', type: 'SPIKE', tdd: 'no' } } }
    for (const review of ['none', 'stale', 'current']) {
      assert.match(nextStep(spike, review), /\/atelier:build.*\/atelier:close/, review)
      assert.doesNotMatch(nextStep(spike, review), /\/atelier:review/, review)
    }
  })
})


// ---------- FEAT-4: relations between chantiers, EPIC type ----------


describe('FEAT-4 next step of an EPIC', () => {
  const nextStepOf = (directory) => JSON.parse(atelier(directory, 'status', '--json')).nextStep

  it('concevoir le découpage sans plan, puis les enfants ouverts et leur nombre, puis la clôture ; jamais la revue [FEAT-4 CA-10]', () => {
    const withoutPlan = makeChantiersRepository({ branches: { 'epic/EPIC-5-x': [{ id: 'EPIC-5' }] }, checkout: 'epic/EPIC-5-x' })
    const open = makeChantiersRepository({
      main: [{ id: 'EPIC-5', files: epicPlan }, { id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } }],
      branches: { 'feat/FEAT-7-x': [{ id: 'FEAT-7', relations: { rel_parent: 'EPIC-5' } }], 'epic/EPIC-5-x': [] },
      checkout: 'epic/EPIC-5-x',
    })
    const closed = makeChantiersRepository({
      main: [{ id: 'EPIC-5', files: epicPlan }, { id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } }],
      branches: { 'epic/EPIC-5-x': [] },
      checkout: 'epic/EPIC-5-x',
    })
    const steps = { withoutPlan: nextStepOf(withoutPlan), open: nextStepOf(open), closed: nextStepOf(closed) }
    assert.match(steps.withoutPlan, /\/atelier:plan/)
    assert.match(steps.open, /\b1\b/)
    assert.match(steps.open, /FEAT-7/)
    assert.doesNotMatch(steps.open, /FEAT-6/)
    assert.match(steps.closed, /\/atelier:close/)
    for (const [name, step] of Object.entries(steps)) {
      assert.doesNotMatch(step, /\/atelier:review/, name)
    }
  })

  it('tous les enfants clos sans aucun done : propose l’abandon, pas la clôture [FEAT-4 CA-10]', () => {
    const directory = makeChantiersRepository({
      main: [
        { id: 'EPIC-5', files: epicPlan },
        { id: 'FEAT-6', status: 'abandoned', relations: { rel_parent: 'EPIC-5' } },
        { id: 'FEAT-17', status: 'abandoned', relations: { rel_parent: 'EPIC-5' } },
      ],
      branches: { 'epic/EPIC-5-x': [] },
      checkout: 'epic/EPIC-5-x',
    })
    const step = nextStepOf(directory)
    assert.match(step, /set-status abandoned/)
    assert.doesNotMatch(step, /\/atelier:close/)
    assert.doesNotMatch(step, /\/atelier:review/)
  })
})

describe('FEAT-4 relations shown by status', () => {
  it('affiche parent, dépendances avec leur statut, origine, remplacement [FEAT-4 CA-11]', () => {
    const directory = makeChantiersRepository({
      main: [{ id: 'EPIC-5' }, { id: 'TEC-8' }, { id: 'TEC-10', status: 'done' }, { id: 'FEAT-3', status: 'abandoned' }],
      branches: {
        'feat/FEAT-11-x': [{
          id: 'FEAT-11',
          relations: { rel_parent: 'EPIC-5', rel_depends_on: 'TEC-8, TEC-10', rel_origin: 'BUG-421', rel_replaces: 'FEAT-3' },
        }],
      },
      checkout: 'feat/FEAT-11-x',
    })
    const text = atelier(directory, 'status')
    assertLine(text, [/^Parent :/, /EPIC-5/])
    assertLine(text, [/^Dépendances :/, /TEC-8[^,]*signed/, /TEC-10[^,]*done/])
    assertLine(text, [/^Origine :/, /BUG-421/])
    assertLine(text, [/^Remplace :/, /FEAT-3/])
    const relations = JSON.parse(atelier(directory, 'status', '--json')).chantier.relations
    assert.deepEqual(relations.dependsOn.map(({ id, status, closed }) => ({ id, status, closed })), [
      { id: 'TEC-8', status: 'signed', closed: false },
      { id: 'TEC-10', status: 'done', closed: true },
    ])
  })

  it('pour un EPIC, affiche ses enfants directs calculés avec leur statut [FEAT-4 CA-11]', () => {
    const directory = makeChantiersRepository({
      main: [
        { id: 'EPIC-5', files: epicPlan },
        { id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } },
        { id: 'EPIC-20', relations: { rel_parent: 'EPIC-5' } },
        { id: 'FEAT-22', relations: { rel_parent: 'EPIC-20' } },
      ],
      branches: { 'feat/FEAT-7-x': [{ id: 'FEAT-7', relations: { rel_parent: 'EPIC-5' } }], 'epic/EPIC-5-x': [] },
      checkout: 'epic/EPIC-5-x',
    })
    const text = atelier(directory, 'status')
    assertLine(text, [/^Enfants :/, /FEAT-6[^,]*done/, /EPIC-20[^,]*signed/, /FEAT-7/])
    assert.doesNotMatch(text, /FEAT-22/, 'enfants directs seulement')
  })

  it('le hook de démarrage affiche les enfants d’un EPIC et sa prochaine étape [FEAT-4 CA-10, CA-11]', () => {
    const directory = makeChantiersRepository({
      main: [{ id: 'EPIC-5', files: epicPlan }, { id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } }],
      branches: { 'feat/FEAT-7-x': [{ id: 'FEAT-7', relations: { rel_parent: 'EPIC-5' } }], 'epic/EPIC-5-x': [] },
      checkout: 'epic/EPIC-5-x',
    })
    const reminder = atelier(directory, 'hook-session-start')
    assertLine(reminder, [/^Enfants :/, /FEAT-6[^,]*done/, /FEAT-7/])
    assertLine(reminder, [/^Prochaine étape :/, /\b1\b/, /FEAT-7/])
    assert.doesNotMatch(reminder, /\/atelier:review/)
  })

  it('compatibilité : un chantier sans rel_* s’affiche comme avant', () => {
    const directory = makeChantiersRepository({ branches: { 'tec/TEC-8-x': [{ id: 'TEC-8' }] }, checkout: 'tec/TEC-8-x' })
    assert.doesNotMatch(atelier(directory, 'status'), /^(Parent|Dépendances|Origine|Remplace|Enfants) :/m)
  })
})

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


describe('FEAT-7 close and next step', () => {
  it('la prochaine étape préfixe le message de la phase par « Tranche N/3 : » [FEAT-7 CA-24]', () => {
    assert.match(nextStep(slicedChantier()), /^Tranche 1\/3 : .*\/atelier:write-tests/)
    assert.match(nextStep(slicedChantier({ slice: '2', slice_base: 'a'.repeat(40) })), /^Tranche 2\/3 : .*\/atelier:write-tests/)
    assert.match(nextStep(slicedChantier({ slice: '2', slice_base: 'a'.repeat(40), tests_commit: 'abc1234' })), /^Tranche 2\/3 : .*\/atelier:build.*\/atelier:review/)
  })

  it('en revue du chantier, demande la revue de l’ensemble, puis la clôture [FEAT-7 CA-24]', () => {
    const chantier = slicedChantier({ slice: 'chantier', last_slice: '3', slice_base: 'a'.repeat(40), tests_commit: 'abc1234' })
    assert.match(nextStep(chantier, 'none'), /^Revue du chantier : faire relire l.ensemble : \/atelier:review/)
    assert.match(nextStep(chantier, 'current'), /\/atelier:close/)
  })

  it('le rappel de début de session indique la tranche, et n’en parle pas pour une tranche unique [FEAT-7 CA-26]', () => {
    const { directory } = atSliceTwo()
    assert.match(atelierOk(directory, 'hook-session-start'), /Tranche 2\/3/)
    assert.doesNotMatch(atelierOk(makeSlicedRepository({ plan: null }), 'hook-session-start'), /tranche/i)
  })
})

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
