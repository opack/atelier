// status command and session start hook: where the active chantier stands and its next step.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { toProjectRelativePath } from '../common.mjs'
import { codeCommittedMatters, nextStep } from '../next-step.mjs'
import { sliceLabel, sliceState } from '../slices.mjs'
import { checkSpec } from '../spec.mjs'
import { effectiveTdd, testDrivenPhase } from '../tdd.mjs'
import { findProjectRoot, isAncestorOfHead, loadConfig } from './common.mjs'
import { activeChantier } from './identifiers.mjs'
import { chantierBaseOf } from './integration.mjs'
import { chantierIndex, formatRelations, needsIndex, relationsSummary } from './relations.mjs'
import { reviewSummary } from './review.mjs'
import { sliceCodeFiles, slicePosition } from './slices.mjs'
import { readBypass } from './write-guard.mjs'

// ---------- Status and session start ----------

export function commandStatus(options) {
  const projectRoot = findProjectRoot()
  const config = loadConfig(projectRoot)
  if (!config) {
    console.log(JSON.stringify({ installed: false }))
    return
  }
  const { branch, chantier, source } = activeChantier(projectRoot, config)
  const bypass = readBypass(projectRoot, branch)
  const index = chantier?.spec && needsIndex(chantier) ? chantierIndex(projectRoot, config) : null
  const review = reviewSummary(projectRoot, config, chantier, index)
  const relations = relationsSummary(projectRoot, config, chantier, index)
  const base = chantier?.spec ? chantierBaseOf(projectRoot, config, chantier, index) : null
  if (base?.warning) {
    console.error(base.warning)
  }
  const codeCommitted = codeCommittedFact(projectRoot, config, chantier, review.reviewState, index)
  const summary = {
    installed: true,
    branch,
    chantierSource: source,
    chantier: chantier
      ? {
          id: chantier.id,
          directory: chantier.directory ? toProjectRelativePath(projectRoot, chantier.directory) : null,
          title: chantier.spec?.data.title ?? null,
          type: chantier.spec?.data.type ?? null,
          status: chantier.spec?.data.status ?? null,
          testDrivenPhase: chantier.spec ? testDrivenPhase(chantier) : null,
          testsCommit: chantier.spec?.data.tests_commit || null,
          ...slicePosition(chantier),
          ...review,
          codeCommitted,
          relations,
          baseBranch: base?.branch ?? null,
          baseEpic: base?.epic ?? null,
          files: chantier.files,
          specProblems: chantier.spec ? checkSpec(readFileSync(join(chantier.directory, 'spec.md'), 'utf8')) : [],
        }
      : null,
    bypass,
    nextStep: nextStep(chantier, review.reviewState, relations?.children, codeCommitted),
  }
  if (options.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }
  console.log(formatStatus(summary, sliceState(chantier).model))
}

// `sliceModel`: slice model of the chantier (see sliceState), to tell a single-slice chantier from the others.
function formatStatus(summary, sliceModel) {
  const lines = [`Branche : ${summary.branch ?? '(aucune)'}`]
  if (summary.chantier) {
    const { id, title, type, status, files, specProblems } = summary.chantier
    const deduced = summary.chantierSource === 'commits' ? ' (déduit des commits)' : ''
    lines.push(`Chantier : ${id}${deduced}${title ? ` — ${title}` : ''} (${type ?? '?'}, ${status ?? 'pas de spec'})`)
    lines.push(`Documents : ${files.length ? files.join(', ') : 'aucun'}`)
    if (summary.chantier.relations) {
      lines.push(...formatRelations(summary.chantier.relations))
    }
    const phaseLabels = {
      'writing-tests': 'tests d’abord — aucune implémentation tant que les tests ne sont pas commités',
      implementing: 'implémentation — tests figés, ne pas les modifier',
    }
    const { slice, sliceCount } = summary.chantier
    const { sliceTdd } = summary.chantier
    if (sliceTdd) {
      const tddLabel = `TDD : ${sliceTdd === 'yes' ? 'oui' : 'non'}`
      if (typeof slice === 'number') {
        lines.push(`${sliceLabel(slice, sliceCount)} : ${tddLabel}`)
      } else if (sliceModel === 'single') {
        lines.push(tddLabel)
      }
    }
    if (typeof slice === 'number' && slice > sliceCount) {
      lines.push(`Tranche ${slice} absente du plan : la revue de la tranche mène à la revue du chantier.`)
    }
    if (status === 'signed' && phaseLabels[summary.chantier.testDrivenPhase]) {
      lines.push(`Phase TDD : ${phaseLabels[summary.chantier.testDrivenPhase]}`)
    }
    const { reviewedCommit, reviewState: state, reviewProblems: problems = [] } = summary.chantier
    if (reviewedCommit) {
      lines.push(state === 'current'
        ? `Revue : commit ${reviewedCommit.slice(0, 7)}, à jour (aucun code commité depuis)`
        : `Revue : commit ${reviewedCommit.slice(0, 7)}, obsolète\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
    }
    if (status !== 'signed' && status !== 'done' && specProblems.length) {
      lines.push(`À compléter dans la spec : ${specProblems.length} point(s)`)
    }
  }
  if (summary.bypass) {
    lines.push(`⚠️ Débrayage actif depuis ${summary.bypass.at} : ${summary.bypass.reason}. Spec et bilan à écrire après coup.`)
  }
  lines.push(`Prochaine étape : ${summary.nextStep}`)
  return lines.join('\n')
}

// Whether code was committed in the current slice, for the next step (see nextStep): in a slice
// in TDD (effective TDD, see effectiveTdd), since the freeze of its tests, test files excluded;
// otherwise since `slice_base` or the merge base with the chantier's base, tests included. null
// when it cannot change the next step, or cannot be computed (no base, git error, start of the
// slice no longer an ancestor of HEAD).
function codeCommittedFact(projectRoot, config, chantier, review, index = null) {
  if (!codeCommittedMatters(chantier, review)) return null
  try {
    const testDriven = effectiveTdd(chantier) === 'yes'
    const start = (testDriven ? chantier.spec.data.tests_commit : chantier.spec.data.slice_base) || null
    if (start && !isAncestorOfHead(projectRoot, start)) return null
    const files = sliceCodeFiles(projectRoot, config, chantier, start, testDriven, index)
    return files === null ? null : files.length > 0
  } catch {
    return null
  }
}

export function hookSessionStart() {
  const projectRoot = findProjectRoot()
  const config = loadConfig(projectRoot)
  if (!config) {
    return
  }
  const { branch, chantier, source } = activeChantier(projectRoot, config)
  const index = chantier?.spec && needsIndex(chantier) ? chantierIndex(projectRoot, config) : null
  const review = reviewSummary(projectRoot, config, chantier, index)
  const relations = relationsSummary(projectRoot, config, chantier, index)
  const summary = {
    branch,
    chantierSource: source,
    chantier: chantier ? { id: chantier.id, title: chantier.spec?.data.title, type: chantier.spec?.data.type, status: chantier.spec?.data.status, files: chantier.files, ...(chantier.spec ? slicePosition(chantier) : {}), ...review, relations } : null,
    bypass: readBypass(projectRoot, branch),
    nextStep: nextStep(chantier, review.reviewState, relations?.children, codeCommittedFact(projectRoot, config, chantier, review.reviewState, index)),
  }
  const statusText = summary.chantier
    ? formatStatus({ ...summary, chantier: { ...summary.chantier, specProblems: [] } }, sliceState(chantier).model)
    : formatStatus(summary)
  console.log(`Projet géré avec atelier (process IA : chantiers, spec signée avant le code, tests d'abord, bilan).\n${statusText}`)
}
