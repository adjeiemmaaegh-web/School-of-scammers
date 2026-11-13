import {describe,it,expect} from 'vitest';
import {p21ReferenceProject} from './fixtures/p21-queue-programs';
import {p21AccumulationPreflight,runP21Accumulation} from '../src/plant/scenes/matrix-p21';
import type {ProjectFile} from '../src/sim/signals';

describe('P21 original powered PLC / real two-body queue and pusher recovery',()=>{
 it('three independent two-carton lots and one replay prove true collision dwell and conserved dual material recovery',()=>{
  const p=p21ReferenceProject();
  const saved=JSON.stringify(p);
  expect(p21AccumulationPreflight(p,'gate-accumulation')).toEqual([]);
  const result=runP21Accumulation(p,'gate-accumulation');
  expect(result.status,JSON.stringify(result,null,2)).toBe('passed');
  expect(result.lots).toHaveLength(4);
  expect(result.lots.map(l=>l.seed)).toEqual([1,42,65535,42]);
  expect(result.originalBodies).toBe(6);
  expect(result.receivedBodies).toBe(3);
  expect(result.divertedBodies).toBe(3);
  expect(result.deterministicReplay).toBe(true);
  expect(result.lots.every(l=>l.pass)).toBe(true);
  for(const lot of result.lots){
   expect(lot.originals).toBe(2);
   expect(lot.leaderId).toBe('b1');
   expect(lot.queuedBodyId).toBe('b2');
   expect(lot.genuinePair).toBe(true);
   expect(lot.contactDwellMs).toBeGreaterThanOrEqual(200);
   expect(lot.stoppedUnderLoad).toBe(true);
   expect(lot.gateRetracted).toBe(true);
   expect(lot.leaderPhysicallyDiverted).toBe(true);
   expect(lot.stopHeldAfterClearance).toBe(true);
   expect(lot.resetFromPlc).toBe(true);
   expect(lot.sameQueuedBodyRecovered).toBe(true);
   expect(lot.contactXmm).not.toBeNull();
   expect(lot.receivedXmm).toBeGreaterThan(330);
   expect(lot.cases.every(x=>x.pass)).toBe(true);
  }
  expect(JSON.stringify(p)).toBe(saved);
  expect(saved).not.toContain('p21-maintenance');
 },120000);
 it.each(['no-reset','held-gate','early-reset','one-body','no-pusher'] as const)(
  'real physics and powered I/O reject %s learner code',
  kind=>{
   const result=runP21Accumulation(p21ReferenceProject(kind),'gate-accumulation');
   expect(result.status).toBe('failed');
   expect(result.lots.some(x=>!x.pass)).toBe(true);
   if(kind==='early-reset'){
    // A physically safe interlock may reject an early reset attempt yet
    // still recover all source bodies after a later legitimate reset.
    // The unsafe *PLC command* is an assessment failure on its own;
    // requiring product loss would falsely punish correct plant physics.
    expect(result.lots.some(l=>l.cases.some(c=>
     c.id==='early-reset-blocked'&&!c.pass))).toBe(true);
   }else expect(result.receivedBodies).toBeLessThan(3);
  },120000);
 it('no genuine moving conveyor, collision feedback, pusher wire or bounded option fails closed',()=>{
  const p=p21ReferenceProject();
  const invalid:ProjectFile[]=[
   {...p,wires:p.wires.filter(w=>w.from!=='belt.OUT_accumulationTripped')},
   {...p,wires:p.wires.filter(w=>w.from!=='stopper.OUT_retracted')},
   {...p,wires:p.wires.filter(w=>w.from!=='pusher.OUT_extended')},
   {...p,wires:p.wires.filter(w=>w.from!=='scene-plc.Q0.4')},
   {...p,wires:p.wires.filter(w=>w.from!=='scene-plc.Q0.3')},
   {...p,wires:p.wires.filter(w=>w.from!=='scene-plc.Q0.0')},
   {...p,params:{...p.params,belt:{...p.params?.belt,accumulationTripMode:0}}},
   {...p,params:{...p.params,belt:{...p.params?.belt,accumulationDwellMs:4000}}},
   {...p,params:{...p.params,belt:{...p.params?.belt,obstructionTripMode:1}}},
   {...p,params:{...p.params,belt:{...p.params?.belt,widthMm:300}}},
   {...p,components:p.components.filter(c=>c.id!=='pusher')},
   {...p,components:p.components.map(c=>c.id==='feeder'?{...c,x:390}:c)},
   {...p,components:[...p.components,{id:'p21-start',kind:'start',x:10,y:10,pressed:false}]},
  ];
  for(const project of invalid){
   const result=runP21Accumulation(project,'gate-accumulation');
   expect(result.status,JSON.stringify(result)).toBe('blocked');
   expect(result.lots).toEqual([]);
  }
  expect(runP21Accumulation(p,'bottle-line').status).toBe('blocked');
 });
});
