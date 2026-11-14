import {describe,it,expect} from 'vitest';
import {freshRuntime,stepScene} from '../src/plant/world/runner';
import {freshWorld,spawnBody,conserved} from '../src/plant/world/bodies';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import type {EquipmentPlacement,WorldInputs} from '../src/plant/world/types';

/** Incomplete workcell integration test.
 * Proves physical-world component behavior under explicit command images only.
 * It does NOT assert that a learner PLC is connected to these devices yet.
 */
const put=(id:string,kind:string,x:number,y=0):EquipmentPlacement=>({
  id,kind,originMm:{x,y,z:0},yawDeg:0,params:{},
});
const plant=[
  put('in','roller-conveyor',-600),
  put('table','turntable',0),
  put('out-a','roller-conveyor',600),
  put('out-b','roller-conveyor',0,600),
  put('eye1','geometry-photoeye',0),
  put('eye2','geometry-photoeye',600),
];
const commands:WorldInputs={
  in:{run:true},table:{turn:true},
  'out-a':{run:false},'out-b':{run:false},
};
const start=()=>{
  const bodyWorld=spawnBody(freshWorld(713),'training',{
    size:{x:120,y:100,z:100},massKg:12,pos:{x:0,y:0,z:130},supportedBy:'table',
  });
  return freshRuntime(bodyWorld,plant,PLANT_EQUIPMENT);
};
const advance=(n:number,cmd:WorldInputs)=>{
  let runtime=start();
  for(let i=0;i<n;i++)runtime=stepScene(runtime,plant,PLANT_EQUIPMENT,cmd);
  return runtime;
};
describe('P3 multi-station mechanical core, before PLC/scene host integration',()=>{
  it('has four independent real conveyor and rotary component instances',()=>{
    const r=advance(1,commands);
    expect(r.world.timeMs).toBe(50);
    expect(r.signals.in.moving).toBe(true);
    expect(r.signals['out-a'].moving).toBe(false);
    expect(r.signals['out-b'].moving).toBe(false);
    expect(r.signals.table.busy).toBe(true);
    expect(r.signals.table.rotated).toBe(false);
  });
  it('turns a supported box once only after the physical quarter-turn duration',()=>{
    const before=advance(39,commands);
    expect(before.world.bodies[0].yawDeg).toBe(0);
    expect(before.signals.table.rotated).toBe(false);
    const after=advance(40,commands);
    expect(after.world.bodies[0].yawDeg).toBe(90);
    expect(after.signals.table.rotated).toBe(true);
    expect(advance(70,commands).world.bodies[0].yawDeg).toBe(90);
    expect(conserved(after.world)).toBe(true);
  });
  it('does not rotate the same body when the turn command is withheld',()=>{
    const noTurn={...commands,table:{turn:false}};
    const w=advance(55,noTurn);
    expect(w.signals.table.home).toBe(true);
    expect(w.world.bodies[0].yawDeg).toBe(0);
  });
  it('reports nearby simulated bodies from geometry rather than UI animation',()=>{
    const r=advance(2,commands);
    expect(r.signals.eye1.present).toBe(true);
    expect(r.signals.eye2.present).toBe(false);
    expect(JSON.stringify(advance(40,commands))).toBe(JSON.stringify(advance(40,commands)));
  });
});
