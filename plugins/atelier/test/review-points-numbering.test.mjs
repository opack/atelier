import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nextReviewIds } from '../lib/review-points.mjs'
import { git, commit, makeRepository, completeBodies, writeChantier, atelierOk, revueOf } from './helpers.mjs'

describe('numbering the review points', () => {
  const noFiles = { revue: null, spec: null, decisions: null }
  const allOnes = { RB: 1, RD: 1, SB: 1, SD: 1, OB: 1, OD: 1 }

  it('le prochain numéro suit le plus grand de chaque série, toutes sections confondues [TEC-15 CA-1]', () => {
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Un', '`a.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Un', '`a.mjs`', 'écarté : doublon'], ['RD7. Sept', '`b.mjs`', 'écarté : doublon']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB3. Trois', '`c.mjs`', 'corrigé (def5678)']], discuss: [['RD2. Deux', '`d.mjs`', 'écarté : doublon']] },
    ])
    const { next } = nextReviewIds({ ...noFiles, revue })
    assert.equal(next.RB, 4)
    assert.equal(next.RD, 8)
  })

  it('un identifiant cité seulement dans une référence ex- compte aussi [TEC-15 CA-1]', () => {
    const revue = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB2 (ex-RD9). Requalifié', '`a.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Un', '`b.mjs`', 'écarté : doublon']] }])
    const { next } = nextReviewIds({ ...noFiles, revue })
    assert.equal(next.RB, 3)
    assert.equal(next.RD, 10)
  })

  it('sans aucun fichier, tous les numéros sont à 1 et aucun point n’est ouvert [TEC-15 CA-2]', () => {
    assert.deepEqual(nextReviewIds(noFiles), { next: allOnes, open: [] })
  })

  it('un revue.md sans point donne RB1 et RD1, sans point ouvert [TEC-15 CA-2]', () => {
    for (const revue of [revueOf([{ title: 'Revue : tranche 1 : 2026-11-21' }]), revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['Aucun', '', '']], discuss: [['aucun.', '', '']] }])]) {
      assert.deepEqual(nextReviewIds({ ...noFiles, revue }), { next: allOnes, open: [] })
    }
  })

  it('le prochain RD tient compte d’un RD requalifié, le prochain RB du RB qui le reprend [TEC-15 CA-13]', () => {
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] },
    ])
    const { next, open } = nextReviewIds({ ...noFiles, revue })
    assert.equal(next.RD, 4)
    assert.equal(next.RB, 5)
    assert.deepEqual(open, [])
  })

  it('SB, SD, OB, OD suivent le plus grand numéro cité dans spec.md et decisions.md [TEC-15 CA-10]', () => {
    const spec = '---\nid: TEC-30\n---\n\n# TEC-30\n\nAmendement : SD2 retenu, OD3 écarté. Mot collé : XSB9.\n'
    const decisions = '# Décisions\n\n- OB1 accepté.\n- OD5 reporté.\n- SD1 écarté.\n'
    const { next } = nextReviewIds({ revue: null, spec, decisions })
    assert.deepEqual(next, { RB: 1, RD: 1, SB: 1, SD: 3, OB: 2, OD: 6 })
  })

  it('les points ouverts sont ceux dont la dernière occurrence n’a pas de traitement, avec leur intitulé et leur section [TEC-15 CA-10]', () => {
    const revue = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Premier', '`a.mjs`', ''], ['RB2. Second', '`b.mjs`', 'corrigé (abc1234)']], discuss: [['RD1. Discuté', '`c.mjs`', 'À corriger au build']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB1 (repris). Premier', '`a.mjs`', 'corrigé (def5678)'], ['RB2 (repris). Second encore', '`b.mjs`', '']] },
    ])
    assert.deepEqual(nextReviewIds({ ...noFiles, revue }).open, [
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
