/**
 * Demonstration D: multi-PLC manufacturing factory. Two independent controllers run two cells joined by a belt: PLC 1 feeds and
 * machines parts and holds each finished part at its stopper; PLC 2 inspects and sinks them. They coordinate only through a real
 * 24V handshake wire (PLC 2 output `Ready` -> PLC 1 input), so a stalled downstream cell visibly backs the upstream one up, and
 * each PLC keeps its own tags, program and scan.
 */
import {MATERIALS} from '../world/materials';
import {DemoBuilder} from './builder';
import type {ProjectFile} from '../../sim/signals';

const index=(id:string)=>MATERIALS.findIndex(m=>m.id===id)+1;
export const FACTORY_PARTS=3;
export const CELL1_ST=`VAR_INPUT
  AtCut : BOOL;
  CutDone : BOOL;
  DownstreamReady : BOOL;
END_VAR
VAR_OUTPUT
  Belt1 : BOOL;
  Feed : BOOL;
  Cut : BOOL;
  HoldS1 : BOOL;
END_VAR
Belt1 := TRUE;
Feed := TRUE;
Cut := AtCut AND NOT CutDone;
HoldS1 := NOT (CutDone AND DownstreamReady);`;
export const CELL2_ST=`VAR_INPUT
  AtInspect : BOOL;
  InspectDone : BOOL;
END_VAR
VAR_OUTPUT
  Belt2 : BOOL;
  Inspect : BOOL;
  HoldS2 : BOOL;
  Ready : BOOL;
END_VAR
Belt2 := TRUE;
Inspect := AtInspect AND NOT InspectDone;
HoldS2 := NOT InspectDone;
Ready := NOT AtInspect;`;

export function multiPlcFactoryDemo():ProjectFile{
 const b=new DemoBuilder('plc','ps').addPlc('plc2',300);
 b.place('feed','box-feeder',-1300,0,{rateMs:2200,quantity:FACTORY_PARTS,materialId:index('metal-workpiece')})
  .place('belt1','belt-conveyor',-700,0,{lengthMm:1400,speedMmS:300})
  .place('cutter','process-station',-250,0,{operation:1,cycleMs:1500,lengthMm:400})
  .place('stop1','stopper',-90,0,{travelMs:100})
  .place('belt2','belt-conveyor',700,0,{lengthMm:1400,speedMmS:300})
  .place('inspector','process-station',300,0,{operation:4,cycleMs:1000,lengthMm:400})
  .place('stop2','stopper',440,0,{travelMs:100})
  .place('bin','collector',1700,0);
 b.sense('cutter','partPresent',0,'AtCut').sense('cutter','cycleDone',1,'CutDone')
  .drive(0,'belt1','run','Belt1').drive(1,'feed','enable','Feed').drive(2,'cutter','run','Cut').drive(3,'stop1','extend','HoldS1')
  .sense('inspector','partPresent',0,'AtInspect','plc2').sense('inspector','cycleDone',1,'InspectDone','plc2')
  .drive(0,'belt2','run','Belt2','plc2').drive(1,'inspector','run','Inspect','plc2').drive(2,'stop2','extend','HoldS2','plc2')
  .link('plc2',3,'plc',2,'Ready','DownstreamReady')
  .hardEnable('bin','enable');
 return b.build(CELL1_ST,{plc2:CELL2_ST});
}
