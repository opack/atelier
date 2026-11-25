import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolveAgentSettings } from '../lib/agent-settings.mjs'
import { parseFrontMatter } from '../lib/common.mjs'
import { atelier, atelierRun, makeRepository } from './helpers.mjs'

// Result shape: { model, effort, sources: { model, effort }, rest, warnings, refusal }
// sources are 'argument' | 'utilisateur' | 'recommandé'; refusal is null unless the resolution fails.

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
  it('sans option ni argument, chaque sous-agent reçoit son défaut, source « recommandé » [FEAT-27 CA-1]', () => {
    for (const [agent, expected] of Object.entries(DEFAULTS)) {
      const result = resolve(agent)
      assert.equal(result.model, expected.model, agent)
      assert.equal(result.effort, expected.effort, agent)
      assert.deepEqual(result.sources, { model: 'recommandé', effort: 'recommandé' }, agent)
      assert.deepEqual(result.warnings, [], agent)
      assert.equal(result.refusal, null, agent)
    }
  })

  it('une option de modèle seule l’emporte sur le défaut, l’effort reste le défaut [FEAT-27 CA-2]', () => {
    const result = resolve('reviewer', { userModel: 'sonnet' })
    assert.equal(result.model, 'sonnet')
    assert.equal(result.effort, 'high')
    assert.deepEqual(result.sources, { model: 'utilisateur', effort: 'recommandé' })
    assert.deepEqual(result.warnings, [])
  })

  it('une option non réglée (texte ${user_config…} littéral, vide ou absente) compte comme absente, sans avertissement [FEAT-27 CA-3]', () => {
    for (const userModel of ['${user_config.reviewer_model}', '', undefined]) {
      const result = resolve('reviewer', { userModel, userEffort: userModel === undefined ? undefined : userModel.replace('model', 'effort') })
      assert.equal(result.model, 'opus', String(userModel))
      assert.equal(result.effort, 'high', String(userModel))
      assert.deepEqual(result.sources, { model: 'recommandé', effort: 'recommandé' }, String(userModel))
      assert.deepEqual(result.warnings, [], String(userModel))
    }
  })

  it('une option « recommandé (…) » compte comme non réglée, quelle que soit la valeur entre parenthèses, même périmée [FEAT-27 CA-3]', () => {
    for (const [userModel, userEffort] of [['recommandé (opus)', 'recommandé (high)'], ['Recommandé (haiku)', 'RECOMMANDÉ (low)']]) {
      const result = resolve('reviewer', { userModel, userEffort })
      assert.equal(result.model, 'opus', userModel)
      assert.equal(result.effort, 'high', userEffort)
      assert.deepEqual(result.sources, { model: 'recommandé', effort: 'recommandé' }, userModel)
      assert.deepEqual(result.warnings, [], userModel)
    }
  })

  it('une option invalide est ignorée au profit du défaut, avec un avertissement qui nomme la valeur et l’option [FEAT-27 CA-6]', () => {
    for (const userModel of ['gpt', 'inherit', 'claude-opus-5-5']) {
      const result = resolve('reviewer', { userModel })
      assert.equal(result.model, 'opus', userModel)
      assert.equal(result.sources.model, 'recommandé', userModel)
      assert.equal(result.warnings.length, 1, userModel)
      assert.ok(result.warnings[0].includes(userModel), result.warnings[0])
      assert.ok(result.warnings[0].includes('reviewer_model'), result.warnings[0])
    }
    const effort = resolve('implementer', { userEffort: 'ultra' })
    assert.equal(effort.effort, 'medium')
    assert.equal(effort.sources.effort, 'recommandé')
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
      assert.deepEqual(result.sources, { model: 'recommandé', effort: 'recommandé' }, args)
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

describe('agent settings: defaults declared in the plugin files', () => {
  const pluginFile = (relativePath) => readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8')
  const repositoryFile = (relativePath) => readFileSync(fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url)), 'utf8')
  // userConfig keys only allow letters, digits and underscores.
  const optionKey = (agent, kind) => `${agent.replaceAll('-', '_')}_${kind}`

  it('le manifeste déclare, par sous-agent, une option de modèle et une d’effort, facultatives, « recommandé (<défaut du code>) » par défaut et en tête d’une liste fermée [FEAT-27 CA-10]', () => {
    const userConfig = JSON.parse(pluginFile('.claude-plugin/plugin.json')).userConfig ?? {}
    for (const [agent, expected] of Object.entries(DEFAULTS)) {
      for (const [kind, allowed] of [['model', ['sonnet', 'opus', 'haiku', 'fable']], ['effort', ['low', 'medium', 'high', 'xhigh', 'max']]]) {
        const option = userConfig[optionKey(agent, kind)]
        assert.ok(option, `option ${optionKey(agent, kind)} absente`)
        assert.equal(option.type, 'string', optionKey(agent, kind))
        assert.notEqual(option.required, true, optionKey(agent, kind))
        assert.equal(option.default, `recommandé (${expected[kind]})`, optionKey(agent, kind))
        assert.equal(option.options[0], option.default, `${optionKey(agent, kind)} : « ${option.default} » en tête de liste`)
        assert.deepEqual(option.options.slice(1).sort(), [...allowed].sort(), optionKey(agent, kind))
      }
    }
  })

  it('l’en-tête model / effort de chaque agent est égal au défaut du code [FEAT-27 CA-10]', () => {
    for (const [agent, expected] of Object.entries(DEFAULTS)) {
      const { data } = parseFrontMatter(pluginFile(`agents/${agent}.md`))
      assert.equal(data.name, agent)
      assert.equal(data.model, expected.model, agent)
      assert.equal(data.effort, expected.effort, agent)
    }
  })

  it('le tableau des défauts de modes.md donne, pour chaque sous-agent, le modèle et l’effort du code [FEAT-27 CA-10]', () => {
    const rows = repositoryFile('site/agent/modes.md').split(/\r?\n/).filter((line) => line.trim().startsWith('|'))
    for (const [agent, expected] of Object.entries(DEFAULTS)) {
      const row = rows.find((line) => line.includes(`\`${agent}\``))
      assert.ok(row, `pas de ligne pour ${agent} dans modes.md`)
      assert.ok(row.includes(`\`${expected.model}\``) && row.includes(`\`${expected.effort}\``), row)
    }
  })

  it('l’agent implementer peut éditer, a une section « Interdit » complète et rend « Arrêt : test à revoir » [FEAT-27 CA-13]', () => {
    const { data, body } = parseFrontMatter(pluginFile('agents/implementer.md'))
    for (const tool of ['Read', 'Edit', 'Write', 'Bash']) {
      assert.match(String(data.tools), new RegExp(`\\b${tool}\\b`), tool)
    }
    const forbidden = body.split(/^## /m).find((section) => /^Interdit/.test(section))
    assert.ok(forbidden, 'section « ## Interdit » absente')
    for (const subject of [/test/i, /commit/i, /`atelier/, /spec/i, /decisions\.md/]) {
      assert.match(forbidden, subject)
    }
    assert.ok(body.includes('Arrêt : test à revoir'))
  })
})

describe('agent settings: atelier agent-settings command', () => {
  it('rend en JSON le modèle, l’effort, leurs sources et le reste, option non réglée comprise [FEAT-27 CA-5]', () => {
    const directory = makeRepository('main')
    const output = atelier(directory, 'agent-settings', 'implementer', '--user-model', '${user_config.implementer_model}', '--user-effort', '', '--args', '2 opus')
    const result = JSON.parse(output)
    assert.equal(result.model, 'opus')
    assert.equal(result.effort, 'medium')
    assert.deepEqual(result.sources, { model: 'argument', effort: 'recommandé' })
    assert.equal(result.rest, '2')
    assert.deepEqual(result.warnings, [])
  })

  it('sort avec un code non nul et nomme les deux valeurs en cas de refus ; tolère une valeur répétée [FEAT-27 CA-7]', () => {
    const directory = makeRepository('main')
    const refused = atelierRun(directory, 'agent-settings', 'reviewer', '--args', 'opus sonnet')
    assert.notEqual(refused.status, 0)
    assert.match(refused.output, /opus/)
    assert.match(refused.output, /sonnet/)

    const repeated = JSON.parse(atelier(directory, 'agent-settings', 'reviewer', '--args', 'opus opus'))
    assert.equal(repeated.model, 'opus')
    assert.equal(repeated.effort, 'high')
  })
})

describe('agent settings: skills that launch the subagents', () => {
  const skill = (name) => readFileSync(fileURLToPath(new URL(`../skills/${name}/SKILL.md`, import.meta.url)), 'utf8')
  const call = (agent, withArguments) => {
    const option = agent.replaceAll('-', '_')
    const base = `atelier agent-settings ${agent} --user-model '\${user_config.${option}_model}' --user-effort '\${user_config.${option}_effort}'`
    return withArguments ? `${base} --args '$ARGUMENTS'` : base
  }
  const instructions = [
    'Passe `model` et `effort` à l’appel du sous-agent',
    'Annonce le modèle, l’effort, leur source et les avertissements',
    'Si la commande échoue, affiche son message et arrête-toi',
  ]

  it('sign, review et build résolvent leurs sous-agents par la commande, valeurs entre guillemets simples, et en suivent le résultat [FEAT-27 CA-11]', () => {
    for (const [name, agents] of [['sign', [['spec-critic', true]]], ['review', [['reviewer', true]]], ['build', [['implementer', true], ['overfit-checker', false]]]]) {
      const text = skill(name)
      for (const [agent, withArguments] of agents) {
        assert.ok(text.includes(call(agent, withArguments)), `${name} : appel attendu « ${call(agent, withArguments)} »`)
      }
      for (const instruction of instructions) {
        assert.ok(text.includes(instruction), `${name} : consigne attendue « ${instruction} »`)
      }
    }
  })

  it('dans build, overfit-checker est résolu sans l’argument de la commande [FEAT-27 CA-11]', () => {
    const line = skill('build').split(/\r?\n/).find((candidate) => candidate.includes('atelier agent-settings overfit-checker'))
    assert.ok(line, 'appel pour overfit-checker absent')
    assert.doesNotMatch(line, /--args/)
  })

  it('build confie tout le code à implementer et lance atelier checks après chaque retour [FEAT-27 CA-12]', () => {
    const text = skill('build')
    const sections = text.split(/^## /m)
    for (const heading of [/^1\. /, /^2\. /, /^Sans TDD/]) {
      const section = sections.find((candidate) => heading.test(candidate))
      assert.ok(section, `section ${heading} absente`)
      assert.ok(section.includes('`atelier:implementer`'), `section ${heading} sans atelier:implementer`)
    }
    const chantierReview = text.split(/\r?\n\r?\n/).find((paragraph) => paragraph.includes('`slice: "chantier"`'))
    assert.ok(chantierReview && chantierReview.includes('`atelier:implementer`'), 'corrections de la revue du chantier sans atelier:implementer')
    assert.ok(text.includes('Après chaque retour d’`implementer`, lance `atelier checks`'))
    for (const ownCode of ['Écris le code', 'Implémente la tranche']) {
      assert.ok(!text.includes(ownCode), `consigne où build code lui-même : « ${ownCode} »`)
    }
  })

  it('la commande refuse une option répétée, qui contournerait le refus de deux valeurs [FEAT-27 CA-7]', () => {
    const directory = makeRepository('main')
    const repeated = atelierRun(directory, 'agent-settings', 'reviewer', '--args', 'opus sonnet', '--args', '')
    assert.equal(repeated.status, 1, repeated.output)
    assert.match(repeated.output, /--args/)
  })
})

describe('agent settings: documentation', () => {
  const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
  const site = (page) => read(`../../../site/${page}`)
  const tableRow = (text, start) => text.split(/\r?\n/).find((line) => line.startsWith(`| ${start}`))
  const options = Object.keys(DEFAULTS).flatMap((agent) => ['model', 'effort'].map((kind) => `${agent.replaceAll('-', '_')}_${kind}`))

  it('modes.md présente l’ordre de résolution et opusplan [FEAT-27 CA-14]', () => {
    const text = site('agent/modes.md')
    assert.ok(text.includes('/plugin configure atelier'), 'option utilisateur non expliquée')
    assert.match(text, /argument de la commande/)
    assert.match(text, /Valeurs recommandées/)
    assert.ok(text.includes('opusplan'), 'opusplan absent')
  })

  it('configuration.md liste les 8 options [FEAT-27 CA-14]', () => {
    const text = site('reference/configuration.md')
    for (const option of options) {
      assert.ok(text.includes(`\`${option}\``), `option ${option} absente de configuration.md`)
    }
    assert.match(text, /\]\(\.\.\/agent\/modes[^)]*\)/, 'pas de renvoi vers les valeurs recommandées de modes.md')
  })

  it('commandes.md donne le modèle et l’effort en argument de build, review et sign, et décrit implementer [FEAT-27 CA-14]', () => {
    const text = site('reference/commandes.md')
    for (const command of ['build', 'review', 'sign']) {
      const row = tableRow(text, `\`/atelier:${command}`)
      assert.ok(row, `ligne /atelier:${command} absente`)
      assert.match(row, /modèle/, `/atelier:${command} : modèle non mentionné`)
      assert.match(row, /effort/, `/atelier:${command} : effort non mentionné`)
    }
    assert.ok(tableRow(text, '`implementer`'), 'ligne implementer absente du tableau des sous-agents')
  })

  it('limites.md dit que les variables d’environnement l’emportent sur la résolution [FEAT-27 CA-14]', () => {
    const text = site('reference/limites.md')
    for (const variable of ['CLAUDE_CODE_EFFORT_LEVEL', 'CLAUDE_CODE_SUBAGENT_MODEL_FORCE']) {
      assert.ok(text.includes(`\`${variable}\``), `${variable} absente de limites.md`)
    }
  })

  it('l’argument-hint de build, review et sign mentionne le modèle et l’effort [FEAT-27 CA-14]', () => {
    for (const name of ['build', 'review', 'sign']) {
      const hint = parseFrontMatter(read(`../skills/${name}/SKILL.md`)).data['argument-hint'] ?? ''
      assert.match(hint, /modèle/, `${name} : modèle absent de l’argument-hint`)
      assert.match(hint, /effort/, `${name} : effort absent de l’argument-hint`)
    }
  })
})
