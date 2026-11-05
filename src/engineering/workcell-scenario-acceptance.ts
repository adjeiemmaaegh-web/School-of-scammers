/** Machine-linked teaching factory acceptance tests from actual simulated scan results.
 * Tests are not a field certification and do not validate hardware or vendor control.
 */
import {loadWorkcellPreset,type WorkcellPresetId} from './workcell-presets';
import {deviceSignals} from './workcell-layout';
import {DEFAULT_OPERATOR_PANEL,initialWorkcellPlcState,stepWorkcellPlc,type OperatorPanel,type WorkcellPlcState} from './workcell-plc';

export interface ScenarioAcceptanceCriterion {
 id:string;description:string;passed:boolean;observed:string;
}
export interface ScenarioAcceptanceReport {
 id:WorkcellPresetId;title:string;passed:boolean;checks:readonly ScenarioAcceptanceCriterion[];
 scanCount:number;simulatedMs:number;trace:readonly {phase:string;timeMs:number;coils:Readonly<Record<string,boolean>>;feedback:Readonly<Record<string,boolean|number>>}[];
}
export function runScenarioAcceptance(id:WorkcellPresetId):ScenarioAcceptanceReport{
 const preset=loadWorkcellPreset(id),layout=preset.layout,program=preset.program;
 const sensor=layout.equipment.find(x=>x.kind==='photoeye'||x.kind==='proximity');
 if(!sensor)throw new Error('Commissioning scenario requires a field detection sensor');
 const outputs=program.rungs.map(r=>r.coil);
 const driven=new Set(outputs.filter(x=>x.endsWith('_CMD')).map(x=>x.slice(0,-4)));
 const actuators=layout.equipment.filter(x=>driven.has(x.tag));
 const checks:ScenarioAcceptanceCriterion[]=[];
 const add=(name:string,description:string,passed:boolean,observed:string)=>checks.push({id:name,description,passed,observed});
 const rows:ScenarioAcceptanceReport['trace'][number][]=[];
 let current:WorkcellPlcState=initialWorkcellPlcState();
 let count=0;
 function apply(label:string,panel:OperatorPanel,input:boolean){
  current=stepWorkcellPlc(layout,program,current,panel,{[sensor.id]:input},100);
  count++;
  const feedback=deviceSignals(layout,current.plant);
  rows.push({phase:label,timeMs:current.plant.timeMs,coils:{...current.outputs},feedback:{...feedback}});
  return current;
 }
 let s=apply('Safe startup, no product',DEFAULT_OPERATOR_PANEL,false);
 add('idle','Input inactive keeps all authored actuator coils off',
  outputs.every(coil=>s.outputs[coil]===false),'Coils: '+outputs.map(x=>x+'='+s.outputs[x]).join(', '));
 s=apply('Sensor active',DEFAULT_OPERATOR_PANEL,true);
 add('detect','Field sensor appears in executed PLC scan and all requested outputs energize',
  outputs.every(coil=>s.outputs[coil]===true)&&actuators.every(device=>s.plant.devices[device.id]?.active===true),
  'Active devices: '+actuators.filter(device=>s.plant.devices[device.id]?.active).map(x=>x.tag).join(', '));
 s=apply('Guard opened',{...DEFAULT_OPERATOR_PANEL,GuardClosed:false},true);
 add('guard','Guard-open inhibits all simulated actuator motion despite active sensor',
  actuators.every(device=>s.plant.devices[device.id]?.active===false),'GuardClosed=FALSE; active actuators='+actuators.filter(device=>s.plant.devices[device.id]?.active).length);
 s=apply('Sensor removed, guard restored',DEFAULT_OPERATOR_PANEL,false);
 add('reset','Restoring guard with sensor removed does not automatically re-energize outputs',
  outputs.every(coil=>s.outputs[coil]===false)&&actuators.every(device=>!s.plant.devices[device.id]?.active),
  'Outputs energized='+outputs.filter(coil=>s.outputs[coil]).length);
 s=apply('E-stop open',{...DEFAULT_OPERATOR_PANEL,EStopOK:false},true);
 add('estop','E-stop inhibits actuator commands even when field sensor remains active',
  actuators.every(device=>s.plant.devices[device.id]?.active===false),
  'EStopOK=FALSE; active actuators='+actuators.filter(device=>s.plant.devices[device.id]?.active).length);
 s=apply('E-stop released, sensor removed',DEFAULT_OPERATOR_PANEL,false);
 add('recover','Operator input reset and field sensor removed return coils to safe idle',
  outputs.every(coil=>s.outputs[coil]===false)&&actuators.every(device=>!s.plant.devices[device.id]?.active),
  'Outputs energized='+outputs.filter(coil=>s.outputs[coil]).length);
 add('time','Simulated PLC clock advances by exactly one 100 ms scan per step',
  s.plant.timeMs===count*100,'Elapsed '+s.plant.timeMs+' ms for '+count+' scans');
 const deterministic=(()=>{
  let previous=initialWorkcellPlcState();
  for(const entry of [
    {panel:DEFAULT_OPERATOR_PANEL,input:false},
    {panel:DEFAULT_OPERATOR_PANEL,input:true},
    {panel:{...DEFAULT_OPERATOR_PANEL,GuardClosed:false},input:true},
    {panel:DEFAULT_OPERATOR_PANEL,input:false},
    {panel:{...DEFAULT_OPERATOR_PANEL,EStopOK:false},input:true},
    {panel:DEFAULT_OPERATOR_PANEL,input:false}
  ])previous=stepWorkcellPlc(layout,program,previous,entry.panel,{[sensor.id]:entry.input},100);
  return JSON.stringify(previous)===JSON.stringify(s);
 })();
 add('replay','Exact same deterministic scan inputs reproduce identical final PLC/plant state',
  deterministic,'Deterministic replay '+(deterministic?'matched':'mismatched'));
 return {id:preset.id,title:preset.title,passed:checks.every(x=>x.passed),checks,scanCount:count,simulatedMs:s.plant.timeMs,trace:rows};
}
