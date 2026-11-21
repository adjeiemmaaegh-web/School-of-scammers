/** R03/R15 conveyor family: a curved belt and powered directional transfer units (pop-up wheel, chain transfer). */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,numeric,param,spec} from '../world/equipment';
import {q,vec} from '../world/math';
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
