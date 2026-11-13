import {describe,it,expect} from 'vitest';
import {p19ReferenceProject} from './fixtures/p19-power-programs';
import {p19PowerPreflight,runP19PowerCampaign} from '../src/plant/scenes/matrix-p19';
import {beltConveyor} from '../src/plant/equipment/transport';
import {ctxOf,initial} from '../src/plant/world/equipment';
import {freshWorld} from '../src/plant/world/bodies';
import {vec} from '../src/plant/world/math';

const ctx=ctxOf({id:'belt',kind:'belt-conveyor',originMm:vec(0,0,0),
 yawDeg:0,params:{restartHoldMode:1,jamResetMode:1}});
describe('P19 controller power-loss and drive-power restart prevention',()=>{
 it('PLC 24V loss latches a motor OFF and requires observed restored LOW before new Q reset rising edge',()=>{
  const world=freshWorld();let state=initial({});
  const step=(controllerPowered:boolean,resetRestart:boolean,fault:string|null=null)=>{
   const next=beltConveyor.step(state,world,{
    run:true,controllerPowered,resetRestart,
   },10,fault,ctx);
   state=next.state;
   return next;
  };
  step(true,false);
  expect(state.engaged).toBe(true);
  step(false,false);
  expect(state.engaged).toBe(false);
  expect(state.restartPending).toBe(true);
  expect(state.speedMmS).toBe(0);
  expect(beltConveyor.read(state,world,ctx).restartRequired).toBe(true);
  // Unsafely stuck high reset on the FIRST scan after restoration
  // cannot clear the latch: there was no powered/low scan to arm it.
  step(true,true);
  expect(state.restartPending).toBe(true);
  step(true,true);
  expect(state.engaged).toBe(false);
  step(true,false);
  expect(state.restartArmed).toBe(true);
  step(true,true);
  expect(state.restartPending).toBe(false);
  expect(state.engaged).toBe(true);
  expect(state.speedMmS).toBeGreaterThan(0);
 });
 it('drive power interruption latches even with healthy PLC; reset while drive dead cannot bypass it',()=>{
  let s=initial({});const world=freshWorld();
  const step=(fault:string|null,resetRestart:boolean)=>{
   const r=beltConveyor.step(s,world,{run:true,controllerPowered:true,
    resetRestart},10,fault,ctx);
   s=r.state;return r;
  };
  step(null,false);expect(s.engaged).toBe(true);
  step('motor-dead',true);expect(s.restartPending).toBe(true);
  expect(s.engaged).toBe(false);
  step('motor-dead',false);step('motor-dead',true);
  expect(s.restartPending).toBe(true);
  step(null,true);expect(s.restartPending).toBe(true);
  step(null,false);expect(s.restartArmed).toBe(true);
  step(null,true);expect(s.restartPending).toBe(false);
  expect(s.engaged).toBe(true);
 });
 it('an unresolved actual belt jam cannot be cleared by restart reset even when power recovered',()=>{
  const world=freshWorld();let s=initial({});
  for(const [fault,resetRestart] of [
   [null,false],['belt-jammed',false],['belt-jammed',true],
   [null,false],[null,true],
  ] as const){
   const r=beltConveyor.step(s,world,{run:true,
    controllerPowered:true,resetRestart},10,fault,ctx);
   s=r.state;
  }
  expect(s.stalled).toBe(true);
  expect(s.engaged).toBe(false);
  expect(s.speedMmS).toBe(0);
 });
 it('legacy default controller behavior remains unchanged with no restartHoldMode setting',()=>{
  const legacy=ctxOf({id:'belt',kind:'belt-conveyor',
   originMm:vec(0,0,0),yawDeg:0,params:{}});
  const world=freshWorld();
  let s=beltConveyor.step(initial({}),world,{run:true,controllerPowered:true},10,null,legacy).state;
  s=beltConveyor.step(s,world,{run:true,controllerPowered:false},10,null,legacy).state;
  expect(s.restartPending).toBe(false);
  s=beltConveyor.step(s,world,{run:true,controllerPowered:true},10,null,legacy).state;
  expect(s.restartPending).toBe(false);
  expect(s.engaged).toBe(true);
 });
 it('six independent original physical batches survive both real supply breaks and motor power loss plus exact replay',()=>{
  const p=p19ReferenceProject(),original=JSON.stringify(p);
  expect(p19PowerPreflight(p,'bottle-line')).toEqual([]);
  const result=runP19PowerCampaign(p,'bottle-line');
  expect(result.status,JSON.stringify(result,null,2)).toBe('passed');
  expect(result.episodes).toHaveLength(7);
  expect(result.episodes.map(e=>e.kind)).toEqual([
   'plc-supply','drive-power','plc-supply','drive-power',
   'plc-supply','drive-power','plc-supply']);
  expect(result.episodes.map(e=>e.faultAtProduct)).toEqual([1,1,2,2,3,3,2]);
  expect(result.deterministicReplay).toBe(true);
  expect(result.totalOriginalProducts).toBe(18);
  expect(result.completedOriginalProducts).toBe(18);
  expect(result.allRestartGates).toBe(true);
  for(const e of result.episodes){
   expect(e.status).toBe('passed');
   expect(e.produced).toBe(3);
   expect(e.completed).toBe(3);
   expect(e.targetBodyId).toBe('b'+e.faultAtProduct);
   expect(e.lostPowerVerified).toBe(true);
   expect(e.motionStopped).toBe(true);
   expect(e.powerRestored).toBe(true);
   expect(e.restartLatched).toBe(true);
   expect(e.resetCoilObserved).toBe(true);
   expect(e.resumedSameBody).toBe(true);
   expect(e.cases.every(c=>c.pass)).toBe(true);
   expect(e.trace.map(t=>t.bodyId)).toEqual(['b1','b2','b3']);
   expect(e.trace.every(t=>t.qualityPassed&&t.capped&&
    t.filledMl!==null&&t.filledMl>=500)).toBe(true);
  }
  expect(JSON.stringify(p)).toBe(original);
  expect(original).not.toContain('p19-start');
 },120000);
 it.each(['no-reset','held-reset','wrong-start'] as const)(
  'incorrect %s controller cannot pass genuine power restore and product campaign',
  kind=>{
   const result=runP19PowerCampaign(p19ReferenceProject(kind),'bottle-line');
   expect(result.status).toBe('failed');
   expect(result.episodes.some(e=>!e.passed)).toBe(true);
  },120000);
 it('isolated run fails closed if exact physical reset/feedback or unique supply path is missing',()=>{
  const p=p19ReferenceProject();
  const invalid=[
   {...p,wires:p.wires.filter(w=>w.from!=='belt.OUT_restartRequired')},
   {...p,wires:p.wires.filter(w=>w.from!=='scene-plc.Q0.5')},
   {...p,wires:p.wires.filter(w=>w.to!=='scene-plc.L+')},
   {...p,wires:[...p.wires,{id:'second-plc-supply',
     from:'scene-supply.P24',to:'scene-plc.L+'}]},
   {...p,params:{...p.params,belt:{...p.params?.belt,restartHoldMode:0}}},
   {...p,components:[...p.components,{id:'p19-start',kind:'start' as const,
     x:100,y:100,pressed:false}]},
  ];
  for(const candidate of invalid){
   const result=runP19PowerCampaign(candidate,'bottle-line');
   expect(result.status).toBe('blocked');
   expect(result.episodes).toHaveLength(0);
  }
  expect(runP19PowerCampaign(p,'robot-sort').status).toBe('blocked');
 });
});
