import { describe,expect,it } from 'vitest';
import type { PlacedComponent, ProjectFile } from '../src/sim/signals';
import {
  placementFrom3DFloor,precise3DPlacement,propose3DPlacement,
  proposeSensorMount,
} from '../src/render/scene-authoring';
import { footprintOf } from '../src/workspace/floor-plan';

const component=(id:string,kind:PlacedComponent['kind'],x:number,y:number,yawDeg:0|90|180|270=0):PlacedComponent=>
  ({id,kind,x,y,pressed:false,yawDeg});
const project=(parts:PlacedComponent[],params:ProjectFile['params']={}):Pick<ProjectFile,'components'|'params'>=>
  ({components:parts,params});

describe('P7 genuine 3D authoring proposals (no fake PLC inputs)',()=>{
  it('maps a ray-plane hit in metres back to the saved floor centre',()=>{
    expect(placementFrom3DFloor(0,0)).toEqual({x:455,y:225});
    expect(placementFrom3DFloor(1,-.5)).toEqual({x:555,y:175});
  });
  it('snaps keyboard-precise placement through the same snap grid as 3D mouse editing',()=>{
    expect(precise3DPlacement(453,227,5)).toEqual({x:455,y:225});
    expect(precise3DPlacement(2000,-80,10)).toEqual({x:910,y:0});
  });
  it('refuses an out-of-floor 3D ray rather than silently placing at the wrong boundary',()=>{
    const proposal=propose3DPlacement('roller-conveyor',{x:928,y:225},project([]),5);
    expect(proposal.valid).toBe(false);
    expect(proposal.reason).toMatch(/outside/i);
  });
  it('accepts precise placement from a genuinely empty factory floor',()=>{
    const next=propose3DPlacement('roller-conveyor',{x:452,y:224},project([]),5);
    expect(next).toMatchObject({valid:true,at:{x:450,y:225},mount:null,advisory:null});
  });
  it('mounts an optical sensor on a horizontal roller side within worker 200mm range',()=>{
    const shop=project([component('roller','roller-conveyor',455,225)]);
    const sensor=proposeSensorMount('geometry-photoeye',{x:455,y:225},shop,1);
    expect(sensor?.carrierId).toBe('roller');
    expect(sensor?.at).toEqual({x:455,y:242});
    expect(Math.hypot(sensor!.at.x-455,sensor!.at.y-225)).toBeLessThan(20);
  });
  it('mounts on the correct rail after the conveyor rotates 90 degrees',()=>{
    const shop=project([component('roller','roller-conveyor',455,225,90)]);
    const sensor=proposeSensorMount('geometry-photoeye',{x:455,y:225},shop,1);
    expect(sensor?.at).toEqual({x:472,y:225});
    expect(sensor?.carrierId).toBe('roller');
  });
  it('uses customised conveyor dimensions, rather than a fixed sensor-side distance',()=>{
    const shop=project([component('roller','roller-conveyor',455,225)],{roller:{widthMm:500}});
    const mount=proposeSensorMount('geometry-photoeye',{x:455,y:240},shop,1);
    expect(mount?.at.y).toBe(252);
  });
  it('never auto-mounts PLCs or unrelated devices',()=>{
    const shop=project([component('roller','roller-conveyor',455,225)]);
    expect(proposeSensorMount('plc16',{x:455,y:225},shop,1)).toBe(null);
    expect(propose3DPlacement('lamp',{x:455,y:225},shop,1).mount).toBe(null);
  });
  it('returns advisory overlap for heavy transport machines but allows intentional joins',()=>{
    const shop=project([component('roller','roller-conveyor',455,225)]);
    const overlap=propose3DPlacement('turntable',{x:455,y:225},shop,1);
    expect(overlap).toMatchObject({valid:true,mount:null});
    expect(overlap.advisory).toMatch(/transport/i);
  });
  it('does not warn about a legitimate photoeye on its intended conveyor',()=>{
    const shop=project([component('roller','roller-conveyor',455,225)]);
    const result=propose3DPlacement('geometry-photoeye',{x:455,y:225},shop,1);
    expect(result).toMatchObject({valid:true,advisory:null,mount:{carrierId:'roller'}});
    expect(footprintOf(component('roller','roller-conveyor',455,225)).isCarrier).toBe(true);
  });
  it('chooses the closest valid rail among multiple carriers deterministically',()=>{
    const shop=project([component('one','roller-conveyor',455,225),
      component('two','roller-conveyor',635,225)]);
    const mount=proposeSensorMount('geometry-photoeye',{x:635,y:245},shop,1);
    expect(mount?.carrierId).toBe('two');
  });
  it('does not alter scene configuration when computing previews and mounts',()=>{
    const shop=project([component('roller','roller-conveyor',455,225)],{roller:{lengthMm:800}});
    const before=JSON.stringify(shop);
    for(let i=0;i<12;i++)propose3DPlacement('geometry-photoeye',{x:455+i,y:225},shop,5);
    expect(JSON.stringify(shop)).toEqual(before);
  });
});
