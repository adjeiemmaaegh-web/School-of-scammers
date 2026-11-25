/**
 * Demonstration B: machining and assembly. A raw workpiece is indexed into a machining station by a stopper, machined, released,
 * indexed into an assembly station where a lid is added, then inspected and collected. The PLC (Structured Text) sequences
 * every step from real sensor and station signals; part state changes raw -> machined -> assembled and each part keeps a trace.
 */
import {MATERIALS} from '../world/materials';
import {DemoBuilder} from './builder';
import type {ProjectFile} from '../../sim/signals';

const index=(id:string)=>MATERIALS.findIndex(m=>m.id===id)+1;
export const MACHINING_ASSEMBLY_ST=`VAR_INPUT
  AtMachine : BOOL;
  MachineDone : BOOL;
  AtAssembly : BOOL;
  AssemblyDone : BOOL;
END_VAR
VAR_OUTPUT
  BeltRun : BOOL;
  HoldMachine : BOOL;
  Machine : BOOL;
  HoldAssembly : BOOL;
  Assemble : BOOL;
  FeedParts : BOOL;
END_VAR
VAR
  machined : BOOL;
  assembled : BOOL;
END_VAR
FeedParts := TRUE;
BeltRun := TRUE;
IF MachineDone THEN machined := TRUE; END_IF;
IF AssemblyDone THEN assembled := TRUE; END_IF;
HoldMachine := NOT MachineDone;
Machine := AtMachine AND NOT MachineDone;
HoldAssembly := NOT AssemblyDone;
Assemble := AtAssembly AND NOT AssemblyDone;`;

/** Layout (mm along the belt, y = 0): feeder -1100 | machine -700 | lid feeder -100 | assembly 100 | collector 1500. */
export function machiningAssemblyDemo():ProjectFile{
 const b=new DemoBuilder();
 b.place('feed','box-feeder',-1100,0,{rateMs:500,quantity:1,materialId:index('metal-workpiece')})
  .place('lids','box-feeder',-100,0,{rateMs:500,quantity:1,materialId:index('lid')})
  .place('belt','belt-conveyor',0,0,{lengthMm:2400,speedMmS:300})
  .place('stop-m','stopper',-540,0).place('machine','process-station',-700,0,{operation:1,cycleMs:1500,lengthMm:400})
  .place('stop-a','stopper',300,0).place('assembly','process-station',100,0,{operation:3,cycleMs:1200,lengthMm:600})
  .place('bin','collector',1500,0);
 b.sense('machine','partPresent',0,'AtMachine').sense('machine','cycleDone',1,'MachineDone')
  .sense('assembly','partPresent',2,'AtAssembly').sense('assembly','cycleDone',3,'AssemblyDone')
  .drive(0,'belt','run','BeltRun').drive(1,'stop-m','extend','HoldMachine').drive(2,'machine','run','Machine')
  .drive(3,'stop-a','extend','HoldAssembly').drive(4,'assembly','run','Assemble').drive(5,'feed','enable','FeedParts')
  .hardEnable('lids','enable').hardEnable('bin','enable');
 return b.build(MACHINING_ASSEMBLY_ST);
}
