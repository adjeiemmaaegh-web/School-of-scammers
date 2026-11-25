/**
 * R14/R28 drive component: a frequency drive as its own device. `run` starts it and `speedPct` (0-100, default 100 when unwired)
 * sets the target speed as a share of its rated speed; the shaft speed `rpm` ramps toward the target over `rampMs` for the full
 * range, so a drive accelerates and coasts down rather than jumping. A tripped drive (fault) stops commanding motion. The drive
 * does nothing mechanical by itself: a project's `mechanicalLinks` connect its shaft to belts, so a belt's speed follows
 * rpm x mm-per-revolution. Teaching model: no torque, no load coupling back to the drive.
 */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,numeric,param,spec} from '../world/equipment';
import {q,vec} from '../world/math';

export const drive:EquipmentDef={
 kind:'drive',label:'Frequency drive',footprint:vec(300,200,400),
 commands:[{name:'run',kind:'bool'},{name:'speedPct',kind:'number',unit:'%'}],
 signals:[{name:'running',kind:'bool'},{name:'rpm',kind:'number',unit:'rpm'},{name:'atSpeed',kind:'bool'},{name:'tripped',kind:'bool'}],
 params:[spec('maxRpm','Rated speed','rpm',100,3000,50,1500),spec('rampMs','Ramp time to rated speed','ms',100,10000,100,1000)],
 faults:['drive-trip'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const tripped=f==='drive-trip';
  const maxRpm=param(ctx,'maxRpm',1500);
  const target=flag(c,'run')&&!tripped?maxRpm*numeric(c,'speedPct',100,0,100)/100:0;
  const stepRpm=maxRpm*dt/param(ctx,'rampMs',1000);
  const rpm=q(s.value+Math.max(-stepRpm,Math.min(stepRpm,target-s.value)));
  return {world:w,state:{...s,value:rpm,engaged:rpm>0,done:Math.abs(rpm-target)<0.5,stalled:tripped,faulted:tripped}};
 },
 read:s=>({running:s.value>0,rpm:s.value,atSpeed:s.done&&s.value>0,tripped:s.stalled}),
 describe:(s,ctx)=>[draw(ctx,'cabinet','box',vec(280,180,380),190,s.stalled?'#b24a3a':s.engaged?'#4f9d86':'#6a6f78')],
};
