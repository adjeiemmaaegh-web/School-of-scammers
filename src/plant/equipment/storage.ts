/** P3 Tier 3 small 3 x 5 educational AS/RS warehouse with bounded occupancy. */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,numeric,param,spec} from '../world/equipment';
import {insideFootprint,q,vec} from '../world/math';
import {SHELF_SOLID_SIZE} from '../world/solid-geometry';
export const shelf:EquipmentDef={
 kind:'shelf',label:'3 by 5 storage rack',footprint:SHELF_SOLID_SIZE,
 commands:[],signals:[{name:'occupiedCount',kind:'number',unit:'bays'}],
 params:[spec('blockMaterialFlow','Block material flow','0=off, 1=on',0,1,1,0)],
 faults:[],fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>({world:w,state:s}),
 read:(s,w,ctx)=>({occupiedCount:Object.keys(s.slots??{}).length}),
 describe:(s,ctx)=>[draw(ctx,'rack','box',vec(1060,580,2900),1450,'#597d98')],
};
export const asrsCrane:EquipmentDef={
 kind:'asrs-crane',label:'15-bay storage crane',footprint:vec(1300,750,3100),
 commands:[{name:'bay',kind:'number',unit:'index'},{name:'store',kind:'bool'},{name:'retrieve',kind:'bool'}],
 signals:[{name:'busy',kind:'bool'},{name:'bayOccupied',kind:'bool'},
  {name:'storedCount',kind:'number',unit:'bodies'},{name:'atBay',kind:'number',unit:'index'}],
 params:[spec('travelMs','Travel time per bay','ms',100,5000,50,500)],
 faults:['fork-jammed','crane-motor-fault','bay-sensor-stuck'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const bay=numeric(c,'bay',1,1,15);
  if(!Number.isInteger(bay))throw new RangeError('ASRS bay must be integer 1–15');
  // Physically require a wired PLC store/retrieve request to drive a crane:
  // previously the model autonomously completed travel on every scan, even
  // with both commands OFF, so a wrong PLC could appear to reach a bay.
  const requested=flag(c,'store')||flag(c,'retrieve');
  const travel=param(ctx,'travelMs',500);
  const motion=requested&&f!=='crane-motor-fault'?dt/travel:0;
  const progress=Math.max(0,Math.min(1,s.progress+motion));
  const atBay=progress===1?bay:s.value;
  const slots={...s.slots};
  let bodies=w.bodies,count=s.count;
  const canHandle=progress===1&&f!=='fork-jammed';
  const store=flag(c,'store')&&!s.lastCommand&&canHandle&&slots[bay]===undefined;
  if(store){
   const body=w.bodies.find(b=>insideFootprint(b.pos,ctx.originMm,vec(350,500,0))&&!b.tags.stored);
   if(body){
    slots[bay]=body.id;
    bodies=w.bodies.map(b=>b.id===body.id?{...b,
      pos:vec(ctx.originMm.x+(bay-1)%3*330,ctx.originMm.y,
        ctx.originMm.z+Math.floor((bay-1)/3)*450+220),
      supportedBy:ctx.id,tags:{...b.tags,stored:true}}:b);
    count++;
   }
  }
  const retrieve=flag(c,'retrieve')&&!s.lastCommand&&canHandle&&!!slots[bay];
  if(retrieve){
   const id=slots[bay];delete slots[bay];
   bodies=bodies.map(b=>b.id===id?{...b,
      pos:vec(ctx.originMm.x-450,ctx.originMm.y,ctx.originMm.z+120),
      supportedBy:null,tags:{...b.tags,stored:false}}:b);count--;
  }
  return {world:bodies===w.bodies?w:{...w,bodies},state:{...s,slots,
    count,positionMm:q(atBay),value:bay,progress:canHandle?1:progress,
    engaged:requested&&progress<1,lastCommand:requested,faulted:!!f}};
 },
 read:(s,w,ctx)=>({busy:s.engaged,bayOccupied:!!s.slots?.[s.value],storedCount:s.count,
  atBay:s.positionMm}),
 describe:(s,ctx)=>[draw(ctx,'crane','box',vec(280,400,2500),1250,'#678d9c')],
};
