import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { planProblems, planSlices } from '../lib/slices.mjs'
import { checkSpec } from '../lib/spec.mjs'

// Acceptance criteria are written AC-n; the retired forms CA-n and V-n are no longer read.

// A signed FIX chantier as readChantier returns it, from a spec body and a plan text.
function chantierOf(body, planText) {
  return { id: 'FIX-40', spec: { data: { status: 'signed', type: 'FIX', tdd: 'yes' }, body }, plan: planText }
}

const planOf = (...entries) => `# Plan : FIX-40\n\n## Tranches\n${entries.join('\n')}\n`

// The criteria of the spec covered by no slice: planProblems names each of them.
function uncoveredCriteria(body) {
  const problems = planProblems(chantierOf(body, planOf('1. Rien — TDD : non')))
  return problems.filter((problem) => /aucune tranche/.test(problem)).map((problem) => problem.match(/^\S+/)[0])
}

const feat = (criteria) => `---\nid: FEAT-40\ntype: FEAT\ntitle: Essai\nstatus: draft\ntdd: yes\n---\n\n# FEAT-40 Essai\n\n## 4. Critères d'acceptation\n${criteria}\n`
const noCriterionProblems = (text) => checkSpec(text).filter((problem) => /aucun critère numéroté/.test(problem))

describe('critères d’acceptation de la spec', () => {
  it('les critères AC-n se lisent en tête d’élément de liste, sans distinction de casse [TEC-37 AC-1]', () => {
    const body = '# FIX-40\n\n## 5. Critère de non-régression\n- [ ] AC-1 : premier\n- AC-2 : second\n- ac-3 : troisième\n'
    assert.deepEqual(uncoveredCriteria(body), ['AC-1', 'AC-2', 'AC-3'])
  })

  it('les anciennes formes ne sont plus lues comme des critères [TEC-37 AC-1]', () => {
    const body = '# FIX-40\n\n## 5. Critère de non-régression\n- [ ] CA-1 : premier\n- V-2 : second\n'
    assert.deepEqual(uncoveredCriteria(body), [])
  })
})

describe('section obligatoire de critères dans check-spec', () => {
  it('une section qui porte des AC-n, en majuscules ou non, n’est pas signalée [TEC-37 AC-2]', () => {
    assert.deepEqual(noCriterionProblems(feat('- [ ] AC-1 : Étant donné un budget, quand je l’ouvre, alors je vois le total.')), [])
    assert.deepEqual(noCriterionProblems(feat('- [ ] ac-1 : Étant donné un budget, quand je l’ouvre, alors je vois le total.')), [])
  })

  it('une section qui ne porte que des CA-n est signalée, et le message cite AC-1, AC-2… [TEC-37 AC-2]', () => {
    const problems = noCriterionProblems(feat('- [ ] CA-1 : Étant donné un budget, quand je l’ouvre, alors je vois le total.'))
    assert.equal(problems.length, 1)
    assert.match(problems[0], /AC-1, AC-2…/)
    assert.doesNotMatch(problems[0], /CA-/)
  })
})

describe('couverture d’une tranche du plan', () => {
  it('le segment « AC couverts » donne les critères de la tranche [TEC-37 AC-3]', () => {
    assert.deepEqual(planSlices(planOf('1. Lecture — AC couverts : AC-1, AC-2 — TDD : oui')), [
      { number: 1, criteria: ['AC-1', 'AC-2'], tdd: 'yes' },
    ])
  })

  it('l’ancien segment « CA couverts » ne couvre rien, et check-plan le signale [TEC-37 AC-3]', () => {
    const plan = planOf('1. Lecture — CA couverts : CA-1 — TDD : oui')
    assert.deepEqual(planSlices(plan), [{ number: 1, criteria: [], tdd: 'yes' }])
    const problems = planProblems(chantierOf('# FIX-40\n\n## 5. Critère de non-régression\n- [ ] AC-1 : premier\n', plan))
    assert.ok(problems.some((problem) => /Tranche 1/.test(problem) && /sans AC couvert/.test(problem)), problems.join('\n'))
    assert.doesNotMatch(problems.join('\n'), /\bCA\b/)
  })
})
