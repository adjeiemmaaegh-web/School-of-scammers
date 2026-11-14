import {describe,it,expect} from 'vitest';
import {freshWorld,spawnBody,conserved} from '../src/plant/world/bodies';
import {freshRuntime,stepScene,validatePlacements} from '../src/plant/world/runner';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import {stopper} from '../src/plant/equipment/actuators';
import {vec} from '../src/plant/world/math';
import type {EquipmentPlacement} from '../src/plant/world/types';
import {p24ReferenceProject} from './fixtures/p24-outfeed-hold-programs';
import {p24HoldPreflight,runP24HoldCampaign} from '../src/plant/scenes/matrix-p24';

const lane=(mode=1):EquipmentPlacement[]=>[
 {id:'receiver',kind:'belt-conveyor',originMm:vec(600,0,0),yawDeg:0,
  params:{lengthMm:600,widthMm:150,speedMmS:250,zoneSensorMode:1,zoneCapacity:1}},
 {id:'outstop',kind:'stopper',originMm:vec(800,0,0),yawDeg:0,
  params:{travelMs:100,holdSensorMode:mode,holdDwellMs:200}},
];
const original=()=>spawnBody(freshWorld(),'feeder',{
 size:vec(160,128,96),massKg:8,pos:vec(600,0,120),
 supportedBy:'receiver',tags:{origin:'feeder',material:'cardboard'}});
describe('P24 genuine worker-owned sustained physical stopper-contact detection',()=>{
 it('does not report a held load in legacy mode, despite genuine original b1 being blocked',()=>{
  const a=lane(0);
  let r=freshRuntime(original(),a,PLANT_EQUIPMENT);
  let jammed=false;
  for(let k=0;k<75;k++){
   r=stepScene(r,a,PLANT_EQUIPMENT,{receiver:{run:true},outstop:{extend:true}});
   jammed ||= r.world.bodies[0]?.tags.jammedByGate==='outstop';
  }
  expect(jammed).toBe(true);
  expect(r.signals.outstop.heldLoad).toBe(false);
  expect(r.signals.outstop.heldDwellMs).toBe(0);
  expect(conserved(r.world)).toBe(true);
 });
 it('reports heldLoad only after 200ms same original jam body on real powered receiver',()=>{
  const a=lane();
  let r=freshRuntime(original(),a,PLANT_EQUIPMENT);
  let contactAt=-1,triggerAt=-1;
  for(let k=0;k<75;k++){
   r=stepScene(r,a,PLANT_EQUIPMENT,{receiver:{run:true},outstop:{extend:true}});
   if(contactAt<0&&r.world.bodies[0]?.tags.jammedByGate==='outstop')
    contactAt=r.world.timeMs;
   if(triggerAt<0&&r.signals.outstop.heldLoad===true)
    triggerAt=r.world.timeMs;
  }
  expect(contactAt).toBeGreaterThan(0);
  expect(triggerAt-contactAt).toBeGreaterThanOrEqual(150);
  expect(r.signals.outstop.heldLoad).toBe(true);
  expect(r.signals.outstop.heldDwellMs).toBe(200);
  expect(r.signals.receiver.zoneFull).toBe(true);
  expect(r.world.bodies[0]?.supportedBy).toBe('receiver');
  const lockedX=r.world.bodies[0].pos.x;
  for(let k=0;k<10;k++)
   r=stepScene(r,a,PLANT_EQUIPMENT,{receiver:{run:true},outstop:{extend:true}});
  expect(Math.abs(r.world.bodies[0].pos.x-lockedX)).toBeLessThan(1);
  expect(r.signals.receiver.moving).toBe(true);
  for(let k=0;k<12;k++)
   r=stepScene(r,a,PLANT_EQUIPMENT,{receiver:{run:true},outstop:{extend:false}});
  expect(r.signals.outstop.retracted).toBe(true);
  expect(r.signals.outstop.heldLoad).toBe(false);
  expect(r.world.bodies[0].pos.x).toBeGreaterThan(lockedX+10);
  expect(r.world.bodies.map(b=>b.id)).toEqual(['b1']);
  expect(conserved(r.world)).toBe(true);
 });
 it('rejects a remote stale jam tag: body must be physically near this exact gate',()=>{
  const ctx={id:'outstop',originMm:vec(800,0,0),yawDeg:0 as const,
   params:{travelMs:100,holdSensorMode:1,holdDwellMs:200}};
  const w=spawnBody(freshWorld(),'feeder',{
   size:vec(160,128,96),massKg:8,pos:vec(0,0,120),
   supportedBy:'receiver',tags:{jammed:true,jammedByGate:'outstop'}});
  let state=stopper.fresh(ctx.params);
  for(let k=0;k<100;k++)state=stopper.step(state,w,{extend:true},10,null,ctx).state;
  expect(stopper.read(state,w,ctx).heldLoad).toBe(false);
  expect(stopper.read(state,w,ctx).heldDwellMs).toBe(0);
 });
 it('resets dwell when physical contact disappears or original body ID changes',()=>{
  const ctx={id:'outstop',originMm:vec(800,0,0),yawDeg:0 as const,
   params:{travelMs:100,holdSensorMode:1,holdDwellMs:200}};
  const a=spawnBody(freshWorld(),'feeder',{
   size:vec(160,128,96),massKg:8,pos:vec(780,0,120),
   supportedBy:'receiver',tags:{jammed:true,jammedByGate:'outstop'}});
  const b={...a,bodies:a.bodies.map(body=>({...body,id:'b2'}))};
  const clear={...a,bodies:a.bodies.map(body=>({...body,tags:{}}))};
  let state=stopper.fresh(ctx.params);
  for(let k=0;k<15;k++)state=stopper.step(state,a,{extend:true},10,null,ctx).state;
  expect(stopper.read(state,a,ctx).heldLoad).toBe(false);
  state=stopper.step(state,b,{extend:true},10,null,ctx).state;
  expect(state.heldContactBodyId).toBe('b2');
  expect(state.heldContactMs).toBe(10);
  state=stopper.step(state,clear,{extend:true},10,null,ctx).state;
  expect(stopper.read(state,clear,ctx).heldDwellMs).toBe(0);
  expect(state.heldContactBodyId).toBeNull();
 });
 it('enforces bounded opt-in dwell settings with inherited stopper unchanged',()=>{
  for(const bad of [0,99,201,4001]){
   const wrong=lane().map(p=>p.id==='outstop'?{
    ...p,params:{...p.params,holdDwellMs:bad}}:p);
   expect(()=>validatePlacements(wrong,PLANT_EQUIPMENT)).toThrow();
  }
  expect(stopper.read(stopper.fresh({}),freshWorld(),{
   id:'outstop',originMm:vec(0,0,0),yawDeg:0,params:{}}).heldLoad).toBe(false);
 });
});
describe('P24 live electrically driven two-belt original-carton hold/release training',()=>{
 it('accepts real three-seed original b2 contact/dwell, premature-request refusal, PLC release and replay',()=>{
  const p=p24ReferenceProject();
  const before=JSON.stringify(p);
  expect(p24HoldPreflight(p,'gate-accumulation')).toEqual([]);
  const result=runP24HoldCampaign(p,'gate-accumulation');
  expect(result.status,JSON.stringify(result,null,2)).toBe('passed');
  expect(result.lots.map(l=>l.seed)).toEqual([1,42,65535,42]);
  expect(result.totalOriginals).toBe(9);
  expect(result.deterministicReplay).toBe(true);
  for(const lot of result.lots){
   expect(lot.pass,JSON.stringify(lot,null,2)).toBe(true);
   expect(lot.stopExtended).toBe(true);
   expect(lot.prematureReleaseBlocked).toBe(true);
   expect(lot.genuineOutfeedContact).toBe(true);
   expect(lot.stopContactDwellMs).toBe(200);
   expect(lot.plcHeldLoad).toBe(true);
   expect(lot.heldCartonStationary).toBe(true);
   expect(lot.downstreamInhibited).toBe(true);
   expect(lot.poweredRelease).toBe(true);
   expect(lot.stopRetracted).toBe(true);
   expect(lot.physicalOutfeedClear).toBe(true);
   expect(lot.thirdFedAfterRestart).toBe(true);
   expect(lot.originalIds).toEqual(['b1','b2','b3']);
   expect(lot.cases.every(c=>c.pass)).toBe(true);
  }
  expect(JSON.stringify(p)).toBe(before);
  expect(before).not.toContain('p24-release');
 },120000);
 it.each(['premature-release','no-dwell','no-stop','never-release',
  'unsafe-third','never-third','no-reset'] as const)(
  'rejects incorrect original-machine PLC sequence: %s',kind=>{
   const r=runP24HoldCampaign(p24ReferenceProject(kind),'gate-accumulation');
   expect(r.status,JSON.stringify(r,null,2)).toBe('failed');
   expect(r.lots.some(l=>!l.pass)).toBe(true);
   if(kind==='premature-release'||kind==='no-dwell')
    expect(r.lots.some(l=>l.cases.some(c=>
     c.id==='early-release-held-until-real-contact'&&!c.pass))).toBe(true);
   if(kind==='no-stop')
    expect(r.lots.some(l=>l.cases.some(c=>
     c.id==='200ms-original-outstop-contact'&&!c.pass))).toBe(true);
   if(kind==='unsafe-third')
    expect(r.lots.some(l=>l.cases.some(c=>
     c.id==='held-receiver-inhibits-new-feed'&&!c.pass))).toBe(true);
  },120000);
 it('preflight rejects forged real stopper channels, wrong mode/location/dwell and private operator collision',()=>{
  const p=p24ReferenceProject();
  const edits=[
   {...p,wires:p.wires.filter(w=>w.from!=='outstop.OUT_heldLoad')},
   {...p,wires:p.wires.filter(w=>w.from!=='scene-plc.Q0.6')},
   {...p,wires:p.wires.filter(w=>w.from!=='outstop.OUT_retracted')},
   {...p,params:{...p.params,outstop:{...p.params?.outstop,holdSensorMode:0}}},
   {...p,params:{...p.params,outstop:{...p.params?.outstop,holdDwellMs:250}}},
   {...p,components:p.components.map(c=>c.id==='outstop'?{...c,x:537}:c)},
   {...p,components:[...p.components,{id:'p24-release',kind:'start' as const,x:1,y:1,pressed:false}]},
  ];
  for(const wrong of edits){
   expect(p24HoldPreflight(wrong,'gate-accumulation').length).toBeGreaterThan(0);
   const result=runP24HoldCampaign(wrong,'gate-accumulation');
   expect(result.status,result.diagnostic).toBe('blocked');
   expect(result.lots).toEqual([]);
  }
  expect(runP24HoldCampaign(p,'bottle-line').status).toBe('blocked');
 },120000);
});
