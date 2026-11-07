#!/usr/bin/env node
/** Deterministic transfer-size guardrail on built frontend artifacts.
 * Gzip asset budgets are size proxies, not a substitute for real 8GB hardware testing.
 */
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const assert=require('node:assert/strict');
const base=path.resolve(__dirname,'../dist/assets');
const LIMITS={entryGzip:120*1024,render3dGzip:285*1024,sandboxSceneGzip:45*1024,totalJsGzip:790*1024,totalCssGzip:110*1024};
const files=fs.readdirSync(base).map(name=>({name,bytes:fs.statSync(path.join(base,name)).size,gzip:zlib.gzipSync(fs.readFileSync(path.join(base,name)),{level:9}).length}));
const js=files.filter(f=>f.name.endsWith('.js')),css=files.filter(f=>f.name.endsWith('.css'));
const entry=js.find(f=>/^index-[\w-]+\.js$/.test(f.name));
const renderer=js.find(f=>/^(?:OrbitControls|SceneShell)-[\w-]+\.js$/.test(f.name));
const sandboxScene=js.find(f=>/^Sandbox3D-[\w-]+\.js$/.test(f.name));
assert.ok(entry,'Missing built JavaScript entry');
assert.ok(renderer,'Missing separately bundled shared 3D renderer chunk');
assert.ok(sandboxScene,'Missing dedicated lazily loaded 3D sandbox scene chunk');
const totalJs=js.reduce((n,f)=>n+f.gzip,0),totalCss=css.reduce((n,f)=>n+f.gzip,0);
const report={entryGzip:entry.gzip,render3dGzip:renderer.gzip,sandboxSceneGzip:sandboxScene.gzip,totalJsGzip:totalJs,totalCssGzip:totalCss,limits:LIMITS};
console.log('BUNDLE BUDGET EVIDENCE',JSON.stringify(report,null,2));
assert.ok(entry.gzip<=LIMITS.entryGzip,'Landing-page JavaScript exceeds entry gzip budget');
assert.ok(renderer.gzip<=LIMITS.render3dGzip,'Optional 3D renderer exceeds gzip budget');
assert.ok(sandboxScene.gzip<=LIMITS.sandboxSceneGzip,'New 3D sandbox scene exceeds gzip budget');
assert.ok(totalJs<=LIMITS.totalJsGzip,'All JavaScript exceeds gzip budget');
assert.ok(totalCss<=LIMITS.totalCssGzip,'All CSS exceeds gzip budget');
console.log('BUNDLE BUDGET PASS (artifact sizes only; not physical low-spec performance acceptance)');
