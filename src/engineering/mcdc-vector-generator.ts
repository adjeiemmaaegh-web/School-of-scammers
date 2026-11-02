/** Bounded unique-cause MC/DC witness generator for stateless external-input-only rungs. */
import {executeLadder,validateLadder,type LadderDocument,type Rung} from './ladder';
import type {VectorStep} from './ladder-sequences';
export type GeneratedWitness={rungId:string;condition:string;first:number;second:number};
export type GeneratedVectors={steps:VectorStep[];witnesses:GeneratedWitness[];uncovered:{rungId:string;condition:string;reason:string}[];excluded:{rungId:string;reason:string}[];inputTags:string[];warnings:string[]};
export function generateMcdcVectors(doc:LadderDocument,maxInputs=10):GeneratedVectors{
 const errors=validateLadder(doc);if(errors.length)throw Error(errors.join('; '));
 if(!Number.isSafeInteger(maxInputs)||maxInputs<1||maxInputs>10)throw RangeError('maxInputs must be 1..10');
 const coils=new Set(doc.rungs.map(r=>r.coil));
 const excluded:{rungId:string;reason:string}[]=[];
 const eligible:{rung:Rung;tags:string[]}[]=[];
 for(const rung of doc.rungs){
  const tags=rung.elements.flatMap(e=>e.type==='contact'?[e.tag]:e.alternatives.flat().map(c=>c.tag));
  const reason=rung.operation&&rung.operation.kind!=='coil'?'Stateful or pulse instruction':tags.some(t=>coils.has(t))?'Internal output feedback':new Set(tags).size!==tags.length?'Repeated condition tag':tags.length>maxInputs?'Condition count exceeds bound':'';
  if(reason)excluded.push({rungId:rung.id,reason});else eligible.push({rung,tags});
 }
 const allTags=[...new Set(eligible.flatMap(r=>r.tags))].sort();
 if(allTags.length>maxInputs)throw RangeError(`Eligible rungs use ${allTags.length} distinct inputs; limit ${maxInputs}. Select a smaller ladder or increase the bound up to 10.`);
 const vectors=Array.from({length:2**allTags.length},(_,mask)=>Object.fromEntries(allTags.map((tag,i)=>[tag,Boolean(mask&(1<<i))])) as Record<string,boolean>);
 const outputs=vectors.map(inputs=>executeLadder(doc,inputs).outputs);
 const witnesses:GeneratedWitness[]=[];const uncovered:GeneratedVectors['uncovered']=[];
 const selected=new Set<number>();
 for(const {rung,tags} of eligible){
  for(const condition of tags){
   const bit=allTags.indexOf(condition);let best:[number,number]|undefined;let score=Infinity;
   for(let mask=0;mask<vectors.length;mask++){
    if(mask&(1<<bit))continue;
    const opposite=mask|(1<<bit);
    if(outputs[mask][rung.coil]===outputs[opposite][rung.coil])continue;
    const cost=Number(!selected.has(mask))+Number(!selected.has(opposite));
    if(cost<score){best=[mask,opposite];score=cost;if(score===0)break;}
   }
   if(!best){uncovered.push({rungId:rung.id,condition,reason:'No independent-effect pair exists in exhaustive Boolean input space'});continue;}
   selected.add(best[0]);selected.add(best[1]);witnesses.push({rungId:rung.id,condition,first:best[0],second:best[1]});
  }
 }
 // Every vector explicitly specifies all external inputs; only stateless eligible coils are asserted.
 const indices=[...selected].sort((a,b)=>a-b);
 const steps=indices.map(index=>({scans:1,inputs:vectors[index],expect:Object.fromEntries(eligible.map(({rung})=>[rung.coil,outputs[index][rung.coil]]))}));
 const positions=new Map(indices.map((index,i)=>[index,i+1]));
 return {steps,witnesses:witnesses.map(w=>({...w,first:positions.get(w.first)!,second:positions.get(w.second)!})),uncovered,excluded,inputTags:allTags,warnings:['Generated expectations are derived from the current ladder implementation, not an independent specification. Review them before treating a passing test as correctness evidence.','Only stateless external-input-only coil rungs qualify. Generated vectors are simulated and not safety certification.']};
}
export function generatedWitnessCsv(result:GeneratedVectors):string{
 const quote=(value:unknown)=>`"${String(value).replace(/"/g,'""')}"`;
 return [['rung','condition','status','step_a','step_b','reason'],...result.witnesses.map(w=>[w.rungId,w.condition,'witness',w.first,w.second,'']),...result.uncovered.map(u=>[u.rungId,u.condition,'uncovered','','',u.reason]),...result.excluded.map(e=>[e.rungId,'','excluded','','',e.reason])].map(row=>row.map(quote).join(',')).join('\r\n');
}
