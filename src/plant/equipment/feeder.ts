/** P3 bounded seeded feeder. Material enters only through visible spawn accounting. */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,param,spec} from '../world/equipment';
import {spawnBody} from '../world/bodies';
import {nextSeed} from '../world/seed';
import {q,vec} from '../world/math';
export const boxFeeder:EquipmentDef={
 kind:'box-feeder',label:'Seeded box feeder',footprint:vec(220,240,320),
 commands:[{name:'enable',kind:'bool'},{name:'feed',kind:'bool'}],
 signals:[{name:'ready',kind:'bool'},{name:'count',kind:'number',unit:'bodies'}],
 params:[spec('rateMs','Feed interval','ms',100,60000,50,1250),
  spec('boxLengthMm','Nominal length','mm',80,500,10,160),
  spec('massKg','Nominal mass','kg',1,100,1,8)],
 faults:['feeder-empty','feeder-jammed'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const enabled=flag(c,'enable')&&f!=='feeder-empty'&&f!=='feeder-jammed';
  const pulse=flag(c,'feed')&&!s.lastCommand;
  const elapsedMs=enabled?s.elapsedMs+dt:0;
  const due=enabled&&(elapsedMs>=param(ctx,'rateMs',1250)||pulse);
  let world=w,count=s.count,remaining=due?0:elapsedMs;
  if(due){
   const rng=nextSeed(w.rngState);
   const length=param(ctx,'boxLengthMm',160);
   const material=rng.unit>.5?'metal':'cardboard';
   const before=w.spawnedCount;
   world=spawnBody({...w,rngState:rng.state},ctx.id,{
    size:vec(length,Math.max(70,length*.8),Math.max(50,length*.6)),
    massKg:param(ctx,'massKg',8),pos:vec(ctx.originMm.x,ctx.originMm.y,ctx.originMm.z+120),
    tags:{material,marked:rng.unit>.75,origin:ctx.id},
   });
   if(world.spawnedCount>before)count++;
  }
  return {world,state:{...s,engaged:enabled,lastCommand:flag(c,'feed'),
   elapsedMs:q(remaining),count,done:due,faulted:!!f}};
 },
 read:(s)=>({ready:!s.faulted,count:s.count}),
 describe:(s,ctx)=>[draw(ctx,'magazine','box',vec(220,220,300),150,s.engaged?'#698d8b':'#667781')],
};
