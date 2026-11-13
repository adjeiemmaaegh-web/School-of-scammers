/** P4 kinematic motor and rated-current approximation. No electromagnetic equivalent circuit. */
import {NAMEPLATE,type MotorMode,type MotorNameplate,type MotorState} from './three-phase-types';
import {stepThermal,THERMAL_CONFIG} from './thermal-protection';
const q=(n:number):number=>{
 if(!Number.isFinite(n))throw new RangeError('Invalid modeled motor measurement');
 return Math.round(n*1e6)/1e6;
};
const bound=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
export function stepMotor(previous:MotorState,command:MotorMode,energized:boolean,
 dtMs=50,nameplate:MotorNameplate=NAMEPLATE,reset=false):MotorState{
 if(!Number.isSafeInteger(dtMs)||dtMs<10||dtMs>1000||
 !Object.values(nameplate).every(Number.isFinite)||nameplate.ratedAmps<=0||
 nameplate.ratedRpm<=0||nameplate.inertiaMs<100||nameplate.loadPercent<0||
 nameplate.loadPercent>100)
  throw new RangeError('Invalid bounded three-phase motor nameplate/scan');
 const active=energized&&!previous.tripped&&['star','delta'].includes(command);
 const mode:MotorMode=active?command:'off';
 const target=active?mode==='star'?nameplate.ratedRpm*.55:nameplate.ratedRpm:0;
 const time=active?nameplate.inertiaMs:Math.max(400,nameplate.inertiaMs*.6);
 const speedRpm=q(bound(previous.speedRpm+(target-previous.speedRpm)*dtMs/time,
   0,nameplate.ratedRpm*1.02));
 const slip=1-speedRpm/nameplate.ratedRpm;
 const inrush=active?mode==='star'?2.2:5.5:0;
 const running=active?(.5+nameplate.loadPercent/100*.8):0;
 const currentA=q(active?nameplate.ratedAmps*(running+inrush*bound(slip,0,1)):0);
 const torqueNm=q(active?nameplate.ratedTorqueNm*
   (mode==='star'?.35:1)*bound((nameplate.ratedRpm-speedRpm)/nameplate.ratedRpm+.5,0,1.5):0);
 const thermal=stepThermal({integral:previous.thermal,temperatureC:previous.temperatureC,
   tripped:previous.tripped},currentA,dtMs,{
    ...THERMAL_CONFIG,pickupA:nameplate.ratedAmps},reset&& !energized);
 const tripped=thermal.tripped;
 const diagnostics=tripped?['Simulated thermal overload latched — isolate and cool before reset']:[];
 return {mode:tripped?'fault':mode,speedRpm:tripped?Math.max(0,speedRpm-dtMs):speedRpm,
  currentA:tripped?0:currentA,torqueNm:tripped?0:torqueNm,
  temperatureC:thermal.temperatureC,thermal:thermal.integral,tripped,
  elapsedMs:previous.elapsedMs+dtMs,energyWh:q(previous.energyWh+
    (active?Math.sqrt(3)*nameplate.ratedVoltsLL*currentA*.75*dtMs/3600000:0)),
  diagnostics};
}
