#!/usr/bin/env node
// REF-29 (spec §4, CA-7): median duration of `atelier hook-guard` over RUNS launches with the same
// input, on this repository. Run once on the base, once at the end; compare the two medians.
//   node docs/chantiers/REF-29-lib-par-domaine/measure-hook.mjs [runs]
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const runs = Number(process.argv[2] ?? 20)
// An edit of a code file: the guard loads the configuration, the active chantier and the rules.
const input = JSON.stringify({
  cwd: root,
  tool_name: 'Edit',
  tool_input: { file_path: join(root, 'plugins/atelier/lib/core.mjs'), old_string: 'x', new_string: 'y' },
})

const durations = []
spawnSync(process.execPath, [join(root, 'plugins/atelier/bin/atelier'), 'hook-guard'], { cwd: root, input })
for (let run = 0; run < runs; run++) {
  const start = process.hrtime.bigint()
  const result = spawnSync(process.execPath, [join(root, 'plugins/atelier/bin/atelier'), 'hook-guard'], { cwd: root, input, encoding: 'utf8' })
  durations.push(Number(process.hrtime.bigint() - start) / 1e6)
  if (result.status !== 0) {
    console.error(`hook-guard a échoué (code ${result.status}) : ${result.stderr}`)
    process.exit(1)
  }
}
durations.sort((a, b) => a - b)
const median = runs % 2 ? durations[(runs - 1) / 2] : (durations[runs / 2 - 1] + durations[runs / 2]) / 2
console.log(`hook-guard, ${runs} lancements : médiane ${median.toFixed(1)} ms (min ${durations[0].toFixed(1)}, max ${durations.at(-1).toFixed(1)})`)
