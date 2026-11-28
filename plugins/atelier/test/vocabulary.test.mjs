import assert from 'node:assert/strict'
import { test } from 'node:test'
import { escapeRegExp } from '../lib/common.mjs'
import { isTreatment, parseReviewPoints } from '../lib/review-points.mjs'
import { REQUIRED_SECTIONS } from '../lib/spec.mjs'
import { VOCABULARY } from '../lib/vocabulary.mjs'

test('VOCABULARY carries the sections of each type with their French titles [REF-34 AC-3]', () => {
  assert.deepEqual(VOCABULARY.sections, {
    FEAT: { context: 'Contexte', description: 'Description', acceptanceCriteria: "Critères d'acceptation", nonFunctional: 'Non-fonctionnel' },
    FIX: {
      problem: 'Problème',
      reproduction: 'Reproduction',
      probableCause: 'Cause probable',
      proposedSolution: 'Solution proposée',
      nonRegressionCriterion: 'Critère de non-régression',
    },
    REF: {
      scope: 'Périmètre',
      whyNow: 'Pourquoi maintenant',
      currentState: 'État actuel',
      nonRegressionProof: 'Preuve de non-régression',
      strategy: 'Stratégie',
      endCriterion: 'Critère de fin',
    },
    TEC: { what: 'Quoi', why: 'Pourquoi', verification: 'Vérification' },
    SPIKE: { question: 'Question', why: 'Pourquoi', budget: 'Budget', answerCriteria: 'Ce qui compte comme réponse' },
    EPIC: { vision: 'Vision', why: 'Pourquoi', globalCriteria: "Critères d'acceptation globaux", frame: 'Cadre', outOfScope: 'Hors périmètre' },
  })
  assert.deepEqual(VOCABULARY.criteria, { FEAT: 'acceptanceCriteria', FIX: 'nonRegressionCriterion' })
})

test('VOCABULARY carries exactly the other keys of the spec, with today\'s values [REF-34 AC-3]', () => {
  const { sections, criteria, ...others } = VOCABULARY
  assert.deepEqual(others, {
    amendments: 'Amendements',
    amendmentEntries: { reopened: 'tests rouverts', refrozen: 'tests regelés', leftFreeze: 'gel quitté' },
    slices: 'Tranches',
    plan: { coverage: 'AC couverts', tdd: 'TDD', yes: 'oui', no: 'non' },
    review: {
      tables: { blocking: 'Bloquant', discuss: 'À discuter' },
      legacyRound: 'Tour',
      columns: { point: 'Point', file: 'Fichier', treatment: 'Traitement' },
      treatments: {
        fixed: 'corrigé',
        testAdded: 'test ajouté',
        specAmended: 'spec amendée',
        acceptedException: 'exception acceptée',
        dismissed: 'écarté',
        postponed: 'reporté',
        requalified: 'requalifié',
        notApplicable: 'sans objet',
      },
      postponedSlice: 'tranche',
      markers: { resumed: 'repris', formerly: 'ex-' },
      empty: 'Aucun',
    },
  })
})

test('the treatment keywords keep their order [REF-34 AC-3]', () => {
  assert.deepEqual(Object.values(VOCABULARY.review.treatments), [
    'corrigé', 'test ajouté', 'spec amendée', 'exception acceptée', 'écarté', 'reporté', 'requalifié', 'sans objet',
  ])
})

test('VOCABULARY is frozen at every depth [REF-34 AC-3]', () => {
  const frozen = (value) => Object.isFrozen(value) && Object.values(value).every((child) => typeof child !== 'object' || frozen(child))
  assert.ok(frozen(VOCABULARY))
})

test('REQUIRED_SECTIONS keeps its values and order [REF-34 AC-3]', () => {
  assert.deepEqual(REQUIRED_SECTIONS, {
    FEAT: ['Contexte', 'Description', "Critères d'acceptation", 'Non-fonctionnel'],
    FIX: ['Problème', 'Reproduction', 'Cause probable', 'Solution proposée', 'Critère de non-régression'],
    REF: ['Périmètre', 'Pourquoi maintenant', 'État actuel', 'Preuve de non-régression', 'Stratégie', 'Critère de fin'],
    TEC: ['Quoi', 'Pourquoi', 'Vérification'],
    SPIKE: ['Question', 'Pourquoi', 'Budget', 'Ce qui compte comme réponse'],
    EPIC: ['Vision', 'Pourquoi', "Critères d'acceptation globaux", 'Cadre', 'Hors périmètre'],
  })
})

test('escapeRegExp makes a RegExp match its text literally', () => {
  const special = 'a.b*c+d?e^f${g}(h)|i[j]k\\l'
  assert.ok(new RegExp(`^${escapeRegExp(special)}$`).test(special))
  assert.ok(!new RegExp(`^${escapeRegExp('a.b')}$`).test('axb'))
})

test('isTreatment accepts each of the eight treatment keywords [REF-34 AC-3]', () => {
  for (const keyword of ['corrigé', 'test ajouté', 'spec amendée', 'exception acceptée', 'écarté', 'reporté', 'requalifié', 'sans objet']) {
    assert.ok(isTreatment(keyword), keyword)
  }
  assert.ok(!isTreatment('en cours'))
})

test('parseReviewPoints reads a point under « ### Bloquant » and under « ### À discuter » [REF-34 AC-3]', () => {
  const revue = [
    '## Revue 1',
    '### Bloquant',
    '| Point | Fichier | Traitement |',
    '|---|---|---|',
    '| RB1. Premier | a.mjs | corrigé |',
    '### À discuter',
    '| Point | Fichier | Traitement |',
    '|---|---|---|',
    '| RD2. Second | b.mjs | écarté |',
  ].join('\n')
  const rows = parseReviewPoints(revue).sections[0].rows
  assert.deepEqual(rows.map((row) => [row.id, row.table, row.file, row.treatment]), [
    ['RB1', 'Bloquant', 'a.mjs', 'corrigé'],
    ['RD2', 'À discuter', 'b.mjs', 'écarté'],
  ])
})
