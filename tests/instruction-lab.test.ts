import {describe,it,expect} from 'vitest';
import {executeLadder,validateLadder,type LadderDocument} from '../src/engineering/ladder';
import {INSTRUCTION_EXERCISES,createLogicBench,advanceLogicBench,setLogicBenchInput,logicBenchInputTags,logicBenchCsv,resetLogicBench} from '../src/engineering/instruction-lab';
import {initialWorkcell,stepWorkcell,workcellLadder} from '../src/engineering/workcell';
import {newBoard} from '../src/engineering/wiring-board';
import {serializeProject,parseProject} from '../src/engineering/project-file';
const lesson=(id:string)=>INSTRUCTION_EXERCISES.find(x=>x.id===id)!.program;
const step=(b:ReturnType<typeof createLogicBench>,n=1)=>advanceLogicBench(b,n);
const switchInput=(b:ReturnType<typeof createLogicBench>,tag:string,on:boolean)=>setLogicBenchInput(b,tag,on);
describe('PLC advanced instructions: deterministic scan semantics',()=>{
 it('all exercise programs pass formal ladder validation',()=>{for(const x of INSTRUCTION_EXERCISES)expect(validateLadder(x.program)).toEqual([])});
 it('TON transitions exactly at preset scan and resets',()=>{let b=switchInput(createLogicBench(lesson('ton')),'Enable',true);b=step(b,2);expect(b.outputs.TimerDone).toBe(false);expect(b.memory.delay.elapsedMs).toBe(40);b=step(b);expect(b.outputs.TimerDone).toBe(true);b=step(switchInput(b,'Enable',false));expect(b.outputs.TimerDone).toBe(false);expect(b.memory.delay.elapsedMs).toBe(0)});
 it('TOF remains active until expiry',()=>{let b=step(switchInput(createLogicBench(lesson('tof')),'Enable',true));b=step(switchInput(b,'Enable',false),2);expect(b.outputs.OffDelayDone).toBe(true);b=step(b);expect(b.outputs.OffDelayDone).toBe(false)});
 it('RTO accumulates across disabled gaps, retains done, resets with priority',()=>{let b=step(switchInput(createLogicBench(lesson('rto')),'Enable',true),2);b=step(switchInput(b,'Enable',false),2);expect(b.memory['retentive-delay'].elapsedMs).toBe(40);b=step(switchInput(b,'Enable',true));expect(b.outputs.RetainDone).toBe(true);b=step(switchInput(b,'ResetTimer',true));expect(b.outputs.RetainDone).toBe(false);expect(b.memory['retentive-delay'].elapsedMs).toBe(0);b=step(switchInput(b,'ResetTimer',false));expect(b.memory['retentive-delay'].elapsedMs).toBe(20)});
 it('TP produces exactly three 20 ms pulse scans after a rising edge',()=>{
  let b=step(createLogicBench(lesson('tp')));
  expect(b.outputs.PulseDone).toBe(false);
  b=step(switchInput(b,'Enable',true));expect(b.outputs.PulseDone).toBe(true);expect(b.memory.pulse.elapsedMs).toBe(20);
  b=step(switchInput(b,'Enable',false));expect(b.outputs.PulseDone).toBe(true);expect(b.memory.pulse.elapsedMs).toBe(40);
  b=step(b);expect(b.outputs.PulseDone).toBe(true);expect(b.memory.pulse.elapsedMs).toBe(60);
  b=step(b);expect(b.outputs.PulseDone).toBe(false);
  b=step(switchInput(b,'Enable',true),4);expect(b.outputs.PulseDone).toBe(false);
  b=step(switchInput(b,'Enable',false));b=step(switchInput(b,'Enable',true));expect(b.outputs.PulseDone).toBe(true);
 });
 it('TP rising edge while active does not retrigger or extend pulse',()=>{
  let b=step(switchInput(createLogicBench(lesson('tp')),'Enable',true));
  b=step(switchInput(b,'Enable',false));b=step(switchInput(b,'Enable',true));
  expect(b.outputs.PulseDone).toBe(true);expect(b.memory.pulse.elapsedMs).toBe(60);
  b=step(b);expect(b.outputs.PulseDone).toBe(false);b=step(b);expect(b.outputs.PulseDone).toBe(false);
 });
 it('CTD requires loading, counts rising edges, saturates at zero and reloads',()=>{
  let b=step(createLogicBench(lesson('ctd')));
  expect(b.outputs.ZeroReached).toBe(true);expect(b.memory['down-counter'].count).toBe(0);
  b=step(switchInput(b,'LoadCount',true));expect(b.memory['down-counter'].count).toBe(3);expect(b.outputs.ZeroReached).toBe(false);
  b=step(switchInput(b,'LoadCount',false));
  for(let i=0;i<3;i++){
   b=step(switchInput(b,'Sensor',true));expect(b.memory['down-counter'].count).toBe(2-i);
   b=step(b,3);expect(b.memory['down-counter'].count).toBe(2-i);
   b=step(switchInput(b,'Sensor',false));
  }
  expect(b.outputs.ZeroReached).toBe(true);
  b=step(switchInput(b,'Sensor',true),9);expect(b.memory['down-counter'].count).toBe(0);
  b=step(switchInput(b,'LoadCount',true));expect(b.memory['down-counter'].count).toBe(3);
  expect(b.outputs.ZeroReached).toBe(false);
 });
 it('CTD load takes priority and prevents phantom decrement while Sensor stays high',()=>{
  let b=createLogicBench(lesson('ctd'));
  b=step(switchInput(switchInput(b,'LoadCount',true),'Sensor',true));
  expect(b.memory['down-counter'].count).toBe(3);
  b=step(switchInput(b,'LoadCount',false),3);expect(b.memory['down-counter'].count).toBe(3);
  b=step(switchInput(b,'Sensor',false));b=step(switchInput(b,'Sensor',true));
  expect(b.memory['down-counter'].count).toBe(2);
 });
 it('CTU counts only rising edges, saturates at preset, resets without phantom count',()=>{let b=createLogicBench(lesson('ctu'));for(let i=0;i<3;i++){b=step(switchInput(b,'Sensor',true));b=step(switchInput(b,'Sensor',false))}expect(b.memory.batch.count).toBe(3);expect(b.outputs.BatchDone).toBe(true);b=step(switchInput(b,'Sensor',true),10);expect(b.memory.batch.count).toBe(3);b=step(switchInput(b,'ResetCount',true));expect(b.memory.batch.count).toBe(0);expect(b.outputs.BatchDone).toBe(false);b=step(switchInput(b,'ResetCount',false));expect(b.memory.batch.count).toBe(0);b=step(switchInput(b,'Sensor',false));b=step(switchInput(b,'Sensor',true));expect(b.memory.batch.count).toBe(1)});
 it('OSR and OSF each emit a one-scan pulse at the corresponding edge',()=>{let b=step(createLogicBench(lesson('edges')));expect(b.outputs).toEqual({Rising:false,Falling:false});b=step(switchInput(b,'Enable',true));expect(b.outputs).toEqual({Rising:true,Falling:false});b=step(b);expect(b.outputs.Rising).toBe(false);b=step(switchInput(b,'Enable',false));expect(b.outputs).toEqual({Rising:false,Falling:true});b=step(b);expect(b.outputs.Falling).toBe(false)});
 it('rejects invalid RTO presets and malformed reset tags',()=>{const p=lesson('rto');expect(validateLadder({...p,rungs:p.rungs.map(r=>({...r,operation:{kind:'rto' as const,presetMs:0}}))}).length).toBeGreaterThan(0);expect(validateLadder({...p,rungs:p.rungs.map(r=>({...r,operation:{kind:'rto' as const,presetMs:100,resetTag:'bad-tag'}}))}).length).toBeGreaterThan(0)});
 it('prevents a reset tag on other operation kinds',()=>{const p=lesson('ton');const input=structuredClone(p) as LadderDocument;(input.rungs[0].operation as any).resetTag='ResetTimer';expect(validateLadder(input).some(e=>e.includes('reset tag unsupported'))).toBe(true)});
 it('replaying a fixed sequence exactly reproduces result and history',()=>{const run=()=>{let b=createLogicBench(lesson('ctu'));b=step(switchInput(b,'Sensor',true),3);b=step(switchInput(b,'Sensor',false),2);return step(switchInput(b,'Sensor',true))};expect(run()).toEqual(run())});
});
describe('isolated logic lab I/O, export, and integration',()=>{
 it('discovers CTD load control without treating the coil as a forced input',()=>{
  expect(logicBenchInputTags(lesson('ctd'))).toEqual(['LoadCount','Sensor']);
  expect(logicBenchInputTags(lesson('tp'))).toEqual(['Enable']);
 });
 it('recognizes external contacts and reset tags but never treats coils as forced inputs',()=>{expect(logicBenchInputTags(lesson('ctu'))).toEqual(['ResetCount','Sensor']);expect(logicBenchInputTags(workcellLadder)).not.toContain('RunLatch')});
 it('blocks unknown forced tags and invalid scan intervals and batch sizes',()=>{const b=createLogicBench(lesson('ton'));expect(()=>setLogicBenchInput(b,'TimerDone',true)).toThrow();expect(()=>createLogicBench(lesson('ton'),0)).toThrow();expect(()=>step(b,0)).toThrow();expect(()=>step(b,501)).toThrow()});
 it('keeps only 500 bounded samples while preserving scan and elapsed time',()=>{let b=step(createLogicBench(lesson('ton')),500);b=step(b,40);expect(b.scan).toBe(540);expect(b.timeMs).toBe(10800);expect(b.history).toHaveLength(500);expect(b.history[0].scan).toBe(41);expect(b.history.at(-1)?.scan).toBe(540)});
 it('CSV includes exact sample columns, instruction state, and CRLF lines',()=>{let b=step(switchInput(createLogicBench(lesson('ctu')),'Sensor',true));const csv=logicBenchCsv(b);expect(csv).toContain('input:Sensor');expect(csv).toContain('batch:count');expect(csv).toContain('"1","20"');expect(csv.split('\r\n')).toHaveLength(3)});
 it('does not mutate an earlier immutable session or its input snapshot',()=>{const a=createLogicBench(lesson('ton')),b=switchInput(a,'Enable',true),c=step(b);expect(a.inputs.Enable).toBe(false);expect(a.scan).toBe(0);expect(b.scan).toBe(0);expect(c.history[0].inputs.Enable).toBe(true)});
 it('reset clears old memory and history, with fresh inputs',()=>{let b=step(switchInput(createLogicBench(lesson('rto')),'Enable',true),3);expect(b.outputs.RetainDone).toBe(true);b=resetLogicBench(b);expect(b.scan).toBe(0);expect(b.history).toHaveLength(0);expect(b.inputs.Enable).toBe(false);expect(b.memory).toEqual({})});
 it('workcell reset inputs are sampled and plant signals come from the preceding process snapshot',()=>{let s=initialWorkcell();s=stepWorkcell(s,'press-reset-count');expect(s.plcInputs.ResetCount).toBe(true);s=stepWorkcell(s,'release-reset-count');expect(s.plcInputs.ResetCount).toBe(false);s=stepWorkcell(s,'press-reset-timer');expect(s.plcInputs.ResetTimer).toBe(true);const before={...s,process:{...s.process,photoeye:true,exitSensor:true,motorFeedback:true},starter:{...s.starter,feedback:true}};const next=stepWorkcell(before,'tick');expect(next.plcInputs.Photoeye).toBe(true);expect(next.plcInputs.ExitSensor).toBe(true);expect(next.plcInputs.MotorFeedback).toBe(true);expect(next.plcInputs.K1Feedback).toBe(true)});
 it('integrated conveyor reference ladder uses sampled photoeye to count physical products',()=>{const program=lesson('conveyor-batch');let s=initialWorkcell();for(const action of ['isolate-power','connect-sensor',{kind:'wire-sensor',target:'I0.2'},'restore-power','press-start','release-start'] as const)s=stepWorkcell(s,action,100,program,undefined);expect(s.motor).toBe(true);for(let i=0;i<3;i++){s=stepWorkcell(s,{kind:'spawn-product',reject:false},100,program);for(let tick=0;tick<12;tick++)s=stepWorkcell(s,'tick',100,program)}for(let tick=0;tick<35;tick++)s=stepWorkcell(s,'tick',100,program);expect(s.ladderMemory['batch-count'].count).toBe(3);expect(s.plcOutputs.BatchDone).toBe(true)});
 it('TP/CTD instruction state appears in scan evidence and CSV export',()=>{
  const tp=step(switchInput(createLogicBench(lesson('tp')),'Enable',true));
  expect(tp.history[0].steps[0].elapsedMs).toBe(20);
  expect(logicBenchCsv(tp)).toContain('pulse:elapsed_ms');
  const ctd=step(switchInput(createLogicBench(lesson('ctd')),'LoadCount',true));
  expect(ctd.history[0].steps[0].count).toBe(3);
  expect(logicBenchCsv(ctd)).toContain('down-counter:count');
 });
 it('advanced instruction programs remain portable in offline project JSON',()=>{const doc=lesson('conveyor-batch');const content=serializeProject({format:'plc-skills-lab-project',schemaVersion:1,name:'Batch training',program:doc,board:newBoard(),boardMode:false});const loaded=parseProject(content);expect(loaded.program).toEqual(doc);expect(content.includes('BatchDone')).toBe(true);expect(content.includes('timeMs')).toBe(false)});
 it('physical power and guard interlocks still override arbitrary ladder output commands',()=>{const p:LadderDocument={id:'unsafe-lesson',version:'1',rungs:[{id:'r1',elements:[{type:'contact',tag:'Start',normallyClosed:true}],coil:'RunLatch'}]};let s=stepWorkcell(initialWorkcell(),'open-guard',20,p);expect(s.plcOutputs.RunLatch).toBe(true);expect(s.motor).toBe(false);s=stepWorkcell(s,'isolate-power',20,p);expect(s.motor).toBe(false)});
});
