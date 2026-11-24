#!/usr/bin/env node
// REF-29 (spec §4, CA-7): median duration of `atelier hook-guard` over RUNS launches with the same
// input, on this repository, for the plugin of this working tree and for the plugin of the base
// (extracted with `git archive`, run against this same repository, so that both take the same path
// through the hook: same active chantier, same decision). Run both in the same session (RD3).
//   node docs/chantiers/REF-29-lib-par-domaine/measure-hook.mjs [runs]
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE_COMMIT = 'f3ec902'
const root = fileURLToPath(new URL('../../../', import.meta.url))
const runs = Number(process.argv[2] ?? 20)
// An edit of a code file: the guard loads the configuration, the active chantier and the rules.
const input = JSON.stringify({
  cwd: root,
  tool_name: 'Edit',
  tool_input: { file_path: join(root, 'plugins/atelier/lib/core.mjs'), old_string: 'x', new_string: 'y' },
})

function measure(pluginDirectory) {
  const launch = () => spawnSync(process.execPath, [join(pluginDirectory, 'bin/atelier'), 'hook-guard'], { cwd: root, input, encoding: 'utf8' })
  const first = launch()
  if (first.status !== 0) throw new Error(`hook-guard a échoué (code ${first.status}) : ${first.stderr}`)
  const durations = []
  for (let run = 0; run < runs; run++) {
    const start = process.hrtime.bigint()
    const result = launch()
    durations.push(Number(process.hrtime.bigint() - start) / 1e6)
    if (result.stdout !== first.stdout) throw new Error('hook-guard ne rend pas toujours la même décision')
  }
  durations.sort((a, b) => a - b)
  const median = runs % 2 ? durations[(runs - 1) / 2] : (durations[runs / 2 - 1] + durations[runs / 2]) / 2
  return { median, min: durations[0], max: durations.at(-1), decision: first.stdout.trim() || '(aucune sortie : écriture autorisée)' }
}

const baseDirectory = mkdtempSync(join(tmpdir(), 'ref29-plugin-'))
// Exit code set, never process.exit() in the try: the finally must remove the extracted plugin (RD6).
try {
  execFileSync('sh', ['-c', `git archive ${BASE_COMMIT} plugins/atelier | tar -x -C "${baseDirectory}"`], { cwd: root })
  const base = measure(join(baseDirectory, 'plugins/atelier'))
  const current = measure(join(root, 'plugins/atelier'))
  const line = (label, result) => `${label} : médiane ${result.median.toFixed(1)} ms (min ${result.min.toFixed(1)}, max ${result.max.toFixed(1)})`
  console.log(`hook-guard, ${runs} lancements chacun, sur ce dépôt`)
  console.log(line(`  base ${BASE_COMMIT}`, base))
  console.log(line('  branche     ', current))
  console.log(`  écart : ${(current.median - base.median).toFixed(1)} ms (seuil CA-7 : 20 ms)`)
  console.log(`  décision base    : ${base.decision}`)
  console.log(`  décision branche : ${current.decision}`)
  if (base.decision !== current.decision) {
    console.error('Décisions différentes : les deux mesures ne suivent pas le même chemin.')
    process.exitCode = 1
  } else {
    process.exitCode = current.median - base.median > 20 ? 1 : 0
  }
} finally {
  rmSync(baseDirectory, { recursive: true, force: true })
}
