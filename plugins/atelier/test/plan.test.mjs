import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as core from '../lib/core.mjs'

// Plan of CA-1: one slice per way of writing it (TDD declared, tolerant spelling, undeclared),
// plus an HTML comment, indented sub-lists and a later numbered section that must be ignored.
const plan = `# Plan : FIX-20

## Approche
Texte.

## Tranches
<!-- 1. <tranche> — CA couverts : CA-x — TDD : oui|non
4. Exemple — CA couverts : CA-4 — TDD : oui -->
1. Analyse — CA couverts : CA-1, CA-27 (plugin) — TDD : oui
   1. sous-étape — CA couverts : CA-9 — TDD : non
   - CA-8 évoqué en passant
2. Site — CA couverts : aucun — tdd:non
3. Export — CA couverts : CA-3

## Risques et points d'attention
1. pas une tranche — CA couverts : CA-5 — TDD : oui
2. toujours pas
3. non
4. non
`

const expected = [
  { number: 1, criteria: ['CA-1', 'CA-27'], tdd: 'yes' },
  { number: 2, criteria: [], tdd: 'no' },
  { number: 3, criteria: ['CA-3'], tdd: null },
]

describe('FIX-20 reading the slices of the plan', () => {
  it('lit le numéro, les CA et le TDD de chaque tranche [FIX-20 CA-1]', () => {
    assert.deepEqual(core.planSlices(plan), expected)
  })

  it('lit de même un plan en CRLF [FIX-20 CA-1]', () => {
    assert.deepEqual(core.planSlices(plan.replace(/\n/g, '\r\n')), expected)
  })

  it('sans plan ou sans section « Tranches », aucune tranche [FIX-20 CA-1]', () => {
    for (const text of [null, '', '# Plan\n\n## Approche\n1. pas une tranche — TDD : oui\n']) {
      assert.deepEqual(core.planSlices(text), [], String(text))
    }
  })

  it('planSliceCount compte les tranches lues par planSlices [FIX-20 CA-1]', () => {
    assert.equal(core.planSliceCount(plan), 3)
  })
})
