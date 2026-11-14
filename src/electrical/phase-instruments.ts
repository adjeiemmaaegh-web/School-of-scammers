/**
 * Three-phase readouts derived ONLY from simulated topology and motor model.
 * Not calibrated instruments or safe field-work procedures.
 */
import type {PhaseReading,StarterPanelState,ThreePhaseConnection} from './three-phase-types';
export const readPhaseMeter=(connection:ThreePhaseConnection|null,
  sourceOn=true):PhaseReading=>{
 if(!sourceOn||!connection||!connection.supplyId)return{
  L1:null,L2:null,L3:null,lineToLine:null,status:'isolated'};
 if(connection.shorted)return {L1:null,L2:null,L3:null,lineToLine:null,status:'short'};
 if(connection.crossed)return {L1:null,L2:null,L3:null,lineToLine:null,status:'crossed'};
 const lines=[connection.hasL1,connection.hasL2,connection.hasL3];
 const live=lines.every(Boolean);
 return {L1:lines[0]?230:null,L2:lines[1]?230:null,L3:lines[2]?230:null,
  lineToLine:live?400:null,status:live?'live':'phase-loss'};
};
export type VirtualClamp={amps:number|null;temperatureC:number|null;
 estimatedPowerKw:number|null;rpm:number|null;status:'isolated'|'running'|'tripped'|'stopped'};
export const readVirtualClamp=(s:StarterPanelState|null):VirtualClamp=>{
 if(!s)return {amps:null,temperatureC:null,estimatedPowerKw:null,rpm:null,status:'isolated'};
 const on=s.mainClosed&&!s.motor.tripped&&(s.starClosed||s.deltaClosed);
 return {amps:s.motor.currentA,temperatureC:s.motor.temperatureC,
  estimatedPowerKw:Math.round(Math.sqrt(3)*400*s.motor.currentA*.75/10)/100,
  rpm:s.motor.speedRpm,status:s.motor.tripped?'tripped':on?'running':'stopped'};
};
