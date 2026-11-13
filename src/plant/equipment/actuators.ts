/** P3 Tier 2 controlled obstructions and drives; mass limits are teaching approximations. */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,param,spec} from '../world/equipment';
import {q,vec,insideFootprint} from '../world/math';
import {addEvent} from '../world/events';
import type {Body,World} from '../world/types';

const moveLimit=(s:number,demand:boolean,rate:number,dt:number,blocked:boolean):number=>
 q(Math.max(0,Math.min(1,s+(blocked?0:(demand?1:-1)*rate*dt/1000))));
export const stopper:EquipmentDef={
 kind:'stopper',label:'Retractable pallet stopper',footprint:vec(90,220,180),
 commands:[{name:'extend',kind:'bool'}],
 signals:[{name:'extended',kind:'bool'},{name:'retracted',kind:'bool'},{name:'jam',kind:'bool'},
  {name:'heldLoad',kind:'bool'},{name:'heldDwellMs',kind:'number',unit:'ms'}],
 params:[spec('travelMs','Travel time','ms',100,5000,50,500),
  spec('holdSensorMode','Original body blocked dwell','0=off, 1=worker contact',0,1,1,0),
  spec('holdDwellMs','Continuous hold required','ms',100,4000,50,200)],
 faults:['stuck-extended','stuck-retracted','limit-stuck'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const desired=f==='stuck-extended'?true:f==='stuck-retracted'?false:flag(c,'extend');
  const progress=moveLimit(s.progress,desired,1000/param(ctx,'travelMs',500),dt,
    f==='stuck-extended'&&s.progress<1||f==='stuck-retracted'&&s.progress>0);
  const engaged=progress>.5;
  // Only an opt-in stopper reports sustained REAL jam-contact by the same
  // worker-owned original carton. This is not a timer since a PLC bit changed:
  // each 10 ms physical sample needs a jammed body naming THIS stopper.
  // A different carton or loss of contact restarts the dwell at zero.
  const monitored=param(ctx,'holdSensorMode',0)===1;
  const original=monitored&&engaged?w.bodies.find(b=>b.supportedBy!==null&&
   b.tags.jammed===true&&b.tags.jammedByGate===ctx.id):undefined;
  const priorSame=!!original&&s.heldContactBodyId===original.id;
  const dwell=param(ctx,'holdDwellMs',200);
  const heldContactMs=original?
   Math.min(dwell,(priorSame?(s.heldContactMs??0):0)+dt):0;
  return {state:{...s,progress,engaged,positionMm:q(progress*140),
   heldContactBodyId:original?.id??null,heldContactMs:q(heldContactMs),
   faulted:!!f,stalled:!!f},world:w};
 },
 read:(s,w,ctx)=>({extended:s.progress>=1,retracted:s.progress<=0,
  jam:s.stalled||w.bodies.some(b=>b.tags.jammed===true&&insideFootprint(b.pos,ctx.originMm,vec(140,260,0))),
  heldLoad:param(ctx,'holdSensorMode',0)===1&&s.engaged&&
   (s.heldContactMs??0)>=param(ctx,'holdDwellMs',200),
  heldDwellMs:param(ctx,'holdSensorMode',0)===1?(s.heldContactMs??0):0}),
 describe:(s,ctx)=>[draw(ctx,'gate','box',vec(80,220,Math.max(15,s.positionMm)),75,s.engaged?'#cb8047':'#688181')],
};
export const pusher:EquipmentDef={
 kind:'pusher',label:'Mass-limited pneumatic pusher',footprint:vec(180,230,170),
 commands:[{name:'extend',kind:'bool'},{name:'retract',kind:'bool'}],
 signals:[{name:'extended',kind:'bool'},{name:'retracted',kind:'bool'},{name:'stalled',kind:'bool'}],
 params:[spec('strokeMm','Stroke','mm',80,550,10,260),spec('speedMmS','Speed','mm/s',40,500,10,220),
  spec('maxMassKg','Push limit','kg',1,200,1,20)],
 faults:['pusher-weak','pusher-stuck','air-leak'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const active=flag(c,'extend')&&!flag(c,'retract')&&f!=='pusher-stuck';
  const hit=w.bodies.find(b=>insideFootprint(b.pos,ctx.originMm,vec(260,230,0)));
  const limit=param(ctx,'maxMassKg',20)*(f==='pusher-weak'?.2:1);
  const stalled=active&&!!hit&&hit.massKg>limit;
  const speed=param(ctx,'speedMmS',220)*(f==='air-leak'?.4:1);
  const delta=(active?1:-1)*speed*dt/1000;
  const x=Math.max(0,Math.min(param(ctx,'strokeMm',260),s.positionMm+(stalled?0:delta)));
  const move=q(x-s.positionMm);
  const bodies=active&&!stalled&&hit?w.bodies.map(b=>b.id===hit.id?{
    ...b,pos:{...b.pos,y:q(b.pos.y+move)}}:b):w.bodies;
  return {state:{...s,positionMm:q(x),engaged:active,stalled,faulted:!!f},
    world:bodies===w.bodies?w:{...w,bodies}};
 },
 read:(s)=>({extended:s.positionMm>=260,retracted:s.positionMm===0,stalled:s.stalled}),
 describe:(s,ctx)=>[draw(ctx,'ram','box',vec(160,80,100),60,s.stalled?'#db6558':'#bb955b')],
};
export const diverterGate:EquipmentDef={
 kind:'diverter-gate',label:'Sorting diverter gate',footprint:vec(160,250,200),
 commands:[{name:'reject',kind:'bool'}],
 signals:[{name:'rejected',kind:'bool'},{name:'home',kind:'bool'}],
 params:[spec('travelMs','Gate transition','ms',100,4000,50,600)],
 faults:['gate-jammed','gate-slow'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const move=f==='gate-jammed'?0:dt/(param(ctx,'travelMs',600)*(f==='gate-slow'?3:1));
  const demanded=flag(c,'reject');
  const progress=q(Math.max(0,Math.min(1,s.progress+(demanded?move:-move))));
  const change=progress>=1&&!s.done;
  // An arriving body receives a signed lateral displacement, not a hidden route counter.
  const bodies=change?w.bodies.map(b=>insideFootprint(b.pos,ctx.originMm,vec(200,280,0))?
    {...b,pos:{...b.pos,y:q(b.pos.y+200)},tags:{...b.tags,rejected:true}}:b):w.bodies;
  return {world:change?{...w,bodies}:w,
    state:{...s,progress,engaged:progress>.5,done:progress>=1,faulted:!!f}};
 },
 read:(s)=>({rejected:s.progress>=1,home:s.progress===0}),
 describe:(s,ctx)=>[draw(ctx,'vane','box',vec(150,45,110),70,s.engaged?'#cc9b59':'#80959b')],
};
