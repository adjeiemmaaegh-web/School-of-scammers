import {describe,it,expect} from 'vitest';
import {freshWorld,spawnBody,conserved} from '../src/plant/world/bodies';
import {freshRuntime,stepScene} from '../src/plant/world/runner';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import {vec} from '../src/plant/world/math';
import type {EquipmentPlacement} from '../src/plant/world/types';
import {p25ReferenceProject} from './fixtures/p25-fault-retry-programs';
import {p25FaultRetryPreflight,runP25FaultRetryCampaign} from '../src/plant/scenes/matrix-p25';

const stations:EquipmentPlacement[]=[
 {id:'receiver',kind:'belt-conveyor',originMm:vec(600,0,0),yawDeg:0,
  params:{lengthMm:600,widthMm:150,speedMmS:250,zoneSensorMode:1,zoneCapacity:1}},
 {id:'outstop',kind:'stopper',originMm:vec(800,0,0),yawDeg:0,
  params:{travelMs:100,holdSensorMode:1,holdDwellMs:200}},
];
const original=()=>spawnBody(freshWorld(),'feeder',{
 size:vec(160,128,96),massKg:8,pos:vec(600,0,120),
 supportedBy:'receiver',tags:{origin:'feeder',material:'cardboard'}});
const commands=(extend:boolean)=>({receiver:{run:true},outstop:{extend}});
describe('P25 real worker-owned outstop fault is mechanically authentic',()=>{
 it('registered stuck-extended fault physically prevents release despite command off and preserves same carton',()=>{
  let r=freshRuntime(original(),stations,PLANT_EQUIPMENT);
  for(let k=0;k<80;k++)r=stepScene(r,stations,PLANT_EQUIPMENT,commands(true));
  expect(r.signals.outstop.heldLoad).toBe(true);
  const x=r.world.bodies[0].pos.x;
  for(let k=0;k<30;k++)r=stepScene(r,stations,PLANT_EQUIPMENT,
   commands(false),{outstop:'stuck-extended'});
  expect(r.world.model.outstop?.faulted).toBe(true);
  expect(r.signals.outstop.extended).toBe(true);
  expect(r.signals.outstop.retracted).toBe(false);
  expect(r.signals.outstop.heldLoad).toBe(true);
  expect(r.world.bodies[0]?.pos.x).toBe(x);
  expect(r.world.bodies[0]?.supportedBy).toBe('receiver');
  expect(r.world.bodies.map(b=>b.id)).toEqual(['b1']);
  expect(r.world.spawnedCount).toBe(1);
  expect(r.world.despawnedCount).toBe(0);
  expect(conserved(r.world)).toBe(true);
 });
 it('repair alone cannot open the gate while PLC keeps the extend output physically energised',()=>{
  let r=freshRuntime(original(),stations,PLANT_EQUIPMENT);
  for(let k=0;k<80;k++)r=stepScene(r,stations,PLANT_EQUIPMENT,commands(true));
  const locked=r.world.bodies[0].pos.x;
  for(let k=0;k<20;k++)r=stepScene(r,stations,PLANT_EQUIPMENT,
   commands(false),{outstop:'stuck-extended'});
  for(let k=0;k<20;k++)r=stepScene(r,stations,PLANT_EQUIPMENT,commands(true));
  expect(r.world.model.outstop?.faulted).toBe(false);
  expect(r.signals.outstop.extended).toBe(true);
  expect(r.world.bodies[0].pos.x).toBe(locked);
  for(let k=0;k<18;k++)r=stepScene(r,stations,PLANT_EQUIPMENT,commands(false));
  expect(r.signals.outstop.retracted).toBe(true);
  expect(r.signals.outstop.heldLoad).toBe(false);
  expect(r.world.bodies[0].pos.x).toBeGreaterThan(locked+10);
  expect(conserved(r.world)).toBe(true);
 });
 it('faulted equipment remains separate from a fabricated PLC fault bit and creates no replacement',()=>{
  let r=freshRuntime(original(),stations,PLANT_EQUIPMENT);
  for(let k=0;k<80;k++)r=stepScene(r,stations,PLANT_EQUIPMENT,commands(true));
  expect(r.world.model.outstop?.faulted).toBe(false);
  expect(r.signals.outstop.heldLoad).toBe(true);
  r=stepScene(r,stations,PLANT_EQUIPMENT,commands(false),{outstop:'stuck-extended'});
  expect(r.world.model.outstop?.faulted).toBe(true);
  expect(r.world.bodies.map(b=>b.tags.origin)).toEqual(['feeder']);
  expect(conserved(r.world)).toBe(true);
 });
});
describe('P25 original PLC physically stuck outfeed, alarm, repair and retry',()=>{
 it('passes 3 original b1/b2/b3 seeded lots, actual electrical alarm, fresh retry and exact replay',()=>{
  const p=p25ReferenceProject(),before=JSON.stringify(p);
  expect(p25FaultRetryPreflight(p,'gate-accumulation')).toEqual([]);
  const r=runP25FaultRetryCampaign(p,'gate-accumulation');
  expect(r.status,JSON.stringify(r,null,2)).toBe('passed');
  expect(r.lots.map(l=>l.seed)).toEqual([1,42,65535,42]);
  expect(r.totalOriginals).toBe(9);
  expect(r.deterministicReplay).toBe(true);
  for(const lot of r.lots){
   expect(lot.pass,JSON.stringify(lot,null,2)).toBe(true);
   expect(lot.injectedFault).toBe(true);
   expect(lot.driveOffButGateStuck).toBe(true);
   expect(lot.faultTimedOut).toBe(true);
   expect(lot.realLampPowered).toBe(true);
   expect(lot.faultFeedInhibited).toBe(true);
   expect(lot.repairNoAutorestart).toBe(true);
   expect(lot.maintenanceRetryPowered).toBe(true);
   expect(lot.retryOpenedOriginalGate).toBe(true);
   expect(lot.originalIds).toEqual(['b1','b2','b3']);
   expect(lot.cases.every(c=>c.pass)).toBe(true);
  }
  expect(JSON.stringify(p)).toBe(before);
  expect(before).not.toContain('p25-retry');
  expect(before).not.toContain('stuck-extended');
 },120000);
 it.each(['ignore-limit','no-timeout','auto-retry','never-retry',
  'unsafe-feed','no-alarm','premature-release'] as const)(
  'rejects actual wrong PLC fault-recovery controller: %s',kind=>{
   const r=runP25FaultRetryCampaign(p25ReferenceProject(kind),'gate-accumulation');
   expect(r.status,JSON.stringify(r,null,2)).toBe('failed');
   expect(r.lots.some(l=>!l.pass)).toBe(true);
   if(kind==='ignore-limit'||kind==='no-timeout'||kind==='no-alarm')
    expect(r.lots.some(l=>l.cases.some(c=>
     c.id==='physical-limit-timeout-and-latched-24v-fault-lamp'&&!c.pass))).toBe(true);
   if(kind==='auto-retry')
    expect(r.lots.some(l=>l.cases.some(c=>
     c.id==='fault-latch-holds-original-and-rejects-demand'&&!c.pass||
     c.id==='repair-alone-never-auto-restarts'&&!c.pass))).toBe(true);
   if(kind==='unsafe-feed')
    expect(r.lots.some(l=>l.cases.some(c=>
     c.id==='fault-latch-holds-original-and-rejects-demand'&&!c.pass))).toBe(true);
  },120000);
 it('blocks missing real alarm hardware, wrong alarm Q0.7, occupied retry I1.4 and P24 defects',()=>{
  const p=p25ReferenceProject();
  const invalids=[
   {...p,wires:p.wires.filter(w=>w.from!=='scene-plc.Q0.7')},
   {...p,wires:p.wires.filter(w=>w.to!=='outfeed-alarm.M-')},
   {...p,components:p.components.filter(c=>c.id!=='outfeed-alarm')},
   {...p,components:p.components.map(c=>c.id==='outfeed-alarm'?{...c,x:730}:c)},
   {...p,wires:[...p.wires,{id:'bad-retry-wire',from:'scene-supply.P24',to:'scene-plc.I1.4'}]},
   {...p,components:[...p.components,{id:'p25-retry',kind:'start' as const,x:1,y:1,pressed:false}]},
   {...p,wires:p.wires.filter(w=>w.from!=='outstop.OUT_heldLoad')},
  ];
  for(const invalid of invalids){
   expect(p25FaultRetryPreflight(invalid,'gate-accumulation').length).toBeGreaterThan(0);
   const result=runP25FaultRetryCampaign(invalid,'gate-accumulation');
   expect(result.status,result.diagnostic).toBe('blocked');
   expect(result.lots).toEqual([]);
  }
  expect(runP25FaultRetryCampaign(p,'bottle-line').status).toBe('blocked');
 },120000);
});
