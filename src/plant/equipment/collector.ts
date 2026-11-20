/** R26: product collector (material sink). Removes bodies that arrive in its footprint, counts them, and reports full. */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,param,spec} from '../world/equipment';
import {despawnBody} from '../world/bodies';
import {addEvent} from '../world/events';
import {materialByIndex,MATERIALS} from '../world/materials';
import {insideFootprint,q,vec} from '../world/math';
import type {Body,World} from '../world/types';

export const collector:EquipmentDef={
 kind:'collector',label:'Product collector (sink)',footprint:vec(400,400,200),
 commands:[{name:'enable',kind:'bool'}],
 signals:[{name:'full',kind:'bool'},{name:'count',kind:'number',unit:'bodies'},{name:'weightKg',kind:'number',unit:'kg'}],
 params:[spec('capacity','Capacity','bodies',1,500,1,50),
  // 0 accepts anything; 1-N accepts only that catalogue material (a reject bin takes the others elsewhere).
  spec('acceptMaterial','Accepted material','0=any, 1-'+MATERIALS.length+'=catalogue',0,MATERIALS.length,1,0)],
 faults:['collector-jammed'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const capacity=param(ctx,'capacity',50);
  const want=materialByIndex(param(ctx,'acceptMaterial',0));
  const open=flag(c,'enable')&&f!=='collector-jammed';
  let world:World=w,count=s.count,mass=s.value;
  if(open)for(const body of w.bodies){
   if(count>=capacity)break;
   if(!insideFootprint(body.pos,ctx.originMm,vec(400,400,0))||body.pos.z>ctx.originMm.z+250)continue;
   if(want&&body.tags.material!==want.id)continue;
   count++;mass=q(mass+body.massKg);
   world=addEvent(despawnBody(world,ctx.id,body.id),{kind:'process',source:ctx.id,bodyId:body.id,
    detail:'Collected '+String(body.tags.material??'body')});
  }
  return {world,state:{...s,count,value:mass,engaged:open,done:count>=capacity,faulted:!!f}};
 },
 read:s=>({full:s.done,count:s.count,weightKg:s.value}),
 describe:(s,ctx)=>[draw(ctx,'bin','box',vec(380,380,150),75,s.done?'#c98a45':s.engaged?'#4f9d86':'#667781')],
};
export type CollectedBody=Body;
