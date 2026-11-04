import {describe,it,expect} from 'vitest';
import {captureWorkcellWatch,watchTimeline,watchTimelineCsv,watchValue,WATCH_CHANGE_LIMIT} from '../src/engineering/workcell-watch';
import {initialWorkcell,stepWorkcell,workcellLadder} from '../src/engineering/workcell';
import {INSTRUCTION_EXERCISES} from '../src/engineering/instruction-lab';
import type {LadderDocument} from '../src/engineering/ladder';
const lesson=(id:string)=>INSTRUCTION_EXERCISES.find(x=>x.id===id)!.program;
const scan=(actions:readonly ('tick'|'press-start'|'release-start'|'open-guard'|'close-guard')[])=>actions.reduce((s,a)=>stepWorkcell(s,a),initialWorkcell());
describe('integrated typed workcell watch evidence',()=>{
 it('keeps sampled K1 feedback separate from post-scan K1 and actual motor feedback',()=>{
  const s=scan(['press-start']);
  const frame=captureWorkcellWatch(s,workcellLadder);
  expect(frame.scan).toBe(1);
  expect(frame.rows.find(r=>r.id==='IN:K1Feedback')?.group).toBe('sampled-input');
  expect(frame.rows.find(r=>r.id==='OUT:K1Feedback')?.group).toBe('post-scan-feedback');
  expect(frame.rows.find(r=>r.id==='PLANT:K1AuxAfterScan')?.phase).toMatch(/Plant state/);
  expect(frame.rows.find(r=>r.id==='IN:PowerOK')).toMatchObject({type:'BOOL',address:'I0.0',value:true});
  expect(frame.rows.find(r=>r.id==='OUT:RunLatch')?.address).toBe('Q0.0');
 });
 it('does not invent PLC sampled inputs or output values before scan zero',()=>{
  const rows=captureWorkcellWatch(initialWorkcell(),workcellLadder).rows;
  expect(rows.some(r=>r.group==='sampled-input'||r.group==='plc-coil'||r.group==='instruction-memory')).toBe(false);
  expect(rows.find(r=>r.id==='PLANT:SupplyAvailable')?.value).toBe(true);
 });
 it('reports actual retentive timer, counter, and pulse data from executed machine scans',()=>{
  const program:LadderDocument={id:'typed-memory',version:'1',rungs:[
   {id:'timer',coil:'TimerDone',elements:[{type:'contact',tag:'Start'}],operation:{kind:'tp',presetMs:60}},
   {id:'counter',coil:'ZeroReached',elements:[{type:'contact',tag:'Start'}],operation:{kind:'ctd',preset:3,loadTag:'Stop'}}
  ]};
  const s=stepWorkcell(initialWorkcell(),'press-start',20,program);
  const rows=captureWorkcellWatch(s,program).rows;
  expect(rows.find(r=>r.id==='MEM:timer:elapsed')).toMatchObject({type:'TIME',value:20,unit:'ms'});
  expect(rows.find(r=>r.id==='MEM:counter:count')).toMatchObject({type:'DINT',value:0});
  expect(rows.find(r=>r.id==='OUT:TimerDone')).toMatchObject({type:'BOOL',value:true});
  expect(rows.find(r=>r.id==='MEM:counter:done')?.value).toBe(true);
 });
 it('keeps sampled photoeye distinct from the post-process photoeye after a scan',()=>{
  let s=initialWorkcell();
  s=stepWorkcell(s,{kind:'spawn-product',reject:false});
  const frame=captureWorkcellWatch(s,workcellLadder);
  expect(frame.rows.some(r=>r.id==='IN:Photoeye')).toBe(true);
  expect(frame.rows.some(r=>r.id==='PLANT:PhotoeyeAfterScan')).toBe(true);
  expect(frame.rows.find(r=>r.id==='IN:Photoeye')?.phase).toMatch(/Beginning-of-scan/);
 });
 it('tracks BOOL transitions and numeric changes without mutating source snapshots',()=>{
  let s=initialWorkcell();const list=[];
  for(const action of ['isolate-power','restore-power','open-guard','close-guard'] as const){s=stepWorkcell(s,action);list.push(s);}
  const before=JSON.stringify(list);
  const timeline=watchTimeline(list,workcellLadder);
  expect(timeline.firstScan).toBe(1);expect(timeline.lastScan).toBe(4);
  expect(timeline.changes.some(e=>e.id==='PLANT:SupplyAvailable'&&e.direction==='rising')).toBe(true);
  expect(timeline.changes.some(e=>e.id==='IN:GuardClosed'&&e.direction==='falling')).toBe(true);
  expect(JSON.stringify(list)).toBe(before);
 });
 it('does not fabricate transitions at the start of a truncated or imported timeline',()=>{
  let s=initialWorkcell();const list=[];
  for(let i=0;i<205;i++){s=stepWorkcell(s,i%2===0?'open-guard':'close-guard');list.push(s);}
  const timeline=watchTimeline(list,workcellLadder);
  expect(timeline.firstScan).toBe(6);
  expect(timeline.truncated).toBe(true);
  expect(timeline.changes.every(e=>e.scan>6)).toBe(true);
  expect(timeline.changes.length).toBeLessThanOrEqual(WATCH_CHANGE_LIMIT);
  expect(watchTimeline(list.slice(-50),workcellLadder).firstScan).toBe(156);
 });
 it('rejects nonmonotonic scans and corrupt time order instead of exporting misleading evidence',()=>{
  const a=stepWorkcell(initialWorkcell(),'tick');
  expect(()=>watchTimeline([a,a],workcellLadder)).toThrow(/increasing/);
  expect(()=>watchTimeline([a,{...a,scan:2,timeMs:0}],workcellLadder)).toThrow(/increasing/);
 });
 it('flags modeled command/output discrepancies without claiming proven physical faults',()=>{
  const base=stepWorkcell(initialWorkcell(),'tick');
  const hazardous={...base,motor:true,runLatch:false};
  const warning=captureWorkcellWatch(hazardous,workcellLadder).diagnostics;
  expect(warning.some(x=>x.kind==='warning'&&x.message.includes('Motor running without'))).toBe(true);
  const stalled={...base,motor:false,runLatch:true};
  expect(captureWorkcellWatch(stalled,workcellLadder).diagnostics.some(x=>x.message.includes('motor is stopped'))).toBe(true);
 });
 it('exports bounded CSV with correctly typed values and stable CRLF escaping',()=>{
  const s1=stepWorkcell(initialWorkcell(),'isolate-power'),s2=stepWorkcell(s1,'restore-power');
  const snapshot=watchTimeline([s1,s2],workcellLadder);
  const csv=watchTimelineCsv(snapshot);
  expect(csv).toContain('"scan","simulated_ms","group"');
  expect(csv).toContain('"SupplyAvailable"');
  expect(csv).toContain('"FALSE","TRUE"');
  expect(csv).toContain('\r\n');
  expect(watchValue(12.345678,'REAL','%')).toBe('12.346 %');
  expect(watchValue(40,'TIME','ms')).toBe('40 ms');
  expect(watchTimelineCsv(watchTimeline([],workcellLadder)).split('\r\n')).toHaveLength(2);
 });
 it('replaying identical action traces produces identical watch frames and event evidence',()=>{
  const make=()=>{let s=initialWorkcell();const states=[];for(const a of ['isolate-power','restore-power','open-guard','close-guard'] as const){s=stepWorkcell(s,a);states.push(s);}return {frame:captureWorkcellWatch(s,workcellLadder),timeline:watchTimeline(states,workcellLadder)};};
  expect(make()).toEqual(make());
  expect(lesson('tp').rungs[0].operation?.kind).toBe('tp');
 });
});
