// Vocabulary of the documents of a chantier: the French terms the code reads from or writes to
// specs, plans and reviews, under canonical English keys. Pure module: it imports nothing.

function deepFreeze(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') {
      deepFreeze(child)
    }
  }
  return Object.freeze(value)
}

export const VOCABULARY = deepFreeze({
  // Section titles required before signature, per chantier type (in the order of the spec template).
  sections: {
    FEAT: {
      context: 'Contexte',
      description: 'Description',
      acceptanceCriteria: "Critères d'acceptation",
      nonFunctional: 'Non-fonctionnel',
    },
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
    TEC: {
      what: 'Quoi',
      why: 'Pourquoi',
      verification: 'Vérification',
    },
    SPIKE: {
      question: 'Question',
      why: 'Pourquoi',
      budget: 'Budget',
      answerCriteria: 'Ce qui compte comme réponse',
    },
    EPIC: {
      vision: 'Vision',
      why: 'Pourquoi',
      globalCriteria: "Critères d'acceptation globaux",
      frame: 'Cadre',
      outOfScope: 'Hors périmètre',
    },
  },
  // Per type, the key (in `sections.<TYPE>`) of the section that must hold numbered criteria.
  criteria: {
    FEAT: 'acceptanceCriteria',
    FIX: 'nonRegressionCriterion',
  },
  amendments: 'Amendements',
  amendmentEntries: {
    reopened: 'tests rouverts',
    refrozen: 'tests regelés',
  },
  slices: 'Tranches',
  review: {
    tables: {
      blocking: 'Bloquant',
      discuss: 'À discuter',
    },
    legacyRound: 'Tour',
    columns: {
      point: 'Point',
      file: 'Fichier',
      treatment: 'Traitement',
    },
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
    markers: {
      resumed: 'repris',
      formerly: 'ex-',
    },
    empty: 'Aucun',
  },
})
