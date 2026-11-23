import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { appendAmendmentEntry, checkSpec, parseAmendments, parseFrontMatter, refreezeTestsEntry, reopenTestsEntry } from '../lib/core.mjs'
import { template, temporaryDirectory, makeRepository, atelier, completeBodies, specText, writeChantier, makeChantiersRepository, atelierRun, specData, assertLine } from './helpers.mjs'

describe('spec completeness', () => {
  it('reports every required section of an untouched template as empty', () => {
    const problems = checkSpec(template('spec-feat'))
    assert.ok(problems.some((problem) => problem.includes('Contexte')))
    assert.ok(problems.some((problem) => problem.includes("Critères d'acceptation")))
    assert.ok(problems.some((problem) => problem.includes('Non-fonctionnel')))
  })

  it('accepts a complete spec', () => {
    const spec = template('spec-feat')
      .replace('## 2. Description', 'Les utilisateurs perdent du temps.\n\n## 2. Description')
      .replace('## 3. Points', 'Afficher le total.\n\n## 3. Points')
      .replace('## 6. Non-fonctionnel', '- [ ] CA-1 : Étant donné un budget, quand je l’ouvre, alors je vois le total.\n\n## 6. Non-fonctionnel')
      .replace('- Sécurité / autorisation :', '- Sécurité / autorisation : lecture réservée au propriétaire')
    assert.ok(checkSpec(spec).some((problem) => problem.includes('« tdd »')), 'the TDD decision is mandatory')
    assert.deepEqual(checkSpec(spec.replace(/^tdd:.*$/m, 'tdd: no')), [])
  })

  it('requires numbered criteria and flags unfinished text', () => {
    const spec = template('spec-fix')
      .replace('- Observé :', '- Observé : crash au démarrage')
      .replace('## 3. Cause probable', 'Ouvrir l’app.\n\n## 3. Cause probable')
      .replace('## 4. Solution proposée', 'Listener non nettoyé (trace Sentry).\n\n## 4. Solution proposée')
      .replace('## 5. Critère de non-régression', 'Nettoyer le listener.\n\n## 5. Critère de non-régression')
      .replace('## 6. Notes', 'Le crash ne revient pas, quand …\n\n## 6. Notes')
    const problems = checkSpec(spec)
    assert.ok(problems.some((problem) => problem.includes('aucun critère numéroté')))
    assert.ok(problems.some((problem) => problem.includes('à compléter')))
  })

  it('rejects an unknown type', () => {
    assert.ok(checkSpec('---\nid: X-1\ntype: CHORE\ntitle: t\ntdd: no\n---\n').some((problem) => /type « CHORE » inconnu/.test(problem)))
  })
})

describe('amendments section', () => {
  const spec = '---\nid: FEAT-12\n---\n# T\n\n## 1. Contexte\nTexte.\n\n## Amendements\n<!-- Après signature : une entrée datée. -->\n- 2026-11-01 : critère ajouté\n  suite indentée\n\n## Annexe\nFin.\n'

  it('reads dated entries with their continuation lines, comments ignored', () => {
    const { sectionCount, entries, rest } = parseAmendments(spec)
    assert.equal(sectionCount, 1)
    assert.deepEqual(entries, ['- 2026-11-01 : critère ajouté\n  suite indentée'])
    assert.equal(rest, '---\nid: FEAT-12\n---\n# T\n\n## 1. Contexte\nTexte.\n\n## Amendements\n## Annexe\nFin.\n')
  })

  it('counts undated lines of the section as body, and tells duplicate or absent sections apart', () => {
    const undated = parseAmendments('## Amendements\n- hier : oubli\n- 2026-11-01 : ok\n')
    assert.deepEqual(undated.entries, ['- 2026-11-01 : ok'])
    assert.match(undated.rest, /- hier : oubli/)
    assert.equal(parseAmendments('## Amendements\n\n## Amendements\n').sectionCount, 2)
    assert.equal(parseAmendments('## Amendement\n- 2026-11-01 : x\n').sectionCount, 0)
  })

  it('adds an entry at the end of the section, even in the middle of the file', () => {
    const updated = appendAmendmentEntry(spec, '2026-11-20 : tests regelés : abc1234')
    assert.equal(updated, spec.replace('  suite indentée\n', '  suite indentée\n- 2026-11-20 : tests regelés : abc1234\n'))
    assert.equal(
      appendAmendmentEntry('# T\r\n\r\n## Amendements\r\n<!-- x -->\r\n', '2026-11-20 : y'),
      '# T\r\n\r\n## Amendements\r\n<!-- x -->\r\n- 2026-11-20 : y\r\n',
      'line endings kept',
    )
  })

  it('creates the section when it is missing', () => {
    assert.equal(appendAmendmentEntry('# T\n\n## 1. Quoi\nX.\n\n', '2026-11-20 : y'), '# T\n\n## 1. Quoi\nX.\n\n## Amendements\n- 2026-11-20 : y\n')
  })

  it('writes entries with fixed labels', () => {
    assert.equal(reopenTestsEntry('2026-11-20', 'abc1234', 'cas oublié'), '2026-11-20 : tests rouverts (gel quitté : abc1234) : cas oublié')
    assert.equal(refreezeTestsEntry('2026-11-20', 'def5678'), '2026-11-20 : tests regelés : def5678')
  })
})

describe('relations checked before signature', () => {
  // main: EPIC-5 (open), EPIC-15 (done), EPIC-34 (child of EPIC-33), TEC-32 (depends on TEC-31);
  // FEAT-7 only on its branch.
  const directory = makeChantiersRepository({
    main: [
      { id: 'EPIC-5' },
      { id: 'EPIC-15', status: 'done' },
      { id: 'EPIC-34', relations: { rel_parent: 'EPIC-33' } },
      { id: 'TEC-32', relations: { rel_depends_on: 'TEC-31' } },
    ],
    branches: { 'feat/FEAT-7-x': [{ id: 'FEAT-7' }] },
  })
  const check = (spec) => atelierRun(directory, 'check-spec', writeChantier(directory, { status: 'draft', ...spec }))

  it('accepte des relations valides, une dépendance présente seulement sur une branche et une origine historique [FEAT-4 CA-5]', () => {
    const { status, output } = check({ id: 'TEC-30', relations: { rel_parent: 'EPIC-5', rel_depends_on: 'FEAT-7', rel_origin: 'BUG-421', rel_replaces: 'FEA-26' } })
    assert.equal(status, 0, output)
  })

  it('signale un parent ou une dépendance introuvable dans toutes les branches [FEAT-4 CA-5]', () => {
    const { status, output } = check({ id: 'TEC-30', relations: { rel_parent: 'EPIC-98', rel_depends_on: 'FEAT-99' } })
    assert.equal(status, 2)
    assertLine(output, [/EPIC-98/, /introuvable/])
    assertLine(output, [/FEAT-99/, /introuvable/])
  })

  it('signale un identifiant mal formé dans n’importe quel champ rel_* [FEAT-4 CA-5]', () => {
    const { status, output } = check({ id: 'TEC-30', relations: { rel_origin: 'ticket 12', rel_replaces: 'FEAT-' } })
    assert.equal(status, 2)
    assertLine(output, [/ticket 12/, /mal formé/])
    assertLine(output, [/FEAT-/, /mal formé/])
  })

  it('signale plusieurs parents, un parent qui n’est pas un EPIC, un EPIC clos [FEAT-4 CA-5]', () => {
    assertLine(check({ id: 'TEC-30', relations: { rel_parent: 'EPIC-5, EPIC-34' } }).output, [/rel_parent/, /plusieurs|un seul|une seule/])
    assertLine(check({ id: 'TEC-30', relations: { rel_parent: 'FEAT-7' } }).output, [/FEAT-7/, /EPIC/])
    assertLine(check({ id: 'TEC-30', relations: { rel_parent: 'EPIC-15' } }).output, [/EPIC-15/, /clos/])
  })

  it('signale une auto-référence et un cycle sur rel_depends_on comme sur rel_parent [FEAT-4 CA-5]', () => {
    assertLine(check({ id: 'TEC-30', relations: { rel_depends_on: 'TEC-30' } }).output, [/TEC-30/, /lui-même|auto-référence/])
    assertLine(check({ id: 'TEC-31', relations: { rel_depends_on: 'TEC-32' } }).output, [/cycle/, /TEC-31/, /TEC-32/])
    assertLine(check({ id: 'EPIC-33', relations: { rel_parent: 'EPIC-34' } }).output, [/cycle/, /EPIC-33/, /EPIC-34/])
  })

  it('ces manques bloquent la signature [FEAT-4 CA-5]', () => {
    const signDirectory = makeChantiersRepository({
      branches: { 'tec/TEC-40-x': [{ id: 'TEC-40', status: 'draft', relations: { rel_depends_on: 'FEAT-99' } }] },
      checkout: 'tec/TEC-40-x',
    })
    const { status, output } = atelierRun(signDirectory, 'sign')
    assert.notEqual(status, 0)
    assertLine(output, [/FEAT-99/, /introuvable/])
    assert.equal(specData(signDirectory, 'TEC-40').status, 'draft')
  })

  it('décision : sans .claude/atelier.json, check-spec ne vérifie pas les relations et le dit', () => {
    const bare = temporaryDirectory('atelier-feat4-noconfig-')
    const path = join(bare, 'spec.md')
    writeFileSync(path, specText({ id: 'TEC-30', status: 'draft', relations: { rel_depends_on: 'FEAT-99' } }))
    const { status, output } = atelierRun(bare, 'check-spec', path)
    assert.equal(status, 0, output)
    assert.match(output, /relations/i)
  })
})

describe('EPIC spec and templates', () => {
  it('le template spec-epic porte tdd: no et les sections exigées avant signature [FEAT-4 CA-7]', () => {
    const epicTemplate = template('spec-epic')
    assert.equal(parseFrontMatter(epicTemplate).data.tdd, 'no')
    const sections = ['Vision', 'Pourquoi', "Critères d'acceptation globaux", 'Cadre', 'Hors périmètre']
    const problems = checkSpec(epicTemplate)
    for (const section of sections) {
      assert.match(epicTemplate, new RegExp(`^## (\\d+\\. )?${section}`, 'm'), section)
      assert.ok(problems.some((problem) => problem.includes(section)), `section vide signalée : ${section}`)
    }
    assert.deepEqual(checkSpec(specText({ id: 'EPIC-5', status: 'draft' })), [])
    const withoutFrame = specText({ id: 'EPIC-5', status: 'draft', body: completeBodies.EPIC.replace(/## 4\. Cadre\n.*\n\n/, '') })
    assert.ok(checkSpec(withoutFrame).some((problem) => problem.includes('Cadre')))
  })

  it('check-spec signale un EPIC en tdd: yes [FEAT-4 CA-7]', () => {
    assert.ok(checkSpec(specText({ id: 'EPIC-5', status: 'draft', tdd: 'yes' })).some((problem) => /tdd/.test(problem) && /EPIC/.test(problem)))
  })

  it('le template plan-epic décrit le découpage [FEAT-4 CA-7]', () => {
    const directory = makeRepository('main')
    const plan = atelier(directory, 'template', 'plan-epic')
    for (const word of [/lot/i, /type/i, /ordre/i, /dépendance/i]) {
      assert.match(plan, word)
    }
  })

  it('set-tdd yes est refusé sur un EPIC [FEAT-4 CA-7]', () => {
    const directory = makeChantiersRepository({ branches: { 'epic/EPIC-5-x': [{ id: 'EPIC-5' }] }, checkout: 'epic/EPIC-5-x' })
    const { status, output } = atelierRun(directory, 'set-tdd', 'yes', 'essai')
    assert.notEqual(status, 0)
    assert.match(output, /EPIC/, 'refusé parce que c’est un EPIC')
    assert.equal(specData(directory, 'EPIC-5').tdd, 'no')
  })
})
