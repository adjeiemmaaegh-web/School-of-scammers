/** Deterministic educational motor starter: fuse, overload, coil and auxiliary feedback.
 * Simplified discrete logic, not a certified protection or electrical transient model.
 */
export interface StarterFaults { fuseOpen:boolean; overloadTripped:boolean; coilOpen:boolean; auxiliaryStuckOpen:boolean; contactorWelded:boolean }
export interface StarterState { faults:StarterFaults; coilEnergized:boolean; contactorClosed:boolean; motorPowered:boolean; feedback:boolean; diagnostics:readonly string[]; voltages:Readonly<Record<string,number|null>> }
export const initialStarterFaults=():StarterFaults=>({fuseOpen:false,overloadTripped:false,coilOpen:false,auxiliaryStuckOpen:false,contactorWelded:false});
export function evaluateStarter(powerOn:boolean,command:boolean,guardClosed:boolean,faults:StarterFaults):StarterState {
 const supply=powerOn&&!faults.fuseOpen;
 const coilEnergized=supply&&command&&guardClosed&&!faults.overloadTripped&&!faults.coilOpen;
 const contactorClosed=coilEnergized||faults.contactorWelded;
 const motorPowered=supply&&contactorClosed&&!faults.overloadTripped;
 const feedback=contactorClosed&&!faults.auxiliaryStuckOpen;
 const diagnostics:string[]=[];
 if(faults.fuseOpen)diagnostics.push('F1 fuse open: control supply interrupted');
 if(faults.overloadTripped)diagnostics.push('OL1 overload tripped: motor supply interrupted');
 if(faults.coilOpen&&command)diagnostics.push('K1 coil open: contactor cannot pull in');
 if(faults.auxiliaryStuckOpen&&contactorClosed)diagnostics.push('K1 auxiliary feedback missing despite closed contactor');
 if(faults.contactorWelded&&!coilEnergized)diagnostics.push('DANGER (simulated): K1 contacts welded; motor may remain powered without coil command');
 return {faults:{...faults},coilEnergized,contactorClosed,motorPowered,feedback,diagnostics,voltages:{'F1_IN':powerOn?24:0,'F1_OUT':supply?24:0,'OL1_OUT':supply&&!faults.overloadTripped?24:0,'K1_A1':coilEnergized?24:0,'K1_A2':0,'K1_AUX':feedback?24:0}};
}
export function changeStarterFault(faults:StarterFaults,key:keyof StarterFaults,value:boolean,powerOn:boolean,motorRunning:boolean):{faults:StarterFaults;error?:string}{
 if(powerOn||motorRunning)return {faults,error:'Isolate simulated supply and stop motor before changing component faults'};
 return {faults:{...faults,[key]:value}};
}
