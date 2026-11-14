/** Runs one browser E2E script, retrying a failed attempt so a loaded CI runner does not fail the pipeline.
 *  Honest by construction: a script that needs a retry is reported as a GitHub warning ("FLAKY") with the first attempt's
 *  output, so instability stays visible; a script that fails all attempts fails the step. Never use it to hide a
 *  deterministic failure: three consecutive failures are treated as real.
 *  Usage: node scripts/run-browser-step.cjs <script.cjs> [attempts=3] */
const { spawnSync } = require('node:child_process');
const script = process.argv[2];
const attempts = Number(process.argv[3] ?? 3);
if (!script || !Number.isInteger(attempts) || attempts < 1) { console.error('usage: run-browser-step.cjs <script> [attempts]'); process.exit(2); }
const failures = [];
for (let attempt = 1; attempt <= attempts; attempt++) {
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env: process.env, maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status === 0) {
    process.stdout.write(output);
    if (failures.length) {
      console.log(`::warning title=FLAKY browser script::${script} passed on attempt ${attempt} of ${attempts}; ${failures.length} earlier attempt(s) failed`);
      console.log(`--- output of the first failed attempt of ${script} ---\n${failures[0]}`);
    }
    process.exit(0);
  }
  failures.push(output.slice(-6000));
  console.log(`attempt ${attempt}/${attempts} of ${script} failed (exit ${result.status})`);
}
console.log(`--- output of the last failed attempt ---\n${failures[failures.length - 1]}`);
console.error(`${script} failed ${attempts} consecutive attempts`);
process.exit(1);
