/**
 * Ten ORIGINAL equipment arrangements, not imported commercial scenes.
 * Each provides equipment, expected tag/wiring names and an illustrative ST
 * controller. The host adapter must validate actual mapped PLC terminal wires;
 * a reference program is NOT a pre-programmed physics animation.
 */
import type {EquipmentPlacement} from '../world/types';
import {PLANT_EQUIPMENT} from '../equipment';
import {validatePlacements} from '../world/runner';
export type SceneLink={source:string;target:string;kind:'bool'|'number'};
export type PlantScene={id:string;title:string;description:string;seed:number;
 equipment:EquipmentPlacement[];recommendedLinks:SceneLink[];
 referenceST:string;acceptance:string};
const pos=(id:string,kind:string,x:number,y:number,z=0,params:Record<string,number>={}):EquipmentPlacement=>
 ({id,kind,originMm:{x,y,z},yawDeg:0,params});
const input=(id:string,signal:string,to:string):SceneLink=>({source:id+'.'+signal,target:'PLC.'+to,kind:'bool'});
const drive=(from:string,id:string,command:string):SceneLink=>({source:'PLC.'+from,target:id+'.'+command,kind:'bool'});
const numeric=(id:string,signal:string,to:string):SceneLink=>({source:id+'.'+signal,target:'PLC.'+to,kind:'number'});
const ST=(inputNames:string[],outputs:string[],logic:string):string=>[
 'VAR_INPUT',...inputNames.map(v=>'  '+v+' : '+(v.endsWith('Value')?'REAL':'BOOL')+';'),'END_VAR',
 'VAR_OUTPUT',...outputs.map(v=>'  '+v+' : BOOL;'),'END_VAR',
 logic,
].join('\n');
export const SCENES:readonly PlantScene[]=[
 {id:'sorting-line',title:'Photoeye and diverting line',description:'Conveyor with geometry sensors and a reject gate',seed:11,
  equipment:[pos('feeder','box-feeder',-1500,0),pos('belt','belt-conveyor',0,0),pos('eye1','geometry-photoeye',-180,0),
   pos('eye2','geometry-photoeye',160,0),pos('gate','diverter-gate',280,0)],
  recommendedLinks:[input('eye1','present','Detected'),drive('Run','belt','run'),drive('Reject','gate','reject')],
  referenceST:ST(['Enable','Detected'],['Run','Reject'],'Run := Enable; Reject := Run AND Detected;'),
  acceptance:'A marked or plain body should activate geometry detection; rejection depends on live PLC control'},
 {id:'gate-accumulation',title:'Stopper accumulation',description:'Belt, blocker and trailing body queue',seed:12,
  equipment:[pos('feeder','box-feeder',-1200,0),pos('belt','belt-conveyor',0,0),
   pos('stopper','stopper',260,0),pos('queue-eye','geometry-photoeye',0,0)],
  recommendedLinks:[input('queue-eye','present','Queue'),drive('Run','belt','run'),drive('Hold','stopper','extend')],
  referenceST:ST(['Enable','Queue'],['Run','Hold'],'Run := Enable; Hold := Queue;'),
  acceptance:'An extended blocker stops the front body, and a trailing body queues rather than crossing it'},
 {id:'weigh-reject',title:'Weigh and pusher reject',description:'Mass threshold drives a real pusher',seed:13,
  equipment:[pos('feeder','box-feeder',-1000,0),pos('belt','belt-conveyor',0,0),
   pos('weight','weigh-cell',200,0),pos('pusher','pusher',310,0)],
  recommendedLinks:[numeric('weight','weightKg','WeightValue'),drive('Reject','pusher','extend')],
  referenceST:ST(['WeightValue'],['Reject'],'Reject := WeightValue > 12.0;'),
  acceptance:'Overweight bodies produce numeric kg readings and the commanded pusher moves the body'},
 {id:'two-level-lift',title:'Two-level lift transfer',description:'Transport between two fixed elevations',seed:14,
  equipment:[pos('in','roller-conveyor',-700,0),pos('lift','lift',0,0),
    pos('out','roller-conveyor',700,0,1000)],
  recommendedLinks:[drive('Raise','lift','up'),input('lift','top','AtTop')],
  referenceST:ST(['Go','AtTop'],['Raise'],'Raise := Go AND NOT AtTop;'),
  acceptance:'The platform takes several simulated scans to reach the top and raises supported bodies'},
 {id:'gantry-transfer',title:'Gantry pick and place',description:'Feeder, two-axis gripper and outbound belt',seed:15,
  equipment:[pos('feeder','box-feeder',-700,0),pos('gantry','pick-and-place',0,0),
   pos('out','belt-conveyor',650,0)],
  recommendedLinks:[input('gantry','partHeld','Holding'),drive('Grip','gantry','grip')],
  referenceST:ST(['Pick','Holding'],['Grip'],'Grip := Pick AND NOT Holding;'),
  acceptance:'Only a body within gripping range attaches and follows deterministic X/Z coordinates'},
 {id:'palletizing',title:'Layer palletizing',description:'Stack pattern, count and completion feedback',seed:16,
  equipment:[pos('feeder','box-feeder',-900,0),pos('belt','belt-conveyor',-400,0),
   pos('palletizer','palletizer',300,0),pos('exit','roller-conveyor',1100,0)],
  recommendedLinks:[input('palletizer','patternDone','Done'),drive('Pick','palletizer','pick'),
   drive('Place','palletizer','place')],
  referenceST:ST(['Start','Done'],['Pick','Place'],'Pick := Start AND NOT Done; Place := Done;'),
  acceptance:'A placed body has a distinct pallet-pattern location; the count follows actual transfers'},
 {id:'mini-warehouse',title:'3x5 mini warehouse',description:'Rack, crane and inbound/outbound conveyors',seed:17,
  equipment:[pos('in','belt-conveyor',-1200,0),pos('rack','shelf',400,0),
   pos('crane','asrs-crane',150,0),pos('out','belt-conveyor',1200,0)],
  recommendedLinks:[drive('Store','crane','store'),drive('Retrieve','crane','retrieve'),
   input('crane','bayOccupied','Occupied')],
  referenceST:ST(['Command','Occupied'],['Store','Retrieve'],
   'Store := Command AND NOT Occupied; Retrieve := NOT Command AND Occupied;'),
  acceptance:'The rack models 15 bays and cannot silently duplicate bodies when storing/retrieving'},
 {id:'robot-sort',title:'Robot sort and place',description:'Arm, sensors and two receiving areas',seed:18,
  equipment:[pos('feeder','box-feeder',-700,0),pos('eye','inductive-prox',-200,0),
   pos('robot','robot-arm',0,0),pos('out','belt-conveyor',800,0)],
  recommendedLinks:[input('eye','present','Metal'),drive('Grip','robot','grip')],
  referenceST:ST(['Metal'],['Grip'],'Grip := Metal;'),
  acceptance:'The arm respects its finite workspace; colliding/unreachable targets inhibit motion'},
 {id:'mixing-tank',title:'Temperature and level mixing',description:'Vessel, mixer, heater, proportional valve',seed:19,
  equipment:[pos('tank','process-tank',0,0),pos('mixer','mixer',180,0),
    pos('heater','heater',-200,0),pos('valve','proportional-valve',350,0)],
  recommendedLinks:[numeric('tank','levelMl','LevelValue'),numeric('heater','temperatureC','TempValue'),
    drive('Mix','mixer','run')],
  referenceST:ST(['Start','TempValue','LevelValue'],['Mix'],
   'Mix := Start AND TempValue < 70.0 AND LevelValue > 500.0;'),
  acceptance:'The liquid level and temperature follow commanded first-order process models'},
 {id:'bottle-line',title:'Bottle filling and capping',description:'Counter, stopper, timed filler and capper',seed:20,
  equipment:[pos('feeder','box-feeder',-1200,0),pos('belt','belt-conveyor',0,0),
   pos('eye','geometry-photoeye',-150,0),pos('stopper','stopper',160,0),
   pos('filler','filler',200,0),pos('capper','capper',400,0)],
  recommendedLinks:[input('eye','present','Bottle'),drive('Fill','filler','fill'),drive('Cap','capper','cap')],
  referenceST:ST(['Start','Bottle'],['Fill','Cap'],'Fill := Start AND Bottle; Cap := Fill;'),
  acceptance:'Bottles fill through genuine dwell/flow and only receive a cap after capper action'},
];
for(const scene of SCENES)validatePlacements(scene.equipment,PLANT_EQUIPMENT);
export const findScene=(id:string):PlantScene|undefined=>SCENES.find(s=>s.id===id);
