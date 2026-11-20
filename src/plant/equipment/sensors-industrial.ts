/**
 * R04 / R17 / R21 industrial sensors: retroreflective photoeye, laser displacement sensor, RFID reader and machine-vision
 * inspection sensor. Each reads REAL body properties from the authoritative worker world (size, position, mass tags and the
 * material catalogue tags) and publishes PLC-readable signals. All four share a continuous aim angle: the sensor head can be
 * pointed at any angle (aimDeg, 5 degree steps) independently of the 90 degree placement yaw.
 * Educational models: no optics, RF propagation or image processing is simulated beyond the stated rules.
 */
import type {EquipmentContext,EquipmentDef} from '../world/equipment';
import {draw,initial,param,spec} from '../world/equipment';
import type {Body} from '../world/types';
import {q,vec} from '../world/math';

const RAD=Math.PI/180;
/** Beam direction in the horizontal plane: placement yaw plus the continuous aim angle. */
const aim=(ctx:EquipmentContext):{x:number;y:number}=>{
 const a=(ctx.yawDeg+param(ctx,'aimDeg',0))*RAD;
 return {x:Math.cos(a),y:Math.sin(a)};
};
const bodyHalf=(b:Body):{hx:number;hy:number}=>{
 const quarter=b.yawDeg===90||b.yawDeg===270;
 const sx=quarter?b.size.y:b.size.x,sy=quarter?b.size.x:b.size.y;
 return {hx:sx/2,hy:sy/2};
};
/** Distance along a ray from (ox,oy) in direction d to the nearest surface of the body footprint, or null (2D slab / circle). */
function rayHit(ox:number,oy:number,d:{x:number;y:number},b:Body):number|null{
 if(b.shape==='cylinder'){
  const r=Math.max(b.size.x,b.size.y)/2,fx=b.pos.x-ox,fy=b.pos.y-oy;
  const along=fx*d.x+fy*d.y,perp2=fx*fx+fy*fy-along*along;
  if(perp2>r*r)return null;
  const t=along-Math.sqrt(r*r-perp2);
  return t>=0?t:(along+Math.sqrt(r*r-perp2)>=0?0:null);
 }
 const {hx,hy}=bodyHalf(b);
 let tmin=0,tmax=Infinity;
 for(const [o,dd,c,h] of [[ox,d.x,b.pos.x,hx],[oy,d.y,b.pos.y,hy]] as const){
  if(Math.abs(dd)<1e-9){if(o<c-h||o>c+h)return null;continue;}
  let t1=(c-h-o)/dd,t2=(c+h-o)/dd;if(t1>t2)[t1,t2]=[t2,t1];
  tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);
  if(tmin>tmax)return null;
 }
 return tmin;
}
const beamZ=(ctx:EquipmentContext):number=>ctx.originMm.z+param(ctx,'beamHeightMm',150);
const crossesBeamHeight=(b:Body,z:number):boolean=>b.pos.z-1<=z&&z<=b.pos.z+b.size.z+1;
const aimSpec=spec('aimDeg','Aim angle','degrees',-180,180,5,0);
const heightSpec=spec('beamHeightMm','Beam height above origin','mm',0,1500,10,150);
const OPTICAL_FAULTS=['sensor-stuck-on','sensor-stuck-off','dirty-lens','sensor-misaligned','sensor-intermittent'];
/** Fault pulses follow simulated worker time, never a wall clock. */
const intermittentOff=(w:{timeMs:number},f:string|null)=>f==='sensor-intermittent'&&Math.floor(w.timeMs/150)%2===1;
/** A misaligned head is turned away by 25 degrees: the beam no longer points at the target. */
const faultAim=(f:string|null):number=>f==='sensor-misaligned'?25:0;

/** Retroreflective photoeye: a beam to a reflector `rangeMm` away; an interrupting body is "present". */
export const retroPhotoeye:EquipmentDef={
 kind:'retro-photoeye',label:'Retroreflective photoeye',footprint:vec(100,100,150),commands:[],
 signals:[{name:'present',kind:'bool'}],
 params:[spec('rangeMm','Reflector distance','mm',50,2000,10,600),spec('beamWidthMm','Beam width','mm',10,100,5,20),
  spec('responseMs','Response delay','ms',0,500,10,40),aimSpec,heightSpec,
  // A shiny target reflects the beam back to the receiver, so it is NOT seen as an interruption unless the sensor is polarised.
  spec('polarised','Polarising filter','0=off, 1=on',0,1,1,0)],
 faults:OPTICAL_FAULTS,
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const range=param(ctx,'rangeMm',600)*(f==='dirty-lens'?.25:1);
  const a=((ctx.yawDeg+param(ctx,'aimDeg',0)+faultAim(f))*RAD),d={x:Math.cos(a),y:Math.sin(a)};
  const z=beamZ(ctx),half=param(ctx,'beamWidthMm',20)/2;
  const polarised=param(ctx,'polarised',0)===1;
  const seen=w.bodies.some(b=>{
   if(!crossesBeamHeight(b,z))return false;
   if(b.tags.transparent===true)return false; // light passes through clear material
   if(b.tags.reflective===true&&!polarised)return false; // reflects the beam: receiver still sees light
   const hit=rayHit(ctx.originMm.x,ctx.originMm.y,d,b);
   if(hit!==null)return hit<=range;
   // Wide bodies beside the beam line still clip a beam of non-zero width: test the body centre's lateral offset.
   const fx=b.pos.x-ctx.originMm.x,fy=b.pos.y-ctx.originMm.y;
   const along=fx*d.x+fy*d.y,lateral=Math.abs(-fx*d.y+fy*d.x);
   const {hx,hy}=bodyHalf(b),reach=Math.abs(d.y)*hx+Math.abs(d.x)*hy;
   return along>=0&&along<=range&&lateral<=reach+half;
  });
  const elapsedMs=seen?s.elapsedMs+dt:0;
  const on=f==='sensor-stuck-on'?true:f==='sensor-stuck-off'||intermittentOff(w,f)?false:seen&&elapsedMs>=param(ctx,'responseMs',40);
  return {world:w,state:{...s,elapsedMs:q(elapsedMs),engaged:on,faulted:!!f}};
 },
 read:s=>({present:s.engaged}),
 describe:(s,ctx)=>[draw(ctx,'sensor','box',vec(95,85,135),75,s.engaged?'#e8b04a':'#7d6a45')],
};

/** Laser displacement sensor: distance to the nearest surface along the aimed ray, as an analog signal. */
export const laserDistance:EquipmentDef={
 kind:'laser-distance',label:'Laser displacement sensor',footprint:vec(100,100,150),commands:[],
 signals:[{name:'present',kind:'bool'},{name:'distanceMm',kind:'number',unit:'mm'}],
 params:[spec('rangeMm','Measuring range','mm',50,1500,10,500),aimSpec,heightSpec],
 faults:['sensor-stuck-off','dirty-lens','sensor-misaligned'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const range=param(ctx,'rangeMm',500)*(f==='dirty-lens'?.25:1);
  const a=((ctx.yawDeg+param(ctx,'aimDeg',0)+faultAim(f))*RAD),d={x:Math.cos(a),y:Math.sin(a)};
  const z=beamZ(ctx);
  let nearest=Infinity;
  if(f!=='sensor-stuck-off')for(const b of w.bodies){
   if(!crossesBeamHeight(b,z))continue;
   const hit=rayHit(ctx.originMm.x,ctx.originMm.y,d,b);
   if(hit!==null&&hit<nearest)nearest=hit;
  }
  const found=nearest<=range;
  // No target reads the full range, as a real displacement sensor reports out-of-range.
  return {world:w,state:{...s,engaged:found,value:found?Math.round(nearest):Math.round(range),faulted:!!f}};
 },
 read:s=>({present:s.engaged,distanceMm:s.value}),
 describe:(s,ctx)=>[draw(ctx,'sensor','box',vec(95,85,135),75,s.engaged?'#d95b5b':'#7a4a4a')],
};

/** RFID reader: reads the numeric `rfid` tag of the nearest tagged body inside its near field. */
export const rfidReader:EquipmentDef={
 kind:'rfid-reader',label:'RFID reader',footprint:vec(120,120,150),commands:[],
 signals:[{name:'present',kind:'bool'},{name:'tagId',kind:'number'},{name:'readCount',kind:'number',unit:'reads'}],
 params:[spec('rangeMm','Read range','mm',20,500,10,150)],
 faults:['tag-unreadable','antenna-detuned'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const base=param(ctx,'rangeMm',150)*(f==='antenna-detuned'?.25:1);
  let best:Body|undefined,bestDist=Infinity;
  if(f!=='tag-unreadable')for(const b of w.bodies){
   if(typeof b.tags.rfid!=='number')continue;
   // Metal detunes the antenna: near-field read range halves close to a conductive body.
   const reach=b.tags.metal===true?base/2:base;
   const dx=b.pos.x-ctx.originMm.x,dy=b.pos.y-ctx.originMm.y,dz=b.pos.z+b.size.z/2-ctx.originMm.z;
   const dist=Math.hypot(dx,dy);
   if(dist<=reach&&Math.abs(dz)<=400&&dist<bestDist){best=b;bestDist=dist;}
  }
  const tag=best?best.tags.rfid as number:0;
  // A read is counted once per new tag entering the field (not every scan it stays there).
  const newRead=!!best&&tag!==s.value;
  return {world:w,state:{...s,engaged:!!best,value:best?tag:s.value,count:s.count+(newRead?1:0),
   progress:best?tag:0,faulted:!!f}};
 },
 read:s=>({present:s.engaged,tagId:s.progress,readCount:s.count}),
 describe:(s,ctx)=>[draw(ctx,'antenna','box',vec(110,110,130),65,s.engaged?'#59b88f':'#45675b')],
};

const CATEGORY_CODE:Record<string,number>={package:1,container:2,pallet:3,workpiece:4,component:5,raw:6,product:7};
const STAGE_CODE:Record<string,number>={raw:1,machined:2,assembled:3,finished:4};
/** Machine-vision inspection sensor: measures and checks the nearest body inside its field of view. */
export const visionSensor:EquipmentDef={
 kind:'vision-sensor',label:'Machine-vision inspection sensor',footprint:vec(140,140,200),commands:[],
 signals:[{name:'present',kind:'bool'},{name:'pass',kind:'bool'},{name:'classId',kind:'number'},{name:'lengthMm',kind:'number',unit:'mm'}],
 params:[spec('fieldMm','Field of view (square side)','mm',100,1000,10,300),
  spec('expectedLengthMm','Expected length (0 = no size check)','mm',0,1500,10,0),
  spec('toleranceMm','Length tolerance','mm',1,200,1,10),
  spec('requireCapped','Bottles must be capped','0=off, 1=on',0,1,1,0),
  spec('requireStage','Required stage (0 = off)','1=raw, 2=machined, 3=assembled, 4=finished',0,4,1,0)],
 faults:['camera-offline','lighting-fault'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const field=param(ctx,'fieldMm',300)/2;
  const seen=f==='camera-offline'?[]:w.bodies.filter(b=>Math.abs(b.pos.x-ctx.originMm.x)<=field&&Math.abs(b.pos.y-ctx.originMm.y)<=field&&
   Math.abs(b.pos.z-ctx.originMm.z)<=700);
  seen.sort((a,b)=>Math.hypot(a.pos.x-ctx.originMm.x,a.pos.y-ctx.originMm.y)-Math.hypot(b.pos.x-ctx.originMm.x,b.pos.y-ctx.originMm.y));
  const body=seen[0];
  if(!body)return {world:w,state:{...s,engaged:false,done:false,value:0,progress:0,faulted:!!f}};
  const {hx,hy}=bodyHalf(body);
  // Poor lighting biases the measurement by +12 mm, enough to push borderline parts out of tolerance.
  const length=Math.round(Math.max(hx,hy)*2+(f==='lighting-fault'?12:0));
  const expected=param(ctx,'expectedLengthMm',0),tol=param(ctx,'toleranceMm',10);
  const sizeOk=expected===0||Math.abs(length-expected)<=tol;
  const cappedOk=param(ctx,'requireCapped',0)===0||body.tags.bottle!==true||body.tags.capped===true;
  const stageNeeded=param(ctx,'requireStage',0);
  const stageOk=stageNeeded===0||STAGE_CODE[String(body.tags.stage)]===stageNeeded;
  return {world:w,state:{...s,engaged:true,done:sizeOk&&cappedOk&&stageOk,value:length,
   progress:CATEGORY_CODE[String(body.tags.category)]??0,faulted:!!f}};
 },
 read:s=>({present:s.engaged,pass:s.engaged&&s.done,classId:s.progress,lengthMm:s.value}),
 describe:(s,ctx)=>[draw(ctx,'camera','box',vec(120,120,170),85,!s.engaged?'#5d6b78':s.done?'#4fb06e':'#c9534f')],
};

/**
 * Measuring-wheel incremental encoder: a wheel that rides on the product under it and counts signed pulses along its aim.
 * (A shaft encoder on a drive would need a link between sensor and belt that the plant world does not model; the wheel form
 * is measured from real body motion.) Counts up for travel along the aim direction and down against it.
 */
export const encoder:EquipmentDef={
 kind:'incremental-encoder',label:'Incremental encoder (measuring wheel)',footprint:vec(100,100,150),commands:[],
 signals:[{name:'moving',kind:'bool'},{name:'count',kind:'number',unit:'pulses'},{name:'speedMmS',kind:'number',unit:'mm/s'}],
 params:[spec('pulsesPerMm','Resolution','pulses/mm',1,20,1,4),spec('wheelRangeMm','Wheel reach','mm',20,300,10,100),aimSpec],
 faults:['encoder-dead','encoder-slip'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const a=(ctx.yawDeg+param(ctx,'aimDeg',0))*RAD,d={x:Math.cos(a),y:Math.sin(a)};
  const reach=param(ctx,'wheelRangeMm',100);
  let under:Body|undefined,best=Infinity;
  for(const b of w.bodies){
   const dist=Math.hypot(b.pos.x-ctx.originMm.x,b.pos.y-ctx.originMm.y);
   if(dist<=reach&&dist<best){under=b;best=dist;}
  }
  // The wheel measures the displacement of the SAME body between substeps; a new body starts a fresh reference.
  const last:Record<string,string>=s.slots??{};
  let travel=s.positionMm,speed=0;
  if(under&&last.body===under.id){
   const delta=(under.pos.x-Number(last.x))*d.x+(under.pos.y-Number(last.y))*d.y;
   travel=q(travel+(f==='encoder-dead'?0:delta*(f==='encoder-slip'?.7:1)));
   speed=q(delta/dt*1000);
  }
  const slots:Record<string,string>=under?{body:under.id,x:String(under.pos.x),y:String(under.pos.y)}:{};
  const pulses=Math.trunc(travel*param(ctx,'pulsesPerMm',4));
  return {world:w,state:{...s,positionMm:travel,speedMmS:speed,value:pulses,engaged:Math.abs(speed)>0.5,slots,faulted:!!f}};
 },
 read:s=>({moving:s.engaged,count:s.value,speedMmS:s.speedMmS}),
 describe:(s,ctx)=>[draw(ctx,'wheel','cylinder',vec(90,90,60),30,s.engaged?'#8c7bd1':'#5b5478')],
};
