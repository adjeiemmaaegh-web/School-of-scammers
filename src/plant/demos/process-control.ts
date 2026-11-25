/**
 * Demonstration E: industrial process control. A PLC (Structured Text) holds a vessel's level between two limits with a
 * hysteresis refill, runs an on/off thermostat on a heater with an agitator, drains the batch while the operator holds START
 * on a pushbutton station, and reports state on an indicator panel (filling, heating, low-level alarm with horn). Level and
 * temperature reach the PLC as real analog inputs, so a leak, a blocked inlet or a failed heating element show up as
 * symptoms in the process values and alarms, not as messages.
 */
import {DemoBuilder} from './builder';
import type {ProjectFile} from '../../sim/signals';

export const PROCESS_CONTROL_ST=`VAR_INPUT
  Analog0 : REAL;
  Analog1 : REAL;
  StartHeld : BOOL;
END_VAR
VAR_OUTPUT
  Fill : BOOL;
  Drain : BOOL;
  Heat : BOOL;
  Mix : BOOL;
  LampFilling : BOOL;
  LampHeating : BOOL;
  LampLow : BOOL;
  Horn : BOOL;
END_VAR
VAR
  filling : BOOL;
  heating : BOOL;
END_VAR
IF Analog0 < 4000.0 THEN filling := TRUE; END_IF;
IF Analog0 > 6000.0 THEN filling := FALSE; END_IF;
IF Analog1 < 58.0 THEN heating := TRUE; END_IF;
IF Analog1 > 62.0 THEN heating := FALSE; END_IF;
Drain := StartHeld;
Fill := filling AND NOT StartHeld;
Heat := heating AND Analog0 > 2000.0;
Mix := Heat;
LampFilling := Fill;
LampHeating := Heat;
LampLow := Analog0 < 1000.0;
Horn := LampLow;`;

export function processControlDemo():ProjectFile{
 const b=new DemoBuilder();
 b.place('tank','process-tank',-600,0,{capacityMl:10000,fillMlS:1000,drainMlS:1300})
  .place('heater','heater',0,0,{tauMs:20000})
  .place('mixer','mixer',500,0)
  .place('hmi','operator-station',-600,-900)
  .place('panel','indicator-panel',600,-900);
 b.io.inputs['I0.0']='StartHeld';
 b.sense('hmi','start',0,'StartHeld');
 b.drive(0,'tank','fill','Fill').drive(1,'tank','drain','Drain').drive(2,'heater','enable','Heat').drive(3,'mixer','run','Mix')
  .drive(4,'panel','lamp1','LampFilling').drive(5,'panel','lamp2','LampHeating').drive(6,'panel','lamp3','LampLow').drive(7,'panel','horn','Horn');
 b.power('tank').power('heater');
 b.wire('tank.AN_levelMl','plc.AI0');b.wire('heater.AN_temperatureC','plc.AI1');
 return b.build(PROCESS_CONTROL_ST);
}
