/**
 * Educational star-to-delta motor starter: a bounded deterministic control-state model.
 * The output is NOT a power-system simulator, certified interlock or wiring prescription.
 * It models the key principle that STAR and DELTA must never be commanded together.
 */
export type StarterFault='none'|'star-welded'|'delta-welded'|'timer-stuck'|'overload-trip';
export type StarterPhase='idle'|'star'|'deadtime'|'delta'|'tripped';
export type StarterConfig={starTimeMs:number;deadTimeMs:number;maximumStarTimeMs:number};
export type StarterInputs={supplyOn:boolean;estopOk:boolean;guardClosed:boolean;overloadOk:boolean;start:boolean;stop:boolean;reset:boolean};
export type StarterSample={timeMs:number;phase:StarterPhase;main:boolean;star:boolean;delta:boolean;starFeedback:boolean;deltaFeedback:boolean;speedPercent:number;fault:StarterFault;hazard:boolean;message:string};
export type StarterState={timeMs:number;phase:StarterPhase;phaseMs:number;speedPercent:number;fault:StarterFault;starWeldLatched:boolean;deltaWeldLatched:boolean;hazard:boolean;message:string;events:readonly string[]};
export const STARTER_CONFIG:StarterConfig={starTimeMs:3000,deadTimeMs:300,maximumStarTimeMs:6000};
export const STARTER_INPUTS:StarterInputs={supplyOn:true,estopOk:true,guardClosed:true,overloadOk:true,start:false,stop:false,reset:false};
export function initialStarter():StarterState{
 return {timeMs:0,phase:'idle',phaseMs:0,speedPercent:0,fault:'none',starWeldLatched:false,deltaWeldLatched:false,hazard:false,message:'Ready — start only with protective inputs healthy.',events:[]};
}
function validateConfig(c:StarterConfig):void {
 if(!c||![c.starTimeMs,c.deadTimeMs,c.maximumStarTimeMs].every(Number.isSafeInteger)||
 c.starTimeMs<100||c.starTimeMs>30000||c.deadTimeMs<100||c.deadTimeMs>3000||
 c.maximumStarTimeMs<c.starTimeMs||c.maximumStarTimeMs>60000)throw new RangeError('Invalid starter time settings');
}
function push(previous:readonly string[],message:string){return [...previous,message].slice(-150);}
function feedback(s:StarterState,phase:StarterPhase){
 return {star:phase==='star'||s.starWeldLatched,delta:phase==='delta'||s.deltaWeldLatched};
}
export function injectStarterFault(s:StarterState,fault:StarterFault,supplyIsolated:boolean):StarterState{
 if(!['none','star-welded','delta-welded','timer-stuck','overload-trip'].includes(fault))throw new TypeError('Unknown starter fault');
 if(!supplyIsolated||s.phase!=='idle'&&s.phase!=='tripped')throw new Error('Isolate simulated power and stop the starter before changing faults');
 // Clearing a simulated mechanical defect is treated as technician repair under isolation.
 return {...s,fault,starWeldLatched:fault==='star-welded'&&s.starWeldLatched,
 deltaWeldLatched:fault==='delta-welded'&&s.deltaWeldLatched,
 message:'Fault configuration updated under simulated isolation.',events:push(s.events,'FAULT '+fault)};
}
export function stepStarDelta(s:StarterState,inputs:StarterInputs,deltaMs=100,config:StarterConfig=STARTER_CONFIG):StarterState{
 validateConfig(config);
 if(!Number.isSafeInteger(deltaMs)||deltaMs<20||deltaMs>1000)throw new RangeError('Scan step must be 20..1000 ms');
 if(!s||!Number.isSafeInteger(s.timeMs)||s.timeMs<0||!Number.isFinite(s.speedPercent)||s.speedPercent<0||s.speedPercent>100)throw new TypeError('Invalid starter state');
 if(!inputs||Object.values(inputs).some(v=>typeof v!=='boolean'))throw new TypeError('Digital starter inputs must be BOOL');
 const timeMs=s.timeMs+deltaMs;
 let phase=s.phase,phaseMs=s.phaseMs+deltaMs,message=s.message;
 let starWeldLatched=s.starWeldLatched,deltaWeldLatched=s.deltaWeldLatched,hazard=false;
 let events=s.events;
 const safetyReady=inputs.supplyOn&&inputs.estopOk&&inputs.guardClosed&&inputs.overloadOk&&s.fault!=='overload-trip';
 const enter=(next:StarterPhase,reason:string)=>{if(phase!==next){events=push(events,timeMs+' ms: '+reason);phase=next;phaseMs=0;}message=reason;};
 if(!safetyReady||inputs.stop){
  if(phase!=='tripped'&&phase!=='idle'){
   enter(inputs.stop&&safetyReady?'idle':'tripped',inputs.stop&&safetyReady?'STOP command':'Protective interlock opened');
  }else if(phase==='idle'){phaseMs=0;}
 }else if(phase==='tripped'){
  if(inputs.reset&&!starWeldLatched&&!deltaWeldLatched)enter('idle','Trip reset with healthy permissives');
 }else if(phase==='idle'){
  phaseMs=0;
  if(inputs.start){
   if(starWeldLatched||deltaWeldLatched)enter('tripped','Welded contact feedback prevents a new start');
   else enter('star','Starting in STAR; main and star coils requested');
  }
 }else if(phase==='star'){
  if(s.fault==='star-welded')starWeldLatched=true;
  if(phaseMs>=config.maximumStarTimeMs)enter('tripped','Star transfer timeout; stopped');
  else if(phaseMs>=config.starTimeMs&&s.fault!=='timer-stuck')enter('deadtime','Star opened; observing changeover dead time');
 }else if(phase==='deadtime'){
  if(starWeldLatched||deltaWeldLatched)enter('tripped','Contactor feedback disagreement; DELTA blocked');
  else if(phaseMs>=config.deadTimeMs)enter('delta','Entering DELTA; main and delta coils requested');
 }else if(phase==='delta'){
  if(s.fault==='delta-welded')deltaWeldLatched=true;
 }
 const main=phase==='star'||phase==='deadtime'||phase==='delta';
 const star=phase==='star',delta=phase==='delta';
 const starFeedback=star||starWeldLatched,deltaFeedback=delta||deltaWeldLatched;
 // In normal control logic commands cannot overlap. Mechanical feedback is independently checked.
 if(starFeedback&&deltaFeedback){
  hazard=true;
  enter('tripped','HAZARD: simultaneous star/delta feedback — isolate simulated supply');
 }else if((phase==='tripped'||phase==='idle')&&(starFeedback||deltaFeedback)){
  hazard=true;
  message='HAZARD: welded contactor remains mechanically closed after stop';
 }
 const running=phase==='star'||phase==='delta';
 const desiredSpeed=phase==='star'?33:phase==='delta'?100:0;
 const speedPercent=Math.max(0,Math.min(100,s.speedPercent+
 Math.max(-deltaMs/90,Math.min(deltaMs/120,desiredSpeed-s.speedPercent))));
 const next:StarterState={timeMs,phase,phaseMs,speedPercent:running?speedPercent:Math.max(0,speedPercent-deltaMs/90),
  fault:s.fault,starWeldLatched,deltaWeldLatched,hazard,message,events};
 return next;
}
export function starterSample(s:StarterState):StarterSample{
 const f=feedback(s,s.phase);
 return {timeMs:s.timeMs,phase:s.phase,main:s.phase==='star'||s.phase==='deadtime'||s.phase==='delta',
 star:s.phase==='star',delta:s.phase==='delta',starFeedback:f.star,deltaFeedback:f.delta,
 speedPercent:s.speedPercent,fault:s.fault,hazard:s.hazard,message:s.message};
}
export function runStarterSequence(initial:StarterState,commands:readonly {inputs:StarterInputs;scans:number;deltaMs?:number}[],config:StarterConfig=STARTER_CONFIG):{end:StarterState;rows:StarterSample[]}{
 if(!Array.isArray(commands)||commands.length<1||commands.length>100)throw new RangeError('Requires 1..100 operating steps');
 let count=0,s=initial;const rows:StarterSample[]=[];
 for(const c of commands){
  if(!Number.isSafeInteger(c.scans)||c.scans<1||count+c.scans>3000)throw new RangeError('Campaign cannot exceed 3000 scans');
  for(let i=0;i<c.scans;i++){s=stepStarDelta(s,c.inputs,c.deltaMs??100,config);rows.push(starterSample(s));}
  count+=c.scans;
 }
 return {end:s,rows};
}
export function starterCsv(rows:readonly StarterSample[]):string{
 if(rows.length>3000)throw new RangeError('Too many evidence rows');
 const columns=['time_ms','phase','main_command','star_command','delta_command','star_feedback','delta_feedback','speed_percent','fault','hazard','message'];
 const cell=(x:unknown)=>'"'+String(x).replace(/"/g,'""')+'"';
 return [columns,...rows.map(r=>[r.timeMs,r.phase,r.main,r.star,r.delta,r.starFeedback,r.deltaFeedback,
 Math.round(r.speedPercent*10)/10,r.fault,r.hazard,r.message])].map(r=>r.map(cell).join(',')).join('\r\n');
}
