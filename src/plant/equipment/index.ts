/** Single official P3 equipment registry; 23 original, bounded teaching models. */
import type {EquipmentDef} from '../world/equipment';
import {spec} from '../world/equipment';
import {STATIC_SOLID_KINDS} from '../world/solid-geometry';
import {beltConveyor,rollerConveyor,turntable} from './transport';
import {stopper,pusher,diverterGate} from './actuators';
import {boxFeeder} from './feeder';
import {photoeye,inductiveProx,capacitiveProx,lightCurtain,weighCell} from './sensors';
import {lift,scissorLift,rotaryActuator,pickAndPlace,palletizer} from './positioning';
import {shelf,asrsCrane} from './storage';
import {robotArm} from './robot';
import {processTank,mixer,heater,proportionalValve,filler,capper} from './process';
const SOURCE_EQUIPMENT:readonly EquipmentDef[]=[
 beltConveyor,rollerConveyor,turntable,stopper,pusher,diverterGate,boxFeeder,
 photoeye,inductiveProx,capacitiveProx,lightCurtain,weighCell,
 lift,scissorLift,rotaryActuator,pickAndPlace,palletizer,
 shelf,asrsCrane,robotArm,processTank,mixer,heater,proportionalValve,filler,capper,
];
/** Opt-in static collision is a shared *registered* equipment capability.
 * No modification to older projects: an absent setting defaults to 0.
 * Moving actuators keep their existing specific motion/collision rules.
 */
export const EQUIPMENT:readonly EquipmentDef[]=SOURCE_EQUIPMENT.map(def=>
 STATIC_SOLID_KINDS.includes(def.kind)&&
 !def.params.some(param=>param.key==='blockMaterialFlow')?{
  ...def,params:[...def.params,
   spec('blockMaterialFlow','Opaque material-flow obstacle','0=off, 1=on',0,1,1,0)],
 }:def);
export const PLANT_EQUIPMENT:Readonly<Record<string,EquipmentDef>>=
 Object.fromEntries(EQUIPMENT.map(def=>[def.kind,def]));
export const plantKinds=EQUIPMENT.map(def=>def.kind);
