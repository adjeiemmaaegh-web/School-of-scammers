/**
 * P3 process teaching equipment: continuous level/temperature/flow, mixing,
 * bottle fill/cap. Discretised first-order systems, not hydraulic/thermal CFD.
 */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,numeric,param,spec} from '../world/equipment';
import {q,clamp,vec,insideFootprint,face} from '../world/math';
import {PROCESS_TANK_SOLID_SIZE} from '../world/solid-geometry';

export const processTank:EquipmentDef={
 kind:'process-tank',label:'Analog process vessel',footprint:PROCESS_TANK_SOLID_SIZE,
 commands:[{name:'fill',kind:'bool'},{name:'drain',kind:'bool'},
  {name:'inletPct',kind:'number',unit:'%'}],
 signals:[{name:'levelMl',kind:'number',unit:'ml'},{name:'high',kind:'bool'},
  {name:'empty',kind:'bool'},{name:'full',kind:'bool'},{name:'temperatureC',kind:'number',unit:'C'}],
 params:[spec('capacityMl','Tank volume','ml',1000,100000,100,10000),
  spec('fillMlS','Inlet flow','ml/s',50,5000,50,1000),
  spec('drainMlS','Outlet flow','ml/s',50,5000,50,1300),
  spec('blockMaterialFlow','Block material flow','0=off, 1=on',0,1,1,0),
  // R11: how fast the liquid cools toward the 20 C room (0 = insulated: the legacy behaviour, nothing changes).
  spec('coolingTauMs','Cooling time constant (0 = insulated)','ms',0,3600000,10000,0)],
 faults:['inlet-blocked','valve-stuck','leak'],
 fresh:params=>({...initial({}),value:params.capacityMl??10000}),
 step:(s,w,c,dt,f,ctx)=>{
  const cap=param(ctx,'capacityMl',10000);
  const inlet=numeric(c,'inletPct',100,0,100)/100;
  const fill=flag(c,'fill')&&f!=='inlet-blocked'?param(ctx,'fillMlS',1000)*inlet:0;
  const drain=flag(c,'drain')&&f!=='valve-stuck'?param(ctx,'drainMlS',1300):0;
  const leak=f==='leak'?150:0;
  const level=clamp(s.levelMl+(fill-drain-leak)*dt/1000,0,cap);
  // Fresh liquid arrives at room temperature; the tank then cools toward the room only if its time constant is set.
  const room=20,inflow=Math.max(0,(level-s.levelMl)+(drain+leak)*dt/1000);
  const mixed=level>0&&inflow>0?(s.temperatureC*Math.max(0,level-inflow)+room*Math.min(level,inflow))/level:s.temperatureC;
  const tau=param(ctx,'coolingTauMs',0);
  const temperatureC=tau>0&&level>0?q(mixed+(room-mixed)*dt/tau):q(mixed);
  return {world:w,state:{...s,value:cap,temperatureC,levelMl:level,engaged:fill>0||drain>0,
    done:level>=cap,stalled:f==='inlet-blocked'||f==='valve-stuck',faulted:!!f}};
 },
 read:(s,w,ctx)=>({levelMl:s.levelMl,high:s.levelMl>=param(ctx,'capacityMl',10000)*.75,
  empty:s.levelMl<=0,full:s.levelMl>=param(ctx,'capacityMl',10000),temperatureC:s.temperatureC}),
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
/**
 * First-order process heater. By default it is a stand-alone model (its own temperature relaxing toward the setpoint, the legacy
 * behaviour). With `coupling` = 1 (R11) it is an element that heats the LIQUID of the nearest process tank within `reachMm`: the
 * tank's temperature rises by power x time / (liquid mass x 4.186 J/g/K), so the same heater warms a half-full tank twice as fast,
 * an empty tank cannot be heated (`dryFire`), the element switches off at the setpoint (and always at the limit `maxC`), and the
 * heater reports the liquid temperature. Teaching model: uniform liquid temperature, no vessel wall or element mass.
 */
export const heater:EquipmentDef={
 kind:'heater',label:'Process heater (first-order, or heating a tank)',footprint:vec(320,320,350),
 commands:[{name:'enable',kind:'bool'},{name:'setpointC',kind:'number',unit:'C'}],
 signals:[{name:'temperatureC',kind:'number',unit:'C'},
  {name:'atSetpoint',kind:'bool'},{name:'hot',kind:'bool'},{name:'dryFire',kind:'bool'}],
 params:[spec('ambientC','Ambient','C',0,40,1,20),spec('maxC','Limit','C',40,200,5,120),
  spec('tauMs','Thermal time constant','ms',1000,120000,100,20000),
  spec('coupling','Heats a tank','0=stand-alone, 1=heats the nearest tank',0,1,1,0),
  spec('powerW','Element power','W',100,20000,100,2000),
  spec('reachMm','Reach to the tank','mm',200,3000,100,800)],
 faults:['element-open','thermostat-stuck','heat-loss'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const enabled=flag(c,'enable')&&f!=='element-open';
  const ambient=param(ctx,'ambientC',20),max=param(ctx,'maxC',120);
  const set=numeric(c,'setpointC',80,ambient,max);
  if(param(ctx,'coupling',0)===1){
   let tank:{id:string;d:number}|null=null;
   for(const p of ctx.peers??[]){
    if(p.kind!=='process-tank')continue;
    const d=Math.hypot(p.originMm.x-ctx.originMm.x,p.originMm.y-ctx.originMm.y);
    if(d<=param(ctx,'reachMm',800)&&(!tank||d<tank.d))tank={id:p.id,d};
   }
   const t=tank?w.model[tank.id]:undefined;
   if(tank&&t){
    // The thermostat cuts the element at the setpoint; a stuck thermostat only stops at the hard limit.
    const wanted=f==='thermostat-stuck'?max:set;
    const on=enabled&&t.temperatureC<wanted;                  // the setpoint is already clamped to the limit
    const grams=t.levelMl;                                              // 1 ml of liquid = 1 g
    const dry=on&&grams<=0;
    const loss=f==='heat-loss'?.4:1;                                    // a fouled element delivers less of its power
    const dT=on&&grams>0?param(ctx,'powerW',2000)*loss*dt/1000/(grams*4.186):0;
    const temperatureC=q(Math.min(max,t.temperatureC+dT));
    const model=dT>0?{...w.model,[tank.id]:{...t,temperatureC}}:w.model;
    return {world:dT>0?{...w,model}:w,state:{...s,temperatureC,engaged:on&&!dry,done:Math.abs(temperatureC-set)<1,stalled:dry,faulted:!!f}};
   }
   // No tank in reach: nothing to heat.
   return {world:w,state:{...s,engaged:false,stalled:false,faulted:!!f}};
  }
  const target=enabled?f==='thermostat-stuck'?max:set:ambient;
  const tau=param(ctx,'tauMs',20000)*(f==='heat-loss'?3:1);
  const temperatureC=clamp(s.temperatureC+(target-s.temperatureC)*dt/tau,ambient,max);
  return {world:w,state:{...s,temperatureC,engaged:enabled,
    done:Math.abs(temperatureC-set)<1,faulted:!!f}};
 },
 read:s=>({temperatureC:s.temperatureC,atSetpoint:s.done,hot:s.temperatureC>=60,dryFire:s.stalled}),
 describe:(s,ctx)=>[draw(ctx,'element','box',vec(310,290,330),165,
   s.stalled?'#b24a3a':s.engaged?'#c77f47':'#6e818a')],
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
 params:[spec('dwellMs','Cap dwell','ms',100,5000,50,800),
  // Opt-in P14 sequential-fill condition. Original older projects retain 0.
  spec('requiresFilled','Require filled bottle before cap','0=legacy, 1=verified filled volume',0,1,1,0),
  spec('minFillMl','Required upstream fill','ml',50,2000,10,500)],
 faults:['capper-jammed','missing-caps'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const bottle=w.bodies.find(b=>b.shape==='cylinder'&&insideFootprint(b.pos,ctx.originMm,vec(200,200,0)));
  const filled=!!bottle&&typeof bottle.tags.filledMl==='number'&&
   bottle.tags.filledMl>=param(ctx,'minFillMl',500);
  // Dwell belongs to one physical bottle ID, not the machine's global clock.
  // A replacement bottle must earn its own complete timed cap operation.
  const active=flag(c,'cap')&&!!bottle&&bottle.tags.capped!==true&&
   (param(ctx,'requiresFilled',0)===0||filled)&&
   f!=='capper-jammed'&&f!=='missing-caps';
  const activeBodyId=active?bottle!.id:null;
  const elapsedMs=active?(s.activeBodyId===activeBodyId?s.elapsedMs+dt:dt):0;
  const newCap=active&&elapsedMs>=param(ctx,'dwellMs',800);
  const done=!!bottle&&(bottle.tags.capped===true||newCap);
  const bodies=newCap?w.bodies.map(b=>b.id===bottle?.id?{...b,
   tags:{...b.tags,capped:true}}:b):w.bodies;
  return {world:newCap?{...w,bodies}:w,state:{...s,activeBodyId,elapsedMs,
   done,engaged:active,faulted:!!f}};
 },
 read:(s,w,ctx)=>({bottlePresent:w.bodies.some(b=>b.shape==='cylinder'&&
   insideFootprint(b.pos,ctx.originMm,vec(200,200,0))),capped:s.done}),
 describe:(s,ctx)=>[draw(ctx,'capping head','box',vec(210,210,440),220,'#648a8b')],
};

/**
 * R11 transfer pump with a pump curve. It moves liquid between the two nearest process tanks along its own axis: the SOURCE is
 * the nearest tank behind it and the DESTINATION the nearest tank ahead (within `reachMm`). Volume is conserved exactly: whatever
 * leaves the source enters the destination, limited by what the source holds and the destination can take.
 *
 * Curve: flow = maxFlow x speed x (1 - head / shutoffHead) x (1 - pipeLoss), head = how far the destination liquid surface stands above
 * the source's (levels converted to height through `areaCm2`). At shut-off head the pump delivers nothing; a destination fuller than
 * the source pushes back. Dry running (run commanded with an empty source) raises a dry-run condition and delivers nothing.
 * Teaching model: no inertia, no pipe network beyond one loss factor, no temperature carried with the liquid.
 */
export const transferPump:EquipmentDef={
 kind:'transfer-pump',label:'Transfer pump between tanks',footprint:vec(300,260,300),
 commands:[{name:'run',kind:'bool'},{name:'speedPct',kind:'number',unit:'%'}],
 signals:[{name:'flowMlS',kind:'number',unit:'ml/s'},{name:'running',kind:'bool'},{name:'dryRun',kind:'bool'},
  {name:'blocked',kind:'bool'},{name:'headCm',kind:'number',unit:'cm'},{name:'connected',kind:'bool'}],
 params:[spec('maxFlowMlS','Free-delivery flow','ml/s',50,5000,50,1000),
  spec('shutoffHeadCm','Shut-off head','cm',10,500,10,100),
  spec('areaCm2','Tank cross-section','cm2',50,5000,50,500),
  spec('pipeLossPct','Pipe restriction','%',0,95,5,0),
  spec('reachMm','Reach to tanks','mm',500,6000,100,3000)],
 faults:['blocked-pipe','worn-impeller','dry-run-protection-off'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const idle={world:w,state:{...s,engaged:false,stalled:false,faulted:!!f,value:0}};
  const fwd=face(ctx.yawDeg);
  const reach=param(ctx,'reachMm',3000);
  let from:{id:string;d:number}|null=null,to:{id:string;d:number}|null=null;
  for(const p of ctx.peers??[]){
   if(p.kind!=='process-tank')continue;
   const dx=p.originMm.x-ctx.originMm.x,dy=p.originMm.y-ctx.originMm.y;
   const along=dx*fwd.x+dy*fwd.y,across=Math.abs(dx*fwd.y-dy*fwd.x);
   if(across>600||Math.abs(along)>reach||Math.abs(along)<1)continue;
   if(along<0){if(!from||-along<from.d)from={id:p.id,d:-along};}
   else if(!to||along<to.d)to={id:p.id,d:along};
  }
  const src=from?w.model[from.id]:undefined,dst=to?w.model[to.id]:undefined;
  if(!src||!dst||!from||!to)return idle;
  const running=flag(c,'run');
  if(!running)return {world:w,state:{...s,engaged:false,stalled:false,faulted:!!f,value:0,done:false}};
  const speed=numeric(c,'speedPct',100,0,100)/100;
  const area=param(ctx,'areaCm2',500),shut=param(ctx,'shutoffHeadCm',100);
  // 1 ml = 1 cm3, so height(cm) = level(ml) / area(cm2)
  const head=dst.levelMl/area-src.levelMl/area;
  const loss=param(ctx,'pipeLossPct',0)/100;
  const worn=f==='worn-impeller'?.5:1;
  const curve=Math.max(0,1-Math.max(0,head)/shut);
  const dryRun=src.levelMl<=0;
  const rate=f==='blocked-pipe'||dryRun?0:param(ctx,'maxFlowMlS',1000)*speed*curve*(1-loss)*worn;
  const moved=Math.min(rate*dt/1000,src.levelMl);
  // A process tank publishes its own capacity in `value`, so the pump never overfills a tank it cannot see the settings of.
  const room=Math.max(0,(dst.value>0?dst.value:dst.levelMl)-dst.levelMl);
  const flow=Math.min(moved,room);
  // The liquid carries its temperature: the destination becomes the volume-weighted mix of what it held and what arrived.
  const mixedC=dst.levelMl+flow>0?(dst.temperatureC*dst.levelMl+src.temperatureC*flow)/(dst.levelMl+flow):dst.temperatureC;
  const model={...w.model,[from.id]:{...src,levelMl:q(src.levelMl-flow)},[to.id]:{...dst,levelMl:q(dst.levelMl+flow),temperatureC:q(mixedC)}};
  return {world:{...w,model},state:{...s,engaged:flow>0,value:flow*1000/dt,stalled:dryRun||f==='blocked-pipe'||(rate>0&&flow<=0),faulted:!!f,done:false,
    elapsedMs:q(head*100)}};
 },
 read:(s,w,ctx)=>({flowMlS:q(s.value),running:s.engaged,dryRun:s.stalled&&!s.faulted,blocked:s.stalled&&s.faulted,headCm:q(s.elapsedMs/100),connected:true}),
 describe:(s,ctx)=>[draw(ctx,'casing','cylinder',vec(260,260,260),130,s.engaged?'#3f8fb0':'#6d8794'),
  draw(ctx,'pipe','box',vec(520,80,80),120,'#8aa0aa')],
};

/**
 * R11 in-line valve for tank networks: a gravity transfer valve between the two nearest process tanks along its own axis (one behind
 * it, one ahead, within `reachMm`). Liquid flows from the HIGHER liquid surface to the lower one, whichever side that is:
 * flow = maxFlow x opening x sqrt(head / refHead), where head is the surface-height difference (levels converted through `areaCm2`)
 * and opening is the commanded `openingPct` (0 when unwired: the valve is closed). It stops when the surfaces are level, when the
 * higher tank is empty or the lower one full, and conserves volume and carries temperature like the transfer pump. Several valves and
 * pumps around one tank make a branching network. Teaching model: head-driven, no pipe inertia, no pressure solved across loops.
 */
export const transferValve:EquipmentDef={
 kind:'transfer-valve',label:'Gravity transfer valve between tanks',footprint:vec(260,200,260),
 commands:[{name:'openingPct',kind:'number',unit:'%'}],
 signals:[{name:'flowMlS',kind:'number',unit:'ml/s'},{name:'open',kind:'bool'},{name:'headCm',kind:'number',unit:'cm'},{name:'connected',kind:'bool'}],
 params:[spec('maxFlowMlS','Flow at full opening and reference head','ml/s',50,5000,50,800),
  spec('refHeadCm','Reference head','cm',5,300,5,50),spec('areaCm2','Tank cross-section','cm2',50,5000,50,500),
  spec('reachMm','Reach to tanks','mm',500,6000,100,3000)],
 faults:['valve-stuck','blocked-pipe'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const fwd=face(ctx.yawDeg),reach=param(ctx,'reachMm',3000);
  let behind:{id:string;d:number}|null=null,ahead:{id:string;d:number}|null=null;
  for(const p of ctx.peers??[]){
   if(p.kind!=='process-tank')continue;
   const dx=p.originMm.x-ctx.originMm.x,dy=p.originMm.y-ctx.originMm.y;
   const along=dx*fwd.x+dy*fwd.y,across=Math.abs(dx*fwd.y-dy*fwd.x);
   if(across>600||Math.abs(along)>reach||Math.abs(along)<1)continue;
   if(along<0){if(!behind||-along<behind.d)behind={id:p.id,d:-along};}
   else if(!ahead||along<ahead.d)ahead={id:p.id,d:along};
  }
  const a=behind?w.model[behind.id]:undefined,b=ahead?w.model[ahead.id]:undefined;
  // A stuck valve keeps the opening it had; otherwise it follows the command (closed when unwired).
  const opening=f==='valve-stuck'?s.value:numeric(c,'openingPct',0,0,100);
  if(!a||!b||!behind||!ahead)return {world:w,state:{...s,value:opening,engaged:false,faulted:!!f}};
  const area=param(ctx,'areaCm2',500);
  const headCm=(a.levelMl-b.levelMl)/area;                                   // positive: behind is higher
  const from=headCm>=0?{id:behind.id,t:a}:{id:ahead.id,t:b},to=headCm>=0?{id:ahead.id,t:b}:{id:behind.id,t:a};
  const rate=f==='blocked-pipe'?0:param(ctx,'maxFlowMlS',800)*opening/100*Math.sqrt(Math.abs(headCm)/param(ctx,'refHeadCm',50));
  const room=Math.max(0,(to.t.value>0?to.t.value:to.t.levelMl)-to.t.levelMl);
  // Never move more than levels the surfaces: half the difference at most per step (no overshoot past level).
  const levelling=Math.abs(a.levelMl-b.levelMl)/2;
  const flow=Math.min(rate*dt/1000,from.t.levelMl,room,levelling);
  const mixedC=to.t.levelMl+flow>0?(to.t.temperatureC*to.t.levelMl+from.t.temperatureC*flow)/(to.t.levelMl+flow):to.t.temperatureC;
  const model=flow>0?{...w.model,[from.id]:{...from.t,levelMl:q(from.t.levelMl-flow)},[to.id]:{...to.t,levelMl:q(to.t.levelMl+flow),temperatureC:q(mixedC)}}:w.model;
  return {world:flow>0?{...w,model}:w,state:{...s,value:opening,engaged:flow>0,progress:q(headCm),elapsedMs:q(flow*1000/dt),faulted:!!f,stalled:rate>0&&flow<=0}};
 },
 read:s=>({flowMlS:q(s.elapsedMs),open:s.value>0,headCm:q(s.progress),connected:true}),
 describe:(s,ctx)=>[draw(ctx,'body','cylinder',vec(220,220,200),100,s.engaged?'#3f8fb0':s.value>0?'#6d9aa8':'#6d7d87'),
  draw(ctx,'pipe','box',vec(520,70,70),110,'#8aa0aa')],
};
