/**
 * R06 pneumatic circuit physics, layered on the cylinder engine. When a cylinder is given a `PneumaticCircuit`, its motion
 * follows the circuit instead of the fixed-speed legacy rule: single- or double-acting, a 5/2 or 3-position (closed, exhaust
 * or pressure centre) valve, flow-control restrictors, line pressure loss, leakage, and the cylinder's force against its load
 * (pressure x piston area, not just "moves or doesn't"). Educational steady-state model: no air-volume dynamics, not a
 * pneumatic design tool, not safety-rated. Pure and deterministic.
 */
export type ValveCentre='closed'|'exhaust'|'pressure';
export type PneumaticCircuit={
 /** 'single' = spring-return: only the extend coil is used and the spring retracts the rod. */
 actuation?:'double'|'single';
 /** What a 5/3 valve does with both coils off (only for double-acting): hold (closed), vent both ports, or pressurise both. */
 centre?:ValveCentre;
 /** Flow-control (meter-out) opening 0.1..1 per direction; 1 = unrestricted. */
 extendRestrictor?:number;retractRestrictor?:number;
 /** Pressure lost in tubing and fittings between the supply and the cylinder port (bar). */
 lineLossBar?:number;
 /** Fraction of the holding pressure that leaks away per second (0..1): a leaking circuit cannot hold a load. */
 leakage?:number;
 boreMm?:number;
 /** Mass moved by the rod (kg) and whether it acts against gravity (vertical) or against friction (horizontal). */
 loadKg?:number;vertical?:boolean;
};
export type CircuitReadout={forceN:number;loadN:number;portBar:number;holding:boolean};
const G=9.81,EFFICIENCY=0.9,SPRING_N=25,FRICTION_MU=0.2,ROD_FRACTION=0.4;
const NOMINAL_BAR=6;
const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
const areaM2=(mm:number)=>Math.PI*(mm/1000)*(mm/1000)/4;

/** Piston areas in m^2: full bore (extend) and annulus (retract, smaller by the rod). */
export const pistonAreas=(boreMm:number):{cap:number;annulus:number}=>
 ({cap:areaM2(boreMm),annulus:areaM2(boreMm)-areaM2(boreMm*ROD_FRACTION)});
/** Force (N) the cylinder can develop at a pressure in the given direction, including piston friction losses. */
export const cylinderForceN=(boreMm:number,barPressure:number,extending:boolean):number=>
 barPressure*1e5*(extending?pistonAreas(boreMm).cap:pistonAreas(boreMm).annulus)*EFFICIENCY;

/**
 * New rod position after `deltaMs`. `extendCoil`/`retractCoil` are the valve solenoids; `supplyBar` the pressure reaching the
 * circuit (before line loss); `minWorkBar` the pressure below which the rod does not move.
 */
export function circuitMotion(position:number,circuit:PneumaticCircuit,coils:{extend:boolean;retract:boolean},
  supplyBar:number,deltaMs:number,minWorkBar:number,jammed:boolean):{position:number;readout:CircuitReadout;stalled:boolean}{
 const bore=circuit.boreMm??40,single=circuit.actuation==='single',centre=circuit.centre??'closed';
 const port=Math.max(0,supplyBar-(circuit.lineLossBar??0));
 const loadN=(circuit.loadKg??0)*G;
 const vertical=circuit.vertical===true;
 const air=port>=minWorkBar;
 const extRestr=clamp(circuit.extendRestrictor??1,0.1,1),retRestr=clamp(circuit.retractRestrictor??1,0.1,1);
 // Direction of the net air force this scan: +1 extend, -1 retract, 0 none.
 let direction:0|1|-1=0,forceAvail=0;
 const holding=!coils.extend&&!coils.retract&&centre==='closed'&&!single;
 if(coils.extend&&air){direction=1;forceAvail=cylinderForceN(bore,port,true);}
 else if(coils.retract&&!single&&air){direction=-1;forceAvail=cylinderForceN(bore,port,false);}
 else if(single)direction=-1;                                 // spring return whenever the extend coil is off (a single-acting cylinder has no retract port)
 else if(!coils.extend&&!coils.retract){
  if(centre==='pressure'&&air){direction=1;forceAvail=cylinderForceN(bore,port,true)-cylinderForceN(bore,port,false);} // differential area pushes out
  else if(centre==='exhaust'){direction=0;}                  // both ports vented: only the load (gravity) moves it
 }
 let speed=0;                                                   // fraction of nominal travel speed (signed by direction)
 let stalled=false;
 const pressureScale=Math.min(1.5,port/NOMINAL_BAR);
 if(direction===1){
  const required=vertical?loadN:loadN*FRICTION_MU;
  const net=forceAvail-required-(single?SPRING_N:0);
  if(net<=0){stalled=coils.extend||centre==='pressure';speed=0;}
  else speed=pressureScale*clamp(net/Math.max(1,cylinderForceN(bore,port,true)),0,1)*extRestr;   // against the full-bore force, so a differential push is slow
 }else if(direction===-1){
  if(single){
   // Spring return, helped by gravity on a vertical load, slowed by friction on a horizontal one.
   const net=SPRING_N+(vertical?loadN:-loadN*FRICTION_MU);
   speed=net>0?-0.6*clamp(net/(SPRING_N+loadN+1),0.2,1)*retRestr:0;
   stalled=net<=0&&coils.extend===false;
  }else{
   const assist=vertical?loadN:0,required=vertical?0:loadN*FRICTION_MU;
   const net=forceAvail+assist-required;
   if(net<=0){stalled=true;speed=0;}
   else speed=-pressureScale*clamp(net/Math.max(1,forceAvail+assist),0,1)*retRestr;
  }
 }else if(vertical&&loadN>0&&(centre==='exhaust'||single===false&&!air&&!coils.extend)){
  speed=-0.5;                                                   // vented / no air: a vertical load drops the rod
 }
 // A leaking, closed-centre circuit loses its holding pressure and lets a vertical load sink.
 if(holding&&vertical&&loadN>0&&(circuit.leakage??0)>0)speed=-clamp((circuit.leakage??0)*2,0,0.5);
 if(jammed)speed=0;
 const next=clamp(position+deltaMs*speed/(speed>=0?1200:1000),0,1);
 const forceN=direction===0?0:Math.max(0,forceAvail);
 return {position:next,readout:{forceN:Math.round(forceN*10)/10,loadN:Math.round(loadN*10)/10,portBar:Math.round(port*1000)/1000,holding},stalled};
}
