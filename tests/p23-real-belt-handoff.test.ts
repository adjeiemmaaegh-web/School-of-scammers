import {describe,it,expect} from 'vitest';
import {freshWorld,spawnBody,conserved} from '../src/plant/world/bodies';
import {freshRuntime,stepScene} from '../src/plant/world/runner';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import {vec} from '../src/plant/world/math';
import type {EquipmentPlacement} from '../src/plant/world/types';
import {p23ReferenceProject} from './fixtures/p23-handoff-programs';
import {p23HandoffPreflight,runP23HandoffCampaign} from '../src/plant/scenes/matrix-p23';

const belts:EquipmentPlacement[]=[
 {id:'source',kind:'belt-conveyor',originMm:vec(0,0,0),yawDeg:0,
  params:{lengthMm:600,widthMm:150,speedMmS:250,zoneSensorMode:1,zoneCapacity:1}},
 {id:'receiver',kind:'belt-conveyor',originMm:vec(600,0,0),yawDeg:0,
  params:{lengthMm:600,widthMm:150,speedMmS:250,zoneSensorMode:1,zoneCapacity:1}},
];
const body=()=>spawnBody(freshWorld(),'feeder',{
 size:vec(160,128,96),massKg:8,pos:vec(250,0,120),
 supportedBy:'source',tags:{origin:'feeder',material:'cardboard'}});
describe('P23 existing real 10ms physics: adjacent conveyor owner transfer',()=>{
 it('changes original carrier ID, count and zone-full from source to receiver without creating a body',()=>{
  let r=freshRuntime(body(),belts,PLANT_EQUIPMENT);
  expect(r.signals.source.zoneFull).toBe(true);
  expect(r.signals.receiver.zoneCount).toBe(0);
  let seen=false;
  for(let k=0;k<65;k++){
   r=stepScene(r,belts,PLANT_EQUIPMENT,{source:{run:true},receiver:{run:true}});
   if(r.world.bodies[0]?.supportedBy==='receiver'){
    seen=true;
    expect(r.signals.source.zoneCount).toBe(0);
    expect(r.signals.receiver.zoneCount).toBe(1);
    expect(r.signals.receiver.zoneFull).toBe(true);
    break;
   }
  }
  expect(seen).toBe(true);
  expect(r.world.bodies.map(b=>b.id)).toEqual(['b1']);
  expect(r.world.spawnedCount).toBe(1);
  expect(r.world.despawnedCount).toBe(0);
  expect(conserved(r.world)).toBe(true);
 });
 it('requires receiver motor power to continue carriage well into the receiving lane',()=>{
  let running=freshRuntime(body(),belts,PLANT_EQUIPMENT);
  let stopped=freshRuntime(body(),belts,PLANT_EQUIPMENT);
  for(let k=0;k<25;k++){
   running=stepScene(running,belts,PLANT_EQUIPMENT,{source:{run:true},receiver:{run:true}});
   stopped=stepScene(stopped,belts,PLANT_EQUIPMENT,{source:{run:true},receiver:{run:false}});
  }
  expect(running.world.bodies[0].pos.x).toBeGreaterThan(450);
  expect(stopped.world.bodies[0].pos.x).toBeLessThan(350);
  expect(conserved(running.world)&&conserved(stopped.world)).toBe(true);
 });
 it('does not invent receiver occupancy without physical transferred source body',()=>{
  const r=freshRuntime(freshWorld(),belts,PLANT_EQUIPMENT);
  expect(r.signals.receiver.zoneCount).toBe(0);
  expect(r.signals.receiver.zoneFull).toBe(false);
 });
});
describe('P23 real 24V PLC two-conveyor receiving, full-lane inhibit and third demand',()=>{
 it('passes independently seeded original b2 handoff and exact-replay campaign',()=>{
  const p=p23ReferenceProject();
  const signature=JSON.stringify(p);
  expect(p23HandoffPreflight(p,'gate-accumulation')).toEqual([]);
  const r=runP23HandoffCampaign(p,'gate-accumulation');
  expect(r.status,JSON.stringify(r,null,2)).toBe('passed');
  expect(r.lots.map(l=>l.seed)).toEqual([1,42,65535,42]);
  expect(r.totalOriginals).toBe(9);
  expect(r.deterministicReplay).toBe(true);
  for(const lot of r.lots){
   expect(lot.pass,JSON.stringify(lot,null,2)).toBe(true);
   expect(lot.downstreamReceived).toBe(true);
   expect(lot.downstreamInputHigh).toBe(true);
   expect(lot.downstreamPowered).toBe(true);
   expect(lot.receiverMotionMm).toBeGreaterThan(35);
   expect(lot.downstreamInhibited).toBe(true);
   expect(lot.downstreamCleared).toBe(true);
   expect(lot.originalIds).toEqual(['b1','b2','b3']);
   expect(lot.cases.every(c=>c.pass)).toBe(true);
  }
  expect(JSON.stringify(p)).toBe(signature);
  expect(signature).not.toContain('p23-start');
 },120000);
 it.each(['ignore-downstream','receiver-off','never-third','blind-upstream','no-reset'] as const)(
  'refuses incorrect authored PLC controller %s',kind=>{
   const r=runP23HandoffCampaign(p23ReferenceProject(kind),'gate-accumulation');
   expect(r.status,JSON.stringify(r,null,2)).toBe('failed');
   expect(r.lots.some(l=>!l.pass)).toBe(true);
   if(kind==='ignore-downstream')
    expect(r.lots.some(l=>l.cases.some(c=>
     c.id==='full-receiver-inhibits-fresh-feed'&&!c.pass))).toBe(true);
   if(kind==='receiver-off')
    expect(r.lots.some(l=>l.cases.some(c=>
     c.id==='original-receiver-handoff'&&!c.pass||
     c.id==='powered-receiver-transport'&&!c.pass))).toBe(true);
  },120000);
 it('blocks forged receiver, disconnected output, fake input and wrong geometry pre-run',()=>{
  const p=p23ReferenceProject();
  const changes=[
   {...p,wires:p.wires.filter(w=>w.from!=='receiver.OUT_zoneFull')},
   {...p,wires:p.wires.filter(w=>w.from!=='scene-plc.Q0.5')},
   {...p,params:{...p.params,receiver:{...p.params?.receiver,zoneSensorMode:0}}},
   {...p,params:{...p.params,receiver:{...p.params?.receiver,zoneCapacity:2}}},
   {...p,components:p.components.map(c=>c.id==='receiver'?{...c,x:520}:c)},
   {...p,components:[...p.components,{id:'p23-start',kind:'start' as const,x:1,y:1,pressed:false}]},
  ];
  for(const wrong of changes){
   expect(p23HandoffPreflight(wrong,'gate-accumulation').length).toBeGreaterThan(0);
   const r=runP23HandoffCampaign(wrong,'gate-accumulation');
   expect(r.status,r.diagnostic).toBe('blocked');
   expect(r.lots).toEqual([]);
  }
  expect(runP23HandoffCampaign(p,'bottle-line').status).toBe('blocked');
 },120000);
});
