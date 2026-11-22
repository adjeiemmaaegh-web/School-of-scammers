/**
 * Demonstration G: production line with a reject/rework branch. Raw workpieces are machined by a station that makes a share of defective
 * parts (a worn-tool style defect rate), inspected at an inspect station, and a PLC (Structured Text) latches the verdict. Passing parts
 * ride on to the good bin; a failed part is pushed sideways by a powered transfer unit onto a rework branch, held by a stopper at a rework
 * station that removes the defect, and collected separately. Part state and trace follow every part, so a rework is visible in its history
 * (`M:machine>I:inspect>R:rework`). Everything is ordinary placed equipment, real wiring and a real program.
 */
import {MATERIALS} from '../world/materials';
import {DemoBuilder} from './builder';
import type {ProjectFile} from '../../sim/signals';

const index=(id:string)=>MATERIALS.findIndex(m=>m.id===id)+1;
export const REJECT_REWORK_PARTS=6;
export const REJECT_REWORK_ST=`VAR_INPUT
  GateEye : BOOL;
  AtMachine : BOOL;
  MachineDone : BOOL;
  AtInspect : BOOL;
  InspectDone : BOOL;
  InspectFail : BOOL;
  AtRework : BOOL;
  ReworkDone : BOOL;
END_VAR
VAR_OUTPUT
  Feed : BOOL;
  MainBelt : BOOL;
  OutBelt : BOOL;
  SideBelt : BOOL;
  GateRun : BOOL;
  HoldMachine : BOOL;
  Machine : BOOL;
  HoldInspect : BOOL;
  Inspect : BOOL;
  Divert : BOOL;
  HoldRework : BOOL;
  Rework : BOOL;
END_VAR
VAR
  RejectNext : BOOL;
  gateLeft : F_TRIG;
END_VAR
Feed := TRUE;
MainBelt := TRUE;
OutBelt := TRUE;
SideBelt := TRUE;
GateRun := TRUE;
HoldMachine := NOT MachineDone;
Machine := AtMachine AND NOT MachineDone;
HoldInspect := NOT InspectDone;
Inspect := AtInspect AND NOT InspectDone;
IF InspectDone THEN RejectNext := InspectFail; END_IF;
gateLeft(CLK := GateEye);
IF gateLeft.Q THEN RejectNext := FALSE; END_IF;
Divert := GateEye AND RejectNext;
HoldRework := NOT ReworkDone;
Rework := AtRework AND NOT ReworkDone;`;

/** Layout (mm): feeder -1400 | machine -1000 (stopper -840) | inspect -300 (stopper -140) | gate eye 160 | transfer unit 350 | out belt 550..1550 | good bin 1700;
 * side branch down +y from the unit's entry edge (x 250, belt y 150..1550): rework station y 700 (stopper 860) | rework bin 1700. One part is in the cell at a time (feeder 7 s), so the latched verdict is unambiguous. */
export function rejectReworkDemo(defectPct=50):ProjectFile{
 const b=new DemoBuilder();
 b.place('feed','box-feeder',-1400,0,{rateMs:7000,quantity:REJECT_REWORK_PARTS,materialId:index('metal-workpiece')})
  .place('main','belt-conveyor',-675,0,{lengthMm:1650,speedMmS:300})
  .place('stop-m','stopper',-840,0).place('machine','process-station',-1000,0,{operation:1,cycleMs:1500,lengthMm:400,defectPct})
  .place('stop-i','stopper',-140,0).place('inspect','process-station',-300,0,{operation:4,cycleMs:800,lengthMm:400})
  .place('gate','transfer-unit',350,0,{lengthMm:400,widthMm:300,speedMmS:300,transferAngleDeg:90})
  .place('sense','inductive-prox',160,0,{rangeMm:250,responseMs:0})
  .place('out','belt-conveyor',1050,0,{lengthMm:1000,speedMmS:300})
  .place('good-bin','collector',1700,0)
  .place('side','belt-conveyor',250,850,{lengthMm:1400,speedMmS:300},90)
  .place('stop-r','stopper',250,860,{},90).place('rework','process-station',250,700,{operation:5,cycleMs:1200,lengthMm:300,widthMm:400})
  .place('rework-bin','collector',250,1700);
 b.sense('sense','present',0,'GateEye')
  .sense('machine','partPresent',1,'AtMachine').sense('machine','cycleDone',2,'MachineDone')
  .sense('inspect','partPresent',3,'AtInspect').sense('inspect','cycleDone',4,'InspectDone').sense('inspect','fail',5,'InspectFail')
  .sense('rework','partPresent',6,'AtRework').sense('rework','cycleDone',7,'ReworkDone')
  .drive(0,'feed','enable','Feed').drive(1,'main','run','MainBelt').drive(2,'out','run','OutBelt').drive(3,'side','run','SideBelt')
  .drive(4,'gate','run','GateRun').drive(5,'stop-m','extend','HoldMachine').drive(6,'machine','run','Machine')
  .drive(7,'stop-i','extend','HoldInspect').drive(8,'inspect','run','Inspect').drive(9,'gate','transfer','Divert')
  .drive(10,'stop-r','extend','HoldRework').drive(11,'rework','run','Rework')
  .hardEnable('good-bin','enable').hardEnable('rework-bin','enable');
 return b.build(REJECT_REWORK_ST);
}
