#!/usr/bin/env node
/** Static source/config inventory; a reproducible heuristic SAST pass, NOT
 * a substitute for manual code review, dynamic analysis or a pentest.
 * Only first-party repository files, never generated node_modules/dist.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const all=[];
function walk(dir){
 if(!fs.existsSync(path.join(root,dir)))return;
 for(const ent of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
  const rel=path.posix.join(dir,ent.name);
  if(ent.isSymbolicLink())continue;
  if(ent.isDirectory())walk(rel);
  else if(ent.isFile())all.push(rel);
 }
}
for(const dir of ['src','tests','scripts','public','qa','.github'])walk(dir);
const src=all.filter(x=>x.startsWith('src/')&&/\.(tsx?|css)$/.test(x));
const sourceCode=all.filter(x=>x.startsWith('src/')&&/\.tsx?$/.test(x));
const checkers=[
 ['dangerouslySetInnerHTML',/\bdangerouslySetInnerHTML\s*=/],
 ['innerHTML write',/\.innerHTML\s*=/],
 ['dynamic code eval',/\beval\s*\(/],
 ['dynamic Function constructor',/\bnew\s+Function\s*\(/],
 ['outerHTML write',/\.outerHTML\s*=/],
 ['document.write',/\bdocument\.write\s*\(/],
 ['network fetch',/\bfetch\s*\(/],
 ['WebSocket',/\bnew\s+WebSocket\s*\(/],
 ['XHR',/\bnew\s+XMLHttpRequest\s*\(/],
 ['storage localStorage',/\blocalStorage\s*\.|\blocalStorage\s*\[/],
 ['storage indexedDB',/\bindexedDB\s*\.|\bindexedDB\s*\[/],
 ['iframe',/<iframe\b/],
 ['postMessage',/\.postMessage\s*\(/],
];
const findings={};for(const [name] of checkers)findings[name]=[];
const hardSecretPatterns=[
 /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
 /\bghp_[A-Za-z0-9]{30,}\b/,
 /\bsk_live_[A-Za-z0-9]{20,}\b/,
 /\bAKIA[0-9A-Z]{16}\b/,
];
const highRiskSecrets=[];
for(const file of sourceCode){
 const lines=read(file).split('\n');
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  for(const [name,re] of checkers)if(re.test(line))
   findings[name].push({file,line:i+1,snippet:line.trim().slice(0,180)});
  for(const re of hardSecretPatterns)if(re.test(line))
   highRiskSecrets.push({file,line:i+1});
 }
}
const pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'));
assert.equal(lock.lockfileVersion,3,'Reproducible npm v3 lockfile required');
assert.equal(lock.packages[''].name,pkg.name,'Root package name must match lock');
for(const group of ['dependencies','devDependencies']){
 assert.deepEqual(lock.packages[''][group]??{},pkg[group]??{},
  'Root package-lock '+group+' must exactly agree with package.json');
}
const vercel=JSON.parse(read('vercel.json'));
const headerGroups=vercel.headers??[];
const headerNames=[...new Set(headerGroups.flatMap(x=>x.headers??[]).map(h=>h.key.toLowerCase()))];
const testFiles=all.filter(x=>x.startsWith('tests/')&&/\.test\.tsx?$/.test(x));
const browserFiles=all.filter(x=>x.startsWith('scripts/')&&/(browser|acceptance)/.test(x));
const report={
 schema:1,headSource:'workflow checkout exact SHA (see workflow metadata)',
 sourceFiles:src.length,sourceCodeFiles:sourceCode.length,testFiles:testFiles.length,
 browserAcceptanceScripts:browserFiles.length,repositoryFilesScanned:all.length,
 architecture:{
  backendFiles:all.filter(x=>/\b(api|server|migrations|database)\b\/|\.sql$/i.test(x)),
  localStorageUsed:findings['storage localStorage'].length>0,
  indexedDbUsed:findings['storage indexedDB'].length>0,
  serviceWorker:all.includes('scripts/offline-worker-template.cjs'),
  deploymentSecurityHeaders:headerNames,
  strongDeploymentHeadersPresent:
   ['content-security-policy','x-content-type-options','referrer-policy']
    .every(x=>headerNames.includes(x)),
 },
 riskySinks:Object.fromEntries(checkers.map(([n])=>[n,{
  count:findings[n].length,samples:findings[n].slice(0,8)}])),
 secrets:{detected:highRiskSecrets.length,locations:highRiskSecrets},
 dependence:{lockfileVersion:lock.lockfileVersion,
  directDependencies:Object.keys(pkg.dependencies??{}).length,
  devDependencies:Object.keys(pkg.devDependencies??{}).length,
  lockNodes:Object.keys(lock.packages??{}).length},
 knownLimits:['heuristic regex scanner; not taint-analysis or SBOM CVE scanner',
  'no backend/database source to penetration-test',
  'hardware PLC, GPU and browser privacy acceptance require owner-run devices'],
};
const file=path.join(root,'qa-artifacts','repository-qa-static.json');
fs.mkdirSync(path.dirname(file),{recursive:true});
fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
console.log('QA STATIC INVENTORY',JSON.stringify({
 source:report.sourceFiles,test:report.testFiles,browser:report.browserAcceptanceScripts,
 scans:report.repositoryFilesScanned,sinkCounts:Object.fromEntries(checkers.map(([n])=>[n,findings[n].length])),
 csp:headerNames.includes('content-security-policy'),secrets:highRiskSecrets.length,
 lockNodes:report.dependence.lockNodes,
},null,2));
assert.equal(highRiskSecrets.length,0,'Possible embedded credential/secret found');
console.log('QA STATIC INVENTORY PASS: root lock matches dependencies, no high-confidence embedded keys (heuristic only)');
