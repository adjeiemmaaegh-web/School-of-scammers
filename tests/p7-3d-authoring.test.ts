import {describe,it,expect} from 'vitest';
import type {PlacedComponent,ProjectFile} from '../src/sim/signals';
import {
 assess3DPlacement,nearestSensorCarrier,placementMessage,previewDimensions,P7_SENSOR_KINDS,
} from '../src/render/scene-authoring';
const part=(id:string,kind:PlacedComponent['kind'],x:number,y:number,yawDeg:PlacedComponent['yawDeg']=0):PlacedComponent=>
 ({id,kind,x,y,yawDeg,pressed:false});
const project=(components:PlacedComponent[],params:ProjectFile['params']={}):
 Pick<ProjectFile,'components'|'params'>=>({components,params});
describe('P7 authoritative 3D placement previews and sensor-to-carrier geometry',()=>{
 it('preserves the actual persisted model and is a pure non-mutating preview',()=>{
  const p=project([part('carrier','roller-conveyor',455,225)]);
  const before=JSON.stringify(p);
  const result=assess3DPlacement(p,'geometry-photoeye',{x:460,y:231},1);
  expect(result.at).toEqual({x:455,y:225});
  expect(result.mountedTo).toBe('carrier');
  expect(JSON.stringify(p)).toBe(before);
 });
 it('matches the nearest registered transport and ignores unrelated electrical parts',()=>{
  const p=project([part('a','roller-conveyor',230,225),part('b','roller-conveyor',465,225),
    part('plc','plc16',500,225)]);
  expect(nearestSensorCarrier(p,{x:470,y:230},'geometry-photoeye')?.id).toBe('b');
  expect(nearestSensorCarrier(p,{x:470,y:230},'plc16')).toBeNull();
  expect(nearestSensorCarrier(p,{x:0,y:0},'geometry-photoeye')).toBeNull();
 });
 it('aligning sensors is opt-out and cannot silently reposition unrelated machines',()=>{
  const p=project([part('a','roller-conveyor',455,225)]);
  expect(assess3DPlacement(p,'geometry-photoeye',{x:450,y:221},1,false).at)
   .toEqual({x:450,y:221});
  expect(assess3DPlacement(p,'lamp',{x:450,y:221},1,true).at)
   .toEqual({x:450,y:221});
 });
 it('quantizes and clamps the same persisted coordinates as worker transforms',()=>{
  const p=project([]);
  expect(assess3DPlacement(p,'roller-conveyor',{x:454,y:227},25).at)
   .toEqual({x:450,y:225});
  expect(assess3DPlacement(p,'roller-conveyor',{x:40000,y:-100},5).at)
   .toEqual({x:910,y:0});
 });
 it('carrier overlaps are advisory, not a false proof of a model collision',()=>{
  const p=project([part('a','roller-conveyor',455,225)]);
  const c=assess3DPlacement(p,'roller-conveyor',{x:480,y:225},1);
  expect(c.overlappingCarriers).toContain('a');
  expect(placementMessage(c)).toMatch(/advisory/);
 });
 it('legal partial handoff between adjoining transport surfaces is still allowed',()=>{
  const p=project([part('a','roller-conveyor',455,225)]);
  const c=assess3DPlacement(p,'turntable',{x:495,y:225},1);
  expect(c.at).toEqual({x:495,y:225});
  expect(c.footprint.kind).toBe('turntable');
 });
 it('quarter-turn footprints are evaluated once, not double rotated in 3D',()=>{
  const p=project([]);
  const horizontal=assess3DPlacement(p,'roller-conveyor',{x:455,y:225},1);
  const rotated=assess3DPlacement(project([part('r','roller-conveyor',455,225,90)]),
    'geometry-photoeye',{x:455,y:225},1);
  expect(previewDimensions(horizontal.footprint)).toEqual([.6,.3]);
  expect(rotated.mountedTo).toBe('r');
  expect(P7_SENSOR_KINDS.has('geometry-photoeye')).toBe(true);
 });
 it('saved P3 length/width override the visual silhouette without changing the engine',()=>{
  const p=project([],{'p7-preview':{lengthMm:1200,widthMm:250}});
  const candidate=assess3DPlacement(p,'roller-conveyor',{x:400,y:200},1);
  expect(previewDimensions(candidate.footprint)).toEqual([1.2,.25]);
 });
 it('aligned photoeye messages disclose the exact carrier instead of invented detection',()=>{
  const p=project([part('table','turntable',455,225)]);
  expect(placementMessage(assess3DPlacement(p,'geometry-photoeye',{x:458,y:220},1)))
   .toContain('table');
 });
});
