#!/usr/bin/env node
/** Reproducible dependency-advisory check for CI. Never swallows an audit
 * service failure. Production high/critical advisories fail this job;
 * lower and development advisories remain reported, not hidden.
 */
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
fs.mkdirSync('qa-artifacts',{recursive:true});
const npm=process.platform==='win32'?'npm.cmd':'npm';
const reports=[];
for(const [scope,args] of [
 ['production',['audit','--omit=dev','--json']],
 ['complete',['audit','--json']],
]){
 const result=spawnSync(npm,args,{encoding:'utf8',maxBuffer:20*1024*1024,
  timeout:120000});
 let parsed;
 try{parsed=JSON.parse(result.stdout)}catch{
  const status={scope,available:false,exitCode:result.status??-1,
   error:'npm audit response was not parseable'};
  reports.push(status);
  fs.writeFileSync('qa-artifacts/npm-audit-'+scope+'.json',
   JSON.stringify(status,null,2)+'\n');
  continue;
 }
 fs.writeFileSync('qa-artifacts/npm-audit-'+scope+'.json',
  JSON.stringify(parsed,null,2)+'\n');
 const counts=parsed.metadata?.vulnerabilities;
 const vulnerable=Object.entries(parsed.vulnerabilities??{}).map(([name,item])=>({
  name,severity:item.severity,range:item.range,
  fixAvailable:item.fixAvailable,
 }));
 const available=!!counts&&typeof counts==='object'&&!parsed.error;
 reports.push({scope,available,exitCode:result.status??-1,
  counts:counts??null,vulnerable,
  ...(parsed.error?{error:parsed.error.message??String(parsed.error)}:{})});
}
fs.writeFileSync('qa-artifacts/qa-advisory-summary.json',
 JSON.stringify({generatedAt:new Date().toISOString(),reports},null,2)+'\n');
for(const r of reports){
 console.log('QA npm '+r.scope+': '+(r.available?
  JSON.stringify(r.counts):'UNAVAILABLE '+(r.error??'')));
 if(r.vulnerable?.length)console.log(
  '  Packages: '+r.vulnerable.map(p=>p.name+' ('+p.severity+')').join(', '));
}
if(reports.some(r=>!r.available)){
 console.error('QA dependency advisory status is UNKNOWN; cannot claim a clean audit');
 process.exitCode=2;
}else if(reports[0].vulnerable.some(x=>x.severity==='high'||x.severity==='critical')){
 console.error('QA release blocker: production high/critical dependency advisories');
 process.exitCode=1;
}else console.log('QA production dependency audit: no HIGH or CRITICAL known advisories');
