/** Single official P3 equipment registry; 23 original, bounded teaching models. */
import type {EquipmentDef} from '../world/equipment';
import {beltConveyor,rollerConveyor,turntable} from './transport';
import {stopper,pusher,diverterGate} from './actuators';
import {boxFeeder} from './feeder';
import {photoeye,inductiveProx,capacitiveProx,lightCurtain,weighCell} from './sensors';
import {lift,scissorLift,rotaryActuator,pickAndPlace,palletizer} from './positioning';
import {shelf,asrsCrane} from './storage';
import {robotArm} from './robot';
import {processTank,mixer,heater,proportionalValve,filler,capper} from './process';
export const EQUIPMENT:readonly EquipmentDef[]=[
 beltConveyor,rollerConveyor,turntable,stopper,pusher,diverterGate,boxFeeder,
 photoeye,inductiveProx,capacitiveProx,lightCurtain,weighCell,
 lift,scissorLift,rotaryActuator,pickAndPlace,palletizer,
 shelf,asrsCrane,robotArm,processTank,mixer,heater,proportionalValve,filler,capper,
];
export const PLANT_EQUIPMENT:Readonly<Record<string,EquipmentDef>>=
 Object.fromEntries(EQUIPMENT.map(def=>[def.kind,def]));
export const plantKinds=EQUIPMENT.map(def=>def.kind);
