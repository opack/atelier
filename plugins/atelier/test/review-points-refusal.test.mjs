import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import path, { join } from 'node:path'
import { describe, it } from 'node:test'
import { commit, chantierDirectoryOf, atelierRun, specData, makeSlicedRepository, commitFiles, headOf, setHeader, specFileText, atelierOk, implementedSlice, revueOf } from './helpers.mjs'

describe('refusing open review points in the CLI', () => {
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
    it(`set-reviewed refuse un point ouvert de la copie de travail de revue.md (${label}), sans rien écrire dans la spec [TEC-15 AC-8]`, () => {
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

  it('set-reviewed enregistre la revue quand tous les points de la copie de travail sont traités [TEC-15 AC-8]', () => {
    const { directory } = implementedSlice({ slice: 2 })
    writeFileSync(revuePath(directory), allTreated)
    atelierOk(directory, 'set-reviewed')
    assert.equal(specData(directory, 'FEAT-20').slice, '3')
  })

  for (const command of [['close-check'], ['set-status', 'done']]) {
    it(`${command.join(' ')} refuse la clôture avec un point ouvert dans un revue.md commité [TEC-15 AC-9]`, () => {
      const directory = reviewedWithRevue(openPoint)
      const before = specFileText(directory, 'FEAT-20')
      const { status, output } = atelierRun(directory, ...command)
      assert.notEqual(status, 0, output)
      assert.match(output, /RB1\b.*Push non vérifié/)
      assert.equal(specFileText(directory, 'FEAT-20'), before)
    })

    it(`${command.join(' ')} refuse la clôture quand revue.md a des modifications non commitées [TEC-15 AC-9]`, () => {
      const directory = reviewedWithRevue(allTreated)
      writeFileSync(revuePath(directory), `${allTreated}\n- Note ajoutée après coup.\n`)
      const { status, output } = atelierRun(directory, ...command)
      assert.notEqual(status, 0, output)
      assert.match(output, /revue\.md/)
    })
  }

  it('close-check accepte la clôture avec un revue.md commité dont tous les points sont traités [TEC-15 AC-9]', () => {
    const { status, output } = atelierRun(reviewedWithRevue(allTreated), 'close-check')
    assert.equal(status, 0, output)
  })

  it('un point reporté (tranche 2) ne bloque pas set-reviewed [TEC-15 AC-16]', () => {
    const { directory } = implementedSlice({ slice: 2 })
    writeFileSync(revuePath(directory), postponed)
    atelierOk(directory, 'set-reviewed')
    assert.equal(specData(directory, 'FEAT-20').slice, '3')
  })

  it('un point dont la dernière occurrence est reporté (tranche 2) bloque la clôture et est listé [TEC-15 AC-16]', () => {
    const { status, output } = atelierRun(reviewedWithRevue(postponed), 'close-check')
    assert.notEqual(status, 0, output)
    assert.match(output, /RD1\b.*Message d’erreur vague/)
  })
})
