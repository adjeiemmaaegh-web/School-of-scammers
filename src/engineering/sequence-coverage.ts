/** Read-only sequential PLC coverage. Coverage is evidence of exercised logic, not safety certification. */
import {executeLadder,validateLadder,type LadderDocument,type LadderMemory} from './ladder';
import type {VectorStep} from './ladder-sequences';
export type CoverageRow={rungId:string;coil:string;trueScans:number;falseScans:number;transitions:number;firstTrueScan:number|null;firstFalseScan:number|null};
export type CoverageReport={totalScans:number;rows:CoverageRow[];coveredRungs:number;totalRungs:number;branchCoveragePercent:number;uncovered:string[];warnings:string[]};
const validTag=(s:string)=>/^[A-Za-z][\w.]{0,79}$/.test(s);
export function analyzeSequenceCoverage(doc:LadderDocument,steps:readonly VectorStep[],deltaMs=20):CoverageReport{
 const errors=validateLadder(doc);if(errors.length)throw Error(errors.join('; '));
 if(!Number.isSafeInteger(deltaMs)||deltaMs<1||deltaMs>1000)throw RangeError('Invalid scan interval');
 if(!Array.isArray(steps)||steps.length<1||steps.length>100)throw RangeError('Sequence must have 1..100 steps');
 const outputTags=new Set(doc.rungs.map(r=>r.coil));
 const rows=doc.rungs.map(r=>({rungId:r.id,coil:r.coil,trueScans:0,falseScans:0,transitions:0,firstTrueScan:null as number|null,firstFalseScan:null as number|null}));
 let inputs:Record<string,boolean>={};let outputs:Record<string,boolean>={};let memory:LadderMemory={};let total=0;
 const previous=new Map<string,boolean>();
 for(const [index,step] of steps.entries()){
  if(!step||!Number.isSafeInteger(step.scans)||step.scans<1||step.scans>1000||total+step.scans>10000)throw RangeError(`Step ${index+1}: scan budget exceeded`);
  for(const map of [step.inputs,step.expect??{}]){
   if(!map||typeof map!=='object'||Array.isArray(map)||Object.keys(map).length>64)throw Error(`Step ${index+1}: invalid signal map`);
   for(const [tag,value] of Object.entries(map))if(!validTag(tag)||typeof value!=='boolean')throw Error(`Step ${index+1}: invalid signal ${tag}`);
  }
  for(const tag of Object.keys(step.inputs))if(outputTags.has(tag))throw Error(`Step ${index+1}: cannot force output ${tag}`);
  for(const tag of Object.keys(step.expect??{}))if(!outputTags.has(tag))throw Error(`Step ${index+1}: unknown expected output ${tag}`);
  inputs={...inputs,...step.inputs};
  for(let n=0;n<step.scans;n++){
   const result=executeLadder(doc,inputs,outputs,memory,deltaMs);outputs=result.outputs;memory=result.memory;total++;
   for(const row of rows){
    const value=outputs[row.coil]===true;
    if(value){row.trueScans++;row.firstTrueScan??=total;}else{row.falseScans++;row.firstFalseScan??=total;}
    if(previous.has(row.rungId)&&previous.get(row.rungId)!==value)row.transitions++;
    previous.set(row.rungId,value);
   }
  }
 }
 const coveredRungs=rows.filter(r=>r.trueScans>0&&r.falseScans>0).length;
 const uncovered=rows.filter(r=>r.trueScans===0||r.falseScans===0).map(r=>`${r.rungId}: ${r.trueScans===0?'never ON':'never OFF'}`);
 return {totalScans:total,rows,coveredRungs,totalRungs:rows.length,branchCoveragePercent:rows.length?Math.round(10000*coveredRungs/rows.length)/100:100,uncovered,warnings:['Measures observed output TRUE/FALSE states, not internal contact path or MC/DC coverage.','Passing coverage does not prove functional correctness or machine safety.']};
}
export function sequenceCoverageCsv(report:CoverageReport):string{
 const esc=(v:unknown)=>`"${String(v).replace(/"/g,'""')}"`;
 return [['rung','coil','on_scans','off_scans','transitions','first_on_scan','first_off_scan'].map(esc).join(','),...report.rows.map(r=>[r.rungId,r.coil,r.trueScans,r.falseScans,r.transitions,r.firstTrueScan??'',r.firstFalseScan??''].map(esc).join(','))].join('\r\n');
}
