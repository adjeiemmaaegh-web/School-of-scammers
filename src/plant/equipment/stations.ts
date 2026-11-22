/**
 * R05/R16/R18 production stations. One equipment kind with four operations, driven by a PLC `run` command:
 *   1 machine  - a raw part at rest in the station is machined (raw -> machined) over the cycle time; tools wear and worn tools
 *                make defective parts (seeded, deterministic);
 *   2 join     - a machined part and a second machined part in the station are joined into one (weld/glue): the partner is
 *                consumed, its mass added, stage -> assembled;
 *   3 assemble - a machined part plus a component (lid, plastic part) are assembled: component consumed, stage -> assembled;
 *   4 inspect  - any part is measured: tagged pass/fail by its defect; the `fail` signal drives a reject mechanism.
 * Parts must be held in the station (a stopper on the belt, as on a real line). Every transformation appends to the part's
 * `trace` tag, so a finished part can be read back to the stations that produced it (R16).
 */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,param,spec} from '../world/equipment';
import {despawnBody} from '../world/bodies';
import {addEvent} from '../world/events';
import {nextSeed} from '../world/seed';
import {insideFootprint,q,vec} from '../world/math';
import type {Body,World} from '../world/types';

export const STATION_OPS=['machine','join','assemble','inspect','rework'] as const;
const TRACE_MAX=96;
const stageOf=(b:Body):string=>typeof b.tags.stage==='string'?b.tags.stage:'raw';
const addTrace=(b:Body,code:string,stationId:string):string=>{
 const next=(typeof b.tags.trace==='string'&&b.tags.trace?b.tags.trace+'>':'')+code+':'+stationId;
 return next.length>TRACE_MAX?next.slice(next.length-TRACE_MAX):next;
};
const atRest=(b:Body):boolean=>Math.hypot(b.vel.x,b.vel.y)<5&&b.vel.z===0;

export const processStation:EquipmentDef={
 kind:'process-station',label:'Production station (machine / join / assemble / inspect)',footprint:vec(400,400,300),
 commands:[{name:'run',kind:'bool'},{name:'toolChange',kind:'bool'}],
 signals:[{name:'busy',kind:'bool'},{name:'partPresent',kind:'bool'},{name:'cycleDone',kind:'bool'},{name:'fail',kind:'bool'},
  {name:'toolWorn',kind:'bool'},{name:'count',kind:'number',unit:'parts'},{name:'toolWear',kind:'number',unit:'cycles'},
  {name:'progress',kind:'number',unit:'fraction'}],
 params:[spec('operation','Operation','1=machine, 2=join, 3=assemble, 4=inspect, 5=rework',1,5,1,1),
  spec('cycleMs','Cycle time','ms',200,30000,50,2000),
  spec('lengthMm','Station length','mm',100,1000,50,400),spec('widthMm','Station width','mm',100,1000,50,400),
  spec('toolLifeCycles','Tool life','cycles (0 = unlimited)',0,500,1,0),
  spec('defectPct','Base defect rate','percent',0,100,1,0)],
 faults:['tool-broken','tool-worn','station-stuck'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const op=param(ctx,'operation',1),cycleMs=param(ctx,'cycleMs',2000);
  const footprint=vec(param(ctx,'lengthMm',400),param(ctx,'widthMm',400),0);
  const inside=(b:Body)=>insideFootprint(b.pos,ctx.originMm,footprint)&&Math.abs(b.pos.z-(ctx.originMm.z+120))<200&&atRest(b)&&b.supportedBy!==null;
  const present=w.bodies.filter(inside);
  // The part being worked is the first (lowest id) body that fits the operation's input stage.
  const wanted=(b:Body)=>op===1?stageOf(b)==='raw':op===4?b.tags.inspected!==true:op===5?b.tags.defect===true:stageOf(b)==='machined';
  const main=present.find(wanted);
  const second=op===2?present.find(b=>b.id!==main?.id&&stageOf(b)==='machined'):
   op===3?present.find(b=>b.id!==main?.id&&b.tags.category==='component'):undefined;
  const wear=s.value;
  let wearNow=flag(c,'toolChange')?0:wear;
  const broken=f==='tool-broken'||f==='station-stuck';
  const canRun=flag(c,'run')&&!broken&&!!main&&(op===2||op===3?!!second:true);
  const elapsedMs=canRun&&s.activeBodyId===main?.id?s.elapsedMs+dt:canRun?dt:0;
  const activeBodyId=canRun?main!.id:null;
  const base:typeof s={...s,value:wearNow,engaged:canRun,activeBodyId,elapsedMs,progress:canRun?q(Math.min(1,elapsedMs/cycleMs)):0,stalled:broken,faulted:!!f};
  // cycleDone stays true while a part this station has finished is still standing in it (a PLC samples levels, not pulses).
  const finishedHere=(b:Body)=>op===1?b.tags.machinedBy===ctx.id:op===4?b.tags.inspectedBy===ctx.id:op===5?b.tags.reworkedBy===ctx.id:b.tags.assembledBy===ctx.id;
  if(!canRun||elapsedMs<cycleMs)return {state:{...base,done:present.some(finishedHere)},world:w};
  // Cycle complete: transform the part(s).
  const life=param(ctx,'toolLifeCycles',0);
  const worn=op===1&&(f==='tool-worn'||(life>0&&wearNow>=life));
  const rng=nextSeed(w.rngState);
  const defectChance=(worn?60:0)+param(ctx,'defectPct',0);
  const makesDefect=op<=3&&rng.unit*100<defectChance;
  let world:World={...w,rngState:rng.state};
  let failed=false;
  const code=op===1?'M':op===2?'J':op===3?'A':op===5?'R':'I';
  world={...world,bodies:world.bodies.map(b=>{
   if(b.id!==main!.id)return b;
   const tags:Body['tags']={...b.tags,trace:addTrace(b,code,ctx.id)};
   if(op===1){tags.stage='machined';tags.machinedBy=ctx.id;if(makesDefect)tags.defect=true;}
   if(op===2||op===3){tags.stage='assembled';tags.assembledBy=ctx.id;if(makesDefect)tags.defect=true;
    tags.parts=(typeof tags.parts==='number'?tags.parts:1)+1;}
   // Rework (R25) removes the defect, forgets the old verdict (so the part can be inspected again) and keeps the trace.
   if(op===5){tags.defect=false;tags.reworked=true;tags.reworkedBy=ctx.id;delete tags.inspected;delete tags.inspectedBy;delete tags.inspectResult;delete tags.rejected;}
   if(op===4){tags.inspected=true;tags.inspectedBy=ctx.id;failed=tags.defect===true;tags.inspectResult=failed?'fail':'pass';
    if(failed)tags.rejected=true;}
   return {...b,tags,massKg:q(b.massKg+(op===2||op===3?second!.massKg:0))};
  })};
  if(second)world=despawnBody(world,ctx.id,second.id);
  world=addEvent(world,{kind:'process',source:ctx.id,bodyId:main!.id,
   detail:(op===1?'Machined':op===2?'Joined':op===3?'Assembled':op===5?'Reworked':failed?'Inspection FAILED':'Inspected OK')+' '+main!.id+
    (second?' with '+second.id:'')+(makesDefect?' (defect)':'')});
  if(op===1)wearNow+=1;
  return {state:{...base,value:wearNow,count:s.count+1,elapsedMs:0,done:true,progress:1,phase:op===4?(failed?1:0):s.phase,activeBodyId:null},world};
 },
 read:(s,w,ctx)=>({busy:s.engaged,partPresent:w.bodies.some(b=>insideFootprint(b.pos,ctx.originMm,vec(param(ctx,'lengthMm',400),param(ctx,'widthMm',400),0))&&
   Math.abs(b.pos.z-(ctx.originMm.z+120))<200&&Math.hypot(b.vel.x,b.vel.y)<5&&b.supportedBy!==null),
  cycleDone:s.done,fail:s.phase===1,toolWorn:param(ctx,'toolLifeCycles',0)>0&&s.value>=param(ctx,'toolLifeCycles',0),
  count:s.count,toolWear:s.value,progress:s.progress}),
 describe:(s,ctx)=>[draw(ctx,'frame','box',vec(param(ctx,'lengthMm',400),param(ctx,'widthMm',400),260),130,
   s.stalled?'#b24a3a':s.engaged?'#c2862a':s.done?'#4f9d86':'#6a6f78')],
};
