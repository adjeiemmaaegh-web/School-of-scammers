/**
 * P4 wired star/delta educational starter.
 * Actual 24V control coils determine contactor demands. The 400V domain only
 * supplies motor power when a physically wired phase source is present.
 * No automatic PLC sequencing: wrong logic has visible consequences.
 */
import type {StarDeltaCoils,StarterPanelState,ThreePhaseConnection,MotorMode} from './three-phase-types';
import {freshStarterPanel} from './three-phase-types';
import {stepMotor} from './motor-dynamics';
const DEADTIME_MS=200,EVENTS_CAP=64;
export function stepWiredStarter(previous:StarterPanelState,
 connection:ThreePhaseConnection|null,coils:StarDeltaCoils,dtMs=50):StarterPanelState{
 if(!Number.isSafeInteger(dtMs)||dtMs<10||dtMs>1000||
  Object.values(coils).some(v=>typeof v!=='boolean'))
  throw new RangeError('Invalid three-phase starter control/scan');
 const mainsPresent=!!connection&&connection.hasL1&&connection.hasL2&&connection.hasL3&&
  !connection.shorted&&!connection.crossed;
 const conflict=coils.star&&coils.delta;
 const mainClosed=coils.main&&mainsPresent&&!conflict&&!previous.motor.tripped;
 const starWanted=mainClosed&&coils.star&&!coils.delta;
 const deltaWanted=mainClosed&&coils.delta&&!coils.star;
 const openingStar=previous.starClosed&&!starWanted;
 const changeoverMs=starWanted?0:openingStar?0:
  Math.min(DEADTIME_MS,previous.changeoverMs+dtMs);
 const starClosed=starWanted&&!previous.deltaClosed;
 const deltaClosed=deltaWanted&&!previous.starClosed&&changeoverMs>=DEADTIME_MS;
 const mode:MotorMode=conflict?'fault':starClosed?'star':deltaClosed?'delta':'off';
 const reset=coils.reset&&!coils.main&&!coils.star&&!coils.delta;
 const motor=stepMotor(previous.motor,mode,mainClosed,dtMs,undefined,reset);
 const actualMain=mainClosed&&!motor.tripped;
 const currentStar=starClosed&&actualMain,currentDelta=deltaClosed&&actualMain;
 const diagnostics:string[]=[];
 if(!connection||!mainsPresent)diagnostics.push('Three-phase supply missing, crossed or isolated');
 if(conflict)diagnostics.push('STAR and DELTA demanded simultaneously; modeled interlock rejects both');
 if(deltaWanted&&!currentDelta)diagnostics.push('Delta blocked until 200ms changeover dead-time completes');
 if(!coils.main&&(coils.star||coils.delta))diagnostics.push('No MAIN contactor demand');
 if(motor.tripped)diagnostics.push('Thermal trip latched; cool before reset');
 const events=[...previous.events];
 for(const message of diagnostics)if(!events.includes(message))events.push(message);
 if(previous.motor.mode!==motor.mode)events.push('Motor winding mode: '+motor.mode);
 return {motor:{...motor,diagnostics:[...motor.diagnostics,...diagnostics]},
  mainClosed:actualMain,starClosed:currentStar,deltaClosed:currentDelta,
  changeoverMs,lastMode:currentStar?'star':currentDelta?'delta':'off',conflict,
  mainsPresent,ready:mainsPresent&&!motor.tripped&&!conflict,events:events.slice(-EVENTS_CAP)};
}
export const idleWiredStarter=():StarterPanelState=>freshStarterPanel();
