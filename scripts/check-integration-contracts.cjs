/* Dependency-free source integration gate.
 *
 * Verifies two things about the experience layer:
 *   1. every relative import in src/ resolves to a real file;
 *   2. every static in-app navigation target is backed by a registered route
 *      (dynamic :params supported), and a "*" fallback route exists.
 *
 * Routes live in src/app/App.tsx; navigation happens from the experience layer
 * (src/app, src/ui, src/main.tsx). Legacy engine components under src/components
 * are mounted directly and are out of scope for this guard.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
let ts;
try {
  ts = require('typescript');
} catch {
  try {
    ts = require(path.join(require('node:child_process').execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript'));
  } catch {
    console.error('TypeScript compiler unavailable; install project dependencies or global TypeScript');
    process.exit(2);
  }
}

const failures = [];
let imports = 0;
let files = 0;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : [],
  );
}

// 1. Relative import resolution across all of src/.
const sources = walk(path.join(root, 'src'));
for (const file of sources) {
  files++;
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(n) {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text.startsWith('.')) {
      imports++;
      const stem = path.resolve(path.dirname(file), n.moduleSpecifier.text);
      const candidates = [stem, stem + '.ts', stem + '.tsx', stem + '.js', stem + '.jsx', stem + '.json', path.join(stem, 'index.ts'), path.join(stem, 'index.tsx')];
      if (!candidates.some((p) => fs.existsSync(p) && fs.statSync(p).isFile())) {
        failures.push('Unresolved import ' + path.relative(root, file) + ' -> ' + n.moduleSpecifier.text);
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(ast);
}

// 2. Route/navigation integrity for the experience layer.
const appSrc = fs.readFileSync(path.join(root, 'src/app/App.tsx'), 'utf8');
const registered = [...appSrc.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
const registeredSet = new Set(registered);

// Build matchers for registered routes, treating :params as single-segment wildcards.
const matchers = registered
  .filter((r) => r !== '*')
  .map((r) => new RegExp('^' + r.split('/').map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/') + '$'));

function isRegistered(target) {
  return registeredSet.has(target) || matchers.some((re) => re.test(target));
}

// Collect static navigation targets from the experience layer only.
const navFiles = [path.join(root, 'src/main.tsx'), ...walk(path.join(root, 'src/app')), ...walk(path.join(root, 'src/ui'))];
const targets = new Set();
for (const f of navFiles) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bto="(\/[^"]*)"/g)) targets.add(m[1]);
  for (const m of src.matchAll(/\b(?:navigate|nav)\(['"](\/[^'"]+)['"]\)/g)) targets.add(m[1]);
}

let checked = 0;
for (const target of targets) {
  checked++;
  if (!isRegistered(target)) failures.push('Unregistered navigation target ' + target);
}
if (!registeredSet.has('*')) failures.push('Missing fallback route');

console.log(
  JSON.stringify(
    {
      sourceFiles: files,
      relativeImportsChecked: imports,
      navigationTargetsChecked: checked,
      registeredRoutes: registered,
      failures,
    },
    null,
    2,
  ),
);
if (failures.length) process.exit(1);
