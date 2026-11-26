/**
 * R20 factory infrastructure that takes part in the simulation: fence panels and interlocked guard doors.
 *
 * Both are BLOCKERS in the physics: while a panel is solid it physically stops conveyed bodies at its footprint (the same
 * mechanism the stopper uses), so material flow genuinely cannot pass a fence or a closed door. A guard door also publishes
 * a "closed" interlock contact that wiring or a PLC can use to gate machines (a safety-TRAINING interlock). Educational
 * only: none of this is a safety function, a rated interlock or a certified guard.
 */
import {guardWalls} from '../world/guard-walls';
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,param,spec} from '../world/equipment';
import {q,vec} from '../world/math';

/** A fixed, always-solid fence panel: blocks conveyed material across its footprint (length x thickness, rotatable in quarter turns). */
export const safetyFence:EquipmentDef={
 kind:'safety-fence',label:'Safety fence panel',footprint:vec(1000,50,1800),
 commands:[],signals:[],
 params:[spec('lengthMm','Panel length','mm',200,3000,50,1000),spec('widthMm','Panel thickness','mm',50,400,50,50)],
 faults:[],
 fresh:()=>({...initial({}),engaged:true}),
 step:(s,w)=>({world:w,state:{...s,engaged:true}}),
 read:()=>({}),
 describe:(s,ctx)=>[draw(ctx,'fence','box',vec(param(ctx,'lengthMm',1000),Math.max(30,param(ctx,'widthMm',50)),1500),750,'#c9a227')],
};

/**
 * R20 machine guard cage: four walls around a machine with one OPEN side (a conveyor passes through it, or a guard door is fitted
 * there). Solid to conveyed material and to the walking operator like a fence, but one device with a settable size, wall
 * thickness and opening. Educational; not a rated guarding arrangement.
 */
export const machineGuard:EquipmentDef={
 kind:'machine-guard',label:'Machine guard cage',footprint:vec(1500,1500,1800),
 commands:[],signals:[],
 params:[spec('sizeMm','Cage size','mm',600,3000,100,1500),spec('thicknessMm','Wall thickness','mm',40,200,20,60),
  spec('openSide','Open side','0=closed, 1=+x, 2=+y, 3=-x, 4=-y (turns with the placement)',0,4,1,1)],
 faults:[],
 fresh:()=>({...initial({}),engaged:true}),
 step:(s,w)=>({world:w,state:{...s,engaged:true}}),
 read:()=>({}),
 describe:(s,ctx)=>guardWalls({originMm:ctx.originMm,yawDeg:ctx.yawDeg,params:ctx.params,headingDeg:ctx.headingDeg}).map((wall,i)=>
  draw({...ctx,yawDeg:0,originMm:{x:wall.cx,y:wall.cy,z:ctx.originMm.z}},'wall'+i,'box',{x:wall.w,y:wall.d,z:1500},750,'#c9a227')),
};

/** An interlocked guard door: solid until fully open; publishes `closed` (interlock contact) and `open`. */
export const guardDoor:EquipmentDef={
 kind:'guard-door',label:'Interlocked guard door',footprint:vec(800,50,1800),
 commands:[{name:'open',kind:'bool'}],
 signals:[{name:'closed',kind:'bool'},{name:'open',kind:'bool'}],
 params:[spec('lengthMm','Door width','mm',200,2000,50,800),spec('widthMm','Door thickness','mm',50,400,50,50),
  spec('travelMs','Open/close time','ms',200,5000,100,1500)],
 faults:['door-jammed','interlock-stuck-closed'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const travel=param(ctx,'travelMs',1500);
  const wantOpen=flag(c,'open');
  let progress=s.progress;
  if(f!=='door-jammed')progress=Math.max(0,Math.min(1,progress+(wantOpen?dt:-dt)/travel));
  // The door is an obstruction until it is fully open.
  // phase 1 records a welded interlock contact for read(): it reports closed whatever the door is doing.
  return {world:w,state:{...s,progress:q(progress),engaged:progress<0.999,phase:f==='interlock-stuck-closed'?1:0,faulted:!!f}};
 },
 // The dangerous failure: an interlock contact welded closed keeps reporting "closed" with the door open.
 read:(s)=>({closed:s.phase===1||s.progress<=0.001,open:s.progress>=0.999}),
 describe:(s,ctx)=>[draw(ctx,'door','box',vec(param(ctx,'lengthMm',800)*(1-s.progress*0.9),Math.max(30,param(ctx,'widthMm',50)),1500),750,s.progress<0.001?'#b5651d':'#7a9f5b')],
};

/** A handrail panel: stops a walking person (not material). Gaps between panels are the openings people use (e.g. at stairs). */
export const handrail:EquipmentDef={
 kind:'handrail',label:'Handrail / guard rail',footprint:vec(1000,40,1100),
 commands:[],signals:[],
 params:[spec('lengthMm','Rail length','mm',200,3000,50,1000)],
 faults:[],
 fresh:()=>({...initial({}),engaged:true}),
 step:(s,w)=>({world:w,state:{...s,engaged:true}}),
 read:()=>({}),
 describe:(s,ctx)=>[draw(ctx,'rail','box',vec(param(ctx,'lengthMm',1000),40,1100),550,'#d4a017')],
};
/** A raised walking platform: the floor height inside its footprint is `heightMm`. A person reaches it only by stairs. */
export const platform:EquipmentDef={
 kind:'platform',label:'Raised walking platform',footprint:vec(1200,1200,900),
 commands:[],signals:[],
 params:[spec('lengthMm','Platform length','mm',400,4000,50,1200),spec('widthMm','Platform width','mm',400,4000,50,1200),spec('heightMm','Floor height','mm',100,2500,50,900)],
 faults:[],
 fresh:()=>initial({}),
 step:(s,w)=>({world:w,state:s}),
 read:()=>({}),
 describe:(s,ctx)=>[draw(ctx,'deck','box',vec(param(ctx,'lengthMm',1200),param(ctx,'widthMm',1200),param(ctx,'heightMm',900)),param(ctx,'heightMm',900)/2,'#7d8793')],
};
/** A stair run: the floor rises linearly toward the item's heading end by `heightMm`; walking up it is the only way onto a platform. */
export const stairs:EquipmentDef={
 kind:'stairs',label:'Stair run',footprint:vec(1800,900,900),
 commands:[],signals:[],
 params:[spec('lengthMm','Run length','mm',400,5000,50,1800),spec('widthMm','Stair width','mm',400,2000,50,900),spec('heightMm','Rise','mm',100,2500,50,900)],
 faults:[],
 fresh:()=>initial({}),
 step:(s,w)=>({world:w,state:s}),
 read:()=>({}),
 describe:(s,ctx)=>{
  const length=param(ctx,'lengthMm',1800),rise=param(ctx,'heightMm',900),width=param(ctx,'widthMm',900),steps=6;
  // Steps run toward the heading end; each box is sized in its own frame (tread depth x stair width) and turned with the run,
  // like every other drawing. (Earlier the size was swapped for 90/270 AND turned, drawing those steps sideways.)
  const heading=ctx.yawDeg+(ctx.headingDeg??0),turn=heading*Math.PI/180;
  const dir=heading===0?[1,0]:heading===90?[0,1]:heading===180?[-1,0]:heading===270?[0,-1]:[Math.cos(turn),Math.sin(turn)];
  return Array.from({length:steps},(_,i)=>{
   const t=(i+.5)/steps,h=rise*(i+1)/steps;
   return {part:'step'+i,shape:'box' as const,pos:{x:ctx.originMm.x+dir[0]*(t-.5)*length,y:ctx.originMm.y+dir[1]*(t-.5)*length,z:ctx.originMm.z+h/2},
    size:vec(length/steps,width,h),yawDeg:heading,colour:'#9aa3ad'};
  });
 },
};
/**
 * A work zone: a floor area whose occupancy by the training operator is a real signal (position dependent). A restricted zone
 * latches an intrusion the moment a person enters it, which a PLC can use to stop machinery; `reset` clears it once empty.
 */
export const workZone:EquipmentDef={
 kind:'work-zone',label:'Work / restricted zone',footprint:vec(1200,1200,20),
 commands:[{name:'reset',kind:'bool'}],
 signals:[{name:'occupied',kind:'bool'},{name:'intrusion',kind:'bool'},{name:'entries',kind:'number',unit:'entries'}],
 params:[spec('lengthMm','Zone length','mm',400,6000,50,1200),spec('widthMm','Zone width','mm',400,6000,50,1200),
  spec('restricted','Restricted (intrusion latches)','0=work zone, 1=restricted',0,1,1,1)],
 faults:['zone-sensor-dead'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const person=w.trainingOperator;
  const quarter=ctx.yawDeg===90||ctx.yawDeg===270,L=param(ctx,'lengthMm',1200),W=param(ctx,'widthMm',1200);
  const hx=(quarter?W:L)/2,hy=(quarter?L:W)/2;
  const inside=!!person&&f!=='zone-sensor-dead'&&Math.abs(person.pos.x-ctx.originMm.x)<=hx&&Math.abs(person.pos.y-ctx.originMm.y)<=hy;
  const entered=inside&&!s.engaged;
  const restricted=param(ctx,'restricted',1)===1;
  const intrusion=(s.done||(entered&&restricted))&&!(flag(c,'reset')&&!inside);
  return {world:w,state:{...s,engaged:inside,done:intrusion,count:s.count+(entered?1:0),faulted:!!f}};
 },
 read:s=>({occupied:s.engaged,intrusion:s.done,entries:s.count}),
 describe:(s,ctx)=>[draw(ctx,'floor','box',vec(param(ctx,'lengthMm',1200),param(ctx,'widthMm',1200),10),5,
   s.done?'#d9534f':s.engaged?'#e0a23a':param(ctx,'restricted',1)===1?'#8a3b3b':'#4f7d6a')],
};
