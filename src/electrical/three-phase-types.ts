/**
 * P4 bounded EDUCATIONAL 400V three-phase domain, separate from 24V DC.
 * Not a real power-distribution, arc-flash, protection, standards or SPICE model.
 */
export type Phase='L1'|'L2'|'L3'|'PE';
export type ThreePhaseConnection={supplyId:string;driveId:string;
 hasL1:boolean;hasL2:boolean;hasL3:boolean;hasPE:boolean;
 crossed:boolean;shorted:boolean;diagnostics:string[]};
export type MotorMode='off'|'star'|'delta'|'fault';
export type MotorNameplate={
 ratedVoltsLL:number;ratedAmps:number;ratedRpm:number;inertiaMs:number;
 ratedTorqueNm:number;loadPercent:number;
};
export type MotorState={mode:MotorMode;speedRpm:number;currentA:number;
 torqueNm:number;temperatureC:number;elapsedMs:number;energyWh:number;
 thermal:number;tripped:boolean;diagnostics:string[]};
export const NAMEPLATE:MotorNameplate={ratedVoltsLL:400,ratedAmps:8,
 ratedRpm:1450,inertiaMs:1800,ratedTorqueNm:20,loadPercent:60};
export const freshMotor=():MotorState=>({mode:'off',speedRpm:0,currentA:0,
 torqueNm:0,temperatureC:20,elapsedMs:0,energyWh:0,thermal:0,
 tripped:false,diagnostics:[]});
export type StarDeltaCoils={main:boolean;star:boolean;delta:boolean;reset:boolean};
export type StarterPanelState={motor:MotorState;mainClosed:boolean;starClosed:boolean;
 deltaClosed:boolean;changeoverMs:number;lastMode:MotorMode;conflict:boolean;
 mainsPresent:boolean;ready:boolean;events:string[]};
export const freshStarterPanel=():StarterPanelState=>({
 motor:freshMotor(),mainClosed:false,starClosed:false,deltaClosed:false,
 changeoverMs:0,lastMode:'off',conflict:false,mainsPresent:false,ready:false,events:[],
});
export type PhaseReading={L1:number|null;L2:number|null;L3:number|null;
 lineToLine:number|null;status:'isolated'|'live'|'phase-loss'|'crossed'|'short'};
