/**
 * Demonstration F: human interaction and troubleshooting (a safety-TRAINING cell, not a safety function). A belt line runs inside a
 * fenced area with an interlocked guard door and a restricted work zone. A simulated operator walks to the door; the PLC stops
 * the line when access is requested, opens the door after a coast-down delay, keeps the line stopped while the zone is occupied
 * or an intrusion is latched, and restarts only when the door is closed and the zone is clear. Faults (a welded door interlock, a
 * dead zone sensor) can be injected to show how each layer failing leaves the line running with a person inside.
 */
import {MATERIALS} from '../world/materials';
import {DemoBuilder} from './builder';
import type {ProjectFile} from '../../sim/signals';

const index=(id:string)=>MATERIALS.findIndex(m=>m.id===id)+1;
export const HUMAN_CELL_ST=`VAR_INPUT
  DoorClosed : BOOL;
  ZoneOccupied : BOOL;
  ZoneIntrusion : BOOL;
  AccessReq : BOOL;
END_VAR
VAR_OUTPUT
  Belt : BOOL;
  Feed : BOOL;
  OpenDoor : BOOL;
  ResetZone : BOOL;
END_VAR
VAR
  coast : TON;
  Safe : BOOL;
END_VAR
Safe := DoorClosed AND NOT ZoneOccupied AND NOT ZoneIntrusion AND NOT AccessReq;
Belt := Safe;
Feed := Safe;
coast(IN := AccessReq, PT := T#1500ms);
OpenDoor := coast.Q;
ResetZone := DoorClosed AND NOT ZoneOccupied AND NOT AccessReq;`;

/** Floor layout (mm): belt y=0 (x -900..900); zone y -1100..-300; fence y=-1200 with the 800 mm door at x=0; operator starts outside at y=-2000. */
export function humanInteractionDemo():ProjectFile{
 const b=new DemoBuilder();
 b.place('feeder','box-feeder',-800,0,{rateMs:1800,materialId:index('carton-small')})
  .place('belt','belt-conveyor',0,0,{lengthMm:1800,speedMmS:300})
  .place('bin','collector',1300,0)
  .place('zone','work-zone',0,-700,{lengthMm:1800,widthMm:800,restricted:1})
  .place('fence-w','safety-fence',-900,-1200,{lengthMm:1000,widthMm:100})
  .place('fence-e','safety-fence',900,-1200,{lengthMm:1000,widthMm:100})
  .place('door','guard-door',0,-1200,{lengthMm:800,widthMm:100,travelMs:1500})
  .place('hmi','operator-station',-1500,-1500);
 b.sense('door','closed',0,'DoorClosed').sense('zone','occupied',1,'ZoneOccupied').sense('zone','intrusion',2,'ZoneIntrusion').sense('hmi','start',3,'AccessReq')
  .drive(0,'belt','run','Belt').drive(1,'feeder','enable','Feed').drive(2,'door','open','OpenDoor').drive(3,'zone','reset','ResetZone')
  .hardEnable('bin','enable');
 return b.build(HUMAN_CELL_ST);
}
