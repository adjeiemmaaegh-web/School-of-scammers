import {describe,it,expect} from 'vitest';
import {initialPatchBench,inspectPatchBench,patchWire,setPatchSupply,setPatchSwitch,setPatchFuse,
 measurePatchVoltage,measurePatchContinuity,patchEvidenceCsv,PATCH_PORTS} from '../src/engineering/patch-bench';

describe('bounded virtual 24V patch wiring and meter lab',()=>{
 it('starts with supply isolated, broken return, and lamp off',()=>{
  const s=initialPatchBench();
  expect(s.supplyOn).toBe(false);expect(inspectPatchBench(s).lampOn).toBe(false);expect(s.links).toHaveLength(3);
 });
 it('completes a loop with a return wire and switched 24V lamp',()=>{
  let s=initialPatchBench();s=patchWire(s,'PSU-','H1:-',true);
  s=setPatchSwitch(s,true);s=setPatchSupply(s,true);
  expect(inspectPatchBench(s).lampOn).toBe(true);
  expect(measurePatchVoltage(s,'H1:+','H1:-')).toBe(24);
  s=setPatchSwitch(s,false);expect(inspectPatchBench(s).lampOn).toBe(false);
 });
 it('reports floating potential rather than inventing a measurement',()=>{
  let s=initialPatchBench();s=setPatchSupply(s,true);
  expect(measurePatchVoltage(s,'H1:+','PSU-')).toBeNull();
 });
 it('short circuit isolates simulated power and opens fuse instead of energizing lamp',()=>{
  let s=patchWire(initialPatchBench(),'PSU+','PSU-',true);
  s=setPatchSupply(s,true);
  expect(s.trips).toBe(1);expect(s.supplyOn).toBe(false);expect(s.fuseClosed).toBe(false);
  expect(inspectPatchBench(s).lampOn).toBe(false);
  expect(s.events.join(' ')).toMatch(/SIMULATED SHORT/);
 });
 it('requires isolation to reset fuse or rewire circuits',()=>{
  const powered=setPatchSupply(initialPatchBench(),true);
  expect(()=>patchWire(powered,'PSU-','H1:-',true)).toThrow(/Isolate/);
  expect(()=>setPatchFuse(powered,true)).toThrow(/Isolate/);
 });
 it('validates wires and is independent of end-point ordering',()=>{
  let s=initialPatchBench();s=patchWire(s,'PSU-','H1:-',true);
  expect(()=>patchWire(s,'H1:-','PSU-',true)).toThrow(/Duplicate/);
  s=patchWire(s,'H1:-','PSU-',false);
  expect(s.links).toHaveLength(3);
  expect(()=>patchWire(s,'PSU+','PSU+',true)).toThrow(/Invalid/);
  expect(()=>patchWire(s,'BAD' as any,'PSU+',true)).toThrow(/Invalid/);
 });
 it('continuity is only measured under isolation and does not model a load as a short',()=>{
  const s=initialPatchBench();
  expect(measurePatchContinuity(s,'PSU+','F1:OUT')).toBe(true);
  expect(measurePatchContinuity(s,'PSU+','S1:OUT')).toBe(false);
  expect(()=>measurePatchContinuity(setPatchSupply(s,true),'PSU+','F1:IN')).toThrow(/disabled/);
 });
 it('treats open fuse as a real break in the modeled signal path',()=>{
  let s=patchWire(initialPatchBench(),'PSU-','H1:-',true);
  s=setPatchSwitch(s,true);
  s=setPatchFuse(s,false);
  s=setPatchSupply(s,true);
  expect(inspectPatchBench(s).lampOn).toBe(false);
  expect(inspectPatchBench(s).diagnostics).toContain('Fuse F1 is open');
 });
 it('preserves source state and exports bounded, escaped evidence',()=>{
  const source=initialPatchBench();
  const modified=patchWire(source,'PSU-','H1:-',true);
  expect(source.links).toHaveLength(3);
  expect(modified.links).toHaveLength(4);
  expect(patchEvidenceCsv(modified)).toContain('CONNECTED PSU-');
  expect(PATCH_PORTS).toHaveLength(8);
 });
});