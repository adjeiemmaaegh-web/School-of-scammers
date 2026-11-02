/** Integrated, deterministic teaching workcell. No physical PLC or safety certification. */
import {evaluateBoard,type Board} from './wiring-board';
import {initialProcess,advanceProcess,setProcessFault,type ProcessState,type ProcessFaults} from './conveyor-process';
import {evaluateStarter,initialStarterFaults,changeStarterFault,type StarterState,type StarterFaults} from './control-panel';
import { executeLadder, type LadderStep, type LadderDocument, type LadderMemory } from './ladder';
import { solveDiscrete24V, type CircuitResult } from './electrical';
import {initialTerminalWiring,sampleTerminals,changeTerminalWiring,type TerminalWiring,type WireTarget,type TerminalSample} from './terminal-wiring';
export type WorkcellAction = 'press-start' | 'release-start' | 'press-stop' | 'release-stop' | 'open-guard' | 'close-guard' | 'disconnect-sensor' | 'connect-sensor' | 'isolate-power' | 'restore-power' | 'press-reset-count' | 'release-reset-count' | 'press-reset-timer' | 'release-reset-timer' | 'tick' | {kind:'wire-sensor';target:WireTarget} | {kind:'wire-return';connected:boolean} | {kind:'starter-fault';fault:keyof StarterFaults;active:boolean} | {kind:'process-fault';fault:keyof ProcessFaults;active:boolean} | {kind:'spawn-product';reject:boolean};
export interface WorkcellState { scan: number; timeMs: number; powerOn: boolean; guardClosed: boolean; sensorConnected: boolean; startPressed: boolean; stopPressed: boolean; resetCountPressed:boolean; resetTimerPressed:boolean; motor: boolean; runLatch: boolean; plcInputs: Readonly<Record<string, boolean>>; plcOutputs: Readonly<Record<string, boolean>>; rungTrace: readonly LadderStep[]; ladderMemory: LadderMemory; electrical: CircuitResult; terminalWiring: TerminalWiring; terminalSample: TerminalSample; starter:StarterState; process:ProcessState; events: readonly string[]; }
export const workcellLadder: LadderDocument = { id:'workcell-v1',version:'1.0',rungs:[{id:'motor-run',elements:[{type:'contact',tag:'PowerOK'},{type:'contact',tag:'GuardClosed'},{type:'contact',tag:'SensorOK'},{type:'contact',tag:'Stop',normallyClosed:true},{type:'branch',alternatives:[[{type:'contact',tag:'Start'}],[{type:'contact',tag:'RunLatch'}]]}],coil:'RunLatch'}]};
function circuit(powerOn: boolean, sensorConnected: boolean, motorRequest: boolean): CircuitResult {
  return solveDiscrete24V({devices:[{id:'psu',kind:'supply',positive:'P24',negative:'M0',volts:24},{id:'sensor',kind:'load',positive:'S+',negative:'S-',nominalVolts:24},{id:'motor-contactor',kind:'load',positive:'K+',negative:'K-',nominalVolts:24},{id:'power',kind:'switch',a:'P24',b:'BUS',closed:powerOn},{id:'sensor-cable',kind:'switch',a:'BUS',b:'S+',closed:sensorConnected},{id:'coil-command',kind:'switch',a:'BUS',b:'K+',closed:motorRequest}],wires:[['M0','S-'],['M0','K-']]});
}
export function initialWorkcell(): WorkcellState {return {scan:0,timeMs:0,powerOn:true,guardClosed:true,sensorConnected:false,startPressed:false,stopPressed:false,resetCountPressed:false,resetTimerPressed:false,motor:false,runLatch:false,plcInputs:{},plcOutputs:{},rungTrace:[],ladderMemory:{},electrical:circuit(true,false,false),terminalWiring:initialTerminalWiring(),terminalSample:sampleTerminals(initialTerminalWiring(),true,true),starter:evaluateStarter(true,false,true,initialStarterFaults()),process:initialProcess(),events:[]};}
/** A PLC scan samples electrical inputs, executes ladder, then applies the output to the contactor. */
export function stepWorkcell(previous: WorkcellState, action: WorkcellAction, deltaMs=20, program: LadderDocument = workcellLadder, board?: Board): WorkcellState {
 if (!Number.isSafeInteger(deltaMs) || deltaMs<1 || deltaMs>1000) throw new RangeError('Scan interval must be 1..1000 ms');
 const next={...previous,events:[...previous.events]};
 if(typeof action==='object'){
  if(action.kind==='process-fault'){next.process=setProcessFault(next.process,action.fault,action.active,!next.powerOn);}
  else if(action.kind==='spawn-product'){next.process=advanceProcess(next.process,{motor:false,diverter:false,spawn:true,rejectNext:action.reject},1);}
  else if(action.kind==='starter-fault'){const change=changeStarterFault(next.starter.faults,action.fault,action.active,next.powerOn,next.motor);if(change.error)next.events.push(`REJECTED fault change: ${change.error}`);else next.starter={...next.starter,faults:change.faults};}
  else {const change=changeTerminalWiring(next.terminalWiring,action.kind==='wire-sensor'?{sensorPositive:action.target}:{sensorReturnConnected:action.connected},next.powerOn,next.motor);next.terminalWiring=change.wiring;if(change.error)next.events.push(`REJECTED wiring: ${change.error}`);}
 } else switch(action){
 case 'press-start': next.startPressed=true; break;
 case 'release-start': next.startPressed=false; break;
 case 'press-stop': next.stopPressed=true; break;
 case 'press-reset-count': next.resetCountPressed=true; break;
 case 'release-reset-count': next.resetCountPressed=false; break;
 case 'press-reset-timer': next.resetTimerPressed=true; break;
 case 'release-reset-timer': next.resetTimerPressed=false; break;
 case 'release-stop': next.stopPressed=false; break;
 case 'open-guard': next.guardClosed=false; break;
 case 'close-guard': next.guardClosed=true; break;
 case 'isolate-power': next.powerOn=false; break;
 case 'restore-power': next.powerOn=true; break;
 case 'disconnect-sensor': case 'connect-sensor':
   if(next.powerOn || next.motor){next.events.push(`REJECTED ${action}: isolate simulated power before wiring changes`);break;}
   next.sensorConnected=action==='connect-sensor'; break;
 case 'tick': break;
 default: throw new Error('Unknown action');
 }
 const pre=circuit(next.powerOn,next.sensorConnected,false);
 const terminalSample=sampleTerminals(next.terminalWiring,next.powerOn,pre.energizedLoads.includes('sensor'));
 next.terminalSample=terminalSample;
 const boardReading=board ? evaluateBoard(board,next.powerOn) : undefined;
 const sensorValue=boardReading ? (boardReading.plcInputs['I0.2']===true) : terminalSample.inputs['I0.2'];
 // Inputs represent the beginning-of-scan plant snapshot. Outputs update the process afterward.
 const sampled={PowerOK:next.powerOn,GuardClosed:next.guardClosed,SensorOK:sensorValue,Start:next.startPressed,Stop:next.stopPressed,ResetCount:next.resetCountPressed,ResetTimer:next.resetTimerPressed,Photoeye:previous.process.photoeye,ExitSensor:previous.process.exitSensor,MotorFeedback:previous.process.motorFeedback,K1Feedback:previous.starter.feedback,...(boardReading?.plcInputs ?? {})};
 if(boardReading?.result.diagnostics.some(d=>d.includes('short circuit')))next.events.push('WIRING BOARD: supply short detected; check connections');
 const ladder=executeLadder(program,sampled,previous.plcOutputs.RunLatch !== undefined ? previous.plcOutputs : {RunLatch:previous.runLatch},previous.ladderMemory,deltaMs);
 next.runLatch=ladder.outputs.RunLatch === true; next.ladderMemory=ladder.memory;
 const outputBoardReading=board ? evaluateBoard(board,next.powerOn,ladder.outputs) : undefined;
 if(outputBoardReading?.result.diagnostics.some(d=>d.includes('short circuit')))next.events.push('OUTPUT WIRING: supply short detected');
 next.electrical=circuit(next.powerOn,next.sensorConnected,next.runLatch);
 next.starter=evaluateStarter(next.powerOn,next.runLatch,next.guardClosed,next.starter.faults);
 // An installed MOTOR load must receive power through the configurable board.
 // Without it, preserve the legacy starter-only teaching scenario.
 const boardHasMotor=board?.parts.some(part=>part.id==='MOTOR' && part.kind==='load')===true;
 const boardMotorPowered=!boardHasMotor || (outputBoardReading?.result.energizedLoads.includes('MOTOR')===true && !outputBoardReading.result.diagnostics.some(d=>d.toLowerCase().includes('short circuit')));
 next.motor=next.starter.motorPowered && boardMotorPowered;
 next.process=advanceProcess(next.process,{motor:next.motor,diverter:ladder.outputs.Diverter===true},deltaMs);
 next.plcInputs={...sampled};next.plcOutputs={...ladder.outputs,MotorContactor:next.motor,K1Feedback:next.starter.feedback};next.rungTrace=ladder.steps;
 if(!Number.isSafeInteger(previous.scan+1)||!Number.isSafeInteger(previous.timeMs+deltaMs))throw new RangeError('Simulation clock overflow');
 next.scan=previous.scan+1;next.timeMs=previous.timeMs+deltaMs;
 next.events.push(`#${next.scan} ${typeof action==='string'?action:action.kind}: motor=${next.motor?'ON':'OFF'} sensor=${sampled.SensorOK?'ON':'OFF'}`);
 return next;
}
export function replayWorkcell(actions: readonly WorkcellAction[],deltaMs=20): WorkcellState {return actions.reduce((state,action)=>stepWorkcell(state,action,deltaMs),initialWorkcell());}
