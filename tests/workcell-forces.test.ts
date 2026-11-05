import {describe,it,expect} from 'vitest';
import {FORCEABLE_WORKCELL_INPUTS,initialWorkcell,stepWorkcell,workcellLadder,type WorkcellAction} from '../src/engineering/workcell';
import {captureWorkcellWatch,watchTimeline} from '../src/engineering/workcell-watch';
import {newBoard} from '../src/engineering/wiring-board';
import {makeSession,parseSession,replaySession,sessionFingerprint} from '../src/engineering/workcell-session';

const run=(actions:readonly WorkcellAction[])=>actions.reduce((s,a)=>stepWorkcell(s,a),initialWorkcell());
const set=(tag:'Start'|'SensorOK'|'Photoeye'|'ExitSensor',value:boolean|null):WorkcellAction=>({kind:'force-input',tag,value});
describe('bounded simulation-only PLC input force table',()=>{
 it('supports only the declared nonsafety input image tags',()=>{
  expect(FORCEABLE_WORKCELL_INPUTS).toEqual(['Start','SensorOK','Photoeye','ExitSensor']);
  for(const tag of ['PowerOK','GuardClosed','Stop','ResetCount','K1Feedback','MotorContactor']){
   expect(()=>stepWorkcell(initialWorkcell(),{kind:'force-input',tag,value:true} as WorkcellAction)).toThrow(/Unsupported simulated input force/);
  }
  expect(()=>stepWorkcell(initialWorkcell(),{kind:'force-input',tag:'Start',value:1} as unknown as WorkcellAction)).toThrow();
 });
 it('requires isolated simulated power before adding or removing an override',()=>{
  const initial=initialWorkcell();
  const rejected=stepWorkcell(initial,set('SensorOK',true));
  expect(rejected.inputForces).toEqual({});
  expect(rejected.events.join(' ')).toMatch(/REJECTED input force/);
  expect(initial.inputForces).toEqual({});
  const active=run(['isolate-power',set('SensorOK',true),'restore-power']);
  expect(active.inputForces.SensorOK).toBe(true);
  const clearRejected=stepWorkcell(active,set('SensorOK',null));
  expect(clearRejected.inputForces.SensorOK).toBe(true);
  expect(clearRejected.events.join(' ')).toContain('REJECTED input force');
 });
 it('keeps actual electrical input and forced PLC image separate across scans',()=>{
  const steps:WorkcellAction[]=['isolate-power',set('SensorOK',true),'restore-power','tick'];
  const s=run(steps);
  expect(s.inputForces).toEqual({SensorOK:true});
  expect(s.rawPlcInputs.SensorOK).toBe(false);
  expect(s.plcInputs.SensorOK).toBe(true);
  const frame=captureWorkcellWatch(s,workcellLadder);
  expect(frame.rows.find(row=>row.id==='IN:SensorOK')).toMatchObject({value:true,forced:true});
  expect(frame.rows.find(row=>row.id==='RAW:SensorOK')).toMatchObject({value:false,group:'unforced-input'});
  expect(frame.diagnostics.map(x=>x.message).join(' ')).toMatch(/Active teaching force/);
 });
 it('never forces physical power, guard, or stop protection in the simulated starter',()=>{
  let s=run(['isolate-power',set('SensorOK',true),set('Start',true),'restore-power']);
  expect(s.plcInputs.Start).toBe(true);
  expect(s.rawPlcInputs.Start).toBe(false);
  expect(s.motor).toBe(true);
  s=stepWorkcell(s,'open-guard');
  expect(s.motor).toBe(false);
  expect(s.starter.motorPowered).toBe(false);
  s=stepWorkcell(s,'close-guard');
  expect(s.motor).toBe(true);
  s=stepWorkcell(s,'press-stop');
  expect(s.motor).toBe(false);
  s=stepWorkcell(s,'isolate-power');
  expect(s.motor).toBe(false);
  expect(s.inputForces.Start).toBe(true);
 });
 it('clear force restores real sampled sensor and removes forced status without editing wiring',()=>{
  let s=run(['isolate-power',set('SensorOK',true),set('Start',true),'restore-power','isolate-power']);
  s=stepWorkcell(s,set('SensorOK',null));
  expect(s.inputForces.SensorOK).toBeUndefined();
  expect(s.rawPlcInputs.SensorOK).toBe(false);
  expect(s.plcInputs.SensorOK).toBe(false);
  expect(captureWorkcellWatch(s,workcellLadder).rows.some(row=>row.id==='RAW:SensorOK')).toBe(false);
  expect(s.inputForces.Start).toBe(true);
 });
 it('replays forced scans deterministically with full exported action evidence',()=>{
  const actions:WorkcellAction[]=['isolate-power',set('SensorOK',true),set('Start',true),'restore-power','tick','open-guard'];
  const session=makeSession('Input force training',workcellLadder,newBoard(),false,actions);
  const parsed=parseSession(JSON.stringify(session));
  expect(parsed.session.actions).toEqual(actions);
  expect(parsed.final.inputForces).toEqual({SensorOK:true,Start:true});
  expect(parsed.final.rawPlcInputs.SensorOK).toBe(false);
  expect(parsed.final.motor).toBe(false);
  expect(sessionFingerprint(parsed.final)).toBe(session.fingerprint);
  expect(parsed.final).toEqual(replaySession(workcellLadder,newBoard(),false,actions));
  expect(parsed.session.checkpoints?.at(-1)?.fingerprint).toBe(session.fingerprint);
 });
 it('rejects malformed, unsafe and modified imported force actions',()=>{
  const actions:WorkcellAction[]=['isolate-power',set('SensorOK',true),'restore-power'];
  const session=makeSession('Example',workcellLadder,newBoard(),false,actions);
  for(const invalid of [
   {kind:'force-input',tag:'GuardClosed',value:true},
   {kind:'force-input',tag:'SensorOK',value:'true'},
   {kind:'force-input',tag:'SensorOK',value:true,extra:'untrusted'},
   {kind:'force-input',tag:'SensorOK'}
  ])expect(()=>parseSession(JSON.stringify({...session,actions:[...actions.slice(0,1),invalid,...actions.slice(2)]}))).toThrow(/action/);
  expect(()=>parseSession(JSON.stringify({...session,actions:['isolate-power',set('SensorOK',false),'restore-power']}))).toThrow(/mismatch/);
 });
 it('preserves unforced legacy replay fingerprints and does not add force fields to them',()=>{
  const actions=['tick','isolate-power','restore-power'] as const;
  const session=makeSession('Legacy',workcellLadder,newBoard(),false,actions);
  const loaded=parseSession(JSON.stringify(session));
  expect(loaded.final.inputForces).toEqual({});
  expect(sessionFingerprint(loaded.final)).toBe(session.fingerprint);
  expect(loaded.session.actions).toEqual([...actions]);
 });
 it('uses actual transitions and never invents changes for the first retained scan',()=>{
  let s=initialWorkcell();
  const snapshots=[];
  for(const action of ['isolate-power',set('SensorOK',true),'restore-power','isolate-power',set('SensorOK',null)] as WorkcellAction[]){
   s=stepWorkcell(s,action);snapshots.push(s);
  }
  const timeline=watchTimeline(snapshots,workcellLadder);
  expect(timeline.changes.some(x=>x.id==='IN:SensorOK'&&x.direction==='rising')).toBe(true);
  expect(timeline.changes.some(x=>x.id==='IN:SensorOK'&&x.direction==='falling')).toBe(true);
  expect(timeline.changes.every(x=>x.scan>1)).toBe(true);
  expect(snapshots[0].inputForces).toEqual({});
 });
});
