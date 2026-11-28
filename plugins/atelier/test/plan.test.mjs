import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { planSlices, planSliceCount } from '../lib/slices.mjs'
import { checkPlanValues, planProblems } from '../lib/slices.mjs'
import { atelierRun, chantierDirectoryOf, commitFiles, makeSlicedRepository, setHeader, specData, specText } from './helpers.mjs'

// Plan of AC-1: one slice per way of writing it (TDD declared, tolerant spelling, undeclared),
// plus an HTML comment, indented sub-lists and a later numbered section that must be ignored.
const plan = `# Plan : FIX-20

## Approche
Texte.

## Tranches
<!-- 1. <tranche> — AC couverts : AC-x — TDD : oui|non
4. Exemple — AC couverts : AC-4 — TDD : oui -->
1. Analyse — AC couverts : AC-1, AC-27 (plugin) — TDD : oui
   1. sous-étape — AC couverts : AC-9 — TDD : non
   - AC-8 évoqué en passant
2. Site — AC couverts : aucun — tdd:non
3. Export — AC couverts : AC-3

## Risques et points d'attention
1. pas une tranche — AC couverts : AC-5 — TDD : oui
2. toujours pas
3. non
4. non
`

const expected = [
  { number: 1, criteria: ['AC-1', 'AC-27'], tdd: 'yes' },
  { number: 2, criteria: [], tdd: 'no' },
  { number: 3, criteria: ['AC-3'], tdd: null },
]

describe('reading the slices of the plan', () => {
  it('lit le numéro, les AC et le TDD de chaque tranche [FIX-20 AC-1]', () => {
    assert.deepEqual(planSlices(plan), expected)
  })

  it('lit de même un plan en CRLF [FIX-20 AC-1]', () => {
    assert.deepEqual(planSlices(plan.replace(/\n/g, '\r\n')), expected)
  })

  it('sans plan ou sans section « Tranches », aucune tranche [FIX-20 AC-1]', () => {
    for (const text of [null, '', '# Plan\n\n## Approche\n1. pas une tranche — TDD : oui\n']) {
      assert.deepEqual(planSlices(text), [], String(text))
    }
  })

  it('planSliceCount compte les tranches lues par planSlices [FIX-20 AC-1]', () => {
    assert.equal(planSliceCount(plan), 3)
  })
})


// A signed chantier as readChantier returns it, from spec header values, spec body and plan text.
function chantierOf({ type = 'FIX', tdd = 'yes', body, plan: planText, ...header }) {
  return { id: `${type}-40`, spec: { data: { status: 'signed', type, tdd, ...header }, body }, plan: planText }
}

const specBody = `# FIX-40

## 5. Critère de non-régression
<!-- - [ ] AC-9 : exemple en commentaire -->
- [ ] AC-1 : premier critère
- AC-2 : second critère
- [ ] AC-3 : troisième critère
`

const tranches = (...lines) => `# Plan : FIX-40\n\n## Tranches\n${lines.join('\n')}\n\n## Risques\n- aucun\n`
const goodPlan = tranches(
  '1. Lecture — AC couverts : AC-1, AC-2 — TDD : oui',
  '2. Commande — AC couverts : AC-3 — TDD:oui',
  '3. Site — AC couverts : aucun — TDD : non',
)

describe('plan problems (check-plan)', () => {
  it('un plan correct ne produit aucun problème [FIX-20 AC-11]', () => {
    assert.deepEqual(planProblems(chantierOf({ body: specBody, plan: goodPlan })), [])
  })

  it('signale une tranche sans TDD déclaré, une tranche TDD sans AC, un AC non couvert, un AC cité absent de la spec [FIX-20 AC-11]', () => {
    const plan = tranches(
      '1. Lecture — AC couverts : AC-1',
      '2. Commande — AC couverts : aucun — TDD : oui',
      '3. Export — AC couverts : AC-2, AC-7 — TDD : oui',
    )
    const problems = planProblems(chantierOf({ body: specBody, plan }))
    assert.equal(problems.length, 4, problems.join('\n'))
    assert.ok(problems.some((problem) => /tranche 1/i.test(problem) && /TDD/.test(problem)), 'TDD non déclaré')
    assert.ok(problems.some((problem) => /tranche 2/i.test(problem) && /aucun AC|sans AC/i.test(problem)), 'TDD sans AC')
    assert.ok(problems.some((problem) => /AC-3/.test(problem) && /aucune tranche/.test(problem)), 'AC non couvert')
    assert.ok(problems.some((problem) => /AC-7/.test(problem) && /absent de la spec/.test(problem)), 'AC absent de la spec')
  })

  it('signale deux tranches de même numéro [FIX-20 AC-11]', () => {
    const plan = tranches(
      '1. Lecture — AC couverts : AC-1, AC-2 — TDD : oui',
      '1. Commande — AC couverts : AC-3 — TDD : oui',
    )
    const problems = planProblems(chantierOf({ body: specBody, plan }))
    assert.equal(problems.length, 1, problems.join('\n'))
    assert.match(problems[0], /tranche 1/i)
  })

  it('lit le plan avec tolérance : tiret demi-cadratin, texte après oui/non, AC en minuscules [FIX-20 AC-11]', () => {
    const plan = tranches(
      '1. Lecture – AC couverts : ac-1, AC-2 – TDD : oui (logique pure).',
      '2. Commande — AC couverts:AC-3 — TDD:OUI',
      '3. Site — AC couverts : aucun — tdd : non, rien à tester',
    )
    assert.deepEqual(planSlices(plan), [
      { number: 1, criteria: ['AC-1', 'AC-2'], tdd: 'yes' },
      { number: 2, criteria: ['AC-3'], tdd: 'yes' },
      { number: 3, criteria: [], tdd: 'no' },
    ])
    assert.deepEqual(planProblems(chantierOf({ body: specBody, plan })), [])
  })

  it('un EPIC n’est pas contrôlé [FIX-20 AC-11]', () => {
    assert.deepEqual(planProblems(chantierOf({ type: 'EPIC', tdd: 'no', body: specBody, plan: tranches('1. Lot — AC couverts : AC-8') })), [])
  })
})

describe('values written by check-plan', () => {
  const values = (header, plan = goodPlan) => checkPlanValues(chantierOf({ body: specBody, plan, ...header }))

  it('écrit slice_tdd d’après la tranche 1, même dans un plan à une seule tranche [FIX-20 AC-12]', () => {
    assert.deepEqual(values({}), { slice_tdd: 'yes' })
    assert.deepEqual(values({}, tranches('1. Site — AC couverts : AC-1, AC-2, AC-3 — TDD : non')), { slice_tdd: 'no' })
    assert.deepEqual(values({ slice: '1' }, tranches('1. Tout — AC couverts : AC-1, AC-2, AC-3 — TDD : oui')), { slice_tdd: 'yes' })
  })

  it('n’écrit rien une fois des tests figés, une revue enregistrée ou slice_tdd renseigné [FIX-20 AC-12]', () => {
    assert.deepEqual(values({ tests_commit: 'abc1234' }), {})
    assert.deepEqual(values({ slice: '2', slice_base: 'a'.repeat(40) }), {})
    assert.deepEqual(values({ reviewed_commit: 'a'.repeat(40) }), {})
    assert.deepEqual(values({ slice_tdd: 'no' }), {}, 'le plan dit désormais oui : slice_tdd ne change plus')
  })

  it('atelier check-plan : 0 et slice_tdd écrit sur un plan correct, 2 sur un plan à problèmes, 1 sans plan ; EPIC ignoré [FIX-20 AC-12]', () => {
    const directory = makeSlicedRepository({ id: 'FIX-40', plan: goodPlan })
    const specPath = `${chantierDirectoryOf(directory, 'FIX-40')}/spec.md`
    commitFiles(directory, { [specPath.slice(directory.length + 1)]: specText({ id: 'FIX-40', tdd: 'yes', body: specBody }) }, 'docs: spec')

    const ok = atelierRun(directory, 'check-plan')
    assert.equal(ok.status, 0, ok.output)
    assert.equal(specData(directory, 'FIX-40').slice_tdd, 'yes')
    assert.match(ok.output, /[Cc]ommite la spec/)

    setHeader(directory, 'FIX-40', { slice_tdd: 'no' })
    assert.equal(atelierRun(directory, 'check-plan').status, 0)
    assert.equal(specData(directory, 'FIX-40').slice_tdd, 'no', 'relancer check-plan ne touche plus slice_tdd')

    const planPath = `${chantierDirectoryOf(directory, 'FIX-40')}/plan.md`.slice(directory.length + 1)
    commitFiles(directory, { [planPath]: tranches('1. Lecture — AC couverts : AC-1') }, 'docs: plan')
    const broken = atelierRun(directory, 'check-plan')
    assert.equal(broken.status, 2, broken.output)
    assert.match(broken.output, /AC-3/)

    assert.equal(atelierRun(directory, 'check-plan', 'docs/absent/plan.md').status, 1)

    const epic = makeSlicedRepository({ id: 'EPIC-41', tdd: 'no', plan: tranches('1. Lot — AC couverts : AC-8') })
    const epicRun = atelierRun(epic, 'check-plan')
    assert.equal(epicRun.status, 0, epicRun.output)
    assert.match(epicRun.output, /EPIC/)
    assert.equal(specData(epic, 'EPIC-41').slice_tdd ?? '', '')
  })
})

describe('check-plan, complements', () => {
  const values = (header, body = specBody) => checkPlanValues(chantierOf({ body, plan: goodPlan, ...header }))
  const amended = (entry) => `${specBody}\n## Amendements\n- ${entry}\n`

  it('n’écrit rien après une réouverture ou un regel des tests, ni pour un EPIC ou un SPIKE sans TDD [FIX-20 AC-12]', () => {
    assert.deepEqual(values({}, amended('2026-11-01 : tests rouverts (gel quitté : abc1234) : oubli')), {}, 'tests rouverts')
    assert.deepEqual(values({}, amended('2026-11-02 : tests regelés : def5678')), {}, 'tests regelés')
    assert.deepEqual(values({ type: 'EPIC', tdd: 'no' }), {}, 'EPIC')
    assert.deepEqual(values({ type: 'SPIKE', tdd: 'no' }), {}, 'SPIKE sans TDD')
  })

  it('signale un plan sans tranche et une numérotation trouée [FIX-20 AC-11]', () => {
    const empty = planProblems(chantierOf({ body: specBody, plan: '# Plan\n\n## Tranches\nÀ venir.\n' }))
    assert.ok(empty.some((problem) => /aucune tranche/i.test(problem)), empty.join('\n'))
    const gap = planProblems(chantierOf({ body: specBody, plan: tranches(
      '1. Lecture — AC couverts : AC-1, AC-2 — TDD : oui',
      '3. Commande — AC couverts : AC-3 — TDD : oui',
    ) }))
    assert.equal(gap.length, 1, gap.join('\n'))
    assert.match(gap[0], /tranche 2/i)
  })

  it('lit les AC de la spec sans casse, avec les puces -, * ou + [FIX-20 AC-11]', () => {
    const body = '# FIX-40\n\n## 5. Critères\n- [ ] ac-1 : premier\n* AC-2 : second\n+ [x] AC-3 : troisième\n'
    assert.deepEqual(planProblems(chantierOf({ body, plan: goodPlan })), [])
    const problems = planProblems(chantierOf({ body: `${body}* AC-4 : quatrième\n`, plan: goodPlan }))
    assert.deepEqual(problems.filter((problem) => /AC-4/.test(problem)).length, 1, problems.join('\n'))
  })

  it('atelier check-plan : 1 sans argument ni plan.md, et sur un dossier [FIX-20 AC-12]', () => {
    const directory = makeSlicedRepository({ id: 'FIX-40', plan: null })
    const missing = atelierRun(directory, 'check-plan')
    assert.equal(missing.status, 1, missing.output)
    assert.match(missing.output, /introuvable/i)
    const folder = atelierRun(directory, 'check-plan', 'docs')
    assert.equal(folder.status, 1, folder.output)
    assert.match(folder.output, /introuvable/i)
  })

  it('atelier check-plan sur un autre fichier que le plan du chantier : contrôle sans écrire slice_tdd [FIX-20 AC-12]', () => {
    const directory = makeSlicedRepository({ id: 'FIX-40', plan: goodPlan.replace('TDD : oui', 'TDD : non') })
    const chantierDirectory = chantierDirectoryOf(directory, 'FIX-40').slice(directory.length + 1)
    commitFiles(directory, {
      [`${chantierDirectory}/spec.md`]: specText({ id: 'FIX-40', tdd: 'yes', body: specBody }),
      'notes/autre-plan.md': goodPlan,
    }, 'docs: spec')
    const other = atelierRun(directory, 'check-plan', 'notes/autre-plan.md')
    assert.equal(other.status, 0, other.output)
    assert.equal(specData(directory, 'FIX-40').slice_tdd ?? '', '', 'autre fichier : rien d’écrit')
    assert.doesNotMatch(other.output, /[Cc]ommite la spec/)

    const own = atelierRun(directory, 'check-plan', `${chantierDirectory}/plan.md`)
    assert.equal(own.status, 0, own.output)
    assert.equal(specData(directory, 'FIX-40').slice_tdd, 'no', 'le plan du chantier, désigné par son chemin')
  })
})
