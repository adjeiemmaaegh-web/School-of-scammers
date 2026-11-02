/** Educational mutation testing: checks whether sequential test vectors detect deliberate logic defects. */
import {validateLadder,type LadderDocument,type Rung} from './ladder';
import {runLadderSequence,type VectorStep,type SequenceResult} from './ladder-sequences';
export type MutationCase={id:string;rungId:string;description:string;document:LadderDocument};
export type MutationOutcome={id:string;rungId:string;description:string;detected:boolean;reason:string;firstFailingStep:number|null};
export type MutationReport={baselinePassed:boolean;baseline:SequenceResult;total:number;detected:number;survived:number;scorePercent:number;outcomes:MutationOutcome[]};
const MAX_MUTANTS=80;
function clone(doc:LadderDocument):LadderDocument{return JSON.parse(JSON.stringify(doc)) as LadderDocument;}
/** Generate only structurally valid, deterministic mutations; never change the original document. */
export function generateLadderMutants(doc:LadderDocument):MutationCase[]{
 const errors=validateLadder(doc);if(errors.length)throw Error(errors.join('; '));
 const result:MutationCase[]=[];
 const push=(rungIndex:number,description:string,change:(r:Rung)=>Rung)=>{
  if(result.length>=MAX_MUTANTS)return;
  const copy=clone(doc);const rungs=[...copy.rungs];rungs[rungIndex]=change(rungs[rungIndex]);
  const candidate={...copy,rungs};if(validateLadder(candidate).length)return;
  result.push({id:`M${String(result.length+1).padStart(3,'0')}`,rungId:rungs[rungIndex].id,description,document:candidate});
 };
 doc.rungs.forEach((r,ri)=>{
  r.elements.forEach((el,ei)=>{
   if(el.type==='contact')push(ri,`Invert contact ${el.tag} in element ${ei+1}`,rung=>({...rung,elements:rung.elements.map((e,i)=>i===ei&&e.type==='contact'?{...e,normallyClosed:!e.normallyClosed}:e)}));
   else el.alternatives.forEach((path,pi)=>path.forEach((c,ci)=>push(ri,`Invert branch ${pi+1} contact ${c.tag}`,rung=>({...rung,elements:rung.elements.map((e,i)=>i===ei&&e.type==='branch'?{...e,alternatives:e.alternatives.map((p,j)=>j===pi?p.map((x,k)=>k===ci?{...x,normallyClosed:!x.normallyClosed}:x):p)}:e)}))));
  });
  if(r.operation?.kind==='ton'||r.operation?.kind==='tof'||r.operation?.kind==='rto'){
   const preset=r.operation.presetMs;
   for(const factor of [0.5,2])push(ri,`Timer preset ×${factor}`,rung=>({...rung,operation:{...r.operation!,presetMs:Math.max(1,Math.min(86400000,Math.round(preset*factor)))} as Rung['operation']}));
  }
  if(r.operation?.kind==='ctu')for(const delta of [-1,1])push(ri,`Counter preset ${delta>0?'+1':'-1'}`,rung=>({...rung,operation:{kind:'ctu',preset:Math.max(1,r.operation!.kind==='ctu'?r.operation!.preset+delta:1),...(r.operation!.kind==='ctu'&&r.operation!.resetTag?{resetTag:r.operation!.resetTag}:{})}}));
  if(r.operation?.kind==='osr'||r.operation?.kind==='osf')push(ri,'Swap rising/falling edge',rung=>({...rung,operation:{kind:r.operation?.kind==='osr'?'osf':'osr'}}));
 });
 return result;
}
/** Mutants are considered detected only when the original suite passes and a mutant fails an expectation. */
export function assessSequenceMutations(doc:LadderDocument,steps:readonly VectorStep[],deltaMs=20):MutationReport{
 const baseline=runLadderSequence(doc,steps,deltaMs);
 if(!baseline.passed)throw Error('Baseline test sequence fails: fix expected outputs before mutation analysis');
 const mutants=generateLadderMutants(doc);
 const outcomes=mutants.map(m=>{
  const test=runLadderSequence(m.document,steps,deltaMs);
  const failed=test.rows.find(r=>!r.passed);
  return {id:m.id,rungId:m.rungId,description:m.description,detected:!!failed,reason:failed?failed.failures.join('; '):'No expected output distinguished this mutation',firstFailingStep:failed?.step??null};
 });
 const detected=outcomes.filter(o=>o.detected).length;
 return {baselinePassed:true,baseline,total:outcomes.length,detected,survived:outcomes.length-detected,scorePercent:outcomes.length?Math.round(10000*detected/outcomes.length)/100:100,outcomes};
}
export function mutationReportCsv(report:MutationReport):string{
 const esc=(x:unknown)=>`"${String(x).replace(/"/g,'""')}"`;
 return [['id','rung','mutation','detected','first_failing_step','reason'].map(esc).join(','),...report.outcomes.map(o=>[o.id,o.rungId,o.description,o.detected,o.firstFailingStep??'',o.reason].map(esc).join(','))].join('\r\n');
}
