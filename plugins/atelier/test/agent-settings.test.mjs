import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveAgentSettings } from '../lib/agent-settings.mjs'

// Result shape: { model, effort, sources: { model, effort }, rest, warnings, refusal }
// sources are 'argument' | 'utilisateur' | 'défaut'; refusal is null unless the resolution fails.

const DEFAULTS = {
  implementer: { model: 'sonnet', effort: 'medium' },
  'overfit-checker': { model: 'opus', effort: 'medium' },
  reviewer: { model: 'opus', effort: 'high' },
  'spec-critic': { model: 'opus', effort: 'high' },
}

function resolve(agent, options = {}) {
  return resolveAgentSettings(agent, { userModel: undefined, userEffort: undefined, args: '', ...options })
}

describe('agent settings: defaults and user options', () => {
  it('sans option ni argument, chaque sous-agent reçoit son défaut, source « défaut » [FEAT-27 CA-1]', () => {
    for (const [agent, expected] of Object.entries(DEFAULTS)) {
      const result = resolve(agent)
      assert.equal(result.model, expected.model, agent)
      assert.equal(result.effort, expected.effort, agent)
      assert.deepEqual(result.sources, { model: 'défaut', effort: 'défaut' }, agent)
      assert.deepEqual(result.warnings, [], agent)
      assert.equal(result.refusal, null, agent)
    }
  })

  it('une option de modèle seule l’emporte sur le défaut, l’effort reste le défaut [FEAT-27 CA-2]', () => {
    const result = resolve('reviewer', { userModel: 'sonnet' })
    assert.equal(result.model, 'sonnet')
    assert.equal(result.effort, 'high')
    assert.deepEqual(result.sources, { model: 'utilisateur', effort: 'défaut' })
    assert.deepEqual(result.warnings, [])
  })

  it('une option non réglée (texte ${user_config…} littéral, vide ou absente) compte comme absente, sans avertissement [FEAT-27 CA-3]', () => {
    for (const userModel of ['${user_config.reviewer_model}', '', undefined]) {
      const result = resolve('reviewer', { userModel, userEffort: userModel === undefined ? undefined : userModel.replace('model', 'effort') })
      assert.equal(result.model, 'opus', String(userModel))
      assert.equal(result.effort, 'high', String(userModel))
      assert.deepEqual(result.sources, { model: 'défaut', effort: 'défaut' }, String(userModel))
      assert.deepEqual(result.warnings, [], String(userModel))
    }
  })

  it('une option invalide est ignorée au profit du défaut, avec un avertissement qui nomme la valeur et l’option [FEAT-27 CA-6]', () => {
    for (const userModel of ['gpt', 'inherit', 'claude-opus-5-5']) {
      const result = resolve('reviewer', { userModel })
      assert.equal(result.model, 'opus', userModel)
      assert.equal(result.sources.model, 'défaut', userModel)
      assert.equal(result.warnings.length, 1, userModel)
      assert.ok(result.warnings[0].includes(userModel), result.warnings[0])
      assert.ok(result.warnings[0].includes('reviewer_model'), result.warnings[0])
    }
    const effort = resolve('implementer', { userEffort: 'ultra' })
    assert.equal(effort.effort, 'medium')
    assert.equal(effort.sources.effort, 'défaut')
    assert.equal(effort.warnings.length, 1)
    assert.ok(effort.warnings[0].includes('ultra') && effort.warnings[0].includes('implementer_effort'), effort.warnings[0])
  })

  it('les options sont reconnues sans tenir compte de la casse et rendues en minuscules [FEAT-27 CA-8]', () => {
    const result = resolve('implementer', { userModel: 'Sonnet', userEffort: 'XHIGH' })
    assert.equal(result.model, 'sonnet')
    assert.equal(result.effort, 'xhigh')
    assert.deepEqual(result.sources, { model: 'utilisateur', effort: 'utilisateur' })
    assert.deepEqual(result.warnings, [])
  })
})

describe('agent settings: command argument', () => {
  it('l’argument l’emporte sur les options et le défaut, modèle et effort indépendamment [FEAT-27 CA-4]', () => {
    const both = resolve('implementer', { userModel: 'haiku', userEffort: 'low', args: 'opus high' })
    assert.equal(both.model, 'opus')
    assert.equal(both.effort, 'high')
    assert.deepEqual(both.sources, { model: 'argument', effort: 'argument' })

    const modelOnly = resolve('implementer', { userModel: 'haiku', userEffort: 'low', args: 'opus' })
    assert.equal(modelOnly.model, 'opus')
    assert.equal(modelOnly.effort, 'low')
    assert.deepEqual(modelOnly.sources, { model: 'argument', effort: 'utilisateur' })
  })

  it('les mots non reconnus sont rendus comme reste, sans avertissement pour implementer [FEAT-27 CA-5]', () => {
    const mixed = resolve('implementer', { args: '2 opus' })
    assert.equal(mixed.model, 'opus')
    assert.equal(mixed.rest, '2')
    assert.deepEqual(mixed.warnings, [])

    for (const args of ['2', 'ultra']) {
      const result = resolve('implementer', { args })
      assert.equal(result.rest, args)
      assert.equal(result.model, 'sonnet', args)
      assert.equal(result.effort, 'medium', args)
      assert.deepEqual(result.sources, { model: 'défaut', effort: 'défaut' }, args)
      assert.deepEqual(result.warnings, [], args)
    }

    assert.equal(resolve('implementer', { args: 'opus high' }).rest, '')
  })

  it('deux modèles ou deux efforts différents sont refusés, en nommant les deux valeurs ; une valeur répétée est tolérée [FEAT-27 CA-7]', () => {
    for (const [args, first, second] of [['opus sonnet', 'opus', 'sonnet'], ['low high', 'low', 'high']]) {
      const result = resolve('reviewer', { args })
      assert.equal(typeof result.refusal, 'string', args)
      assert.ok(result.refusal.includes(first) && result.refusal.includes(second), result.refusal)
    }
    const repeated = resolve('reviewer', { args: 'opus opus' })
    assert.equal(repeated.refusal, null)
    assert.equal(repeated.model, 'opus')
    assert.equal(repeated.sources.model, 'argument')
  })

  it('l’argument est reconnu sans tenir compte de la casse et l’emporte sur une option en majuscules [FEAT-27 CA-8]', () => {
    const result = resolve('reviewer', { userModel: 'Sonnet', args: 'Opus HIGH' })
    assert.equal(result.model, 'opus')
    assert.equal(result.effort, 'high')
    assert.deepEqual(result.sources, { model: 'argument', effort: 'argument' })
    assert.equal(result.rest, '')
  })

  it('un reste pour reviewer ou spec-critic est rendu avec un avertissement qui dit qu’il est ignoré, pas pour implementer [FEAT-27 CA-9]', () => {
    for (const agent of ['reviewer', 'spec-critic']) {
      const result = resolve(agent, { args: 'foo' })
      assert.equal(result.rest, 'foo', agent)
      assert.equal(result.warnings.length, 1, agent)
      assert.ok(result.warnings[0].includes('foo'), result.warnings[0])
      assert.match(result.warnings[0], /ignor/i)
    }
    assert.deepEqual(resolve('implementer', { args: 'foo' }).warnings, [])
  })
})
