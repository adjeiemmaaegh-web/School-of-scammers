/** Educational discrete 24 V DC PLC input rack. Not a general circuit solver. */
export type InputTerminal = 'I0.0'|'I0.1'|'I0.2'|'I0.3'|'I0.4';
export type WireTarget = InputTerminal | 'UNCONNECTED' | 'M0';
export interface TerminalWiring { sensorPositive: WireTarget; sensorReturnConnected: boolean }
export const initialTerminalWiring = (): TerminalWiring => ({sensorPositive:'UNCONNECTED',sensorReturnConnected:true});
export interface TerminalSample { inputs: Readonly<Record<InputTerminal,boolean>>; volts: Readonly<Record<string,number|null>>; diagnostics: readonly string[]; sensorEnergized:boolean }
const terminals: readonly InputTerminal[]=['I0.0','I0.1','I0.2','I0.3','I0.4'];
/** PLC inputs are high impedance; a sensor needs both +24 V and M0 return. */
export function sampleTerminals(wiring:TerminalWiring,powerOn:boolean,sensorActive:boolean):TerminalSample {
 const inputs=Object.fromEntries(terminals.map(t=>[t,false])) as Record<InputTerminal,boolean>;
 const volts:Record<string,number|null>={P24:powerOn?24:0,M0:0,'S+':powerOn?24:0,'S-':wiring.sensorReturnConnected?0:null};
 const diagnostics:string[]=[];
 const sensorEnergized=powerOn&&wiring.sensorReturnConnected&&sensorActive;
 if(wiring.sensorPositive==='M0'&&sensorEnergized) diagnostics.push('Fault: sensor output wired to M0 (output short); input not energized');
 else if(wiring.sensorPositive!=='UNCONNECTED'&&wiring.sensorPositive!=='M0'&&sensorEnergized) inputs[wiring.sensorPositive]=true;
 for(const terminal of terminals) volts[terminal]=powerOn?(inputs[terminal]?24:0):0;
 volts['S_OUT']=sensorEnergized?24:0;
 if(!wiring.sensorReturnConnected) diagnostics.push('Sensor return open: no complete sensor supply circuit');
 if(wiring.sensorPositive==='UNCONNECTED') diagnostics.push('Sensor output not wired to any PLC input');
 return {inputs,volts,diagnostics,sensorEnergized};
}
export function changeTerminalWiring(wiring:TerminalWiring,patch:Partial<TerminalWiring>,powerOn:boolean,motorRunning:boolean):{wiring:TerminalWiring;error?:string} {
 if(powerOn||motorRunning) return {wiring,error:'Isolate simulated power and stop the motor before changing wiring'};
 const next={...wiring,...patch};
 if(!['I0.0','I0.1','I0.2','I0.3','I0.4','UNCONNECTED','M0'].includes(next.sensorPositive)) return {wiring,error:'Unknown terminal'};
 return {wiring:next};
}
/** Voltage measured between two terminals; floating measurements are indeterminate. */
export function measureDcVoltage(sample:TerminalSample,red:string,black:string):number|null {
 const a=sample.volts[red],b=sample.volts[black];
 return typeof a==='number'&&typeof b==='number'?a-b:null;
}
