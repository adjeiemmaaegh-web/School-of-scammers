/** Bounded teaching adapter from authored ladder rungs to editable virtual workcell I/O.
 * Scans sample previous device feedback, execute ladder, then advance simulated plant.
 * Not intended for physical equipment, hardware safety interlocks, or IEC conformity.
 */
import {executeLadder,validateLadder,type LadderDocument,type LadderMemory,type LadderStep} from './ladder';
import {deviceSignals,initialScan,stepWorkcell,validateLayout,type WorkcellLayout,type WorkcellScan} from './workcell-layout';
import {initialMaterialFlow,sampleMaterialSensors,stepMaterialFlow,type MaterialFlowState} from './workcell-material';

export type OperatorPanel={EStopOK:boolean;GuardClosed:boolean;AutoEnable:boolean};
export const DEFAULT_OPERATOR_PANEL:OperatorPanel={EStopOK:true,GuardClosed:true,AutoEnable:true};
export type WorkcellPlcState={plant:WorkcellScan;outputs:Readonly<Record<string,boolean>>;memory:LadderMemory;trace:readonly LadderStep[];material:MaterialFlowState};
export function initialWorkcellPlcState():WorkcellPlcState{return {plant:initialScan(),outputs:{},memory:{},trace:[],material:initialMaterialFlow()};}

/** Device output naming is explicit: PLC coil TAG_CMD controls a device, TAG_ACTIVE reports action feedback. */
export function stepWorkcellPlc(layout:WorkcellLayout,program:LadderDocument,previous:WorkcellPlcState,operator:OperatorPanel,fieldInputs:Readonly<Record<string,boolean>>={},deltaMs=100,options?:{materialFlow?:boolean}):WorkcellPlcState{
 const valid=validateLayout(layout);
 if(!operator||typeof operator.EStopOK!=='boolean'||typeof operator.GuardClosed!=='boolean'||typeof operator.AutoEnable!=='boolean')throw TypeError('Invalid operator panel');
 if(!Array.isArray(program?.rungs)||program.rungs.length>200)throw RangeError('Invalid or oversized PLC program');
 const errors=validateLadder(program);
 if(errors.length)throw Error('Invalid PLC document: '+errors.join('; '));
 const autoSensors=options?.materialFlow===true?sampleMaterialSensors(valid,previous.material):null;
 const sensorInputs:Readonly<Record<string,boolean>>=autoSensors?{...fieldInputs,...autoSensors}:fieldInputs;
 const inputValues:Record<string,boolean|number>={...deviceSignals(valid,previous.plant)};
 for(const device of valid.equipment){
  if(device.kind==='photoeye'||device.kind==='proximity'||device.kind==='control-panel')inputValues[device.tag+'_ACTIVE']=sensorInputs[device.id]===true;
 }
 inputValues.EStopOK=operator.EStopOK;
 inputValues.GuardClosed=operator.GuardClosed;
 inputValues.AutoEnable=operator.AutoEnable;
 const result=executeLadder(program,inputValues,previous.outputs,previous.memory,deltaMs);
 const permit=operator.EStopOK&&operator.GuardClosed&&operator.AutoEnable;
 const commands:Record<string,boolean>={};
 for(const device of valid.equipment){
  commands[device.id]=device.kind==='photoeye'||device.kind==='proximity'||device.kind==='control-panel'?
   sensorInputs[device.id]===true:
   permit&&result.outputs[device.tag+'_CMD']===true;
 }
 return {
  plant:stepWorkcell(valid,previous.plant,commands,deltaMs),
  material:options?.materialFlow===true?stepMaterialFlow(valid,previous.material,previous.plant,commands,deltaMs):previous.material,
  outputs:{...result.outputs},
  memory:result.memory,
  trace:result.steps
 };
}
export const DEMO_WORKCELL_PROGRAM:LadderDocument={
 id:'workcell-auto-demo',version:'1',rungs:[
  {id:'drive-conveyor',elements:[
   {type:'contact',tag:'AutoEnable'},
   {type:'contact',tag:'EStopOK'},
   {type:'contact',tag:'GuardClosed'},
   {type:'contact',tag:'PE1_ACTIVE'}
  ],coil:'CV1_CMD'},
  {id:'extend-diverter',elements:[
   {type:'contact',tag:'AutoEnable'},
   {type:'contact',tag:'EStopOK'},
   {type:'contact',tag:'GuardClosed'},
   {type:'contact',tag:'PE1_ACTIVE'}
  ],coil:'CY1_CMD'}
 ]};
