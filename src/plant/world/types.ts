/**
 * P3 original bounded educational plant world.
 * Units: millimetres, kilograms, milliseconds, Celsius. z is vertical.
 * No real-machine accuracy, rigid-body certification or safety guarantees.
 */
export type Vec3={x:number;y:number;z:number};
export type BodyShape='box'|'cylinder';
export type Body={
 id:string;shape:BodyShape;size:Vec3;massKg:number;pos:Vec3;
 yawDeg:0|90|180|270;vel:Vec3;supportedBy:string|null;
 /** Worker-owned smooth quarter-turn payload orientation. Only visual yaw;
  * collision broad phase remains conservative until discrete index completion. */
 visualYawDeg?:number;
 tags:Record<string,string|number|boolean>;
};
export type WorldEvent={atMs:number;kind:'spawn'|'despawn'|'jam'|'contact'|'motion'|'fault'|'limit'|'process';source:string;bodyId?:string;detail:string};
export type World={
 bodies:Body[];nextBodyId:number;timeMs:number;rngState:number;
 spawnedCount:number;despawnedCount:number;droppedEventCount:number;
 events:WorldEvent[];model:Record<string,EquipmentState>;
 /** Explicit transient classroom operator used only for opt-in worker sensing.
  * It is never a camera inference, real human detector or physical collision body. */
 trainingOperator?:Body;
};
export type EquipmentState={
 positionMm:number;speedMmS:number;progress:number;count:number;
 levelMl:number;temperatureC:number;value:number;engaged:boolean;done:boolean;
 lastCommand:boolean;elapsedMs:number;stalled:boolean;faulted:boolean;
 heldBodyId?:string|null;routeMetalLatched?:boolean;activeBodyId?:string|null;
 lastPlaceCommand?:boolean;lastJamResetCommand?:boolean;
 /** P19 opt-in 24V controller/drive outage recovery; never persisted as project data. */
 lastRestartCommand?:boolean;restartPending?:boolean;restartArmed?:boolean;
 /** P20 original physical gate/body provenance; cleared only by recovered belt reset. */
 obstructionGateId?:string|null;obstructionBodyId?:string|null;
 /** P21 opt-in sustained original body-to-body queue detection and restart. */
 accumulationContactMs?:number;accumulationBodyId?:string|null;
 accumulationBlockingBodyId?:string|null;
 controllerPowerSeen?:boolean;
 slots?:Record<string,string>;phase?:number;
};
export type EquipmentPlacement={
 id:string;kind:string;originMm:Vec3;yawDeg:0|90|180|270;params:Record<string,number>;
};
export type EquipmentCommand=Readonly<Record<string,boolean|number>>;
export type WorldInputs=Readonly<Record<string,EquipmentCommand>>;
export type EquipmentSignal=boolean|number;
export type LiveSignal=Record<string,EquipmentSignal>;
export type EquipmentDrawing={
 part:string;shape:BodyShape;pos:Vec3;size:Vec3;yawDeg:number;colour:string;
};
export const MAX_BODIES=60, MAX_WORLD_EVENTS=80, MAX_SCENE_EQUIPMENT=60;
export const QUANTUM=1e-6, SUBSTEP_MS=10, SCAN_MS=50;
export const G_MM_S2=9810;
