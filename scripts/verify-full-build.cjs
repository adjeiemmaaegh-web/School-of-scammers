#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const checks = [
  ['offline engineering', ['run', 'verify:engineering:offline']],
  ['TypeScript typecheck', ['run', 'typecheck']],
  ['Vitest', ['run', 'test']],
  ['production build', ['run', 'build']],
];
const results = [];
for (const [name, args] of checks) {
  process.stdout.write(`\n=== ${name} ===\n`);
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: 'inherit' });
  const status = result.status ?? 1;
  results.push({ name, status, passed: status === 0 });
}
fs.writeFileSync('full-build-results.json', JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2) + '\n');
console.log('\nSummary:', results.map(x => `${x.name}: ${x.passed ? 'PASS' : 'FAIL'}`).join('; '));
if (results.some(x => !x.passed)) process.exitCode = 1;
