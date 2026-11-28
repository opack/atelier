import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseReviewPoints } from '../lib/review-points.mjs'
import { readChantier } from '../lib/cli/identifiers.mjs'
import { DEFAULT_CONFIG } from '../lib/common.mjs'
import { temporaryDirectory, writeChantier, revueOf } from './helpers.mjs'

// The fields of each analysed row that AC-12 and AC-15 are about.
function pointsOf(parsed) {
  return parsed.sections.flatMap((section) => section.rows.map(({ id, marker, title, treatment, table }) =>
    ({ section: section.title, table, id, marker, title, treatment })))
}

describe('reading revue.md', () => {
  it('extrait l’identifiant, le marqueur (repris, ex-RD3 ou aucun) et l’intitulé de chaque point [TEC-15 AC-12]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB2. Intitulé', '`a.mjs`', 'corrigé (abc1234)']], discuss: [['RD3. Autre point', '`b.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB2 (repris). Intitulé', '`a.mjs`', ''], ['RB4 (ex-RD3). Intitulé', '`b.mjs`', 'écarté : hors périmètre']] },
    ])
    assert.deepEqual(pointsOf(parseReviewPoints(text)), [
      { section: 'Revue : tranche 1 : 2026-11-21', table: 'Bloquant', id: 'RB2', marker: null, title: 'Intitulé', treatment: 'corrigé (abc1234)' },
      { section: 'Revue : tranche 1 : 2026-11-21', table: 'À discuter', id: 'RD3', marker: null, title: 'Autre point', treatment: 'requalifié (RB4)' },
      { section: 'Revue : tranche 2 : 2026-11-22', table: 'Bloquant', id: 'RB2', marker: 'repris', title: 'Intitulé', treatment: '' },
      { section: 'Revue : tranche 2 : 2026-11-22', table: 'Bloquant', id: 'RB4', marker: 'ex-RD3', title: 'Intitulé', treatment: 'écarté : hors périmètre' },
    ])
  })

  it('lit un revue.md en CRLF, aux cellules entourées d’espaces superflus [TEC-15 AC-12]', () => {
    const text = revueOf([{ title: 'Revue : chantier : 2026-11-21', blocking: [['  RB1. Push non vérifié  ', '`a.mjs`', '   corrigé (abc1234)   ']] }])
      .replace(/\n/g, '\r\n')
    assert.deepEqual(pointsOf(parseReviewPoints(text)), [
      { section: 'Revue : chantier : 2026-11-21', table: 'Bloquant', id: 'RB1', marker: null, title: 'Push non vérifié', treatment: 'corrigé (abc1234)' },
    ])
  })

  it('seuls les tableaux sous « ### Bloquant » et « ### À discuter » sont des tableaux de points [TEC-15 AC-12]', () => {
    const text = `${revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Un point', '`a.mjs`', 'corrigé (abc1234)']] }])}\n### Contrôles\n| Point | Fichier | Traitement |\n|---|---|---|\n| RB9. Hors tableau de points | \`x\` | |\n`
    assert.deepEqual(pointsOf(parseReviewPoints(text)).map((point) => point.id), ['RB1'])
  })

  it('une ligne vide au milieu d’un tableau de points ne fait perdre aucun point [TEC-15 AC-12]', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Un', '`a.mjs`', 'corrigé (abc1234)'], ['RB2. Deux', '`b.mjs`', ''], ['RB3. Trois', '`c.mjs`', 'écarté : doublon']] }])
      .replace('corrigé (abc1234) |\n', 'corrigé (abc1234) |\n\n')
    assert.deepEqual(pointsOf(parseReviewPoints(text)).map(({ id, treatment }) => ({ id, treatment })), [
      { id: 'RB1', treatment: 'corrigé (abc1234)' },
      { id: 'RB2', treatment: '' },
      { id: 'RB3', treatment: 'écarté : doublon' },
    ])
  })

  it('un tableau de points sans ligne d’en-tête ne perd pas son premier point [TEC-15 AC-12]', () => {
    const text = '# Revue : TEC-30 Essai\n\n## Revue : 2026-11-21\n\n### Bloquant\n| RB1. Un | `a.mjs` | |\n| RB2. Deux | `b.mjs` | |\n'
    assert.deepEqual(pointsOf(parseReviewPoints(text)).map((point) => point.id), ['RB1', 'RB2'])
  })

  it('une ligne dont le nombre de cellules diffère de l’en-tête est marquée [TEC-15 AC-12]', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Pipe non échappé', '`a | b`', 'corrigé (abc1234)'], ['RB2. Normal', '`c.mjs`', '']] }])
    const rows = parseReviewPoints(text).sections[0].rows
    assert.deepEqual(rows.map(({ id, cellCountMismatch }) => ({ id, cellCountMismatch })), [
      { id: 'RB1', cellCountMismatch: true },
      { id: 'RB2', cellCountMismatch: false },
    ])
  })

  it('un tableau dans un commentaire HTML n’est pas lu, comme un bloc de code [TEC-15 AC-12]', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Vrai point', '`a.mjs`', '']] }])
      .replace('### Bloquant\n', '### Bloquant\n<!-- Exemple :\n| Point | Fichier | Traitement |\n|---|---|---|\n| RB9. Exemple | `x` | |\n-->\n')
    assert.deepEqual(pointsOf(parseReviewPoints(text)).map((point) => point.id), ['RB1'])
  })

  it('un | dans une cellule est un | littéral, pas un séparateur de colonne [TEC-15 AC-15]', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Option a \\| b', '`a \\| b`', 'corrigé (abc1234)']] }])
    const [point] = parseReviewPoints(text).sections[0].rows
    assert.equal(point.treatment, 'corrigé (abc1234)')
    assert.equal(point.file, '`a | b`')
    assert.equal(point.title, 'Option a | b')
  })

  it('readChantier expose le texte de revue.md (null sans fichier)', () => {
    const directory = temporaryDirectory('atelier-tec15-')
    const config = { ...DEFAULT_CONFIG, chantiersDir: 'docs/chantiers' }
    const text = revueOf([{ title: 'Revue : 2026-11-21' }])
    writeChantier(directory, { id: 'TEC-30', files: { 'revue.md': text } })
    writeChantier(directory, { id: 'TEC-31' })
    assert.equal(readChantier(directory, config, 'TEC-30').revue, text)
    assert.equal(readChantier(directory, config, 'TEC-31').revue, null)
  })
})
