#!/usr/bin/env node
/** Deterministic root dependency lockfile and high-confidence application token
 * check. Heuristic only, not full secrets scanning, pentesting or legal review.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
const root=lock.packages?.[''];
const sorted=group=>Object.fromEntries(Object.entries(group??{}).sort(([a],[b])=>a.localeCompare(b)));
assert.equal(lock.lockfileVersion,3,'npm lockfile v3 required');
assert.equal(lock.name,pkg.name,'Top-level lockfile name differs');
assert.equal(root?.name,pkg.name,'Root lockfile name differs');
assert.equal(root?.version,pkg.version,'Root lockfile version differs');
for(const group of ['dependencies','devDependencies','optionalDependencies'])
 assert.deepEqual(sorted(root?.[group]),sorted(pkg[group]),'Lockfile root '+group+' differs from package.json');
const patterns=[
 ['PEM private key',/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
 ['GitHub access token',/\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
 ['AWS access key',/\bAKIA[0-9A-Z]{16}\b/],
 ['Stripe live secret',/\bsk_live_[A-Za-z0-9]{20,}\b/],
];
function walk(dir,out=[]) {
 if(!fs.existsSync(dir))return out;
 for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,ent.name);
  if(ent.isDirectory())walk(file,out);
  else if(ent.isFile()&&/\.(?:tsx?|jsx?|cjs|mjs|html|json|ya?ml|css)$/.test(file))out.push(file);
 }
 return out;
}
const paths=[...walk('src'),...walk('public'),...walk('.github'),'vercel.json'];
const findings=[];
for(const file of paths){
 const content=fs.readFileSync(file,'utf8');
 for(const [kind,regex] of patterns)if(regex.test(content))findings.push({file,kind});
}
fs.mkdirSync('qa-artifacts',{recursive:true});
fs.writeFileSync('qa-artifacts/qa-lockfile-credential-check.json',
 JSON.stringify({lockfileVersion:lock.lockfileVersion,rootDependencyGroupsMatch:true,
  filesInspected:paths.length,highConfidenceFindings:findings,
  scope:'Heuristic source scan only'},null,2)+'\n');
assert.equal(findings.length,0,'Potential embedded secret in first-party code/config');
console.log('QA LOCKFILE/CREDENTIAL PASS: '+paths.length+' files scanned; npm root dependencies match');
