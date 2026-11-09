/**
 * P3 process teaching equipment: continuous level/temperature/flow, mixing,
 * bottle fill/cap. Discretised first-order systems, not hydraulic/thermal CFD.
 */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,numeric,param,spec} from '../world/equipment';
import {q,clamp,vec,insideFootprint} from '../world/math';

export const processTank:EquipmentDef={
 kind:'process-tank',label:'Analog process vessel',footprint:vec(700,700,1350),
 commands:[{name:'fill',kind:'bool'},{name:'drain',kind:'bool'},
  {name:'inletPct',kind:'number',unit:'%'}],
 signals:[{name:'levelMl',kind:'number',unit:'ml'},{name:'high',kind:'bool'},
  {name:'empty',kind:'bool'},{name:'full',kind:'bool'}],
 params:[spec('capacityMl','Tank volume','ml',1000,100000,100,10000),
  spec('fillMlS','Inlet flow','ml/s',50,5000,50,1000),
  spec('drainMlS','Outlet flow','ml/s',50,5000,50,1300)],
 faults:['inlet-blocked','valve-stuck','leak'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const cap=param(ctx,'capacityMl',10000);
  const inlet=numeric(c,'inletPct',100,0,100)/100;
  const fill=flag(c,'fill')&&f!=='inlet-blocked'?param(ctx,'fillMlS',1000)*inlet:0;
  const drain=flag(c,'drain')&&f!=='valve-stuck'?param(ctx,'drainMlS',1300):0;
  const leak=f==='leak'?150:0;
  const level=clamp(s.levelMl+(fill-drain-leak)*dt/1000,0,cap);
  return {world:w,state:{...s,levelMl:level,engaged:fill>0||drain>0,
    done:level>=cap,stalled:f==='inlet-blocked'||f==='valve-stuck',faulted:!!f}};
 },
 read:(s,w,ctx)=>({levelMl:s.levelMl,high:s.levelMl>=param(ctx,'capacityMl',10000)*.75,
  empty:s.levelMl<=0,full:s.levelMl>=param(ctx,'capacityMl',10000)}),
 describe:(s,ctx)=>[draw(ctx,'vessel','cylinder',vec(650,650,1300),650,'#7396ab'),
  draw(ctx,'contents','cylinder',vec(620,620,Math.max(10,s.levelMl/param(ctx,'capacityMl',10000)*1200)),
    Math.max(5,s.levelMl/param(ctx,'capacityMl',10000)*600),'#388da8')],
};
export const mixer:EquipmentDef={
 kind:'mixer',label:'Process agitator',footprint:vec(450,450,650),
 commands:[{name:'run',kind:'bool'}],
 signals:[{name:'running',kind:'bool'},{name:'mixed',kind:'bool'}],
 params:[spec('mixMs','Mix time','ms',500,120000,100,12000)],
 faults:['motor-stalled','impeller-slipping'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const run=flag(c,'run')&&f!=='motor-stalled';
  const rate=f==='impeller-slipping'?.35:1;
  const elapsedMs=run?s.elapsedMs+dt*rate:0;
  return {world:w,state:{...s,elapsedMs:q(elapsedMs),engaged:run,
   done:elapsedMs>=param(ctx,'mixMs',12000),faulted:!!f}};
 },
 read:s=>({running:s.engaged,mixed:s.done}),
 describe:(s,ctx)=>[draw(ctx,'agitator','cylinder',vec(250,250,600),300,
   s.engaged?'#4d9bad':'#778c9e')],
};
export const heater:EquipmentDef={
 kind:'heater',label:'First-order process heater',footprint:vec(320,320,350),
 commands:[{name:'enable',kind:'bool'},{name:'setpointC',kind:'number',unit:'C'}],
 signals:[{name:'temperatureC',kind:'number',unit:'C'},
  {name:'atSetpoint',kind:'bool'},{name:'hot',kind:'bool'}],
 params:[spec('ambientC','Ambient','C',0,40,1,20),spec('maxC','Limit','C',40,200,5,120),
  spec('tauMs','Thermal time constant','ms',1000,120000,100,20000)],
 faults:['element-open','thermostat-stuck','heat-loss'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const enabled=flag(c,'enable')&&f!=='element-open';
  const ambient=param(ctx,'ambientC',20),max=param(ctx,'maxC',120);
  const set=numeric(c,'setpointC',80,ambient,max);
  const target=enabled?f==='thermostat-stuck'?max:set:ambient;
  const tau=param(ctx,'tauMs',20000)*(f==='heat-loss'?3:1);
  const temperatureC=clamp(s.temperatureC+(target-s.temperatureC)*dt/tau,ambient,max);
  return {world:w,state:{...s,temperatureC,engaged:enabled,
    done:Math.abs(temperatureC-set)<1,faulted:!!f}};
 },
 read:s=>({temperatureC:s.temperatureC,atSetpoint:s.done,hot:s.temperatureC>=60}),
 describe:(s,ctx)=>[draw(ctx,'element','box',vec(310,290,330),165,
   s.engaged?'#c77f47':'#6e818a')],
};
export const proportionalValve:EquipmentDef={
 kind:'proportional-valve',label:'Variable opening process valve',footprint:vec(240,260,350),
 commands:[{name:'openingPct',kind:'number',unit:'%'}],
 signals:[{name:'openingPct',kind:'number',unit:'%'},
  {name:'open',kind:'bool'},{name:'closed',kind:'bool'}],
 params:[spec('travelPctS','Travel speed','%/s',5,100,5,45)],
 faults:['valve-stuck','valve-leaking'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const demanded=numeric(c,'openingPct',0,0,100);
  const wanted=f==='valve-stuck'?s.value:f==='valve-leaking'?Math.max(5,demanded):demanded;
  const delta=param(ctx,'travelPctS',45)*dt/1000;
  const value=clamp(s.value+Math.max(-delta,Math.min(delta,wanted-s.value)),0,100);
  return {world:w,state:{...s,value,engaged:value>0,done:Math.abs(value-wanted)<.1,faulted:!!f}};
 },
 read:s=>({openingPct:s.value,open:s.value>=99,closed:s.value===0}),
 describe:(s,ctx)=>[draw(ctx,'valve','cylinder',vec(240,240,250),125,
   s.engaged?'#589b8a':'#8e928f')],
};
export const filler:EquipmentDef={
 kind:'filler',label:'Bottle filler',footprint:vec(250,250,500),
 commands:[{name:'fill',kind:'bool'}],
 signals:[{name:'bottlePresent',kind:'bool'},{name:'filled',kind:'bool'}],
 params:[spec('doseMl','Dose volume','ml',50,2000,10,500),
  spec('rateMlS','Fill flow','ml/s',50,2000,50,500)],
 faults:['nozzle-blocked','overfill'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const bottle=w.bodies.find(b=>b.shape==='cylinder'&&insideFootprint(b.pos,ctx.originMm,vec(200,200,0)));
  if(!bottle)return {world:w,state:{...s,engaged:false,done:false}};
  const target=param(ctx,'doseMl',500);
  const filling=flag(c,'fill')&&f!=='nozzle-blocked';
  const current=typeof bottle.tags.filledMl==='number'?bottle.tags.filledMl:0;
  const value=clamp(current+(filling?param(ctx,'rateMlS',500)*dt/1000:0),0,f==='overfill'?target*1.2:target);
  const bodies=w.bodies.map(b=>b.id===bottle.id?{...b,tags:{...b.tags,filledMl:value}}:b);
  return {world:{...w,bodies},state:{...s,engaged:filling,done:value>=target,levelMl:value,faulted:!!f}};
 },
 read:(s,w,ctx)=>({bottlePresent:w.bodies.some(b=>b.shape==='cylinder'&&
   insideFootprint(b.pos,ctx.originMm,vec(200,200,0))),filled:s.done}),
 describe:(s,ctx)=>[draw(ctx,'nozzle','box',vec(200,200,450),225,'#688a9b')],
};
export const capper:EquipmentDef={
 kind:'capper',label:'Bottle capper',footprint:vec(240,240,500),
 commands:[{name:'cap',kind:'bool'}],
 signals:[{name:'bottlePresent',kind:'bool'},{name:'capped',kind:'bool'}],
 params:[spec('dwellMs','Cap dwell','ms',100,5000,50,800)],
 faults:['capper-jammed','missing-caps'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const bottle=w.bodies.find(b=>b.shape==='cylinder'&&insideFootprint(b.pos,ctx.originMm,vec(200,200,0)));
  const active=flag(c,'cap')&&!!bottle&&f!=='capper-jammed'&&f!=='missing-caps';
  const elapsedMs=active?s.elapsedMs+dt:0,done=!!bottle&&elapsedMs>=param(ctx,'dwellMs',800);
  const bodies=done?w.bodies.map(b=>b.id===bottle?.id?{...b,tags:{...b.tags,capped:true}}:b):w.bodies;
  return {world:done?{...w,bodies}:w,state:{...s,elapsedMs,done,engaged:active,faulted:!!f}};
 },
 read:(s,w,ctx)=>({bottlePresent:w.bodies.some(b=>b.shape==='cylinder'&&
   insideFootprint(b.pos,ctx.originMm,vec(200,200,0))),capped:s.done}),
 describe:(s,ctx)=>[draw(ctx,'capping head','box',vec(210,210,440),220,'#648a8b')],
};
