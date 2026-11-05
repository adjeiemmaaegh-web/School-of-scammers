/** Ready-to-run, offline deterministic virtual factory scenes.
 * These are bounded teaching models, not reference industrial equipment.
 */
import {defaultLayout,validateLayout,type Equipment,type WorkcellLayout} from './workcell-layout';
import {validateLadder,type LadderDocument,type Contact,type Rung} from './ladder';
import {DEMO_WORKCELL_PROGRAM} from './workcell-plc';

export type WorkcellPresetId='conveyor-sort'|'packaging-cell'|'vertical-transfer'|'process-skid';
export type WorkcellPreset={id:WorkcellPresetId;title:string;description:string;layout:WorkcellLayout;program:LadderDocument};
const equipment=(id:string,kind:Equipment['kind'],label:string,tag:string,x:number,z:number,rotation:Equipment['rotation']=0):Equipment=>({id,kind,label,tag,x,z,rotation});
const scene=(name:string,items:Equipment[]):WorkcellLayout=>({format:'plc-skills-workcell',schemaVersion:1,name,equipment:items});
const contact=(tag:string):Contact=>({type:'contact',tag});
const rung=(id:string,coil:string,sensor:string):Rung=>({
 id,coil,elements:['AutoEnable','EStopOK','GuardClosed',sensor+'_ACTIVE'].map(contact)
});
const program=(id:string,sensor:string,...outputs:readonly string[]):LadderDocument=>({
 id,version:'1.0.0',rungs:outputs.map((coil,i)=>rung('drive-'+(i+1),coil,sensor))
});
const configured:readonly WorkcellPreset[]=[
 {
 id:'conveyor-sort',title:'Conveyor sorter commissioning',
 description:'Entry photoeye triggers the conveyor and diverter with guard and E-stop modeled interlocks.',
 layout:defaultLayout(),program:DEMO_WORKCELL_PROGRAM
 },
 {
 id:'packaging-cell',title:'Packaging pusher and conveyor',
 description:'Proximity detection starts a conveyor, pushes a carton and illuminates a beacon.',
 layout:scene('Packaging cell',[
 equipment('cv2','conveyor','Packaging belt','CV2',-3,0),
 equipment('px2','proximity','Part-present inductive sensor','PX2',-1,-2),
 equipment('ps2','pusher','Pack eject pusher','PS2',0,0),
 equipment('lt2','indicator','Pack signal beacon','LT2',2,0),
 equipment('fn2','fence','Isolation barrier','FN2',1,-2),
 equipment('cp2','control-panel','Operator panel','CP2',-3,2)
 ]),
 program:program('packaging-cell-v1','PX2','CV2_CMD','PS2_CMD','LT2_CMD')
 },
 {
 id:'vertical-transfer',title:'Lift and variable-speed drive',
 description:'A virtual photoeye enables a ramping drive, positioning lift and transfer valve.',
 layout:scene('Vertical transfer cell',[
 equipment('pe3','photoeye','Pallet approach sensor','PE3',-2,-2),
 equipment('lf3','lift','Vertical hoist','LF3',0,0),
 equipment('vf3','vfd','Variable-speed transfer drive','VF3',-2,0),
 equipment('vl3','valve','Transfer valve','VL3',2,0),
 equipment('lt3','indicator','Transfer beacon','LT3',2,2),
 equipment('cp3','control-panel','Transfer control cabinet','CP3',0,3)
 ]),
 program:program('vertical-transfer-v1','PE3','LF3_CMD','VF3_CMD','VL3_CMD','LT3_CMD')
 },
 {
 id:'process-skid',title:'Process tank and valve skid',
 description:'Sensor-triggered pump, valve and tower light with a bounded simulated filling tank.',
 layout:scene('Tank filling and valve skid',[
 equipment('tk4','tank','Buffer vessel','TK4',-2,0),
 equipment('pm4','pump','Transfer pump','PM4',-2,-2),
 equipment('vl4','valve','Fill valve','VL4',0,-2),
 equipment('pe4','photoeye','Demand sensor','PE4',2,-2),
 equipment('lt4','indicator','Run indicator','LT4',2,1),
 equipment('cp4','control-panel','Process control cabinet','CP4',0,2)
 ]),
 program:program('process-skid-v1','PE4','TK4_CMD','PM4_CMD','VL4_CMD','LT4_CMD')
 }
];
export const WORKCELL_PRESETS:readonly Readonly<Pick<WorkcellPreset,'id'|'title'|'description'>>[]=configured.map(({id,title,description})=>({id,title,description}));
export function loadWorkcellPreset(id:string):WorkcellPreset{
 const found=configured.find(x=>x.id===id);
 if(!found)throw new Error('Unknown workcell scenario');
 const layout=validateLayout(found.layout);
 const errors=validateLadder(found.program);
 if(errors.length)throw new Error('Invalid workcell scenario ladder: '+errors.join('; '));
 return {id:found.id,title:found.title,description:found.description,layout:structuredClone(layout),program:structuredClone(found.program)};
}
