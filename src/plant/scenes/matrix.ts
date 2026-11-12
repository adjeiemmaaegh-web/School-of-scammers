/**
 * P12 multi-case on-device factory skill validation.
 *
 * Isolated copies of a learner's EXACT Ladder/FBD/ST project are executed
 * through the production pure PLC/plant Worker engine. The extra physical
 * NO test pushbutton replaces one sensor input ONLY in the test clone, so
 * high/low transitions go through 24V electrical terminal solving and the
 * genuine PLC scan. No forceLocal, direct coil writes, fake render state,
 * arbitrary network access or saved-project mutation.
 *
 * Curated original scenes: rotary, lift, scissor lift, safety-stop training,
 * height-stop and material-gate. This is NOT a production safety assessment.
 */
import {createWorld,tick,renderSnapshot} from '../../sim/orchestrator';
import {defaultProgramFor,programOf} from '../../sim/plcs';
import {ioOf} from '../../sim/plc-io';
import type {ProjectFile,WorldState,RenderSnapshot,Wire} from '../../sim/signals';
import {SCENES} from './catalogue';
import {projectSignature} from './commissioning';

export type MatrixKind='index'|'lift'|'guard'|'stopper'|'gate';
export type MatrixSpec={
 sceneId:string;kind:MatrixKind;actor:string;command:string;
 feedback:string|null;
 inputSensor:string|null;
 fault:string;
 /** The physical outputs are positional PLC16 Q0.0 (and Q0.1 on guard). */
};
export const P12_MATRIX_SPECS:readonly MatrixSpec[]=[
 {sceneId:'rotary-inspection',kind:'index',actor:'index',command:'turn',
  feedback:'index.OUT_indexed',inputSensor:'eye.OUT_present',fault:'actuator-stuck'},
 {sceneId:'two-level-lift',kind:'lift',actor:'lift',command:'up',
  feedback:'lift.OUT_top',inputSensor:null,fault:'lift-stuck'},
 {sceneId:'scissor-lift-station',kind:'lift',actor:'lift',command:'up',
  feedback:'lift.OUT_top',inputSensor:'eye.OUT_present',fault:'lift-stuck'},
 {sceneId:'guarded-conveyor',kind:'guard',actor:'stop',command:'extend',
  feedback:null,inputSensor:'curtain.OUT_blocked',fault:'stuck-retracted'},
 {sceneId:'height-guard',kind:'stopper',actor:'stop',command:'extend',
  feedback:null,inputSensor:'curtain.OUT_tall',fault:'stuck-retracted'},
 {sceneId:'material-inspection',kind:'gate',actor:'gate',command:'reject',
  feedback:null,inputSensor:'material.OUT_present',fault:'gate-jammed'},
] as const;
export const matrixSpecFor=(id:string):MatrixSpec|undefined=>
 P12_MATRIX_SPECS.find(s=>s.sceneId===id);
export type MatrixCaseResult={
 id:'idle'|'demand'|'release'|'fault-recovery';
 title:string;pass:boolean;detail:string;
 /** Worker simulation time measured in ms (no real-time claims). */
 atMs:number;
};
export type MatrixResult={
 sceneId:string;sourceSignature:string;
 status:'passed'|'failed'|'blocked';
 cases:readonly MatrixCaseResult[];
 diagnostic:string;
 executedScans:number;
};
const PLC='scene-plc',SUPPLY='scene-supply',BUTTON='p12-test-button';
const TEST_A=BUTTON+'.A',TEST_B=BUTTON+'.B',TEST_INPUT=PLC+'.I0.0';
const v=(w:WorldState,id:string,name:string):boolean|number|undefined=>
 w.plantWorld.signals[id]?.[name];
const powered=(w:WorldState):boolean=>renderSnapshot(w).plcs[PLC]?.powered===true;
const out=(w:WorldState,pin:'Q0.0'|'Q0.1'):boolean=>
 renderSnapshot(w).plcs[PLC]?.outputs[pin]===true;
const direct=(p:ProjectFile,a:string,b:string):boolean=>
 p.wires.some(w=>(w.from===a&&w.to===b)||(w.from===b&&w.to===a));
const freshProgram=(p:ProjectFile)=>{
 const plc=p.components.find(c=>c.id===PLC&&c.kind==='plc16');
 if(!plc)return false;
 const now=programOf(p,PLC),placeholder=defaultProgramFor(plc.kind,ioOf(p,plc));
 return now.language!==placeholder.language||
  now.language==='ladder'&&JSON.stringify(now.program)!==JSON.stringify(placeholder.program)||
  now.language==='st'&&now.stSource!==placeholder.stSource||
  now.language==='fbd'&&JSON.stringify(now.fbd)!==JSON.stringify(placeholder.fbd);
};
const required=(spec:MatrixSpec):readonly [string,string][]=>{
 const output=spec.kind==='guard'?
  [[PLC+'.Q0.0','belt.CMD_run+'],[PLC+'.Q0.1',spec.actor+'.CMD_'+spec.command+'+']]:
  [[PLC+'.Q0.0',spec.actor+'.CMD_'+spec.command+'+']];
 const io:readonly [string,string][]=[
  [SUPPLY+'.P24',PLC+'.L+'],[SUPPLY+'.M0',PLC+'.M'],
  ...output.map(x=>[x[0],x[1]] as [string,string]),
  [SUPPLY+'.M0',spec.actor+'.M-'],
 ];
 const sources: [string,string][]=[];
 if(spec.feedback) sources.push([spec.feedback,PLC+'.I0.1']);
 if(spec.inputSensor) sources.push([spec.inputSensor,TEST_INPUT]);
 // The real physical sensor and actuator require their own supply/reference.
 if(spec.inputSensor){
  const id=spec.inputSensor.split('.')[0];
  sources.push([SUPPLY+'.P24',id+'.L+'],[SUPPLY+'.M0',id+'.M']);
 }
 if(spec.feedback){
  sources.push([SUPPLY+'.P24',spec.actor+'.L+'],
   [SUPPLY+'.M0',spec.actor+'.M']);
 }
 if(spec.kind==='guard')sources.push([SUPPLY+'.M0','belt.M-']);
 return [...io,...sources];
};
export function matrixPreflight(p:ProjectFile,sceneId:string):string[]{
 const s=matrixSpecFor(sceneId);
 if(!s)return ['No calibrated multi-case training matrix for this scene'];
 const original=SCENES.find(x=>x.id===sceneId);
 if(!original)return ['Unknown original scene'];
 const reasons:string[]=[];
 if(p.components.some(c=>c.id===BUTTON))reasons.push('Test-fixture identifier already in use');
 if(!original.equipment.every(e=>
  p.components.some(c=>c.id===e.id&&c.kind===e.kind)))
  reasons.push('Original machine components are missing');
 if(!p.components.some(c=>c.id===PLC&&c.kind==='plc16')||
  !p.components.some(c=>c.id===SUPPLY&&c.kind==='supply'))
  reasons.push('Requires the original PLC16 and 24 V supply');
 if(!freshProgram(p))reasons.push('Write a learner PLC program, not the shipped starter');
 if((p.plantFaults&&Object.keys(p.plantFaults).length)||
  (p.faults&&p.faults.length))
  reasons.push('Clear existing injected faults before running isolated challenges');
 for(const [a,b] of required(s))if(!direct(p,a,b))
  reasons.push('Missing real physical patch '+a+' ↔ '+b);
 // Don't let unrelated parallel drivers fake a button/test input.
 const qPins=[PLC+'.Q0.0',...(s.kind==='guard'?[PLC+'.Q0.1']:[])];
 for(const q of qPins){
  const connected=p.wires.filter(w=>w.from===q||w.to===q);
  if(connected.length!==1)reasons.push('Dedicated PLC output expected at '+q);
 }
 return [...new Set(reasons)].slice(0,24);
}
function fixture(p:ProjectFile):ProjectFile{
 const old=p.wires.filter(w=>w.from!==TEST_INPUT&&w.to!==TEST_INPUT);
 const wires:Wire[]=[...old,
  {id:'p12-fixture-power',from:SUPPLY+'.P24',to:TEST_A},
  {id:'p12-fixture-input',from:TEST_B,to:TEST_INPUT}];
 return {
  ...p,
  components:[...p.components,{id:BUTTON,kind:'start',x:875,y:420,pressed:false}],
  wires,
 };
}
const scans=(w:WorldState,n:number,history:WorldState[]):WorldState=>{
 for(let i=0;i<n;i++){
  w=tick(w).world;
  if(w.lastError)throw new Error(w.lastError);
  history.push(w);
 }
 return w;
};
function fresh(p:ProjectFile,faultId?:string,fault?:string):WorldState{
 let w=tick(createWorld(),[{k:'loadProject',project:fixture(p)}]).world;
 if(w.lastError)throw new Error(w.lastError);
 if(faultId&&fault){
  w=tick(w,[{k:'setPlantFault',id:faultId,fault}]).world;
  if(w.lastError)throw new Error(w.lastError);
 }
 w=tick(w,[{k:'run'}]).world;
 if(w.lastError)throw new Error(w.lastError);
 return w;
}
const button=(w:WorldState,pressed:boolean,history:WorldState[]):WorldState=>{
 w=tick(w,[{k:'operate',id:BUTTON,pressed}]).world;
 if(w.lastError)throw new Error(w.lastError);
 history.push(w);return w;
};
const repair=(w:WorldState,id:string,history:WorldState[]):WorldState=>{
 w=tick(w,[{k:'pause'},{k:'setPlantFault',id,fault:null}]).world;
 if(w.lastError)throw new Error(w.lastError);
 w=tick(w,[{k:'run'}]).world;
 if(w.lastError)throw new Error(w.lastError);
 history.push(w);return w;
};
const sig=(w:WorldState,s:MatrixSpec,key:string):boolean|number|undefined=>
 v(w,s.actor,key);
const exact= (s:MatrixSpec,w:WorldState):boolean=>{
 if(s.kind==='index')return sig(w,s,'indexed')===true;
 if(s.kind==='lift')return sig(w,s,'top')===true;
 if(s.kind==='guard'||s.kind==='stopper')return sig(w,s,'extended')===true;
 return sig(w,s,'rejected')===true;
};
const resting=(s:MatrixSpec,w:WorldState):boolean=>{
 if(s.kind==='index')return sig(w,s,'home')===true&&!out(w,'Q0.0');
 if(s.kind==='lift')return sig(w,s,'bottom')===true&&!out(w,'Q0.0');
 if(s.kind==='guard')return v(w,'belt','moving')===true&&
  sig(w,s,'retracted')===true&&out(w,'Q0.0')&&!out(w,'Q0.1');
 if(s.kind==='stopper')return sig(w,s,'retracted')===true&&!out(w,'Q0.0');
 return sig(w,s,'home')===true&&!out(w,'Q0.0');
};
const operated=(s:MatrixSpec,w:WorldState):boolean=>
 s.kind==='guard'?out(w,'Q0.1')&&!out(w,'Q0.0'):
 out(w,'Q0.0');
const activeCondition=(s:MatrixSpec,w:WorldState):boolean=>
 exact(s,w)&&(s.kind==='guard'?v(w,'belt','moving')===false:true);
const nActive=(s:MatrixSpec):number=>
 s.kind==='lift'?150:s.kind==='index'?33:22;
const nRelease=(s:MatrixSpec):number=>s.kind==='lift'?20:24;
const fail=(id:MatrixCaseResult['id'],title:string,e:unknown,ms=0):MatrixCaseResult=>({
 id,title,pass:false,detail:e instanceof Error?e.message:String(e),atMs:ms,
});
const result=(id:MatrixCaseResult['id'],title:string,pass:boolean,
 why:string,w:WorldState):MatrixCaseResult=>({
 id,title,pass,detail:why,atMs:w.plantWorld.world.timeMs,
});
const faultChecks=(s:MatrixSpec,w:WorldState):boolean=>
 s.kind==='index'?sig(w,s,'indexed')===false:
 s.kind==='lift'?sig(w,s,'positionMm')===0:
 s.kind==='guard'||s.kind==='stopper'?sig(w,s,'extended')===false:
 sig(w,s,'rejected')===false;

/**
 * Four independent challenge cases per original scene. No dynamic input
 * comes from UI switches/Three.js: every transition is a real 24V NO
 * pushbutton in the isolated netlist. Each fresh case runs its own exact
 * learner program; return only small human-auditable case results.
 */
export function runPlantMatrix(p:ProjectFile,sceneId:string):MatrixResult{
 const signature=projectSignature(p),s=matrixSpecFor(sceneId);
 const reasons=matrixPreflight(p,sceneId);
 if(!s||reasons.length)return {sceneId,sourceSignature:signature,status:'blocked',
  cases:[],diagnostic:reasons.join('; '),executedScans:0};
 const results:MatrixCaseResult[]=[];
 let total=0;
 const execute=(id:MatrixCaseResult['id'],title:string,
  fn:(history:WorldState[])=>{pass:boolean;reason:string;world:WorldState})=>{
  const history:WorldState[]=[];
  try{
   const checked=fn(history);
   total+=history.length;
   results.push(result(id,title,checked.pass,checked.reason,checked.world));
  }catch(error){
   total+=history.length;
   results.push(fail(id,title,error));
  }
 };
 execute('idle','Uncommanded idle / fail-safe initial state',h=>{
  let w=fresh(p);
  w=scans(w,5,h);
  const pass=powered(w)&&resting(s,w);
  return {world:w,pass,reason:pass?
   'Unpressed physical training button; real PLC and machine remain in expected idle state':
   'Unexpected PLC output or worker equipment response while the pushbutton is open'};
 });
 execute('demand','Actual 24V input causes commanded machine action',h=>{
  let w=fresh(p);w=button(w,true,h);
  w=scans(w,nActive(s),h);
  const commandSeen=h.some(t=>operated(s,t));
  const motionSeen=h.some(t=>s.kind==='index'?sig(t,s,'busy')===true:
   s.kind==='lift'?sig(t,s,'moving')===true:activeCondition(s,t));
  const interlock=s.kind==='index'||s.kind==='lift'?!out(w,'Q0.0'):true;
  const pass=powered(w)&&commandSeen&&motionSeen&&activeCondition(s,w)&&interlock;
  return {world:w,pass,reason:pass?
   'Real PLC output, physical motion and reached worker limit, with end feedback interlock':
   'Demand failed actual Q drive, physical motion/limit, or controller feedback stop'};
 });
 execute('release','Remove input; stop or retract without uncontrolled continuation',h=>{
  let w=fresh(p);
  w=button(w,true,h);
  w=scans(w,s.kind==='lift'||s.kind==='index'?8:22,h);
  const before=sig(w,s,s.kind==='lift'?'positionMm':'busy');
  w=button(w,false,h);
  w=scans(w,nRelease(s),h);
  let stable=false;
  if(s.kind==='lift')stable=typeof before==='number'&&
   Math.abs((sig(w,s,'positionMm') as number)-before)<5&&!out(w,'Q0.0');
  else if(s.kind==='index')stable=sig(w,s,'indexed')===false&&!out(w,'Q0.0');
  else stable=resting(s,w);
  const pass=powered(w)&&stable;
  return {world:w,pass,reason:pass?
   'Removing actual 24V input produced worker-verified stop/return behavior':
   'PLC or machine continued dangerously/unexpectedly after input was released'};
 });
 execute('fault-recovery','Injected equipment fault prevents action; repair restores it',h=>{
  let w=fresh(p,s.actor,s.fault);
  w=button(w,true,h);
  w=scans(w,Math.min(35,nActive(s)),h);
  const faultHeld=operated(s,w)&&faultChecks(s,w);
  w=repair(w,s.actor,h);
  w=scans(w,nActive(s)+5,h);
  const recovered=h.some(t=>activeCondition(s,t));
  const pass=powered(w)&&faultHeld&&recovered;
  return {world:w,pass,reason:pass?
   'Real PLC requested action under a blocked plant fault; corrected model then responded':
   'Fault was bypassed, no valid PLC demand, or plant did not recover after repair'};
 });
 return {sceneId,sourceSignature:signature,
  status:results.every(c=>c.pass)?'passed':'failed',cases:results,
  diagnostic:results.every(c=>c.pass)?
   'All four isolated engine-run cases passed; limited to this named training matrix':
   'One or more independent real-worker cases failed; inspect the individual expected outcomes',
  executedScans:Math.min(2000,total)};
}
