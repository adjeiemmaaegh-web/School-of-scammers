/** Deterministic educational double-acting pneumatic cylinder and valve control.
 * Not a pressure/force design tool or a safety-rated machine controller.
 */
export type PneumaticFault='none'|'no-air'|'extend-solenoid-open'|'retract-solenoid-open'|'extend-sensor-stuck'|'retract-sensor-stuck'|'rod-jammed';
export type CylinderCommand='neutral'|'extend'|'retract';
export type PneumaticState={
 timeMs:number; position:number; command:CylinderCommand; fault:PneumaticFault;
 extendCoil:boolean; retractCoil:boolean; extendLimit:boolean; retractLimit:boolean;
 pressureBar:number; alarm:string|null; travelMs:number; events:readonly string[];
};
export type PneumaticInput={command:CylinderCommand; airOn:boolean; guardClosed:boolean; emergencyStop:boolean; fault:PneumaticFault; resetAlarm?:boolean};
export type PneumaticTrace={timeMs:number;position:number;command:CylinderCommand;extendCoil:boolean;retractCoil:boolean;extended:boolean;retracted:boolean;pressureBar:number;alarm:string};
export const DEFAULT_PNEUMATIC_INPUT:PneumaticInput={command:'neutral',airOn:true,guardClosed:true,emergencyStop:false,fault:'none'};
export const PNEUMATIC_FAULTS:readonly PneumaticFault[]=['none','no-air','extend-solenoid-open','retract-solenoid-open','extend-sensor-stuck','retract-sensor-stuck','rod-jammed'];
const limit=(x:number)=>Math.max(0,Math.min(1,x));
export function initialPneumatic():PneumaticState{return {timeMs:0,position:0,command:'neutral',fault:'none',extendCoil:false,retractCoil:false,extendLimit:false,retractLimit:true,pressureBar:0,alarm:null,travelMs:0,events:[]};}
export function validatePneumaticInput(input:PneumaticInput):void{
 if(!input||!['neutral','extend','retract'].includes(input.command)||!PNEUMATIC_FAULTS.includes(input.fault)||typeof input.airOn!=='boolean'||typeof input.guardClosed!=='boolean'||typeof input.emergencyStop!=='boolean'||(input.resetAlarm!==undefined&&typeof input.resetAlarm!=='boolean'))throw new TypeError('Invalid pneumatic inputs');
}
export function stepPneumatic(state:PneumaticState,input:PneumaticInput,deltaMs=100):PneumaticState{
 validatePneumaticInput(input);
 if(!state||!Number.isFinite(state.position)||state.position<0||state.position>1||!Number.isSafeInteger(state.timeMs)||state.timeMs<0||!Number.isSafeInteger(state.travelMs)||state.travelMs<0)throw new TypeError('Invalid cylinder state');
 if(!Number.isSafeInteger(deltaMs)||deltaMs<10||deltaMs>1000)throw new RangeError('PLC step must be 10..1000 ms');
 const safe=input.guardClosed&&!input.emergencyStop;
 const pressure=input.airOn&&input.fault!=='no-air'?6:0;
 let command:CylinderCommand=safe?input.command:'neutral';
 const extendCoil=command==='extend'&&input.fault!=='extend-solenoid-open';
 const retractCoil=command==='retract'&&input.fault!=='retract-solenoid-open';
 if(extendCoil&&retractCoil)throw Error('Valve interlock violation');
 // Spring-centred 5/3 valve holds the position when de-energized; no motion without air.
 let position=state.position;
 if(pressure>0&&input.fault!=='rod-jammed'){
  if(extendCoil)position=limit(position+deltaMs/1200);
  else if(retractCoil)position=limit(position-deltaMs/1000);
 }
 position=Math.round(position*1000000)/1000000;
 const extendLimit=input.fault==='extend-sensor-stuck'?false:position>=0.999999;
 const retractLimit=input.fault==='retract-sensor-stuck'?false:position<=0.000001;
 const moving=command!=='neutral' && !(command==='extend'?extendLimit:retractLimit);
 const travelMs=moving?(state.command===command?state.travelMs+deltaMs:deltaMs):0;
 const timeout=travelMs>2500;
 // Fault latch requires neutral command, safe guards and a genuine reset request.
 let alarm=state.alarm;
 if(input.resetAlarm&&command==='neutral'&&safe)alarm=null;
 if(!safe)alarm='INTERLOCK OPEN — VALVE DE-ENERGIZED';
 else if(timeout)alarm='CYLINDER TRAVEL TIMEOUT';
 else if(!alarm&&pressure===0&&command!=='neutral')alarm='AIR PRESSURE UNAVAILABLE';
 const events=[...state.events];
 const event=(text:string)=>{events.push((state.timeMs+deltaMs)+' ms: '+text);};
 if(state.command!==command)event('Valve command '+command);
 if(!state.extendLimit&&extendLimit)event('EXTENDED limit reached');
 if(!state.retractLimit&&retractLimit)event('RETRACTED limit reached');
 if(alarm!==state.alarm&&alarm)event(alarm);
 if(alarm===null&&state.alarm!==null)event('Alarm reset');
 return {timeMs:state.timeMs+deltaMs,position,command,fault:input.fault,extendCoil,retractCoil,extendLimit,retractLimit,pressureBar:pressure,alarm,travelMs,events:events.slice(-300)};
}
export function pneumaticSample(s:PneumaticState):PneumaticTrace{return {timeMs:s.timeMs,position:s.position,command:s.command,extendCoil:s.extendCoil,retractCoil:s.retractCoil,extended:s.extendLimit,retracted:s.retractLimit,pressureBar:s.pressureBar,alarm:s.alarm??''};}
export function pneumaticCsv(rows:readonly PneumaticTrace[]):string{
 const q=(v:unknown)=>'"'+String(v).replace(/"/g,'""')+'"';
 return [['time_ms','position_percent','command','extend_coil','retract_coil','extend_limit','retract_limit','pressure_bar','alarm'],...rows.map(r=>[r.timeMs,Math.round(r.position*10000)/100,r.command,r.extendCoil,r.retractCoil,r.extended,r.retracted,r.pressureBar,r.alarm])].map(row=>row.map(q).join(',')).join('\r\n');
}
export function evaluateCylinderCycle(rows:readonly PneumaticTrace[]):{passed:boolean;reasons:string[]}{
 const reasons:string[]=[];
 if(!rows.some(r=>r.extended))reasons.push('No confirmed full extension');
 if(!rows.some(r=>r.extended)&&rows.some(r=>r.extendCoil))reasons.push('Extension requested but not verified');
 const firstExtended=rows.findIndex(r=>r.extended);
 if(firstExtended<0||!rows.slice(firstExtended+1).some(r=>r.retracted))reasons.push('No confirmed return after extension');
 if(rows.some(r=>r.extendCoil&&r.retractCoil))reasons.push('Conflicting coil commands');
 if(rows.some(r=>r.alarm!=='') )reasons.push('Alarm recorded during commissioning');
 if(!rows.some(r=>r.extendCoil)||!rows.some(r=>r.retractCoil))reasons.push('Both travel directions must be commanded');
 return {passed:reasons.length===0,reasons};
}
