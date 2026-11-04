/** Isolated, deterministic PLC instruction practice; never drives the workcell hardware model. */
import {executeLadder,validateLadder,type LadderDocument,type LadderMemory,type LadderStep} from './ladder';

export const LOGIC_LAB_HISTORY_LIMIT=500;
export type LogicSample={scan:number;timeMs:number;inputs:Readonly<Record<string,boolean>>;outputs:Readonly<Record<string,boolean>>;steps:readonly LadderStep[]};
export interface LogicBench {
 readonly program:LadderDocument;
 readonly scan:number;
 readonly timeMs:number;
 readonly deltaMs:number;
 readonly inputs:Readonly<Record<string,boolean>>;
 readonly outputs:Readonly<Record<string,boolean>>;
 readonly memory:LadderMemory;
 readonly history:readonly LogicSample[];
}
export interface InstructionExercise {id:string;title:string;goal:string;steps:string;program:LadderDocument}
const contact=(tag:string)=>({type:'contact' as const,tag});
/** Each exercise is deliberately self-contained: simulated inputs cannot bypass a workcell interlock. */
export const INSTRUCTION_EXERCISES:readonly InstructionExercise[]=[
 {id:'ton',title:'TON · Delay before output',goal:'Output energizes after three 20 ms enabled scans and drops immediately when Enable opens.',steps:'Set Enable ON, run 2 scans (output OFF), run 1 more (ON), then turn Enable OFF and scan (OFF).',program:{id:'lesson-ton',version:'1',rungs:[{id:'delay',elements:[contact('Enable')],coil:'TimerDone',operation:{kind:'ton',presetMs:60}}]}},
 {id:'tof',title:'TOF · Run-on delay',goal:'Output remains ON for 60 ms after Enable falls.',steps:'Set Enable ON and scan. Turn it OFF, scan twice (output ON); third OFF scan expires the delay.',program:{id:'lesson-tof',version:'1',rungs:[{id:'off-delay',elements:[contact('Enable')],coil:'OffDelayDone',operation:{kind:'tof',presetMs:60}}]}},
 {id:'rto',title:'RTO · Retentive timer',goal:'Accumulate 60 ms across interruptions; ResetTimer clears accumulated time.',steps:'Enable ON for 2 scans, OFF for 2 scans, ON for 1 scan: output ON. Toggle ResetTimer then scan to clear.',program:{id:'lesson-rto',version:'1',rungs:[{id:'retentive-delay',elements:[contact('Enable')],coil:'RetainDone',operation:{kind:'rto',presetMs:60,resetTag:'ResetTimer'}}]}},
 {id:'ctu',title:'CTU · Product batch counter',goal:'Count three separate Sensor rising edges; ResetCount clears the batch.',steps:'Pulse Sensor ON/OFF three times (scanning each change). Hold ON and scan again: no extra count. ResetCount clears the count.',program:{id:'lesson-ctu',version:'1',rungs:[{id:'batch',elements:[contact('Sensor')],coil:'BatchDone',operation:{kind:'ctu',preset:3,resetTag:'ResetCount'}}]}},
 {id:'tp',title:'TP · Fixed one-shot pulse',goal:'A rising Enable edge starts a 60 ms pulse (three 20 ms scans) even when Enable falls. Held-high input does not retrigger.',steps:'Turn Enable ON and scan once; turn it OFF and scan twice (output stays ON), then scan again to expire. After expiry, turn Enable ON and scan again to start a new pulse.',program:{id:'lesson-tp',version:'1',rungs:[{id:'pulse',elements:[contact('Enable')],coil:'PulseDone',operation:{kind:'tp',presetMs:60}}]}},
 {id:'ctd',title:'CTD · Load and count down',goal:'Load three units and count separate Sensor rising edges down to zero.',steps:'Fresh CTD count is zero and Q is ON. Turn LoadCount ON and scan to load 3 (Q OFF); turn it OFF and pulse Sensor ON/OFF three times, scanning each change. The output turns ON when CV reaches zero.',program:{id:'lesson-ctd',version:'1',rungs:[{id:'down-counter',elements:[contact('Sensor')],coil:'ZeroReached',operation:{kind:'ctd',preset:3,loadTag:'LoadCount'}}]}},
 {id:'conveyor-batch',title:'Integrated conveyor · Count and inspect',goal:'Use an interlocked RunLatch, count three photoeye edges into BatchDone, and pulse an exit event.',steps:'In the isolated lab, turn PowerOK, GuardClosed and SensorOK ON, pulse Start, then pulse Photoeye three times. In the workcell, with supply isolated connect the sensor cable and wire its signal to I0.2, then restore power, start the conveyor and place products.',program:{id:'lesson-conveyor-batch',version:'1',rungs:[{id:'motor-run',elements:[contact('PowerOK'),contact('GuardClosed'),contact('SensorOK'),{type:'contact',tag:'Stop',normallyClosed:true},{type:'branch',alternatives:[[contact('Start')],[contact('RunLatch')]]}],coil:'RunLatch'},{id:'batch-count',elements:[contact('Photoeye')],coil:'BatchDone',operation:{kind:'ctu',preset:3,resetTag:'ResetCount'}},{id:'exit-edge',elements:[contact('ExitSensor')],coil:'ExitPulse',operation:{kind:'osr'}}]}},
 {id:'edges',title:'OSR / OSF · One-shot edges',goal:'Generate exactly one scan of positive- and negative-edge outputs.',steps:'Enable OFF, scan; ON, scan twice to see one Rising pulse; OFF, scan twice to see one Falling pulse.',program:{id:'lesson-edges',version:'1',rungs:[{id:'rising',elements:[contact('Enable')],coil:'Rising',operation:{kind:'osr'}},{id:'falling',elements:[contact('Enable')],coil:'Falling',operation:{kind:'osf'}}]}}
] as const;

export function logicBenchInputTags(program:LadderDocument):string[]{
 const outputs=new Set(program.rungs.map(r=>r.coil));const tags=new Set<string>();
 for(const rung of program.rungs){
  for(const element of rung.elements){if(element.type==='contact')tags.add(element.tag);else for(const branch of element.alternatives)for(const c of branch)tags.add(c.tag)}
  if(rung.operation && 'resetTag' in rung.operation && rung.operation.resetTag)tags.add(rung.operation.resetTag);
  if(rung.operation?.kind==='ctd')tags.add(rung.operation.loadTag);
 }
 return [...tags].filter(tag=>!outputs.has(tag)).sort();
}
export function createLogicBench(program:LadderDocument,deltaMs=20):LogicBench {
 const errors=validateLadder(program);if(errors.length)throw Error(errors.join('; '));
 if(!Number.isSafeInteger(deltaMs)||deltaMs<1||deltaMs>1000)throw RangeError('Scan interval must be 1..1000 ms');
 return {program,scan:0,timeMs:0,deltaMs,inputs:Object.fromEntries(logicBenchInputTags(program).map(tag=>[tag,false])),outputs:{},memory:{},history:[]};
}
export function setLogicBenchInput(bench:LogicBench,tag:string,on:boolean):LogicBench {
 if(!Object.hasOwn(bench.inputs,tag))throw Error('Input tag is not an externally controllable contact');
 if(typeof on!=='boolean')throw TypeError('Input requires a boolean value');
 return {...bench,inputs:{...bench.inputs,[tag]:on}};
}
export function advanceLogicBench(bench:LogicBench,scans=1):LogicBench {
 if(!Number.isSafeInteger(scans)||scans<1||scans>500)throw RangeError('Run between 1 and 500 scans per action');
 if(bench.scan+scans>1_000_000||!Number.isSafeInteger(bench.timeMs+scans*bench.deltaMs))throw RangeError('Logic lab simulation limit reached; reset to continue');
 let {scan,timeMs,outputs,memory}=bench;
 const history=[...bench.history];
 for(let i=0;i<scans;i++){
  const result=executeLadder(bench.program,bench.inputs,outputs,memory,bench.deltaMs);
  scan++;timeMs+=bench.deltaMs;outputs=result.outputs;memory=result.memory;
  history.push({scan,timeMs,inputs:{...bench.inputs},outputs:{...outputs},steps:result.steps});
  if(history.length>LOGIC_LAB_HISTORY_LIMIT)history.shift();
 }
 return {...bench,scan,timeMs,outputs,memory,history};
}
export function resetLogicBench(bench:LogicBench):LogicBench{return createLogicBench(bench.program,bench.deltaMs)}
const csvEscape=(value:unknown)=>`"${String(value).replaceAll('"','""')}"`;
/** Exports sampled values and all instruction accumulator/done states; no wall clock or cloud data. */
export function logicBenchCsv(bench:LogicBench):string {
 const inputs=logicBenchInputTags(bench.program);const outputs=bench.program.rungs.map(r=>r.coil);
 const header=['scan','time_ms',...inputs.map(t=>`input:${t}`),...outputs.map(t=>`coil:${t}`),...bench.program.rungs.flatMap(r=>[`${r.id}:enable`,`${r.id}:done`,`${r.id}:elapsed_ms`,`${r.id}:count`])];
 const rows=bench.history.map(s=>[s.scan,s.timeMs,...inputs.map(t=>Number(s.inputs[t]===true)),...outputs.map(t=>Number(s.outputs[t]===true)),...s.steps.flatMap(t=>[Number(t.energized),Number(t.result),t.elapsedMs??'',t.count??''])]);
 return [header,...rows].map(row=>row.map(csvEscape).join(',')).join('\r\n')+'\r\n';
}
