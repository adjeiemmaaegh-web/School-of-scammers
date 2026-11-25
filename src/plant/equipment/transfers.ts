/** R03/R15 conveyor family: a curved belt and powered directional transfer units (pop-up wheel, chain transfer). */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,numeric,param,spec} from '../world/equipment';
import {q,vec,face,insideFootprint} from '../world/math';
import {arcOf} from '../world/arc';

export const curvedConveyor:EquipmentDef={
 kind:'curved-conveyor',label:'Curved belt conveyor (90 degrees)',footprint:vec(900,900,120),
 commands:[{name:'run',kind:'bool'},{name:'reverse',kind:'bool'},{name:'speed',kind:'number',unit:'mm/s'}],
 signals:[{name:'moving',kind:'bool'},{name:'jam',kind:'bool'},{name:'speed',kind:'number',unit:'mm/s'}],
 params:[spec('radiusMm','Centre-line radius','mm',300,1500,50,600),spec('widthMm','Belt width','mm',150,500,50,300),
  spec('speedMmS','Surface speed','mm/s',50,1000,10,250),spec('turnRight','Turn direction','0=left, 1=right',0,1,1,0)],
 faults:['belt-slip','belt-jammed','motor-dead'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const run=flag(c,'run')&&f!=='motor-dead';
  const demanded=numeric(c,'speed',param(ctx,'speedMmS',250),0,1000);
  const actual=run?(f==='belt-slip'?demanded*.3:demanded):0;
  return {state:{...s,engaged:run,speedMmS:q(run?(flag(c,'reverse')?-actual:actual):0),stalled:f==='belt-jammed',faulted:!!f},world:w};
 },
 read:(s,w,ctx)=>({moving:s.engaged&&!s.stalled,jam:s.stalled||w.bodies.some(b=>b.supportedBy===ctx.id&&b.tags.jammed===true),
  speed:s.engaged?s.speedMmS:0}),
 describe:(s,ctx)=>{
  // Seven straight segments along the arc approximate the curved frame (drawing only; carrying uses the true arc).
  const a=arcOf({id:ctx.id,kind:'curved-conveyor',originMm:ctx.originMm,yawDeg:ctx.yawDeg,params:ctx.params});
  const segs=7,span=Math.PI/2,out=[];
  const chord=2*a.radius*Math.sin(span/segs/2)*1.04;
  // Direction from the arc centre to the entry point, in world coordinates, then sweep toward the exit.
  const entryAngle=Math.atan2(-a.sign*Math.cos(a.yawRad),a.sign*Math.sin(a.yawRad));
  for(let i=0;i<segs;i++){
   const ang=entryAngle+a.sign*(i+.5)/segs*span;
   out.push({part:'seg'+i,shape:'box' as const,
    pos:{x:a.cx+a.radius*Math.cos(ang),y:a.cy+a.radius*Math.sin(ang),z:ctx.originMm.z+60},
    size:vec(chord,a.halfWidth*2,120),yawDeg:(ang+a.sign*Math.PI/2)*180/Math.PI,colour:s.engaged?'#397fa0':'#5f7380'});
  }
  return out;
 },
};

export const transferUnit:EquipmentDef={
 kind:'transfer-unit',label:'Powered transfer (pop-up wheel / chain)',footprint:vec(600,300,120),
 commands:[{name:'run',kind:'bool'},{name:'transfer',kind:'bool'},{name:'reverse',kind:'bool'}],
 signals:[{name:'moving',kind:'bool'},{name:'transferring',kind:'bool'},{name:'jam',kind:'bool'}],
 params:[spec('lengthMm','Length','mm',200,2400,50,400),spec('widthMm','Width','mm',150,600,50,300),
  spec('speedMmS','Surface speed','mm/s',50,1000,10,250),
  spec('side','Transfer side','0=left, 1=right',0,1,1,0),
  // 45 degrees is a pop-up wheel sorter (angled wheels deflect the load diagonally); 90 is a chain transfer (straight sideways).
  spec('transferAngleDeg','Transfer angle','degrees (45 pop-up wheel, 90 chain)',15,90,15,90)],
 faults:['motor-dead','transfer-stuck'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const transfer=flag(c,'transfer')&&f!=='motor-dead'&&f!=='transfer-stuck';
  const run=(flag(c,'run')||transfer)&&f!=='motor-dead';
  const speed=param(ctx,'speedMmS',250);
  return {state:{...s,engaged:run,done:transfer,speedMmS:q(run?(flag(c,'reverse')&&!transfer?-speed:speed):0),faulted:!!f},world:w};
 },
 read:(s,w,ctx)=>({moving:s.engaged,transferring:s.done,jam:w.bodies.some(b=>b.supportedBy===ctx.id&&b.tags.jammed===true)}),
 describe:(s,ctx)=>[draw(ctx,'frame','box',vec(param(ctx,'lengthMm',400),param(ctx,'widthMm',300),120),60,s.done?'#c77a2b':s.engaged?'#397fa0':'#5f7380')],
};

/**
 * R03/R15 merge gate: priority merging of a minor lane onto a main lane with no PLC. It blocks the minor lane (the physics treats it as
 * an extended stopper) while ANY body is inside a watch zone on the main lane, and opens only after that zone has stayed clear for
 * `clearMs`, which leaves a real gap for the minor-lane part to enter. Place it on the minor lane just before the merge point.
 *
 * The zone is a square of `zoneMm` whose centre is `zoneForwardMm` ahead of the gate and `zoneLeftMm` to its left (negative = right),
 * measured in the gate's own frame (forward = its heading). A stuck-closed gate blocks permanently, a stuck-open gate never blocks.
 * `bypass` (command) opens it regardless, for a PLC that takes over.
 */
export const mergeGate:EquipmentDef={
 kind:'merge-gate',label:'Priority merge gate',footprint:vec(90,220,180),
 commands:[{name:'bypass',kind:'bool'}],
 signals:[{name:'blocking',kind:'bool'},{name:'zoneOccupied',kind:'bool'},{name:'released',kind:'number',unit:'parts'}],
 params:[spec('zoneForwardMm','Zone ahead of gate','mm',-1500,1500,10,200),
  spec('zoneLeftMm','Zone to the left of gate','mm',-1500,1500,10,-300),
  spec('zoneMm','Zone size','mm',100,1200,10,400),
  spec('clearMs','Gap kept clear','ms',0,5000,50,600)],
 faults:['stuck-closed','stuck-open'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const fwd=face(ctx.yawDeg),left={x:-fwd.y,y:fwd.x};
  const fwdMm=param(ctx,'zoneForwardMm',200),leftMm=param(ctx,'zoneLeftMm',-300),size=param(ctx,'zoneMm',400);
  const centre=vec(ctx.originMm.x+fwd.x*fwdMm+left.x*leftMm,ctx.originMm.y+fwd.y*fwdMm+left.y*leftMm,0);
  const occupied=w.bodies.some(b=>b.supportedBy!==null&&insideFootprint(b.pos,centre,vec(size,size,0)));
  // clearMs of continuous vacancy are needed before the gate opens; `elapsedMs` counts the vacancy.
  const clear=occupied?0:Math.min(param(ctx,'clearMs',600),s.elapsedMs+dt);
  const wantsBlock=!flag(c,'bypass')&&(occupied||clear<param(ctx,'clearMs',600));
  const blocking=f==='stuck-closed'?true:f==='stuck-open'?false:wantsBlock;
  const released=s.engaged&&!blocking?s.count+1:s.count;
  return {world:w,state:{...s,elapsedMs:q(clear),engaged:blocking,progress:blocking?1:0,count:released,stalled:occupied,faulted:!!f}};
 },
 read:s=>({blocking:s.engaged,zoneOccupied:s.stalled,released:s.count}),
 describe:(s,ctx)=>[draw(ctx,'gate','box',vec(80,220,s.engaged?160:30),s.engaged?80:15,s.engaged?'#c0583f':'#5a9a6b')],
};
