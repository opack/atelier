import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isTreatment, parseReviewPoints, reviewPointProblems } from '../lib/review-points.mjs'
import { revueOf } from './helpers.mjs'

// The problems found by the review checks in a revue.md text.
const pointProblems = (text, options = {}) => reviewPointProblems(parseReviewPoints(text), options)

const citing = (problems, pattern) => problems.filter((problem) => pattern.test(problem))

// A revue.md with one review section whose body is given as is.
const revueWithBody = (body) => `# Revue : TEC-30 Essai\n\n## Revue : 2026-11-21\n\n${body}`

const pointTable = '| Point | Fichier | Traitement |\n|---|---|---|\n'

describe('checking the review points', () => {
  it('c’est la dernière occurrence d’un point qui dit s’il est ouvert [TEC-15 AC-3]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Premier', '`a.mjs`', ''], ['RB2. Second', '`b.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB1 (repris). Premier', '`a.mjs`', 'corrigé (def5678)'], ['RB2 (repris). Second', '`b.mjs`', '']] },
    ])
    const problems = pointProblems(text)
    assert.equal(citing(problems, /\bRB2\b/).length, 1)
    assert.deepEqual(citing(problems, /\bRB1\b/), [])
  })

  it('un traitement commence par un mot-clé, quelle que soit sa casse [TEC-15 AC-4]', () => {
    for (const cell of ['corrigé (abc1234)', 'Corrigé (abc1234)', 'test ajouté (abc1234)', 'Spec amendée (2026-11-21)',
      'exception acceptée par Opack : coût', 'écarté : hors périmètre', 'Écarté : doublon', 'reporté (FIX-12)',
      'reporté (tranche 3)', 'requalifié (RB4)', 'sans objet : code supprimé', 'SANS OBJET']) {
      assert.equal(isTreatment(cell), true, cell)
    }
    for (const cell of ['', '   ', 'À corriger au build', 'TODO', 'à voir', 'correction à faire']) {
      assert.equal(isTreatment(cell), false, cell)
    }
  })

  it('un point sans traitement reconnu est signalé avec son identifiant et son intitulé, RB comme RD [TEC-15 AC-4]', () => {
    const text = revueOf([{
      title: 'Revue : 2026-11-21',
      blocking: [['RB1. Push non vérifié', '`a.mjs`', ''], ['RB2. Commit non signé', '`b.mjs`', '   '], ['RB3. Bien traité', '`c.mjs`', 'Corrigé (abc1234)']],
      discuss: [['RD1. Nom ambigu', '`d.mjs`', 'À corriger au build'], ['RD2. Doublon', '`e.mjs`', 'écarté : hors périmètre']],
    }])
    const problems = pointProblems(text)
    assert.equal(problems.length, 3)
    assert.equal(citing(problems, /\bRB1\b.*Push non vérifié/).length, 1)
    assert.equal(citing(problems, /\bRB2\b.*Commit non signé/).length, 1)
    assert.equal(citing(problems, /\bRD1\b.*Nom ambigu/).length, 1)
  })

  it('un identifiant présenté comme nouveau dans deux sections est signalé avec les titres des deux sections [TEC-15 AC-5]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Premier', '`a.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : tranche 2 : 2026-11-22', blocking: [['RB1. Autre chose', '`b.mjs`', 'corrigé (def5678)']] },
    ])
    const problems = citing(pointProblems(text), /\bRB1\b/)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /Revue : tranche 1 : 2026-11-21/)
    assert.match(problems[0], /Revue : tranche 2 : 2026-11-22/)
  })

  it('un identifiant nouveau dans deux sections de même titre est signalé, et le premier point ouvert n’est pas masqué [TEC-15 AC-5]', () => {
    const text = revueOf([
      { title: 'Revue : 2026-11-22', blocking: [['RB1. Premier', '`a.mjs`', '']] },
      { title: 'Revue : 2026-11-22', blocking: [['RB1. Autre chose', '`b.mjs`', 'corrigé (def5678)']] },
    ])
    assert.equal(citing(pointProblems(text), /présenté comme nouveau/).length, 1)
  })

  it('un identifiant présent deux fois dans une même section est signalé [TEC-15 AC-5]', () => {
    const text = revueOf([{
      title: 'Revue : 2026-11-21',
      blocking: [['RB1. Premier', '`a.mjs`', 'corrigé (abc1234)'], ['RB1. Second', '`b.mjs`', 'corrigé (abc1234)']],
    }])
    const problems = citing(pointProblems(text), /\bRB1\b/)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /Revue : 2026-11-21/)
  })

  it('une cellule Point qui n’a pas la forme définie est signalée, avec son contenu [TEC-15 AC-6]', () => {
    const cells = ['B1. Ancien format', '1. Numéro seul', 'Texte libre sans identifiant', 'RB1 Sans point final', 'RB2.Sans espace', 'Aucun']
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: cells.map((cell) => [cell, '`a.mjs`', 'corrigé (abc1234)']) }])
    const problems = pointProblems(text)
    for (const cell of cells) {
      assert.equal(citing(problems, new RegExp(cell.replace(/[.()]/g, '\\$&'))).length, 1, cell)
    }
  })

  it('la ligne « Aucun » (ou « aucun. ») seule n’est pas signalée [TEC-15 AC-6]', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['Aucun', '', '']], discuss: [['aucun.', '', '']] }])
    assert.deepEqual(pointProblems(text), [])
  })

  it('une ligne dont le nombre de cellules diffère de l’en-tête est signalée (| non échappé) [TEC-15 AC-6]', () => {
    const text = revueOf([{ title: 'Revue : 2026-11-21', blocking: [['RB1. Pipe non échappé', '`a.mjs`', 'corrigé (abc1234)', 'en trop']] }])
    assert.equal(citing(pointProblems(text), /\bRB1\b/).length, 1)
  })

  it('une ligne mal formée suivie d’un séparateur n’est jamais prise pour l’en-tête (RD6, RD10, RD11) [TEC-15 AC-6]', () => {
    const one = '| RB1. Un | `a.mjs` | corrigé (abc1234) |\n'
    const two = '| RB2. Deux | `b.mjs` | corrigé (abc1234) |\n'
    const cases = {
      'RD6, ouvre le tableau': `### Bloquant\n| B1. Ancien | \`a.mjs\` | corrigé (abc1234) |\n|---|---|---|\n${two}`,
      'RD10, en plein tableau': `### Bloquant\n${pointTable}${one}| B1. Ancien | Point | c |\n|---|---|---|\n${two}`,
      'RD11, après une ligne vide': `### Bloquant\n${pointTable}${one}\n| B1. Ancien | Point | Traitement |\n|---|---|---|\n${two}`,
      'RD11, après un commentaire': `### Bloquant\n${pointTable}${one}<!-- note -->\n| B1. Ancien | Point | Traitement |\n|---|---|---|\n${two}`,
    }
    for (const [name, body] of Object.entries(cases)) {
      assert.equal(citing(pointProblems(revueWithBody(body)), /B1\. Ancien/).length, 1, name)
    }
  })

  it('un point bien formé qui contient une cellule « Point », suivi d’un séparateur, est lu comme un point (RD7) [TEC-15 AC-6]', () => {
    const text = revueWithBody(`### Bloquant\n| RB1. x | Point | c |\n|---|---|---|\n| RB2. Deux | \`b.mjs\` | corrigé (abc1234) |\n`)
    assert.equal(citing(pointProblems(text), /\bRB1\b/).length, 1)
  })

  it('un en-tête mal écrit est signalé comme un en-tête non reconnu [TEC-15 AC-6]', () => {
    for (const header of ['| point | Fichier | Traitement |', '| **Point** | Fichier | Traitement |', '| Point | File | Traitement |']) {
      const text = revueWithBody(`### Bloquant\n${header}\n|---|---|---|\n| RB1. Un | \`a.mjs\` | corrigé (abc1234) |\n`)
      assert.equal(citing(pointProblems(text), /en-tête/i).length, 1, header)
    }
  })

  it('un revue.md aux sections « ## Tour » (antérieur à FEAT-7) n’est pas contrôlé [TEC-15 AC-7]', () => {
    const text = revueOf([
      { title: 'Tour 1', blocking: [['B1. Ancien format', '`a.mjs`', '']], discuss: [['1. Numéro seul', '`b.mjs`', '']] },
      { title: 'Tour 2', blocking: [['B1. Ancien format', '`a.mjs`', 'À corriger']] },
    ])
    assert.deepEqual(pointProblems(text), [])
    assert.deepEqual(pointProblems(text, { atClose: true }), [])
  })

  it('un revue.md qui garde une section « ## Tour » échappe au contrôle, même avec d’autres sections (RD5, spec §4) [TEC-15 AC-7]', () => {
    const text = revueOf([
      { title: 'Tour 1', blocking: [['B1. Ancien format', '`a.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : 2026-11-22', blocking: [['B2. Nouveau', '`b.mjs`', '']] },
    ])
    assert.deepEqual(pointProblems(text), [])
  })

  it('un revue.md aux autres sections, sans aucun RB/RD mais avec des points B1., est contrôlé [TEC-15 AC-7]', () => {
    const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['B1. Ancien format', '`a.mjs`', 'corrigé (abc1234)']], discuss: [['D1. Autre', '`b.mjs`', 'écarté : doublon']] }])
    const problems = pointProblems(text)
    assert.equal(citing(problems, /B1\. Ancien format/).length, 1)
    assert.equal(citing(problems, /D1\. Autre/).length, 1)
  })

  it('un RD requalifié en RB, puis traité sous son nouvel identifiant, ne laisse aucun problème [TEC-15 AC-13]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] },
    ])
    assert.deepEqual(pointProblems(text), [])
    assert.deepEqual(pointProblems(text, { atClose: true }), [])
  })

  it('un RB dans le tableau « À discuter » ou un RD dans le tableau « Bloquant » est signalé [TEC-15 AC-14]', () => {
    const text = revueOf([{
      title: 'Revue : 2026-11-21',
      blocking: [['RD1. Mal rangé', '`a.mjs`', 'corrigé (abc1234)']],
      discuss: [['RB1. Mal rangé aussi', '`b.mjs`', 'corrigé (abc1234)']],
    }])
    const problems = pointProblems(text)
    assert.equal(citing(problems, /\bRD1\b/).length, 1)
    assert.equal(citing(problems, /\bRB1\b/).length, 1)
  })

  it('un point reporté à une tranche est accepté à l’enregistrement de la revue, refusé à la clôture [TEC-15 AC-16]', () => {
    const text = revueOf([{
      title: 'Revue : tranche 1 : 2026-11-21',
      discuss: [['RD1. Reporté en tranche', '`a.mjs`', 'Reporté (tranche 2) : avec AC-6'], ['RD2. Reporté ailleurs', '`b.mjs`', 'reporté (FIX-12)']],
    }])
    assert.deepEqual(pointProblems(text), [])
    const atClose = pointProblems(text, { atClose: true })
    assert.equal(atClose.length, 1)
    assert.match(atClose[0], /\bRD1\b/)
  })

  it('un point reporté à une tranche puis traité dans une revue suivante n’est pas refusé à la clôture [TEC-15 AC-16]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD1. Reporté', '`a.mjs`', 'reporté (tranche 2)']] },
      { title: 'Revue : tranche 2 : 2026-11-22', discuss: [['RD1 (repris). Reporté', '`a.mjs`', 'corrigé (abc1234)']] },
    ])
    assert.deepEqual(pointProblems(text, { atClose: true }), [])
  })

  it('un titre ### proche de « Bloquant » ou « À discuter » est signalé [TEC-15 AC-17]', () => {
    for (const title of ['Bloquants', 'bloquant', 'A discuter', 'À discuter :', '**Bloquant**']) {
      const text = revueWithBody(`### ${title}\n${pointTable}| RB1. Un | \`a.mjs\` | corrigé (abc1234) |\n`)
      assert.equal(citing(pointProblems(text), new RegExp(title.replace(/[*]/g, '\\$&'))).length, 1, title)
    }
  })

  it('une ligne de point hors d’un tableau de points est signalée, une phrase qui cite un point ne l’est pas [TEC-15 AC-17]', () => {
    const text = `${revueOf([{ title: 'Revue : 2026-11-21', discuss: [['RD1. Un', '`a.mjs`', 'corrigé (abc1234)']] }])}\n- RD1 corrigé, voir plus haut.\n\n### Contrôles\n${pointTable}| RB1. Perdu | \`x\` | corrigé (abc1234) |\n`
    const problems = pointProblems(text)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /\bRB1\b/)
  })

  it('un identifiant repris deux fois dans une même section est signalé (OB2) [TEC-15 AC-5]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB1. Premier', '`a.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB1 (repris). Premier', '`a.mjs`', ''], ['RB1 (repris). Premier', '`a.mjs`', 'corrigé (def5678)']] },
    ])
    const problems = citing(pointProblems(text), /\bRB1\b/)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /Revue : tranche 1 : 2026-11-22/)
  })

  it('un report à une tranche écrit librement est aussi refusé à la clôture (OD12) [TEC-15 AC-16]', () => {
    for (const treatment of ['reporté en tranche 3', 'Reporté (tranche 2, avec AC-6)']) {
      const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD1. Reporté', '`a.mjs`', treatment]] }])
      assert.deepEqual(pointProblems(text), [], treatment)
      assert.equal(citing(pointProblems(text, { atClose: true }), /\bRD1\b/).length, 1, treatment)
    }
  })

  it('un report à une tranche accordé au féminin est aussi refusé à la clôture [TEC-15 AC-16]', () => {
    for (const treatment of ['Reportée (tranche 2)', 'reportée en tranche 3']) {
      const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD1. Reporté', '`a.mjs`', treatment]] }])
      assert.deepEqual(pointProblems(text), [], treatment)
      assert.equal(citing(pointProblems(text, { atClose: true }), /\bRD1\b/).length, 1, treatment)
    }
  })

  it('un point requalifié vers un identifiant qui ne le reprend jamais (ex-) est signalé [TEC-15 AC-18]', () => {
    const alone = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] }])
    const withoutEx = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4. Autre chose', '`b.mjs`', 'corrigé (abc1234)']] },
    ])
    for (const [name, text] of Object.entries({ alone, withoutEx })) {
      assert.equal(citing(pointProblems(text), /\bRD3\b/).length, 1, name)
    }
  })

  it('un point marqué repris sans occurrence plus haut est signalé [TEC-15 AC-18]', () => {
    const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB7 (repris). Jamais présenté', '`a.mjs`', 'corrigé (abc1234)']] }])
    const problems = pointProblems(text)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /\bRB7\b/)
  })

  it('un point ex-RD3 sans RD3 plus haut est signalé [TEC-15 AC-18]', () => {
    const text = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] }])
    const problems = pointProblems(text)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /\bRB4\b/)
    assert.match(problems[0], /\bRD3\b/)
  })

  it('dans une même section, la requalification est reprise même si le tableau Bloquant précède (OD19) [TEC-15 AC-18]', () => {
    const text = revueOf([{
      title: 'Revue : tranche 1 : 2026-11-21',
      blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']],
      discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']],
    }])
    assert.deepEqual(pointProblems(text), [])
  })

  it('entre sections, l’ordre compte : ex- et repris avant le point d’origine sont signalés (OD22) [TEC-15 AC-18]', () => {
    const exBefore = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)']] },
    ])
    const exProblems = pointProblems(exBefore)
    assert.equal(citing(exProblems, /^RB4 \(ex-RD3\)/).length, 1)
    assert.equal(citing(exProblems, /^RD3\b/).length, 1)
    const reprisBefore = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', blocking: [['RB7 (repris). Push', '`a.mjs`', 'corrigé (abc1234)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB7. Push', '`a.mjs`', 'corrigé (def5678)']] },
    ])
    assert.equal(citing(pointProblems(reprisBefore), /\bRB7\b/).length, 1)
  })

  it('une reprise qui renvoie à un autre point (RB4 ex-RD9) ne ferme pas la requalification de RD3 (OD22) [TEC-15 AC-18]', () => {
    const text = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4)'], ['RD9. Autre', '`b.mjs`', 'requalifié (RB4)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4 (ex-RD9). Autre', '`b.mjs`', 'corrigé (abc1234)']] },
    ])
    const problems = pointProblems(text)
    assert.equal(citing(problems, /^RD3\b/).length, 1)
    assert.deepEqual(citing(problems, /^RD9\b/), [])
  })

  it('un requalifié sans identifiant est signalé ; un identifiant suivi d’un commentaire est lu (OD20) [TEC-15 AC-18]', () => {
    const withoutId = revueOf([{ title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié en bloquant']] }])
    assert.equal(citing(pointProblems(withoutId), /^RD3\b/).length, 1)
    const withComment = revueOf([
      { title: 'Revue : tranche 1 : 2026-11-21', discuss: [['RD3. Commit non signé', '`a.mjs`', 'requalifié (RB4, plus grave)']] },
      { title: 'Revue : tranche 1 : 2026-11-22', blocking: [['RB4 (ex-RD3). Commit non signé', '`a.mjs`', 'corrigé (abc1234)']] },
    ])
    assert.deepEqual(pointProblems(withComment), [])
  })
})
