/** P3 bounded seeded feeder. Material enters only through visible spawn accounting. */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,param,spec} from '../world/equipment';
import {spawnBody} from '../world/bodies';
import {nextSeed} from '../world/seed';
import {MATERIALS,materialByIndex,materialSpawn} from '../world/materials';
import {q,vec} from '../world/math';
export const boxFeeder:EquipmentDef={
 kind:'box-feeder',label:'Seeded box feeder',footprint:vec(220,240,320),
 commands:[{name:'enable',kind:'bool'},{name:'feed',kind:'bool'}],
 signals:[{name:'ready',kind:'bool'},{name:'empty',kind:'bool'},{name:'count',kind:'number',unit:'bodies'}],
 params:[spec('rateMs','Feed interval','ms',100,60000,50,1250),
  spec('boxLengthMm','Nominal length','mm',80,500,10,160),
  spec('massKg','Nominal mass','kg',1,100,1,8),
  spec('shapeMode','Body form','0=original box, 1=cylinder bottle',0,1,1,0),
  // R26/R02: choose a catalogue material (0 keeps the original random cardboard/metal box), cap the production run, and mix sizes.
  spec('materialId','Material','0=original, 1-'+MATERIALS.length+'=catalogue',0,MATERIALS.length,1,0),
  spec('quantity','Production quantity','0=unlimited',0,1000,1,0),
  spec('variationPct','Size and weight variation','percent',0,50,5,0),
  // R04: 1 gives every body a sequential numeric RFID tag (count + 1) that an RFID reader can read; 0 leaves bodies untagged.
  spec('rfidTags','RFID tag on each body','0=none, 1=sequential',0,1,1,0)],
 faults:['feeder-empty','feeder-jammed'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const quantity=param(ctx,'quantity',0);
  // A finished production run is depletion: the source stops, the count stays and OUT_empty reports it.
  const depleted=quantity>0&&s.count>=quantity;
  const enabled=flag(c,'enable')&&f!=='feeder-empty'&&f!=='feeder-jammed'&&!depleted;
  const pulse=flag(c,'feed')&&!s.lastCommand;
  const elapsedMs=enabled?s.elapsedMs+dt:0;
  // A physical rising-edge CMD_feed pulse dispenses one body even with
  // continuous auto-feed disabled. A held feed command cannot create an
  // unlimited stream: rising-edge detection uses the previous model state.
  // Continuous enable still follows the original interval and fault gates.
  const available=f!=='feeder-empty'&&f!=='feeder-jammed'&&!depleted;
  const due=available&&(enabled&&elapsedMs>=param(ctx,'rateMs',1250)||pulse);
  // A magazine cannot discharge onto an occupied exit: if a body is already standing where the new one would appear, the
  // feeder waits (and keeps its timer) instead of stacking bodies on top of each other, which would lock them together.
  const cat=materialByIndex(param(ctx,'materialId',0));
  const length=param(ctx,'boxLengthMm',160);
  const nominal=cat?cat.sizeMm:param(ctx,'shapeMode',0)===1?vec(90,90,190):vec(length,Math.max(70,length*.8),Math.max(50,length*.6));
  const pad=cat&&param(ctx,'variationPct',0)>0?1+param(ctx,'variationPct',0)/100:1;
  const exitBlocked=due&&w.bodies.some(b=>Math.abs(b.pos.x-ctx.originMm.x)<(b.size.x+nominal.x*pad)/2&&
   Math.abs(b.pos.y-ctx.originMm.y)<(b.size.y+nominal.y*pad)/2&&Math.abs(b.pos.z-(ctx.originMm.z+120))<150);
  let world=w,count=s.count,remaining=due?(exitBlocked?elapsedMs:0):elapsedMs;
  if(due&&!exitBlocked){
   const rng=nextSeed(w.rngState);
   const length=param(ctx,'boxLengthMm',160);
   const material=rng.unit>.5?'metal':'cardboard';
   const before=w.spawnedCount;
   const bottle=param(ctx,'shapeMode',0)===1;
   const catalogue=materialByIndex(param(ctx,'materialId',0));
   if(catalogue){
    // Seeded variation gives mixed-size, mixed-weight loads without any wall-clock randomness.
    const pct=param(ctx,'variationPct',0);
    const vary=nextSeed(rng.state);
    const scale=1+(vary.unit*2-1)*pct/100;
    const dims=catalogue.sizeMm;
    world=spawnBody({...w,rngState:vary.state},ctx.id,materialSpawn(catalogue,
     vec(ctx.originMm.x,ctx.originMm.y,ctx.originMm.z+120),
     {size:vec(Math.max(10,dims.x*scale),Math.max(10,dims.y*scale),Math.max(10,dims.z*scale)),
      massKg:Math.max(.01,catalogue.massKg*scale*scale*scale),tags:{origin:ctx.id,marked:rng.unit>.75}}));
   }else
   world=spawnBody({...w,rngState:rng.state},ctx.id,{
    shape:bottle?'cylinder':'box',
    size:bottle?vec(90,90,190):vec(length,Math.max(70,length*.8),Math.max(50,length*.6)),
    massKg:param(ctx,'massKg',8),pos:vec(ctx.originMm.x,ctx.originMm.y,ctx.originMm.z+120),
    tags:{material,marked:rng.unit>.75,origin:ctx.id,
     ...(bottle?{bottle:true,filledMl:0,capped:false}:{})},
   });
   if(world.spawnedCount>before){
    count++;
    if(param(ctx,'rfidTags',0)===1){
     const last=world.bodies[world.bodies.length-1];
     world={...world,bodies:world.bodies.map(b=>b.id===last.id?{...b,tags:{...b.tags,rfid:count}}:b)};
    }
   }
  }
  return {world,state:{...s,engaged:enabled,lastCommand:flag(c,'feed'),
   elapsedMs:q(remaining),count,done:due&&!exitBlocked,stalled:exitBlocked,faulted:!!f}};
 },
 read:(s,w,ctx)=>({ready:!s.faulted&&!(param(ctx,'quantity',0)>0&&s.count>=param(ctx,'quantity',0)),
  empty:param(ctx,'quantity',0)>0&&s.count>=param(ctx,'quantity',0),count:s.count}),
 describe:(s,ctx)=>[draw(ctx,'magazine','box',vec(220,220,300),150,s.engaged?'#698d8b':'#667781')],
};
