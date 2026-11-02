export type Mode = 'learning' | 'assessment';
export type Action = 'inspect' | 'read-plc' | 'stop' | 'start' | 'reset-estop' | 'repair-sensor' | 'verify' | 'submit';
export type MachineStatus = 'stopped' | 'running';
export interface Event { index: number; action: Action; detail: string; accepted: boolean; }
export interface Machine { status: MachineStatus; motor: boolean; startRequested: boolean; estop: boolean; guardClosed: boolean; sensorHealthy: boolean; sensorDetected: boolean; inspected: boolean; plcRead: boolean; diagnosed: boolean; repaired: boolean; verified: boolean; submitted: boolean; unsafeAttempts: number; events: Event[]; }
export interface Scenario { id: string; version: string; name: string; fault: 'sensor-disconnected'; expected: MachineStatus; }
export const scenario: Scenario = { id: 'conveyor-start-fault', version: '1.0.0', name: 'Conveyor will not start', fault: 'sensor-disconnected', expected: 'running' };
export function initialMachine(): Machine { return {status:'stopped',motor:false,startRequested:false,estop:false,guardClosed:true,sensorHealthy:false,sensorDetected:false,inspected:false,plcRead:false,diagnosed:false,repaired:false,verified:false,submitted:false,unsafeAttempts:0,events:[]}; }
export function inputs(s: Machine) { return { I0_0_Start:s.startRequested,I0_1_EStopOK:!s.estop,I0_2_GuardClosed:s.guardClosed,I0_3_PartSensor:s.sensorHealthy && s.sensorDetected,I0_4_SensorHealthy:s.sensorHealthy }; }
export function outputs(s: Machine) { return { Q0_0_Motor:s.motor }; }
export function transition(previous: Machine, action: Action): Machine {
 if(previous.submitted) return previous;
 const s: Machine={...previous,events:[...previous.events]}; let accepted=true; let detail='';
 switch(action){
 case 'inspect': s.inspected=true; detail='Visual inspection recorded'; break;
 case 'read-plc': s.plcRead=true; if(s.inspected && !s.sensorHealthy) s.diagnosed=true; detail='PLC input/output diagnostics inspected'; break;
 case 'stop': s.startRequested=false; s.motor=false; s.status='stopped'; detail='Stop command applied'; break;
 case 'start': s.startRequested=true; if(s.estop || !s.guardClosed){accepted=false;s.unsafeAttempts++;detail='Start blocked by safety interlock';} else if(!s.sensorHealthy){accepted=false;detail='Start blocked: sensor circuit unhealthy';} else {s.motor=true;s.status='running';detail='Conveyor motor energized';} break;
 case 'reset-estop': if(s.estop){s.estop=false;detail='Emergency-stop input reset';}else{accepted=false;detail='Emergency stop already clear';}break;
 case 'repair-sensor': if(s.motor || s.startRequested){accepted=false;s.unsafeAttempts++;detail='Repair rejected: stop and isolate simulated motor command first';}else{s.sensorHealthy=true;s.repaired=true;detail='Sensor cable reconnected with motor command off';}break;
 case 'verify': if(s.motor && s.sensorHealthy && s.plcRead){s.verified=true;detail='Running motor and healthy sensor confirmed';}else{accepted=false;detail='Verification requires running motor, healthy sensor and PLC diagnostics';}break;
 case 'submit': s.submitted=true;detail='Attempt submitted';break;
 }
 s.events.push({index:s.events.length+1,action,detail,accepted});return s;
}
