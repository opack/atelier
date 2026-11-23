import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as core from '../lib/core.mjs'
import { temporaryDirectory, git, atelier, makeChantiersRepository, epicPlan } from './helpers.mjs'

describe('relations read from the spec header', () => {
  it('lit les relations en listes normalisées (espaces, casse, doublons), vides si absentes [FEAT-4 CA-1]', () => {
    const relations = core.parseRelations({
      rel_parent: 'epic-5',
      rel_depends_on: 'FEAT-12,  tec-15',
      rel_origin: 'SPIKE-3, spike-3',
      rel_replaces: '',
    })
    assert.deepEqual(relations, { parent: ['EPIC-5'], dependsOn: ['FEAT-12', 'TEC-15'], origin: ['SPIKE-3'], replaces: [] })
    assert.deepEqual(core.parseRelations({ id: 'FEAT-1' }), { parent: [], dependsOn: [], origin: [], replaces: [] })
  })
})

describe('children of an EPIC across branches', () => {
  it('enfants découverts dans l’arbre courant et sur les autres branches, statut jugé dans l’arbre courant [FEAT-4 CA-2]', () => {
    const directory = makeChantiersRepository({
      main: [
        { id: 'EPIC-5', files: epicPlan },
        { id: 'FEAT-6', status: 'done', relations: { rel_parent: 'EPIC-5' } },
        { id: 'TEC-8' },
      ],
      branches: {
        'feat/FEAT-7-x': [{ id: 'FEAT-7', status: 'done', relations: { rel_parent: 'EPIC-5' } }],
        'epic/EPIC-5-x': [],
      },
      checkout: 'epic/EPIC-5-x',
    })
    const children = JSON.parse(atelier(directory, 'status', '--json')).chantier.relations.children
    assert.deepEqual(children.map((child) => child.id).sort(), ['FEAT-6', 'FEAT-7'])
    assert.equal(children.find((child) => child.id === 'FEAT-6').closed, true)
    assert.equal(children.find((child) => child.id === 'FEAT-7').closed, false, 'done sur sa branche seulement : ouvert')
  })

  it('un enfant présent seulement sur une branche distante connue est découvert [FEAT-4 CA-2]', () => {
    const origin = temporaryDirectory('atelier-feat4-origin-')
    git(origin, 'init', '-q', '--bare', '-b', 'main')
    const directory = makeChantiersRepository({
      main: [{ id: 'EPIC-5', files: epicPlan }],
      branches: { 'feat/FEAT-16-x': [{ id: 'FEAT-16', relations: { rel_parent: 'EPIC-5' } }], 'epic/EPIC-5-x': [] },
    })
    git(directory, 'remote', 'add', 'origin', origin)
    git(directory, 'push', '-q', 'origin', 'main', 'feat/FEAT-16-x')
    git(directory, 'fetch', '-q', 'origin')
    git(directory, 'branch', '-q', '-D', 'feat/FEAT-16-x')
    git(directory, 'switch', '-q', 'epic/EPIC-5-x')
    const children = JSON.parse(atelier(directory, 'status', '--json')).chantier.relations.children
    assert.deepEqual(children.map((child) => child.id), ['FEAT-16'])
    assert.equal(children[0].closed, false)
  })
})
