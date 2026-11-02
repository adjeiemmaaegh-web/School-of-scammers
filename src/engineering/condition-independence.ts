/** Observed unique-cause MC/DC pairs for stateless, external-input-only coil rungs.
 * This is an educational evidence metric, not certified safety verification. */
import {executeLadder,validateLadder,type LadderDocument,type LadderMemory} from './ladder';
import type {VectorStep} from './ladder-sequences';
export type IndependenceRow={rungId:string;tag:string;covered:boolean;firstScan:number|null;secondScan:number|null;reason:string};
export type IndependenceReport={scans:number;eligible:number;covered:number;rows:IndependenceRow[];excluded:{rungId:string;reason:string}[];warnings:string[]};
const validTag=(s:string)=>/^[A-Za-z][\w.]{0,79}$/.test(s);
export function analyzeConditionIndependence(doc:LadderDocument,steps:readonly VectorStep[],deltaMs=20):IndependenceReport{
 const errors=validateLadder(doc);if(errors.length)throw Error(errors.join('; '));
 if(!Number.isSafeInteger(deltaMs)||deltaMs<1||deltaMs>1000)throw RangeError('Invalid scan interval');
 if(!Array.isArray(steps)||steps.length<1||steps.length>100)throw RangeError('Sequence must have 1..100 steps');
 const outputTags=new Set(doc.rungs.map(r=>r.coil));
 const excluded:{rungId:string;reason:string}[]=[];
 const eligible=doc.rungs.flatMap(r=>{
  const contacts=r.elements.flatMap(e=>e.type==='contact'?[e]:e.alternatives.flat());
  const tags=contacts.map(c=>c.tag);
  let reason='';
  if(r.operation && r.operation.kind!=='coil')reason='Stateful or pulse instruction';
  else if(tags.some(t=>outputTags.has(t)))reason='Internal output feedback';
  else if(new Set(tags).size!==tags.length)reason='Repeated condition tag';
  else if(tags.length>12)reason='More than 12 conditions';
  if(reason){excluded.push({rungId:r.id,reason});return [];}
  return [{rungId:r.id,tags}];
 });
 const rows:IndependenceRow[]=eligible.flatMap(r=>r.tags.map(tag=>({rungId:r.rungId,tag,covered:false,firstScan:null,secondScan:null,reason:'No observed independent-effect pair'})));
 const observations=new Map<string,{scan:number;values:boolean[];result:boolean}[]>();
 for(const r of eligible)observations.set(r.rungId,[]);
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
   for(const r of eligible){const trace=result.steps.find(s=>s.rungId===r.rungId)!;
    const values=r.tags.map(t=>inputs[t]===true);
    const history=observations.get(r.rungId)!;
    // Deduplicate input vectors to bound pair comparisons to 2^12 per rung.
    if(!history.some(h=>h.values.every((v,i)=>v===values[i])))history.push({scan:scans,values,result:trace.result});
   }
  }
 }
 for(const r of eligible){const history=observations.get(r.rungId)!;
  const lookup=new Map(history.map(h=>[h.values.map(v=>v?'1':'0').join(''),h]));
  for(const row of rows.filter(x=>x.rungId===r.rungId)){
   const index=r.tags.indexOf(row.tag);
   for(const a of history){
    const opposite=[...a.values];opposite[index]=!opposite[index];
    const b=lookup.get(opposite.map(v=>v?'1':'0').join(''));
    if(b&&a.result!==b.result){row.covered=true;row.firstScan=a.scan;row.secondScan=b.scan;row.reason='Observed unique-cause independent effect';break;}
   }
  }
 }
 return {scans,eligible:rows.length,covered:rows.filter(r=>r.covered).length,rows,excluded,warnings:['Observed unique-cause pairs only; unobserved combinations and masking MC/DC are not credited.','Internal feedback, repeated tags, and stateful instructions are excluded. This is not industrial safety certification.']};
}
export function conditionIndependenceCsv(report:IndependenceReport):string{
 const q=(v:unknown)=>`"${String(v).replace(/"/g,'""')}"`;
 return [['rung','condition','covered','scan_a','scan_b','reason'],...report.rows.map(r=>[r.rungId,r.tag,r.covered,r.firstScan??'',r.secondScan??'',r.reason]),...report.excluded.map(r=>[r.rungId,'',false,'','',r.reason])].map(r=>r.map(q).join(',')).join('\r\n');
}
