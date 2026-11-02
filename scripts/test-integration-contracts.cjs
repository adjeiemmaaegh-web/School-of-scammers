const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),main=path.join(root,'src/main.tsx'),original=fs.readFileSync(main,'utf8');
const check=()=>cp.spawnSync(process.execPath,[path.join(__dirname,'check-integration-contracts.cjs')],{cwd:root,encoding:'utf8'});
assert.equal(check().status,0,'baseline source contract must pass');
try{
  assert.ok(original.includes("nav('/labs')"));
  fs.writeFileSync(main,original.replace("nav('/labs')","nav('/missing-learner-route')"));
  let result=check();assert.equal(result.status,1,'unknown navigation route must fail');assert.match(result.stdout,/Unregistered navigation target \/missing-learner-route/);
  fs.writeFileSync(main,original.replace("import './style.css';","import './style.css';\nimport './missing-integration-module';"));
  result=check();assert.equal(result.status,1,'unresolved relative import must fail');assert.match(result.stdout,/Unresolved import/);
}finally{fs.writeFileSync(main,original)}
assert.equal(check().status,0,'source must be restored after negative tests');
console.log('PASS: baseline, unknown-route rejection, unresolved-import rejection, restored baseline (4/4)');
