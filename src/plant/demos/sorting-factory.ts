/**
 * Demonstration A: automated sorting factory. Two feeders put metal workpieces and small cartons on one belt in mixed order.
 * An inductive proximity sensor tells the PLC (Structured Text) when a metal part is in front of a powered transfer unit; the
 * PLC commands the transfer, which pushes only that part sideways onto a short belt into the reject bin, while cartons ride
 * straight on to the good bin. Each bin accepts only its own material, so a mis-sort stays visible on the floor.
 */
import {MATERIALS} from '../world/materials';
import {DemoBuilder} from './builder';
import type {ProjectFile} from '../../sim/signals';

const index=(id:string)=>MATERIALS.findIndex(m=>m.id===id)+1;
export const SORTING_FACTORY_ST=`VAR_INPUT
  MetalAtGate : BOOL;
END_VAR
VAR_OUTPUT
  MainBelt : BOOL;
  GateRun : BOOL;
  Divert : BOOL;
  SideBelt : BOOL;
  FeedMetal : BOOL;
  FeedBoxes : BOOL;
END_VAR
MainBelt := TRUE;
GateRun := TRUE;
SideBelt := TRUE;
FeedMetal := TRUE;
FeedBoxes := TRUE;
Divert := MetalAtGate;`;
export const SORTING_PARTS_PER_KIND=4;

/** Layout (mm): feeders -1000 (metal) and -400 (cartons, 600 mm ahead so a carton is never at the gate with a metal part) | main belt -1100..-100 | sensor -90 | transfer unit -100..300 | out belt 300..1300 | side belt up +y | good bin 1500, reject bin (100, 1000). */
export function sortingFactoryDemo():ProjectFile{
 const b=new DemoBuilder();
 b.place('feed-metal','box-feeder',-1000,0,{rateMs:2600,quantity:SORTING_PARTS_PER_KIND,materialId:index('metal-workpiece')})
  .place('feed-box','box-feeder',-400,0,{rateMs:2600,quantity:SORTING_PARTS_PER_KIND,materialId:index('carton-small')})
  .place('main','belt-conveyor',-600,0,{lengthMm:1000,speedMmS:300})
  .place('gate','transfer-unit',100,0,{lengthMm:400,widthMm:300,speedMmS:300,transferAngleDeg:90})
  .place('out','belt-conveyor',800,0,{lengthMm:1000,speedMmS:300})
  .place('side','belt-conveyor',100,480,{lengthMm:600,speedMmS:300},90)
  .place('sense','inductive-prox',-90,0,{rangeMm:250,responseMs:0})
  .place('good-bin','collector',1500,0,{acceptMaterial:index('carton-small')})
  .place('reject-bin','collector',100,950,{acceptMaterial:index('metal-workpiece')});
 b.sense('sense','present',0,'MetalAtGate')
  .drive(0,'main','run','MainBelt').drive(1,'gate','run','GateRun').drive(2,'gate','transfer','Divert')
  .drive(3,'side','run','SideBelt').drive(4,'feed-metal','enable','FeedMetal').drive(5,'feed-box','enable','FeedBoxes')
  .drive(6,'out','run','OutBelt')
  .hardEnable('good-bin','enable').hardEnable('reject-bin','enable');
 return b.build(SORTING_FACTORY_ST.replace('SideBelt : BOOL;','SideBelt : BOOL;\n  OutBelt : BOOL;').replace('SideBelt := TRUE;','SideBelt := TRUE;\nOutBelt := TRUE;'));
}
