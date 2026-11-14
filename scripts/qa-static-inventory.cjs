#!/usr/bin/env node
/** Repository-wide deterministic static risk inventory, not a substitute
 * for CodeQL, SAST, penetration testing or device QA.
 */
const fs=require('node:fs'),path=require('node:path');
function walk(dir){
 const out=[];
 if(!fs.existsSync(dir))return out;
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const name=path.join(dir,entry.name);
  if(entry.isDirectory())out.push(...walk(name));
  else if(/\.(?:tsx?|jsx?|cjs|json|css)$/.test(name))out.push(name);
 }
 return out;
}
const files=walk('src'),scripts=walk('scripts'),tests=walk('tests');
const patterns={
 dynamicCode:/\b(?:eval\s*\(|new\s+Function\s*\(|document\.write\s*\()/g,
 rawHtml:/dangerouslySetInnerHTML|\.innerHTML\s*=/g,
 localStorage:/\blocalStorage\s*\./g,
 sessionStorage:/\bsessionStorage\s*\./g,
 indexedDb:/\bindexedDB\s*\./g,
 networkFetch:/\bfetch\s*\(/g,
 serviceWorker:/\bserviceWorker\b/g,
 webWorker:/\bnew\s+Worker\s*\(/g,
 useOfCrypto:/\bcrypto\s*\./g,
};
const occurrences=Object.fromEntries(Object.keys(patterns).map(name=>[name,[]]));
for(const filename of files){
 const text=fs.readFileSync(filename,'utf8');
 for(const [name,regex] of Object.entries(patterns)){
  for(const hit of text.matchAll(regex)){
   const line=text.slice(0,hit.index).split('\n').length;
   occurrences[name].push({file:filename.replaceAll('\\','/'),line});
  }
 }
}
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const cfg=JSON.parse(fs.readFileSync('vercel.json','utf8'));
const headers=(cfg.headers??[]).flatMap(x=>(x.headers??[]).map(h=>h.key.toLowerCase()));
const js=files.filter(f=>/\.(?:tsx?|jsx?)$/.test(f));
const summary={
 sourceFiles:files.length,sourceTypeScriptAndJs:js.length,
 testFiles:tests.length,testTsFiles:tests.filter(f=>/\.test\.ts$/.test(f)).length,
 scripts:scripts.length,
 backendDependencies:Object.keys(pkg.dependencies??{}).filter(n=>/express|fastify|sqlite|prisma|supabase|firebase|mongoose|postgres|mysql|typeorm/i.test(n)),
 dependencyRanges:pkg.dependencies,
 securityHeaders:{csp:headers.includes('content-security-policy'),
  nosniff:headers.includes('x-content-type-options'),
  referrerPolicy:headers.includes('referrer-policy'),
  framePolicy:headers.includes('x-frame-options'),
  permissionsPolicy:headers.includes('permissions-policy')},
 patterns:Object.fromEntries(Object.entries(occurrences).map(([key,items])=>[
  key,{count:items.length,locations:items.slice(0,40)}])),
};
fs.mkdirSync('qa-artifacts',{recursive:true});
fs.writeFileSync('qa-artifacts/qa-static-inventory.json',
 JSON.stringify(summary,null,2)+'\n');
console.log('QA source '+summary.sourceTypeScriptAndJs+
 ' TS/JS modules, '+summary.testTsFiles+' native test files, '+
 summary.scripts+' scripts');
for(const [name,detail] of Object.entries(summary.patterns))
 console.log(name+': '+detail.count+' source occurrences');
console.log('Static deployment headers currently declared: '+JSON.stringify(summary.securityHeaders));
console.log('This is a risk inventory. It does not imply the matches are exploitable.');
