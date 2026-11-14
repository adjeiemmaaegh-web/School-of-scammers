#!/usr/bin/env node
/** Aggregate current hosted-CI npm advisory evidence. Advisory databases are
 * live and may change; scan failure is UNKNOWN, never "zero issues".
 * Kept nonblocking so new advisories remain visible for explicit triage.
 */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../qa-artifacts');
function collect(filename,scope){
 const file=path.join(root,filename);
 if(!fs.existsSync(file))return {scope,status:'unavailable',error:'Missing npm audit report'};
 try{
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data.error)return {scope,status:'unavailable',error:
   String(data.error.summary??data.error.message??'registry query failed').slice(0,500)};
  const counts=data.metadata?.vulnerabilities;
  if(!counts||!['info','low','moderate','high','critical'].every(k=>typeof counts[k]==='number'))
   return {scope,status:'unavailable',error:'Advisory metadata omitted/malformed'};
  const packages=Object.entries(data.vulnerabilities??{})
   .filter(([,entry])=>entry&&typeof entry==='object')
   .map(([name,entry])=>({name,severity:entry.severity,
    direct:entry.isDirect===true,range:String(entry.range??'').slice(0,100)}));
  return {scope,status:'queried',counts:{
   info:counts.info,low:counts.low,moderate:counts.moderate,
   high:counts.high,critical:counts.critical,total:counts.total},
   affectedPackages:packages.slice(0,80)};
 }catch(error){return {scope,status:'unavailable',error:String(error).slice(0,500)};}
}
const result={generatedAt:new Date().toISOString(),
 installed:collect('npm-audit.json','CI installed tree: npm ci plus temporary browser runners'),
 production:collect('npm-audit-production.json','production dependency subgraph'),
 caveat:'npm advisories cover known published vulnerabilities only; no private audit, code scan or legal opinion'};
fs.mkdirSync(root,{recursive:true});
fs.writeFileSync(path.join(root,'npm-advisory-summary.json'),JSON.stringify(result,null,2)+'\n');
console.log('QA LIVE NPM AUDIT SUMMARY',JSON.stringify(result,null,2));
if(result.installed.status!=='queried'||result.production.status!=='queried')
 console.warn('QA AUDIT INCOMPLETE: registry or metadata unavailable; do NOT claim no vulnerabilities');
if(result.production.counts&&
 (result.production.counts.high||result.production.counts.critical))
 console.warn('QA RELEASE BLOCKER: current production dependency advisories include high or critical findings');
