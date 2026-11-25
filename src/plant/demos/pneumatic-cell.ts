/**
 * Demonstration C: pneumatic production cell. A PLC (Structured Text) runs a compressor with receiver, an air regulator and a
 * double-acting cylinder through its two solenoids and two limit switches: extend until the EXTENDED switch, dwell one second,
 * retract until the RETRACTED switch, repeat, counting cycles. Pressure comes from the real air model, so a leak, a low regulator
 * setting, a restrictor, line loss or an overload each change the cycle in a way the learner can diagnose from the PLC tags.
 */
import {DemoBuilder} from './builder';
import type {ProjectFile} from '../../sim/signals';

export const PNEUMATIC_CELL_ST=`VAR_INPUT
  PressureOK : BOOL;
  ExtLs : BOOL;
  RetLs : BOOL;
END_VAR
VAR_OUTPUT
  Pump : BOOL;
  Extend : BOOL;
  Retract : BOOL;
  Cycles : INT;
END_VAR
VAR
  dwell : TON;
  seen : R_TRIG;
  counter : CTU;
  retracting : BOOL;
END_VAR
Pump := TRUE;
dwell(IN := ExtLs, PT := T#1s);
IF dwell.Q THEN retracting := TRUE; END_IF;
IF RetLs THEN retracting := FALSE; END_IF;
Extend := PressureOK AND NOT retracting;
Retract := retracting;
seen(CLK := ExtLs);
counter(CU := seen.Q, R := FALSE, PV := 1000);
Cycles := counter.CV;`;

/** `pumpBarPerS` sizes the compressor: a pump slower than the 0.4 bar/s leak fault cannot keep up with it. */
export function pneumaticCellDemo(cylinder:Record<string,number>={},regulatorBar=6,pumpBarPerS=0.6):ProjectFile{
 const b=new DemoBuilder();
 b.place('comp','compressor',0,0,pumpBarPerS===0.6?{}:{fillBarPerS:pumpBarPerS}).place('reg','air-regulator',200,0,{setpointBar:regulatorBar}).place('cyl','cylinder',400,0,cylinder);
 b.io.inputs['I0.0']='PressureOK';b.io.inputs['I0.1']='ExtLs';b.io.inputs['I0.2']='RetLs';
 b.io.outputs['Q0.0']='Pump';b.io.outputs['Q0.1']='Extend';b.io.outputs['Q0.2']='Retract';
 b.wire('plc.Q0.0','comp.A1');b.wire('comp.A2','ps.M0');
 b.wire('ps.P24','comp.PS_A');b.wire('comp.PS_B','plc.I0.0');
 b.wire('ps.P24','cyl.L+');b.wire('cyl.M-','ps.M0');
 b.wire('plc.Q0.1','cyl.EXT+');b.wire('plc.Q0.2','cyl.RET+');
 b.wire('cyl.EXT_LS','plc.I0.1');b.wire('cyl.RET_LS','plc.I0.2');
 b.wire('comp.AIR','reg.AIR_IN');b.wire('reg.AIR_OUT','cyl.AIR');
 return b.build(PNEUMATIC_CELL_ST);
}
