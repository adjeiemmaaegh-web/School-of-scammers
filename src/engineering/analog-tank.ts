/** Deterministic educational analog level/PID process model, not physical plant or certified controls. */
export type TankFault='none'|'sensor-stuck-low'|'sensor-stuck-high'|'inlet-blocked'|'outlet-leak';
export type TankMode='auto'|'manual';
export type TankConfig={capacityLiters:number;inletLitersPerSecond:number;outletLitersPerSecond:number};
export type TankControl={mode:TankMode;setpointPercent:number;kp:number;ki:number;kd:number;manualDuty:number;demandOutflow:number;emergencyStop:boolean;resetTrip:boolean;permitPump:boolean;fault:TankFault};
export type TankState={timeMs:number;liters:number;measuredPercent:number;actualPercent:number;duty:number;integral:number;lastMeasurement:number;highHighTrip:boolean;spilledLiters:number;totalInletLiters:number;totalOutletLiters:number;alarm:string|null};
export type TankSample={second:number;actualPercent:number;measuredPercent:number;setpointPercent:number;dutyPercent:number;highHighTrip:boolean;fault:TankFault;alarm:string};
export const DEFAULT_TANK_CONFIG:TankConfig={capacityLiters:1000,inletLitersPerSecond:50,outletLitersPerSecond:12};
export const DEFAULT_TANK_CONTROL:TankControl={mode:'auto',setpointPercent:60,kp:0.045,ki:0.002,kd:0,manualDuty:0.4,demandOutflow:12,emergencyStop:false,resetTrip:false,permitPump:true,fault:'none'};
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
function finiteRange(value:number,min:number,max:number,name:string):void{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new RangeError(`${name} must be between ${min} and ${max}`);}
export function validateTankConfig(config:TankConfig):void{
 if(!config||typeof config!=='object')throw new TypeError('Invalid tank configuration');
 finiteRange(config.capacityLiters,10,100000,'Capacity');finiteRange(config.inletLitersPerSecond,0.01,1000,'Inlet flow');finiteRange(config.outletLitersPerSecond,0,1000,'Outlet flow');
}
export function validateTankControl(control:TankControl,config:TankConfig):void{
 if(!control||!['auto','manual'].includes(control.mode)||!['none','sensor-stuck-low','sensor-stuck-high','inlet-blocked','outlet-leak'].includes(control.fault))throw new TypeError('Invalid process mode or fault');
 for(const k of ['emergencyStop','resetTrip','permitPump'] as const)if(typeof control[k]!=='boolean')throw new TypeError(`Invalid ${k}`);
 finiteRange(control.setpointPercent,0,95,'Setpoint');finiteRange(control.kp,0,2,'Kp');finiteRange(control.ki,0,0.5,'Ki');finiteRange(control.kd,0,3,'Kd');finiteRange(control.manualDuty,0,1,'Manual duty');finiteRange(control.demandOutflow,0,config.outletLitersPerSecond,'Demand flow');
}
export function initialTank(config:TankConfig=DEFAULT_TANK_CONFIG,percent=20):TankState{
 validateTankConfig(config);finiteRange(percent,0,100,'Initial level');
 return {timeMs:0,liters:config.capacityLiters*percent/100,actualPercent:percent,measuredPercent:percent,duty:0,integral:0,lastMeasurement:percent,highHighTrip:false,spilledLiters:0,totalInletLiters:0,totalOutletLiters:0,alarm:null};
}
/** One physical integration step; PID and controller state are evolved solely from supplied state. */
export function stepTank(state:TankState,control:TankControl,deltaMs=1000,config:TankConfig=DEFAULT_TANK_CONFIG):TankState{
 validateTankConfig(config);validateTankControl(control,config);
 if(!state||!Number.isFinite(state.liters)||!Number.isFinite(state.integral)||!Number.isFinite(state.timeMs)||!Number.isFinite(state.lastMeasurement)||!Number.isFinite(state.spilledLiters))throw new TypeError('Corrupt tank state');
 if(state.liters<0||state.liters>config.capacityLiters||state.timeMs<0||state.spilledLiters<0)throw new RangeError('Tank state out of range');
 if(!Number.isSafeInteger(deltaMs)||deltaMs<100||deltaMs>10000)throw new RangeError('Step must be 100..10000 simulated ms');
 const dt=deltaMs/1000;
 const actualBefore=100*state.liters/config.capacityLiters;
 const measuredBefore=control.fault==='sensor-stuck-low'?0:control.fault==='sensor-stuck-high'?100:actualBefore;
 const resetSafe=control.resetTrip&&actualBefore<=90;
 let trip=resetSafe?false:state.highHighTrip;
 if(actualBefore>=98)trip=true;
 let duty=0;let integral=state.integral;
 if(control.mode==='manual')duty=control.manualDuty;
 else{
  const error=control.setpointPercent-measuredBefore;
  const derivative=-(measuredBefore-state.lastMeasurement)/dt; // derivative on measurement avoids setpoint kick
  const candidate=integral+control.ki*error*dt;
  const unsaturated=control.kp*error+candidate+control.kd*derivative;
  const saturatingHigh=unsaturated>1&&error>0;
  const saturatingLow=unsaturated<0&&error<0;
  // Do not integrate error while the high-high trip or external emergency/permissive keeps the pump isolated.
  if(!control.emergencyStop&&control.permitPump&&!trip&&!saturatingHigh&&!saturatingLow)integral=clamp(candidate,-1,1);
  duty=clamp(control.kp*error+integral+control.kd*derivative,0,1);
 }
 if(control.emergencyStop||!control.permitPump||trip)duty=0;
 const flowIn=control.fault==='inlet-blocked'?0:duty*config.inletLitersPerSecond*dt;
 const extraLeak=control.fault==='outlet-leak'?18*dt:0;
 const requestedOut=(control.demandOutflow*dt)+extraLeak;
 const out=Math.min(state.liters+flowIn,requestedOut);
 const rawLiters=state.liters+flowIn-out;
 const spill=Math.max(0,rawLiters-config.capacityLiters);
 const liters=clamp(rawLiters,0,config.capacityLiters);
 const actualPercent=100*liters/config.capacityLiters;
 const measuredPercent=control.fault==='sensor-stuck-low'?0:control.fault==='sensor-stuck-high'?100:actualPercent;
 if(actualPercent>=98)trip=true;
 const alarm=trip?'HIGH-HIGH LEVEL TRIP':control.emergencyStop?'EMERGENCY STOP':!control.permitPump?'EXTERNAL PUMP PERMISSIVE OPEN':Math.abs(measuredPercent-actualPercent)>10?'LEVEL SENSOR DISAGREEMENT':null;
 return {timeMs:state.timeMs+deltaMs,liters,actualPercent,measuredPercent,duty,integral,lastMeasurement:measuredBefore,highHighTrip:trip,spilledLiters:state.spilledLiters+spill,totalInletLiters:state.totalInletLiters+flowIn,totalOutletLiters:state.totalOutletLiters+out,alarm};
}
export function tankSample(state:TankState,control:TankControl):TankSample{return {second:state.timeMs/1000,actualPercent:state.actualPercent,measuredPercent:state.measuredPercent,setpointPercent:control.setpointPercent,dutyPercent:Math.round(state.duty*10000)/100,highHighTrip:state.highHighTrip,fault:control.fault,alarm:state.alarm??''};}
export function simulateTank(initial:TankState,control:TankControl,steps=60,deltaMs=1000,config:TankConfig=DEFAULT_TANK_CONFIG):{end:TankState;rows:TankSample[];overshootPercent:number;meanAbsoluteErrorPercent:number;tripScans:number}{
 if(!Number.isSafeInteger(steps)||steps<1||steps>3600)throw new RangeError('Simulation requires 1..3600 steps');
 let state=initial,absoluteError=0,peak=-Infinity,trips=0;const rows:TankSample[]=[];
 for(let i=0;i<steps;i++){state=stepTank(state,control,deltaMs,config);rows.push(tankSample(state,control));absoluteError+=Math.abs(state.actualPercent-control.setpointPercent);peak=Math.max(peak,state.actualPercent);if(state.highHighTrip)trips++;}
 return {end:state,rows,overshootPercent:Math.max(0,peak-control.setpointPercent),meanAbsoluteErrorPercent:absoluteError/steps,tripScans:trips};
}
export function tankSamplesCsv(rows:readonly TankSample[]):string{
 if(rows.length>10000)throw new RangeError('CSV evidence too large');
 const columns=['second','actual_percent','sensor_percent','setpoint_percent','pump_duty_percent','high_high_trip','fault','alarm'];
 const quote=(v:unknown)=>`"${String(v).replace(/"/g,'""')}"`;
 return [columns,...rows.map(r=>[r.second,r.actualPercent,r.measuredPercent,r.setpointPercent,r.dutyPercent,r.highHighTrip,r.fault,r.alarm])].map(row=>row.map(quote).join(',')).join('\r\n');
}