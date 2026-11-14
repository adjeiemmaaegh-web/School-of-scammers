/**
 * Bounded illustrative I²t thermal memory and manual reset.
 * The tripping threshold is arbitrary educational tuning, not IEC/UL curve data.
 */
export type ThermalConfig={pickupA:number;tripIntegral:number;coolingMs:number;
 ambientC:number;hotC:number};
export type ThermalState={integral:number;temperatureC:number;tripped:boolean};
export const THERMAL_CONFIG:ThermalConfig={
 pickupA:8,tripIntegral:80,coolingMs:60000,ambientC:20,hotC:110,
};
export const freshThermal=():ThermalState=>({integral:0,temperatureC:20,tripped:false});
const quant=(n:number):number=>Math.round(n*1e6)/1e6;
export function stepThermal(previous:ThermalState,amps:number,dtMs:number,
 config:ThermalConfig=THERMAL_CONFIG,reset=false):ThermalState{
 if(!Number.isFinite(amps)||amps<0||amps>10000||
    !Number.isSafeInteger(dtMs)||dtMs<1||dtMs>1000||
    !Number.isFinite(config.pickupA)||config.pickupA<=0||
    !Number.isFinite(config.tripIntegral)||config.tripIntegral<=0||
    !Number.isFinite(config.coolingMs)||config.coolingMs<1000)
  throw new RangeError('Invalid thermal teaching input');
 const ratio=amps/config.pickupA;
 // No temperature rise above nominal at or below rated current; simplified
 // I²t overload memory integrates only EXCESS current and survives inrush.
 const heat=previous.tripped?0:Math.max(0,ratio*ratio-1)*dtMs/1000;
 const cool=previous.integral*dtMs/config.coolingMs;
 const integral=quant(Math.min(config.tripIntegral,Math.max(0,previous.integral+heat-cool)));
 const temperatureC=quant(config.ambientC+
   (config.hotC-config.ambientC)*Math.min(1,integral/config.tripIntegral));
 const reached=integral>=config.tripIntegral;
 const tripped=previous.tripped||reached;
 const canReset=reset&&amps===0&&integral<config.tripIntegral*.3;
 return {integral,temperatureC,tripped:canReset?false:tripped};
}
