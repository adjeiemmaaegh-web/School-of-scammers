import {describe,it,expect} from 'vitest';
import {p16ReferenceProject,type P16Original} from './fixtures/p16-autonomous-programs';
import {runP17MaterialCampaign,P17_MATERIAL_SEEDS} from '../src/plant/scenes/matrix-p17';
import {runP15AutonomousSort} from '../src/plant/scenes/matrix-p15-autonomous';
import {runP15AutonomousFactory} from '../src/plant/scenes/matrix-p15-autonomous-factory';

const scenes:P16Original[]=['robot-sort','gantry-transfer','palletizing','bottle-line'];
const sequences:Record<P16Original,string[]>={
 'robot-sort':['CCM','CMC','MCC'],
 'gantry-transfer':['CCM','CMC','MCC'],
 palletizing:['CCMCMCCC','CMCMMCMM','MCCCMMCC'],
 'bottle-line':['CCM','CMC','MCC'],
};
describe('P17 feeder-seeded material-lot quality campaign',()=>{
 it.each(scenes)('%s processes three distinct real material lots with original body quality and replay',
  scene=>{
   const p=p16ReferenceProject(scene),before=JSON.stringify(p);
   const r=runP17MaterialCampaign(p,scene);
   expect(r.status,JSON.stringify({scene,lots:r.lots},null,2)).toBe('passed');
   expect(r.lots.map(l=>l.id)).toEqual(['lot-a','lot-b','lot-c','replay-b']);
   expect(r.lots.map(l=>l.materialSeed)).toEqual([1,42,65535,42]);
   expect(r.lots.slice(0,3).map(l=>l.materialSequence)).toEqual(sequences[scene]);
   expect(r.lots[3].materialSequence).toBe(sequences[scene][1]);
   expect(r.materialDiversity).toBe(true);
   expect(r.deterministicReplay).toBe(true);
   expect(r.lots.every(l=>l.pass&&l.faultRecovered)).toBe(true);
   expect(r.lots.map(l=>l.faultAtProduct)).toEqual(
    scene==='palletizing'?[1,4,8,4]:[1,2,3,2]);
   expect(r.totalPhysicalProducts).toBe(scene==='palletizing'?24:9);
   expect(r.acceptedPhysicalProducts).toBe(r.totalPhysicalProducts);
   expect(r.qualityYieldPercent).toBe(100);
   expect(r.minModelThroughputPerHour).toBeGreaterThan(0);
   expect(r.maxModelThroughputPerHour).toBeGreaterThanOrEqual(r.minModelThroughputPerHour);
   for(const lot of r.lots){
    expect(lot.produced).toBe(lot.expected);
    expect(lot.accepted).toBe(lot.expected);
    expect(lot.trace).toHaveLength(lot.expected);
    expect(lot.trace.map(t=>t.bodyId)).toEqual(
     Array.from({length:lot.expected},(_,i)=>'b'+(i+1)));
    expect(lot.trace.every(t=>t.qualityPassed)).toBe(true);
    if(scene==='bottle-line')expect(lot.trace.every(t=>t.capped&&
     t.filledMl!==null&&t.filledMl>=500&&t.shape==='cylinder')).toBe(true);
    if(scene==='palletizing')expect(lot.trace.map(t=>t.palletSlot)).toEqual(
     Array.from({length:8},(_,i)=>i));
    if(scene==='robot-sort')expect(new Set(lot.trace.map(t=>t.supportedBy))).toEqual(
     new Set(['metal-out','plain-out']));
   }
   expect(JSON.stringify(p)).toBe(before);
   expect(before).not.toContain('p17-product');
  },120000);
 it('rejects 0, negative, fractional, overflow and missing-seed material sampling',()=>{
  const p=p16ReferenceProject('robot-sort');
  for(const bad of [0,-1,1.25,4294967296,NaN,Infinity]){
   const r=runP15AutonomousSort(p,'robot-sort',{materialSeed:bad});
   expect(r.status).toBe('blocked');
   expect(r.productTrace).toEqual([]);
  }
  for(const bad of [0,-2,1.1,4294967296,Number.NEGATIVE_INFINITY]){
   const r=runP15AutonomousFactory(p16ReferenceProject('bottle-line'),'bottle-line',
    {materialSeed:bad});
   expect(r.status).toBe('blocked');
   expect(r.productTrace).toEqual([]);
  }
 });
 it('different seed changes actual robot feeder provenance, not original PLC source or routed material grade',()=>{
  const p=p16ReferenceProject('robot-sort'),before=JSON.stringify(p);
  const a=runP15AutonomousSort(p,'robot-sort',{materialSeed:P17_MATERIAL_SEEDS[0]});
  const b=runP15AutonomousSort(p,'robot-sort',{materialSeed:P17_MATERIAL_SEEDS[1]});
  const c=runP15AutonomousSort(p,'robot-sort',{materialSeed:P17_MATERIAL_SEEDS[2]});
  expect([a,b,c].map(x=>x.status)).toEqual(['passed','passed','passed']);
  expect([a,b,c].map(x=>x.materialSequence)).toEqual(['CCM','CMC','MCC']);
  expect([a,b,c].every(x=>x.productTrace.every(t=>t.qualityPassed))).toBe(true);
  expect(JSON.stringify(p)).toBe(before);
 },120000);
 it('refuses a fixed nonmetal route that accidentally passes only one seed',()=>{
  const p=p16ReferenceProject('robot-sort');
  if(!p.stSource)throw Error('Expected source reference ST');
  const wrong={...p,stSource:p.stSource.replace('Lane := In2;','Lane := FALSE;')};
  const campaign=runP17MaterialCampaign(wrong,'robot-sort');
  expect(campaign.status).toBe('failed');
  expect(campaign.lots.some(l=>!l.pass)).toBe(true);
  expect(campaign.qualityYieldPercent).toBeLessThan(100);
 },120000);
 it('blocks unwired original references and unsupported scenes without executing source code',()=>{
  const p=p16ReferenceProject('bottle-line');
  const disconnected={...p,wires:p.wires.filter(w=>w.from!=='fill-eye.OUT_present')};
  const blocked=runP17MaterialCampaign(disconnected,'bottle-line');
  expect(blocked.status).toBe('blocked');
  expect(blocked.lots).toEqual([]);
  expect(blocked.totalPhysicalProducts).toBe(0);
  const unsupported=runP17MaterialCampaign(p,'production-line');
  expect(unsupported.status).toBe('blocked');
  expect(unsupported.lots).toHaveLength(0);
 });
});
