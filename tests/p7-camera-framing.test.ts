import {describe,expect,it} from 'vitest';
import type {PlacedComponent,ProjectFile} from '../src/sim/signals';
import {frameEntireWorkcell} from '../src/render/workcell-camera';
const part=(id:string,kind:PlacedComponent['kind'],x:number,y:number,yawDeg:PlacedComponent['yawDeg']=0):PlacedComponent=>
 ({id,kind,x,y,yawDeg,pressed:false});
const scene=(components:PlacedComponent[],params:ProjectFile['params']={}):
 Pick<ProjectFile,'components'|'params'>=>({components,params});
describe('P7 Fit Scene operates only on actual saved 3D workcell bounds',()=>{
 it('frames the factory centre on an empty project without generating fake content',()=>{
  expect(frameEntireWorkcell(scene([]))).toEqual({
   target:[0,0,0],position:[7,8.5,10],
  });
 });
 it('centres a physically centred model and chooses usable 3D camera distance',()=>{
  const f=frameEntireWorkcell(scene([part('roller','roller-conveyor',455,225)]));
  expect(f.target).toEqual([0,0,0]);
  expect(f.position[1]).toBeGreaterThan(2);
  expect(f.position[2]).toBeGreaterThan(0);
 });
 it('frames multiple distant stations rather than a hardcoded centre',()=>{
  const a=frameEntireWorkcell(scene([part('left','roller-conveyor',80,50)]));
  const b=frameEntireWorkcell(scene([
   part('left','roller-conveyor',80,50),part('right','roller-conveyor',870,430),
  ]));
  expect(b.target[0]).toBeGreaterThan(a.target[0]);
  expect(b.target[2]).toBeGreaterThan(a.target[2]);
  expect(b.position[1]).toBeGreaterThan(a.position[1]);
 });
 it('uses rotated worker footprints and saved nondefault dimensions',()=>{
  const base=frameEntireWorkcell(scene([
   part('north','roller-conveyor',455,200,90),part('east','roller-conveyor',530,200),
  ]));
  const expanded=frameEntireWorkcell(scene([
   part('north','roller-conveyor',455,200,90),part('east','roller-conveyor',530,200),
  ],{east:{lengthMm:2200,widthMm:400}}));
  expect(expanded.position[1]).toBeGreaterThan(base.position[1]);
  expect(expanded.target[0]).toBeGreaterThan(base.target[0]);
 });
 it('never changes project state or produces invalid camera coordinates',()=>{
  const model=scene([part('r','roller-conveyor',0,0),part('t','turntable',910,450,90)]);
  const before=JSON.stringify(model);
  const frame=frameEntireWorkcell(model);
  expect([...frame.target,...frame.position].every(Number.isFinite)).toBe(true);
  expect(frame.position[1]).toBeLessThanOrEqual(14.3);
  expect(JSON.stringify(model)).toBe(before);
 });
});
