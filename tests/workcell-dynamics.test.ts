import {describe,it,expect} from 'vitest';
import {defaultLayout} from '../src/engineering/workcell-layout';
import {loadWorkcellPreset} from '../src/engineering/workcell-presets';
import {updateEquipment,validateLayout,serializeLayout,parseLayout,stepWorkcell,initialScan,defaultDynamics} from '../src/engineering/workcell-layout';
describe('user-tuned motion and coupled virtual fluid dynamics',()=>{
 it('requires bounded numeric rise/return tuning and rejects tampered dynamics',()=>{
  const layout=loadWorkcellPreset('vertical-transfer').layout;
  for(const dynamics of [{riseMs:0,fallMs:1000},{riseMs:1000,fallMs:121000},{riseMs:100.5,fallMs:1000},{riseMs:1000,fallMs:NaN}]){
   expect(()=>updateEquipment(layout,'lf3',{dynamics})).toThrow(/dynamics/);
  }
  expect(()=>updateEquipment(layout,'pe3',{dynamics:{riseMs:100,fallMs:100}})).toThrow(/dynamics/);
  expect(defaultDynamics('vfd')).toEqual({riseMs:2600,fallMs:3400});
 });
 it('user-configured motion time actually changes virtual device travel',()=>{
  const original=loadWorkcellPreset('vertical-transfer').layout;
  const faster=updateEquipment(original,'lf3',{dynamics:{riseMs:500,fallMs:500}});
  const normal=stepWorkcell(original,initialScan(),{lf3:true},100);
  const tuned=stepWorkcell(faster,initialScan(),{lf3:true},100);
  expect(tuned.devices.lf3.value).toBeGreaterThan(normal.devices.lf3.value);
  expect(tuned.devices.lf3.value).toBeCloseTo(.2,5);
  expect(original.equipment.find(x=>x.id==='lf3')?.dynamics).toBeUndefined();
  const encoded=serializeLayout(faster);
  expect(parseLayout(encoded)).toEqual(faster);
  let s=tuned;
  for(let i=0;i<10;i++)s=stepWorkcell(faster,s,{lf3:false},100);
  expect(s.devices.lf3.value).toBe(0);
 });
 it('tanks cannot fill with pump stopped or valve closed, and filling follows valve travel',()=>{
  const scene=loadWorkcellPreset('process-skid').layout;
  let scan=initialScan();
  scan=stepWorkcell(scene,scan,{tk4:true,pm4:false,vl4:true},100);
  expect(scan.devices.tk4.value).toBe(0);
  scan=stepWorkcell(scene,scan,{tk4:true,pm4:true,vl4:false},100);
  expect(scan.devices.tk4.value).toBe(0);
  scan=stepWorkcell(scene,scan,{tk4:true,pm4:true,vl4:true},100);
  expect(scan.devices.tk4.value).toBe(0);
  scan=stepWorkcell(scene,scan,{tk4:true,pm4:true,vl4:true},100);
  expect(scan.devices.tk4.value).toBeGreaterThan(0);
  const prior=scan.devices.tk4.value;
  scan=stepWorkcell(scene,scan,{tk4:true,pm4:false,vl4:true},100);
  expect(scan.devices.tk4.value).toBeLessThan(prior);
 });
 it('preserves old unconfigured scene behavior and rejects unknown dynamic fields',()=>{
  expect(validateLayout(defaultLayout())).toEqual(defaultLayout());
  const layout=loadWorkcellPreset('vertical-transfer').layout;
  expect(()=>validateLayout({...layout,equipment:layout.equipment.map(item=>item.id==='lf3'?{...item,dynamics:{riseMs:1000,fallMs:1000,hidden:'unknown'}}:item)})).toThrow(/dynamics/);
 });
});
