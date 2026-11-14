import {describe,it,expect} from 'vitest';
import {p20ReferenceProject} from './fixtures/p20-gate-programs';
import {p20ObstructionPreflight,runP20Obstruction} from '../src/plant/scenes/matrix-p20';
import {freshWorld,spawnBody,conserved} from '../src/plant/world/bodies';
import {freshRuntime,stepScene} from '../src/plant/world/runner';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import {vec} from '../src/plant/world/math';
import type {EquipmentPlacement} from '../src/plant/world/types';
import type {ProjectFile} from '../src/sim/signals';

const placements=(trip=1):EquipmentPlacement[]=>[
 {id:'belt',kind:'belt-conveyor',originMm:vec(0,0,0),yawDeg:0,
  params:{obstructionTripMode:trip,jamResetMode:1,speedMmS:250}},
 {id:'stopper',kind:'stopper',originMm:vec(240,0,0),yawDeg:0,
  params:{travelMs:100}},
];
const physical=(trip=1)=>freshRuntime(spawnBody(freshWorld(), 'original-machine', {
 size:vec(160,128,96),massKg:8,pos:vec(-150,0,120),
 tags:{material:'cardboard',origin:'original-machine'},supportedBy:'belt',
}),placements(trip),PLANT_EQUIPMENT);
const drive=(s:ReturnType<typeof physical>,trip=1,extend=true,resetJam=false)=>
 stepScene(s,placements(trip),PLANT_EQUIPMENT,{
  belt:{run:true,resetJam},stopper:{extend}
 });
const until=(cond:(s:ReturnType<typeof physical>)=>boolean,trip=1)=>{
 let s=physical(trip);
 for(let i=0;i<140&&!cond(s);i++)s=drive(s,trip);
 return s;
};
describe('P20 equipment-native gate obstruction stop and actual PLC recovery',()=>{
 it('a worker-owned body blocked by a real powered stopper trips its own conveyor and retains original gate/ID provenance',()=>{
  let s=until(w=>w.signals.belt.obstructionTripped===true);
  expect(s.signals.belt.obstructionTripped).toBe(true);
  expect(s.signals.belt.jam).toBe(true);
  expect(s.signals.belt.moving).toBe(false);
  expect(s.world.model.belt.stalled).toBe(true);
  expect(s.world.model.belt.speedMmS).toBe(0);
  expect(s.world.model.belt.obstructionBodyId).toBe('b1');
  expect(s.world.model.belt.obstructionGateId).toBe('stopper');
  expect(s.world.bodies[0].tags.jammedByGate).toBe('stopper');
  const x=s.world.bodies[0].pos.x;
  for(let i=0;i<40;i++){
   s=drive(s);
   expect(s.world.bodies[0].pos.x).toBe(x);
   expect(s.world.model.belt.stalled).toBe(true);
   expect(conserved(s.world)).toBe(true);
  }
 });
 it('a reset issued while the physical gate is still extended cannot bypass it; actual retraction alone never restarts',()=>{
  let s=until(x=>x.signals.belt.obstructionTripped===true);
  const x=s.world.bodies[0].pos.x;
  s=drive(s,1,true,true);
  expect(s.signals.belt.obstructionTripped).toBe(true);
  expect(s.world.bodies[0].pos.x).toBe(x);
  s=drive(s,1,true,false);
  for(let i=0;i<45;i++)s=drive(s,1,false,false);
  expect(s.signals.stopper.retracted).toBe(true);
  expect(s.world.model.stopper.engaged).toBe(false);
  expect(s.signals.belt.obstructionTripped).toBe(true);
  expect(s.world.bodies[0].pos.x).toBe(x);
  s=drive(s,1,false,true);
  expect(s.world.model.belt.obstructionBodyId).toBeNull();
  expect(s.signals.belt.obstructionTripped).toBe(false);
  expect(s.signals.belt.moving).toBe(true);
  for(let i=0;i<15;i++)s=drive(s,1,false,false);
  expect(s.world.bodies[0].pos.x).toBeGreaterThan(x+15);
  expect(s.world.bodies[0].id).toBe('b1');
  expect(conserved(s.world)).toBe(true);
 });
 it('opt-in absence preserves original P8 real mechanical contact without latching drive stop',()=>{
  let s=until(x=>x.world.bodies[0].tags.jammed===true,0);
  expect(s.world.bodies[0].tags.jammed).toBe(true);
  expect(s.signals.belt.jam).toBe(true);
  expect(s.signals.belt.obstructionTripped).toBe(false);
  expect(s.signals.belt.moving).toBe(true);
  expect(s.world.model.belt.stalled).toBe(false);
 });
 it('a retracted gate is not a true obstruction: body crosses physical gate with no forced latch',()=>{
  let s=physical();
  for(let i=0;i<120;i++)s=drive(s,1,false,false);
  expect(s.world.bodies[0].pos.x).toBeGreaterThan(300);
  expect(s.signals.belt.obstructionTripped).toBe(false);
  expect(s.world.model.belt.obstructionBodyId).toBeFalsy();
  expect(conserved(s.world)).toBe(true);
 });
 it('source-owned 24V PLC, three feeder material lots and independent replay prove correct physical gate sequence',()=>{
  const p=p20ReferenceProject(),before=JSON.stringify(p);
  expect(p20ObstructionPreflight(p,'gate-accumulation')).toEqual([]);
  const result=runP20Obstruction(p,'gate-accumulation');
  expect(result.status,JSON.stringify(result,null,2)).toBe('passed');
  expect(result.lots).toHaveLength(4);
  expect(result.lots.map(x=>x.seed)).toEqual([1,42,65535,42]);
  expect(result.deterministicReplay).toBe(true);
  expect(result.originalProducts).toBe(3);
  expect(result.recoveredProducts).toBe(3);
  expect(result.lots.map(x=>x.material)).toEqual(['cardboard','cardboard','metal','cardboard']);
  expect(result.lots.every(x=>x.pass)).toBe(true);
  expect(result.lots.every(x=>x.bodyId==='b1')).toBe(true);
  expect(result.lots.every(x=>x.sensedOriginalGate&&x.stoppedWhileBlocked&&
   x.actualGateRetracted&&x.stayedStoppedAfterClearance&&
   x.plcResetEdge&&x.recoveredSameBody)).toBe(true);
  expect(result.lots.every(x=>x.cases.every(c=>c.pass))).toBe(true);
  expect(result.lots.every(x=>x.contactXmm!==null&&
   x.finalXmm!==null&&x.finalXmm>330)).toBe(true);
  expect(JSON.stringify(p)).toBe(before);
  expect(before).not.toContain('p20-ack');
 },120000);
 it.each(['no-reset','gate-held','early-reset','never-feed'] as const)(
  'rejects a PLC that has %s instead of physically valid release and new reset',
  kind=>{
   const result=runP20Obstruction(p20ReferenceProject(kind),'gate-accumulation');
   expect(result.status).toBe('failed');
   expect(result.lots.some(x=>!x.pass)).toBe(true);
  },120000);
 it('disconnecting genuine gate/belt feedback or removing opt-in fails closed without running worker',()=>{
  const p=p20ReferenceProject();
  const changes:ProjectFile[]=[
   {...p,wires:p.wires.filter(x=>x.from!=='belt.OUT_obstructionTripped')},
   {...p,wires:p.wires.filter(x=>x.from!=='stopper.OUT_retracted')},
   {...p,wires:p.wires.filter(x=>x.from!=='scene-plc.Q0.3')},
   {...p,wires:p.wires.filter(x=>x.to!=='belt.L+')},
   {...p,params:{...p.params,belt:{...p.params?.belt,
    obstructionTripMode:0}}},
   {...p,components:p.components.map(x=>x.id==='feeder'?{...x,x:330}:x)},
   {...p,components:[...p.components,{id:'p20-ack',kind:'start',x:20,y:20,pressed:false}]},
  ];
  for(const project of changes){
   const report=runP20Obstruction(project,'gate-accumulation');
   expect(report.status).toBe('blocked');
   expect(report.lots).toEqual([]);
  }
  expect(runP20Obstruction(p,'robot-sort').status).toBe('blocked');
 });
});
