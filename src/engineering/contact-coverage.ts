/** Scan-based contact/path coverage from actual ladder execution traces; no safety certification. */
import {executeLadder,validateLadder,type LadderDocument,type LadderMemory} from './ladder';
import type {VectorStep} from './ladder-sequences';
export type ContactCoverageRow={id:string;rungId:string;tag:string;normallyClosed:boolean;conducting:number;blocked:number;firstConducting:number|null;firstBlocked:number|null};
export type PathCoverageRow={id:string;rungId:string;conducting:number;blocked:number};
export type ContactCoverageReport={scans:number;contacts:ContactCoverageRow[];paths:PathCoverageRow[];contactBoth:number;pathBoth:number;warnings:string[]};
const validTag=(s:string)=>/^[A-Za-z][\w.]{0,79}$/.test(s);
export function analyzeContactCoverage(doc:LadderDocument,steps:readonly VectorStep[],deltaMs=20):ContactCoverageReport{
 const errors=validateLadder(doc);if(errors.length)throw Error(errors.join('; '));
 if(!Number.isSafeInteger(deltaMs)||deltaMs<1||deltaMs>1000)throw RangeError('Invalid scan interval');
 if(!Array.isArray(steps)||steps.length<1||steps.length>100)throw RangeError('Sequence must have 1..100 steps');
 const outputTags=new Set(doc.rungs.map(r=>r.coil));
 const contacts:ContactCoverageRow[]=[];const paths:PathCoverageRow[]=[];
 for(const rung of doc.rungs)rung.elements.forEach((element,e)=>{
  const branches=element.type==='contact'?[[element]]:element.alternatives;
  branches.forEach((branch,p)=>{
   paths.push({id:`${rung.id}/e${e}/p${p}`,rungId:rung.id,conducting:0,blocked:0});
   branch.forEach((c,k)=>contacts.push({id:`${rung.id}/e${e}/p${p}/c${k}`,rungId:rung.id,tag:c.tag,normallyClosed:c.normallyClosed===true,conducting:0,blocked:0,firstConducting:null,firstBlocked:null}));
  });
 });
 const contactMap=new Map(contacts.map(r=>[r.id,r]));const pathMap=new Map(paths.map(r=>[r.id,r]));
 let inputs:Record<string,boolean>={};let outputs:Record<string,boolean>={};let memory:LadderMemory={};let scans=0;
 for(const [index,step] of steps.entries()){
  if(!step||!Number.isSafeInteger(step.scans)||step.scans<1||step.scans>1000||scans+step.scans>10000)throw RangeError(`Step ${index+1}: scan budget exceeded`);
  for(const map of [step.inputs,step.expect??{}]){
   if(!map||typeof map!=='object'||Array.isArray(map)||Object.keys(map).length>64)throw Error(`Step ${index+1}: invalid signal map`);
   for(const [tag,value] of Object.entries(map))if(!validTag(tag)||typeof value!=='boolean')throw Error(`Step ${index+1}: invalid signal ${tag}`);
  }
  for(const tag of Object.keys(step.inputs))if(outputTags.has(tag))throw Error(`Step ${index+1}: cannot force output ${tag}`);
  for(const tag of Object.keys(step.expect??{}))if(!outputTags.has(tag))throw Error(`Step ${index+1}: unknown expected output ${tag}`);
  inputs={...inputs,...step.inputs};
  for(let n=0;n<step.scans;n++){
   const result=executeLadder(doc,inputs,outputs,memory,deltaMs);outputs=result.outputs;memory=result.memory;scans++;
   for(const rung of result.steps)rung.elements.forEach((element,e)=>element.paths.forEach((path,p)=>{
    const pathRow=pathMap.get(`${rung.rungId}/e${e}/p${p}`)!;
    if(path.every(c=>c.conducts))pathRow.conducting++;else pathRow.blocked++;
    path.forEach((c,k)=>{const row=contactMap.get(`${rung.rungId}/e${e}/p${p}/c${k}`)!;
     if(c.conducts){row.conducting++;row.firstConducting??=scans;}else{row.blocked++;row.firstBlocked??=scans;}
    });
   }));
  }
 }
 return {scans,contacts,paths,contactBoth:contacts.filter(c=>c.conducting>0&&c.blocked>0).length,pathBoth:paths.filter(p=>p.conducting>0&&p.blocked>0).length,warnings:['Contact/path state coverage is not MC/DC, independent condition coverage, or safety validation.','A contact may be sampled even when earlier series contacts block the rung.']};
}
export function contactCoverageCsv(report:ContactCoverageReport):string{
 const q=(v:unknown)=>`"${String(v).replace(/"/g,'""')}"`;
 const lines=[['type','id','rung','tag','nc','conducting_scans','blocked_scans','first_conducting','first_blocked'].map(q).join(',')];
 for(const r of report.contacts)lines.push(['contact',r.id,r.rungId,r.tag,r.normallyClosed,r.conducting,r.blocked,r.firstConducting??'',r.firstBlocked??''].map(q).join(','));
 for(const r of report.paths)lines.push(['path',r.id,r.rungId,'','',r.conducting,r.blocked,'',''].map(q).join(','));
 return lines.join('\r\n');
}
