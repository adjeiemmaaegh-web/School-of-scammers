import {describe,expect,it} from 'vitest';
import type {PlacedComponent,ProjectFile} from '../src/sim/signals';
import {
 superposedCarrierPairs,firstNewCarrierSuperposition,carrierSuperpositionError,
} from '../src/workspace/carrier-clearance';

const part=(id:string,kind:PlacedComponent['kind'],x:number,y:number,yawDeg:PlacedComponent['yawDeg']=0):PlacedComponent=>
 ({id,kind,x,y,yawDeg,pressed:false});
const scene=(components:PlacedComponent[],params:ProjectFile['params']={}):
 Pick<ProjectFile,'components'|'params'>=>({components,params});

describe('P7 bounded worker-authoritative transport clearance',()=>{
 it('rejects new near-identical same-type, same-direction co-located rollers',()=>{
  const before=scene([part('a','roller-conveyor',455,225)]);
  const after=scene([...before.components,part('b','roller-conveyor',456,225)]);
  const invalid=firstNewCarrierSuperposition(before,after);
  expect(invalid).toMatchObject({first:'a',second:'b',kind:'roller-conveyor'});
  expect(carrierSuperpositionError(invalid!)).toMatch(/Refused duplicate/);
 });
 it('allows the practical partial overlaps required by P3 conveyor handoffs',()=>{
  const before=scene([part('a','roller-conveyor',455,225)]);
  expect(firstNewCarrierSuperposition(before,scene([
   ...before.components,part('b','roller-conveyor',500,225),
  ]))).toBeNull();
  expect(firstNewCarrierSuperposition(before,scene([
   ...before.components,part('turn','turntable',455,225),
  ]))).toBeNull();
 });
 it('allows intentionally crossed 90 degree transports and different kinds',()=>{
  const before=scene([part('a','roller-conveyor',455,225)]);
  expect(firstNewCarrierSuperposition(before,scene([
   ...before.components,part('b','roller-conveyor',455,225,90),
  ]))).toBeNull();
  expect(firstNewCarrierSuperposition(before,scene([
   ...before.components,part('belt','belt-conveyor',455,225),
  ]))).toBeNull();
 });
 it('sensor mounting on the conveyor is not a transport collision',()=>{
  const before=scene([part('a','roller-conveyor',455,225)]);
  expect(firstNewCarrierSuperposition(before,scene([
   ...before.components,part('eye','geometry-photoeye',455,225),
  ]))).toBeNull();
 });
 it('an unchanged historic duplicate pair does not block unrelated edits',()=>{
  const before=scene([part('a','roller-conveyor',455,225),
   part('b','roller-conveyor',455,225)]);
  expect(superposedCarrierPairs(before)).toHaveLength(1);
  const after=scene([...before.components,part('light','lamp',600,320)]);
  expect(firstNewCarrierSuperposition(before,after)).toBeNull();
 });
 it('blocks moving an existing machine into a new near-total overlap',()=>{
  const before=scene([part('a','roller-conveyor',455,225),
   part('b','roller-conveyor',555,225)]);
  const next=scene([before.components[0],{...before.components[1],x:455}]);
  expect(firstNewCarrierSuperposition(before,next)?.second).toBe('b');
  expect(firstNewCarrierSuperposition(next,before)).toBeNull();
 });
 it('saves dimensions and yaw in clearance decisions without mutating model',()=>{
  const before=scene([part('a','roller-conveyor',455,225,90)],
   {a:{lengthMm:1800,widthMm:250}});
  const next=scene([...before.components,part('b','roller-conveyor',455,225,90)],
   {a:{lengthMm:1800,widthMm:250},b:{lengthMm:1800,widthMm:250}});
  const original=JSON.stringify({before,next});
  expect(firstNewCarrierSuperposition(before,next)).not.toBeNull();
  expect(JSON.stringify({before,next})).toBe(original);
 });
});
