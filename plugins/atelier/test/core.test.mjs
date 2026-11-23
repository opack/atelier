import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path, { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_CONFIG,
  closeProblems,
  nextStep,
  reviewCodeFiles,
} from '../lib/core.mjs'
import * as core from '../lib/core.mjs'
import {
  template,
  signedChantier, draftChantier, implementingChantier, signedTec,
  git, commit, makeRepository, atelier,
  completeBodies, chantierDirectoryOf, writeChantier, makeChantiersRepository, atelierRun, specData, assertLine, epicPlan,
  planOf, threeSlices, slicedChantier, makeSlicedRepository, commitFiles, headOf, setHeader, specFileText, atelierOk, atSliceTwo, implementedSlice,
  revueOf,
} from './helpers.mjs'


describe('close decision', () => {
  const reviewed = { reviewedCommit: 'a'.repeat(40), found: true, isAncestor: true, codeFilesSince: [], amendmentsChanged: false }
  const nominal = { chantier: signedTec, reviewFacts: reviewed, uncommittedCode: [], checksFailure: null }
  const spike = { ...signedTec, id: 'SPIKE-4', spec: { data: { status: 'signed', type: 'SPIKE', tdd: 'no' } } }
  const refused = (overrides, message, label = JSON.stringify(overrides)) => {
    const problems = closeProblems({ ...nominal, ...overrides })
    assert.ok(problems.length, label)
    assert.match(problems.join('\n'), message, label)
  }
  const since = (files) => ({ reviewFacts: { ...reviewed, codeFilesSince: reviewCodeFiles(files, DEFAULT_CONFIG) } })

  it('accepts a current review, with documentation committed after it', () => {
    assert.deepEqual(closeProblems(nominal), [])
    assert.deepEqual(closeProblems({ ...nominal, ...since(['docs/chantiers/TEC-3-x/bilan.md', 'README.md']) }), [])
  })

  it('refuses without review, or after code or tests committed since the review', () => {
    refused({ reviewFacts: { reviewedCommit: null } }, /Aucune revue/)
    refused(since(['src/a.ts']), /src\/a\.ts/)
    refused(since(['src/a.test.ts']), /a\.test\.ts/)
    refused(since(['src/merged.ts']), /merged\.ts/, 'conflict resolved in a merge: listed by git log --diff-merges=first-parent')
    refused(since(['src/old.ts', 'docs/old.ts']), /src\/old\.ts/, 'renamed to a free path: listed as delete plus add (--no-renames)')
    refused(since(['.claude/atelier.json']), /\.claude\/atelier\.json/)
  })

  it('refuses a stale review: rebase, lost commit, amendment', () => {
    refused({ reviewFacts: { ...reviewed, isAncestor: false } }, /ancêtre/)
    refused({ reviewFacts: { ...reviewed, found: false } }, /introuvable/)
    refused({ reviewFacts: { ...reviewed, amendmentsChanged: true } }, /amendée/)
  })

  it('refuses uncommitted code, red checks, tests not frozen, an unsigned spec', () => {
    refused({ uncommittedCode: ['src/a.ts'] }, /pas commité/)
    refused({ uncommittedError: 'fatal: not a git repository' }, /non commités \(fatal: not a git repository\)/)
    refused({ checksFailure: { check: { name: 'tests', command: 'npm test' } } }, /« tests » échoue/)
    refused({ chantier: signedChantier, reviewFacts: reviewed }, /pas figés/)
    refused({ chantier: draftChantier }, /pas signée/)
  })

  it('lets a SPIKE close without review, or after changes since its review, other checks still applied', () => {
    assert.deepEqual(closeProblems({ ...nominal, chantier: spike, reviewFacts: { reviewedCommit: null } }), [])
    assert.deepEqual(closeProblems({ ...nominal, chantier: spike, reviewFacts: { ...reviewed, isAncestor: false, codeFilesSince: ['src/a.ts'], amendmentsChanged: true } }), [])
    refused({ chantier: spike, reviewFacts: { reviewedCommit: null }, uncommittedCode: ['src/a.ts'] }, /pas commité/)
  })
})

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


describe('FEAT-4 dependencies checked at close', () => {
  it('refuse la clôture tant qu’une dépendance n’est pas done dans l’arbre courant, en la nommant avec son statut [FEAT-4 CA-3]', () => {
    const directory = makeChantiersRepository({
      main: [{ id: 'TEC-8' }, { id: 'TEC-12', status: 'abandoned' }],
      branches: {
        'tec/TEC-9-y': [{ id: 'TEC-9', status: 'done' }],
        'spike/SPIKE-13-x': [{ id: 'SPIKE-13', relations: { rel_depends_on: 'TEC-8, TEC-12, TEC-9' } }],
      },
      checkout: 'spike/SPIKE-13-x',
    })
    const { status, output } = atelierRun(directory, 'set-status', 'done')
    assert.notEqual(status, 0)
    assertLine(output, [/TEC-8/, /signed/])
    assertLine(output, [/TEC-12/, /abandoned/])
    assertLine(output, [/TEC-9/, /fusionn/], 'clos seulement sur une branche non fusionnée : inviter à fusionner')
    assert.equal(specData(directory, 'SPIKE-13').status, 'signed')
  })

  it('laisse clore quand toutes les dépendances sont done dans l’arbre courant [FEAT-4 CA-4]', () => {
    const directory = makeChantiersRepository({
      main: [{ id: 'TEC-10', status: 'done' }],
      branches: { 'spike/SPIKE-13-x': [{ id: 'SPIKE-13', relations: { rel_depends_on: 'TEC-10' } }] },
      checkout: 'spike/SPIKE-13-x',
    })
    const { status, output } = atelierRun(directory, 'set-status', 'done')
    assert.equal(status, 0, output)
    assert.equal(specData(directory, 'SPIKE-13').status, 'done')
  })
})

describe('FEAT-4 closing an EPIC', () => {
  const epicOn = (main, branches = {}) => makeChantiersRepository({
    main: [{ id: 'EPIC-5', files: epicPlan }, ...main],
    branches: { ...branches, 'epic/EPIC-5-x': [] },
    checkout: 'epic/EPIC-5-x',
  })

  it('refuse avec la liste des enfants ouverts, sans exiger de revue [FEAT-4 CA-9]', () => {
    const directory = epicOn(
      [{ id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } }, { id: 'TEC-18', relations: { rel_parent: 'EPIC-5' } }],
      { 'feat/FEAT-7-x': [{ id: 'FEAT-7', status: 'done', relations: { rel_parent: 'EPIC-5' } }] },
    )
    const { status, output } = atelierRun(directory, 'set-status', 'done')
    assert.notEqual(status, 0)
    assertLine(output, [/TEC-18/])
    assertLine(output, [/FEAT-7/, /feat\/FEAT-7-x/], 'l’enfant qui ne vit que sur sa branche est nommé avec sa branche')
    assert.doesNotMatch(output, /revue|\/atelier:review/i)
    assert.equal(specData(directory, 'EPIC-5').status, 'signed')
  })

  it('refuse sans enfant done (aucun enfant, ou tous abandonnés) [FEAT-4 CA-9]', () => {
    for (const main of [[], [{ id: 'FEAT-6', status: 'abandoned', relations: { rel_parent: 'EPIC-5' } }, { id: 'FEAT-17', status: 'abandoned', relations: { rel_parent: 'EPIC-5' } }]]) {
      const directory = epicOn(main)
      const { status, output } = atelierRun(directory, 'set-status', 'done')
      assert.notEqual(status, 0, `${main.length} enfant(s)`)
      assert.match(output, /enfant/, 'refusé faute d’enfant done')
      assert.equal(specData(directory, 'EPIC-5').status, 'signed', output)
    }
  })

  it('permet la clôture quand tous les enfants sont clos et au moins un est done, sans revue enregistrée [FEAT-4 CA-9]', () => {
    const directory = epicOn([
      { id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } },
      { id: 'FEAT-17', status: 'abandoned', relations: { rel_parent: 'EPIC-5' } },
    ])
    const { status, output } = atelierRun(directory, 'set-status', 'done')
    assert.equal(status, 0, output)
    assert.equal(specData(directory, 'EPIC-5').status, 'done')
  })

  it('un EPIC enfant ouvert bloque la clôture de son EPIC parent [FEAT-4 CA-9]', () => {
    const directory = makeChantiersRepository({
      main: [
        { id: 'EPIC-21', files: epicPlan },
        { id: 'EPIC-20', relations: { rel_parent: 'EPIC-21' } },
        { id: 'FEAT-22', status: 'done', relations: { rel_parent: 'EPIC-20' } },
      ],
      branches: { 'epic/EPIC-21-x': [] },
      checkout: 'epic/EPIC-21-x',
    })
    const { status, output } = atelierRun(directory, 'set-status', 'done')
    assert.notEqual(status, 0)
    assertLine(output, [/EPIC-20/])
  })

  it('l’abandon reste permis avec des enfants ouverts, qui sont listés [FEAT-4 CA-9]', () => {
    const directory = epicOn([{ id: 'TEC-18', relations: { rel_parent: 'EPIC-5' } }])
    const { status, output } = atelierRun(directory, 'set-status', 'abandoned')
    assert.equal(status, 0, output)
    assert.match(output, /TEC-18/)
    assert.equal(specData(directory, 'EPIC-5').status, 'abandoned')
  })
})

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
  // Code committed, then the review recorded by hand at that commit (spec committed after it).
  function reviewedChantier({ plan = threeSlices, header = {}, tdd = 'no', id = 'FEAT-20' } = {}) {
    const directory = makeSlicedRepository({ plan, tdd, id })
    commitFiles(directory, { 'src/a.mjs': 'code\n' }, 'feat: a')
    setHeader(directory, id, { ...header, reviewed_commit: headOf(directory) })
    return directory
  }

  it('refuse la clôture tant qu’une tranche est en cours [FEAT-7 CA-21]', () => {
    for (const slice of ['2', '3']) {
      const { directory } = implementedSlice({ slice, tdd: 'no' })
      const { status, output } = atelierRun(directory, 'close-check')
      assert.notEqual(status, 0, slice)
      assert.match(output, new RegExp(`tranche ${slice}/3 en cours`, 'i'), slice)
    }
  })

  it('en revue du chantier sans reviewed_commit, demande la revue du chantier [FEAT-7 CA-21]', () => {
    const { directory } = implementedSlice({ slice: 'chantier', tdd: 'no', extra: { last_slice: '3' } })
    const { status, output } = atelierRun(directory, 'close-check')
    assert.notEqual(status, 0)
    assert.match(output, /revue du chantier/i)
  })

  it('refuse la clôture quand le plan compte une tranche après last_slice [FEAT-7 CA-22]', () => {
    const directory = reviewedChantier({ plan: planOf([1, 2, 3, 4]), header: { slice: 'chantier', last_slice: '3' } })
    const { status, output } = atelierRun(directory, 'close-check')
    assert.notEqual(status, 0)
    assert.match(output, /tranche 4 du plan non revue/i)
  })

  it('clôture possible avec la revue du chantier à jour, et pour un chantier de l’ancien modèle revu [FEAT-7 CA-23]', () => {
    const sliced = reviewedChantier({ header: { slice: 'chantier', last_slice: '3' } })
    const slicedResult = atelierRun(sliced, 'close-check')
    assert.equal(slicedResult.status, 0, slicedResult.output)
    const legacy = makeSlicedRepository({ tdd: 'yes' })
    commitFiles(legacy, { 'test/a.test.mjs': 'test\n' }, 'test: a')
    const testsCommit = git(legacy, 'rev-parse', '--short', 'HEAD').trim()
    commitFiles(legacy, { 'src/a.mjs': 'code\n' }, 'feat: a')
    setHeader(legacy, 'FEAT-20', { tests_commit: testsCommit, reviewed_commit: headOf(legacy) })
    const legacyResult = atelierRun(legacy, 'close-check')
    assert.equal(legacyResult.status, 0, legacyResult.output)
  })

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

  it('un SPIKE en TDD suit le cycle par tranche et sa clôture exige la revue du chantier [FEAT-7 CA-25]', () => {
    const spike = slicedChantier({ slice: '2', slice_base: 'a'.repeat(40) }, { type: 'SPIKE' })
    assert.equal(core.sliceState(spike).model, 'sliced')
    assert.match(nextStep(spike), /^Tranche 2\/3 : .*\/atelier:write-tests/)
    const directory = makeSlicedRepository({ id: 'SPIKE-20', tdd: 'yes', header: { slice: 'chantier', last_slice: '3', tests_commit: 'abc1234' } })
    const { status, output } = atelierRun(directory, 'close-check')
    assert.notEqual(status, 0)
    assert.match(output, /revue du chantier/i)
  })

  it('un SPIKE en TDD de l’ancien modèle se clôt sans revue exigée [FEAT-7 CA-25]', () => {
    const directory = makeSlicedRepository({ id: 'SPIKE-20', tdd: 'yes' })
    commitFiles(directory, { 'test/a.test.mjs': 'test\n' }, 'test: a')
    const testsCommit = git(directory, 'rev-parse', '--short', 'HEAD').trim()
    commitFiles(directory, { 'src/a.mjs': 'code\n' }, 'feat: a')
    setHeader(directory, 'SPIKE-20', { tests_commit: testsCommit })
    const { status, output } = atelierRun(directory, 'close-check')
    assert.equal(status, 0, output)
  })

  it('un SPIKE sans TDD reste hors tranches : pas de slice, pas de message de tranche, clôture sans revue [FEAT-7 CA-25]', () => {
    const spike = slicedChantier({}, { type: 'SPIKE', tdd: 'no' })
    assert.equal(core.sliceState(spike).model, 'none')
    assert.doesNotMatch(nextStep(spike), /tranche/i)
    const directory = makeSlicedRepository({ id: 'SPIKE-20', tdd: 'no' })
    commitFiles(directory, { 'src/a.mjs': 'code\n' }, 'feat: a')
    const summary = JSON.parse(atelierOk(directory, 'status', '--json'))
    assert.equal(summary.chantier.slice, null)
    assert.equal(summary.chantier.sliceCount, null)
    const closeResult = atelierRun(directory, 'close-check')
    assert.equal(closeResult.status, 0, closeResult.output)
    atelierOk(directory, 'set-reviewed')
    assert.equal(specData(directory, 'SPIKE-20').slice, undefined)
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

describe('TEC-15 numbering the review points', () => {
  const noFiles = { revue: null, spec: null, decisions: null }
  const allOnes = { RB: 1, RD: 1, SB: 1, SD: 1, OB: 1, OD: 1 }

  it('le prochain numéro suit le plus grand de chaque série, toutes sections confondues [TEC-15 CA-1]', () => {
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Un', '`a.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Un', '`a.mjs`', 'écarté : doublon'], ['RD7. Sept', '`b.mjs`', 'écarté : doublon']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB3. Trois', '`c.mjs`', 'corrigé (def5678)']], discuss: [['RD2. Deux', '`d.mjs`', 'écarté : doublon']] },
    ])
    const { next } = core.nextReviewIds({ ...noFiles, revue })
    assert.equal(next.RB, 4)
    assert.equal(next.RD, 8)
  })

  it('un identifiant cité seulement dans une référence ex- compte aussi [TEC-15 CA-1]', () => {
    const revue = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB2 (ex-RD9). Requalifié', '`a.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Un', '`b.mjs`', 'écarté : doublon']] }])
    const { next } = core.nextReviewIds({ ...noFiles, revue })
    assert.equal(next.RB, 3)
    assert.equal(next.RD, 10)
  })

  it('sans aucun fichier, tous les numéros sont à 1 et aucun point n’est ouvert [TEC-15 CA-2]', () => {
    assert.deepEqual(core.nextReviewIds(noFiles), { next: allOnes, open: [] })
  })

  it('un revue.md sans point donne RB1 et RD1, sans point ouvert [TEC-15 CA-2]', () => {
    for (const revue of [revueOf([{ title: 'Revue : tranche 1 : 2026-11-21' }]), revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['Aucun', '', '']], discuss: [['aucun.', '', '']] }])]) {
      assert.deepEqual(core.nextReviewIds({ ...noFiles, revue }), { next: allOnes, open: [] })
    }
  })

  it('le prochain RD tient compte d’un RD requalifié, le prochain RB du RB qui le reprend [TEC-15 CA-13]', () => {
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] },
    ])
    const { next, open } = core.nextReviewIds({ ...noFiles, revue })
    assert.equal(next.RD, 4)
    assert.equal(next.RB, 5)
    assert.deepEqual(open, [])
  })

  it('SB, SD, OB, OD suivent le plus grand numéro cité dans spec.md et decisions.md [TEC-15 CA-10]', () => {
    const spec = '---\nid: TEC-30\n---\n\n# TEC-30\n\nAmendement : SD2 retenu, OD3 écarté. Mot collé : XSB9.\n'
    const decisions = '# Décisions\n\n- OB1 accepté.\n- OD5 reporté.\n- SD1 écarté.\n'
    const { next } = core.nextReviewIds({ revue: null, spec, decisions })
    assert.deepEqual(next, { RB: 1, RD: 1, SB: 1, SD: 3, OB: 2, OD: 6 })
  })

  it('les points ouverts sont ceux dont la dernière occurrence n’a pas de traitement, avec leur intitulé et leur section [TEC-15 CA-10]', () => {
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Premier', '`a.mjs`', ''], ['RB2. Second', '`b.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Discuté', '`c.mjs`', 'À corriger au build']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB1 (repris). Premier', '`a.mjs`', 'corrigé (def5678)'], ['RB2 (repris). Second encore', '`b.mjs`', '']] },
    ])
    assert.deepEqual(core.nextReviewIds({ ...noFiles, revue }).open, [
      { id: 'RD1', title: 'Discuté', section: 'Revue : tranche 1 : 2026-11-21' },
      { id: 'RB2', title: 'Second encore', section: 'Revue : tranche 2 : 2026-11-22' },
    ])
  })

  it('atelier review-ids --json lit revue.md, spec.md et decisions.md du chantier actif [TEC-15 CA-10]', () => {
    const directory = makeRepository('main')
    git(directory, 'switch', '-q', '-c', 'tec/TEC-30-x')
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Un', '`a.mjs`', 'corrigé (abc1234)'], ['RB2. Deux', '`b.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Un', '`c.mjs`', 'écarté : doublon']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB2 (repris). Deux', '`b.mjs`', '']] },
    ])
    writeChantier(directory, {
      id: 'TEC-30',
      body: `${completeBodies.TEC}\n## Amendements\n- 2026-11-21 : précisé (SD2 de la relecture de spec)\n`,
      files: { 'revue.md': revue, 'decisions.md': '# Décisions\n\n- OB1 accepté : coût.\n' },
    })
    git(directory, 'add', '-A')
    commit(directory, 'docs(chantiers): [TEC-30] spec')
    assert.deepEqual(JSON.parse(atelierOk(directory, 'review-ids', '--json')), {
      next: { RB: 3, RD: 2, SB: 1, SD: 3, OB: 2, OD: 1 },
      open: [{ id: 'RB2', title: 'Deux', section: 'Revue : tranche 2 : 2026-11-22' }],
    })
  })
})

describe('TEC-15 refusing open review points in the CLI', () => {
  const revuePath = (directory) => join(chantierDirectoryOf(directory, 'FEAT-20'), 'revue.md')
  const openPoint = revueOf([{ title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB1. Push non vérifié', '`src/now.mjs`', '']], discuss: [['RD1. Nom peu clair', '`src/now.mjs`', 'écarté : convention du projet']] }])
  const allTreated = revueOf([{ title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB1. Push non vérifié', '`src/now.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Nom peu clair', '`src/now.mjs`', 'écarté : convention du projet']] }])
  const postponed = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Push non vérifié', '`src/now.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Message d’erreur vague', '`src/now.mjs`', 'reporté (tranche 2)']] }])

  // Code and revue.md committed, then the review recorded at that commit (spec committed after it).
  function reviewedWithRevue(revue) {
    const directory = makeSlicedRepository({ tdd: 'no' })
    commitFiles(directory, { 'src/a.mjs': 'code\n', [path.relative(directory, revuePath(directory))]: revue }, 'feat: a')
    setHeader(directory, 'FEAT-20', { slice: 'chantier', last_slice: '3', reviewed_commit: headOf(directory) })
    return directory
  }

  for (const [label, options] of [['revue de tranche', { slice: 2 }], ['revue du chantier', { slice: 'chantier', extra: { last_slice: '3' } }]]) {
    it(`set-reviewed refuse un point ouvert de la copie de travail de revue.md (${label}), sans rien écrire dans la spec [TEC-15 CA-8]`, () => {
      const { directory } = implementedSlice(options)
      writeFileSync(revuePath(directory), openPoint)
      const before = specFileText(directory, 'FEAT-20')
      const { status, output } = atelierRun(directory, 'set-reviewed')
      assert.notEqual(status, 0, output)
      assert.match(output, /RB1\b.*Push non vérifié/)
      assert.doesNotMatch(output, /RD1\b/, 'un point traité n’est pas listé')
      assert.equal(specFileText(directory, 'FEAT-20'), before)
    })
  }

  it('set-reviewed enregistre la revue quand tous les points de la copie de travail sont traités [TEC-15 CA-8]', () => {
    const { directory } = implementedSlice({ slice: 2 })
    writeFileSync(revuePath(directory), allTreated)
    atelierOk(directory, 'set-reviewed')
    assert.equal(specData(directory, 'FEAT-20').slice, '3')
  })

  for (const command of [['close-check'], ['set-status', 'done']]) {
    it(`${command.join(' ')} refuse la clôture avec un point ouvert dans un revue.md commité [TEC-15 CA-9]`, () => {
      const directory = reviewedWithRevue(openPoint)
      const before = specFileText(directory, 'FEAT-20')
      const { status, output } = atelierRun(directory, ...command)
      assert.notEqual(status, 0, output)
      assert.match(output, /RB1\b.*Push non vérifié/)
      assert.equal(specFileText(directory, 'FEAT-20'), before)
    })

    it(`${command.join(' ')} refuse la clôture quand revue.md a des modifications non commitées [TEC-15 CA-9]`, () => {
      const directory = reviewedWithRevue(allTreated)
      writeFileSync(revuePath(directory), `${allTreated}\n- Note ajoutée après coup.\n`)
      const { status, output } = atelierRun(directory, ...command)
      assert.notEqual(status, 0, output)
      assert.match(output, /revue\.md/)
    })
  }

  it('close-check accepte la clôture avec un revue.md commité dont tous les points sont traités [TEC-15 CA-9]', () => {
    const { status, output } = atelierRun(reviewedWithRevue(allTreated), 'close-check')
    assert.equal(status, 0, output)
  })

  it('un point reporté (tranche 2) ne bloque pas set-reviewed [TEC-15 CA-16]', () => {
    const { directory } = implementedSlice({ slice: 2 })
    writeFileSync(revuePath(directory), postponed)
    atelierOk(directory, 'set-reviewed')
    assert.equal(specData(directory, 'FEAT-20').slice, '3')
  })

  it('un point dont la dernière occurrence est reporté (tranche 2) bloque la clôture et est listé [TEC-15 CA-16]', () => {
    const { status, output } = atelierRun(reviewedWithRevue(postponed), 'close-check')
    assert.notEqual(status, 0, output)
    assert.match(output, /RD1\b.*Message d’erreur vague/)
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
