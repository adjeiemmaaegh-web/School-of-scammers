/* Meta-test for check-integration-contracts.cjs: verifies the gate accepts the
 * real source, rejects an unknown navigation target, and rejects an unresolved
 * relative import — then restores every file it touched. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
const navFile = path.join(root, 'src/app/FrontDoor.tsx'); // contains to="/trades"
const mainFile = path.join(root, 'src/main.tsx'); // contains import './ui/theme.css';
const navOriginal = fs.readFileSync(navFile, 'utf8');
const mainOriginal = fs.readFileSync(mainFile, 'utf8');

const check = () => cp.spawnSync(process.execPath, [path.join(__dirname, 'check-integration-contracts.cjs')], { cwd: root, encoding: 'utf8' });

assert.equal(check().status, 0, 'baseline source contract must pass');
try {
  assert.ok(navOriginal.includes('to="/trades"'), 'expected a to="/trades" nav anchor in FrontDoor.tsx');
  fs.writeFileSync(navFile, navOriginal.replace('to="/trades"', 'to="/missing-learner-route"'));
  let result = check();
  assert.equal(result.status, 1, 'unknown navigation route must fail');
  assert.match(result.stdout, /Unregistered navigation target \/missing-learner-route/);
  fs.writeFileSync(navFile, navOriginal);

  assert.ok(mainOriginal.includes("import './ui/theme.css';"), 'expected theme.css import anchor in main.tsx');
  fs.writeFileSync(mainFile, mainOriginal.replace("import './ui/theme.css';", "import './ui/theme.css';\nimport './missing-integration-module';"));
  result = check();
  assert.equal(result.status, 1, 'unresolved relative import must fail');
  assert.match(result.stdout, /Unresolved import/);
} finally {
  fs.writeFileSync(navFile, navOriginal);
  fs.writeFileSync(mainFile, mainOriginal);
}
assert.equal(check().status, 0, 'source must be restored after negative tests');
console.log('PASS: baseline, unknown-route rejection, unresolved-import rejection, restored baseline (4/4)');
