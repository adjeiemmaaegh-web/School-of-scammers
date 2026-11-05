/** Integrated parcel-sorter exercise. Opt-in geometric sensor sampling only. */
import {validateLayout,type WorkcellLayout} from './workcell-layout';
import {validateLadder,type LadderDocument,type Rung} from './ladder';
const c=(tag:string)=>({type:'contact' as const,tag});
const logic=['AutoEnable','EStopOK','GuardClosed'];
const rung=(id:string,coil:string,extra:string):Rung=>({id,coil,elements:[...logic,extra].map(c)});
export const MATERIAL_LINE_LAYOUT:WorkcellLayout=validateLayout({
 format:'plc-skills-workcell',schemaVersion:1,name:'Parcel conveyor and sorter',
 equipment:[
  {id:'belt1',kind:'conveyor',label:'Infeed conveyor',tag:'BELT1',x:-2,z:0,rotation:0},
  {id:'beam1',kind:'photoeye',label:'Optical part-present gate',tag:'BEAM1',x:-2,z:-1,rotation:0},
  {id:'reject1',kind:'pusher',label:'Reject pusher',tag:'REJECT1',x:0,z:0,rotation:0},
  {id:'control1',kind:'control-panel',label:'Operator run switch',tag:'CONTROL1',x:-3,z:2,rotation:0},
  {id:'lamp1',kind:'indicator',label:'Sort indicator',tag:'LAMP1',x:1,z:1,rotation:0},
  {id:'barrier1',kind:'fence',label:'Training safety barrier',tag:'BARRIER1',x:-1,z:2,rotation:0}
 ]
});
export const MATERIAL_LINE_PROGRAM:LadderDocument={
 id:'parcel-material-sorter',version:'1.0.0',
 rungs:[
  rung('run-infeed','BELT1_CMD','CONTROL1_ACTIVE'),
  rung('reject-detected-part','REJECT1_CMD','BEAM1_ACTIVE'),
  rung('light-detected-part','LAMP1_CMD','BEAM1_ACTIVE')
 ]
};
if(validateLadder(MATERIAL_LINE_PROGRAM).length)throw new Error('Invalid supplied parcel sorting ladder exercise');
export function loadMaterialLineExercise(){
 return {layout:structuredClone(MATERIAL_LINE_LAYOUT),program:structuredClone(MATERIAL_LINE_PROGRAM),title:'Parcel conveyor and sorter'};
}
