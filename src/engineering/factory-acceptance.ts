/**
 * Deterministic educational Factory Acceptance Test (FAT) simulator.
 * A fresh sandboxed workcell is used for every test. Never operates a real PLC,
 * never mutates the learner's live workcell, and never certifies safety.
 */
import {initialWorkcell,stepWorkcell,type WorkcellState,type WorkcellAction} from './workcell';
import {workcellLadder} from './workcell';
import {validateLadder,type LadderDocument} from './ladder';
import {validateIoMapping} from './io-mapping';
import type {Board} from './wiring-board';

export type FatCaseId = 'start-permissives'|'stop-command'|'guard-restart'|'power-cycle'|'sensor-loss'|'fuse-failure'|'overload-trip'|'conveyor-throughput'|'belt-slip-recovery'|'welded-contactor';
export type FatMode='fixture'|'configured-board';
export type FatEvidence={scan:number;timeMs:number;action:string;power:boolean;guard:boolean;sensor:boolean;runRequest:boolean;motor:boolean;motorFeedback:boolean;photoeye:boolean;completed:number;activeProducts:number;starterDiagnostic:string};
export type FatCheck={name:string;passed:boolean;expected:string;actual:string;scan:number};
export type FatCaseResult={id:FatCaseId;title:string;system:string;passed:boolean;checks:readonly FatCheck[];evidence:readonly FatEvidence[];scans:number;elapsedMs:number;note?:string};
export type FatReport={schema:1;kind:'plc-skills-lab-simulated-fat';mode:FatMode;programId:string;cases:readonly FatCaseResult[];passed:number;failed:number;total:number;simulatedScans:number;limitations:string};
export type FatDefinition={id:FatCaseId;title:string;system:string;objective:string};
export const FAT_DEFINITIONS:readonly FatDefinition[]=[
 {id:'start-permissives',title:'Start permit and motor pickup',system:'PLC / motor starter',objective:'A correctly wired, powered, guarded machine starts only when commanded.'},
 {id:'stop-command',title:'Stop response and latch release',system:'PLC / motor starter',objective:'STOP removes the motor run request and prevents automatic restart.'},
 {id:'guard-restart',title:'Guard opening and restart interlock',system:'Machine interlocks',objective:'Opening the guard stops the motor; closing it alone cannot restart.'},
 {id:'power-cycle',title:'Supply isolation and restoration',system:'Machine interlocks',objective:'Loss of simulated supply stops the motor and restoration cannot auto-restart.'},
 {id:'sensor-loss',title:'Open sensor circuit inhibits start',system:'Electrical / PLC input',objective:'Disconnecting the sensor while isolated removes the start permissive.'},
 {id:'fuse-failure',title:'Fuse failure and feedback discrepancy',system:'Motor starter',objective:'With an open fuse, a run request cannot produce motor feedback.'},
 {id:'overload-trip',title:'Overload and feedback discrepancy',system:'Motor starter',objective:'An overload interrupt prevents energization despite a PLC run request.'},
 {id:'conveyor-throughput',title:'Product transfer and photoeye',system:'Conveyor process',objective:'One accepted product triggers a photoeye transition and exits the conveyor.'},
 {id:'belt-slip-recovery',title:'Belt slip isolation and recovery',system:'Conveyor process',objective:'A simulated slipping belt cannot move products; repair under isolation restores travel.'},
 {id:'welded-contactor',title:'Welded contactor hazard identification',system:'Fault detection',objective:'Identify a welded contactor that remains powered after STOP; this test does not claim STOP is safe.'}
];
const ids=new Set(FAT_DEFINITIONS.map(x=>x.id));
const LIMIT_SCANS=1000;

class FatHarness {
 state:WorkcellState=initialWorkcell();
 evidence:FatEvidence[]=[];
 checks:FatCheck[]=[];
 scanned=0;
 constructor(readonly program:LadderDocument,public board?:Board){}
 capture(action:string){const s=this.state;this.evidence.push({scan:s.scan,timeMs:s.timeMs,action,power:s.powerOn,guard:s.guardClosed,sensor:s.plcInputs.SensorOK===true,runRequest:s.plcOutputs.RunLatch===true,motor:s.motor,motorFeedback:s.process.motorFeedback,photoeye:s.process.photoeye,completed:s.process.completed,activeProducts:s.process.products.length,starterDiagnostic:s.starter.diagnostics.join('; ').slice(0,300)});}
 do(action:WorkcellAction){if(++this.scanned>LIMIT_SCANS)throw Error('FAT scan budget exceeded');this.state=stepWorkcell(this.state,action,20,this.program,this.board);if(action!=='tick')this.capture(typeof action==='string'?action:action.kind);}
 ticks(n:number){if(!Number.isSafeInteger(n)||n<1||n>LIMIT_SCANS)throw Error('Invalid scan block');for(let i=0;i<n;i++){this.do('tick');}this.capture(`Advance ${n} scans`);}
 assert(name:string,passed:boolean,expected:string,actual:string){this.checks.push({name,passed,expected,actual,scan:this.state.scan});}
 expect(name:string,actual:boolean,expected:boolean){this.assert(name,actual===expected,expected?'ON':'OFF',actual?'ON':'OFF');}
 count(name:string,actual:number,expected:number){this.assert(name,actual===expected,`${expected}`,`${actual}`);}
 ready(){this.do('isolate-power');this.do('connect-sensor');this.do({kind:'wire-sensor',target:'I0.2'});this.do('restore-power');}
 start(){this.do('press-start');this.do('release-start');}
 ensureRunning(){this.ready();this.start();this.expect('Precondition: motor running',this.state.motor,true);}
}
function executeCase(id:FatCaseId,h:FatHarness):void {
 switch(id){
 case 'start-permissives':{
  h.ready();h.expect('Sensor input is electrically present',h.state.plcInputs.SensorOK===true,true);
  h.expect('No motor movement before START',h.state.motor,false);
  h.start();h.expect('Motor runs on START',h.state.motor,true);
  h.expect('PLC run request held',h.state.plcOutputs.RunLatch===true,true);
  h.expect('Starter feedback matches running motor',h.state.starter.feedback,true);
  break;
 }
 case 'stop-command':{
  h.ensureRunning();h.do('press-stop');h.expect('STOP removes run request',h.state.plcOutputs.RunLatch===true,false);
  h.expect('STOP stops motor',h.state.motor,false);
  h.do('release-stop');h.ticks(3);h.expect('Released STOP does not auto-start',h.state.motor,false);
  break;
 }
 case 'guard-restart':{
  h.ensureRunning();h.do('open-guard');h.expect('Open guard removes motor power',h.state.motor,false);
  h.expect('Open guard removes run request',h.state.plcOutputs.RunLatch===true,false);
  h.do('close-guard');h.ticks(2);h.expect('Close guard does not auto-restart',h.state.motor,false);
  h.start();h.expect('Explicit START can resume',h.state.motor,true);
  break;
 }
 case 'power-cycle':{
  h.ensureRunning();h.do('isolate-power');h.expect('Supply isolation stops motor',h.state.motor,false);
  h.expect('Supply isolation clears run latch',h.state.runLatch,false);
  h.do('restore-power');h.ticks(2);h.expect('Restored power does not auto-start',h.state.motor,false);
  h.start();h.expect('New START restores motor',h.state.motor,true);
  break;
 }
 case 'sensor-loss':{
  h.ready();h.expect('Sensor input present before interruption',h.state.plcInputs.SensorOK===true,true);
  h.do('isolate-power');
  if(h.board){
   // In configured-board mode open the actual board input circuit, not the unused legacy cable.
   // The board copy is local to this scenario; the learner's board is never changed.
   const input=h.board.parts.find(p=>p.kind==='plc-input'&&p.label.replace(/^PLC\s+/,'')==='I0.2');
   if(!input)throw Error('Configured board lacks a PLC I0.2 input component');
   const terminals=new Set([`${input.id}.IN`,`${input.id}.COM`]);
   h.board={...h.board,wires:h.board.wires.filter(w=>!terminals.has(w.from)&&!terminals.has(w.to))};
   h.do('tick');
  } else h.do('disconnect-sensor');
  h.do('restore-power');
  h.expect('Open input loop drops SensorOK',h.state.plcInputs.SensorOK===true,false);
  h.start();h.expect('Open sensor inhibits run request',h.state.plcOutputs.RunLatch===true,false);
  h.expect('Open sensor inhibits motor',h.state.motor,false);
  break;
 }
 case 'fuse-failure':{
  h.ready();h.do('isolate-power');h.do({kind:'starter-fault',fault:'fuseOpen',active:true});h.do('restore-power');h.start();
  h.expect('PLC command persists with failed fuse',h.state.plcOutputs.RunLatch===true,true);
  h.expect('Open fuse prevents motor drive',h.state.motor,false);
  h.expect('Starter reports fuse fault',h.state.starter.diagnostics.some(x=>x.includes('fuse open')),true);
  break;
 }
 case 'overload-trip':{
  h.ready();h.do('isolate-power');h.do({kind:'starter-fault',fault:'overloadTripped',active:true});h.do('restore-power');h.start();
  h.expect('PLC requests motor despite overload',h.state.plcOutputs.RunLatch===true,true);
  h.expect('Overload prevents motor drive',h.state.motor,false);
  h.expect('Starter reports overload trip',h.state.starter.diagnostics.some(x=>x.includes('overload tripped')),true);
  break;
 }
 case 'conveyor-throughput':{
  h.ensureRunning();h.do({kind:'spawn-product',reject:false});h.count('One product admitted',h.state.process.products.length,1);
  let seenEye=h.state.process.photoeye;
  for(let i=0;i<850&&h.state.process.completed===0;i++){h.do('tick');seenEye=seenEye||h.state.process.photoeye;}
  h.capture('Observe product transfer');
  h.expect('Photoeye detected product in travel',seenEye,true);
  h.count('One product exits main lane',h.state.process.completed,1);
  h.count('No rejected products',h.state.process.rejected,0);
  h.count('No product remains on conveyor',h.state.process.products.length,0);
  break;
 }
 case 'belt-slip-recovery':{
  h.ready();h.do('isolate-power');h.do({kind:'process-fault',fault:'beltSlipping',active:true});h.do('restore-power');h.start();
  h.expect('Motor starts with slipping belt',h.state.motor,true);
  h.expect('Belt motion feedback absent',h.state.process.motorFeedback,false);
  h.do({kind:'spawn-product',reject:false});h.ticks(40);h.count('Stalled product remains at infeed',h.state.process.products[0]?.xMm??-1,0);
  h.do('isolate-power');h.do({kind:'process-fault',fault:'beltSlipping',active:false});h.do('restore-power');h.start();h.ticks(40);
  h.expect('Belt feedback restored',h.state.process.motorFeedback,true);
  h.assert('Product advances after simulated repair',(h.state.process.products[0]?.xMm??0)>0,'Position > 0 mm',`${h.state.process.products[0]?.xMm??'absent'} mm`);
  break;
 }
 case 'welded-contactor':{
  h.ready();h.do('isolate-power');h.do({kind:'starter-fault',fault:'contactorWelded',active:true});h.do('restore-power');h.start();
  h.do('press-stop');h.expect('PLC run request falls on STOP',h.state.plcOutputs.RunLatch===true,false);
  h.expect('Hazard: welded motor remains powered with supply ON',h.state.motor,true);
  h.expect('Weld warning produced',h.state.starter.diagnostics.some(x=>x.includes('welded')),true);
  h.do('isolate-power');h.expect('Supply isolation removes motor power',h.state.motor,false);
  break;
 }
 }
}
/** Tests current program against a fresh simulated fixture or the learner's board.
 * Fixture mode uses wired I0.2. Board mode additionally requires the provided board
 * to energize its PLC I0.2 input. No live workcell state is read or altered.
 */
export function runFactoryAcceptance(program:LadderDocument=workcellLadder,mode:FatMode='fixture',board?:Board,selection:readonly FatCaseId[]=FAT_DEFINITIONS.map(x=>x.id)):FatReport {
 const errors=[...validateLadder(program),...validateIoMapping(program)];
 if(errors.length)throw Error(`Invalid ladder: ${errors.join('; ').slice(0,500)}`);
 if(mode!=='fixture'&&mode!=='configured-board')throw Error('Unknown FAT fixture mode');
 if(mode==='configured-board'&&!board)throw Error('Configured-board mode requires a wiring board');
 if(selection.length===0||selection.length>FAT_DEFINITIONS.length||selection.some(x=>!ids.has(x))||new Set(selection).size!==selection.length)throw Error('Invalid FAT case selection');
 const cases:FatCaseResult[]=selection.map(id=>{
  const definition=FAT_DEFINITIONS.find(x=>x.id===id)!;
  const h=new FatHarness(program,mode==='configured-board'?board:undefined);
  let note:string|undefined;
  try{executeCase(id,h);}catch(error){note=`Simulation interrupted: ${error instanceof Error?error.message:String(error)}`;h.assert('Scenario completed without runtime error',false,'No runtime error',note);}
  const checks=h.checks;
  return {id,title:definition.title,system:definition.system,passed:checks.length>0&&checks.every(c=>c.passed),checks,evidence:h.evidence,scans:h.state.scan,elapsedMs:h.state.timeMs,...(note?{note}:{})};
 });
 return {schema:1,kind:'plc-skills-lab-simulated-fat',mode,programId:program.id,cases,passed:cases.filter(x=>x.passed).length,failed:cases.filter(x=>!x.passed).length,total:cases.length,simulatedScans:cases.reduce((n,x)=>n+x.scans,0),limitations:'Synthetic deterministic educational FAT. No physical PLC, real I/O timing, field safety validation, certified interlocks, or actual equipment performance is tested.'};
}
function csv(value:string|number|boolean):string {const s=String(value);return /[",\n\r]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
export function fatChecksCsv(report:FatReport):string {
 const rows=[['case','status','criterion','expected','observed','scan'],...report.cases.flatMap(c=>c.checks.map(k=>[c.id,k.passed?'PASS':'FAIL',k.name,k.expected,k.actual,k.scan]))];
 return rows.map(row=>row.map(csv).join(',')).join('\r\n')+'\r\n';
}
export function fatEvidenceCsv(report:FatReport):string {
 const headers=['case','scan','timeMs','action','power','guard','sensor','runRequest','motor','motorFeedback','photoeye','completed','activeProducts','starterDiagnostic'];
 return [headers.map(csv).join(','),...report.cases.flatMap(c=>c.evidence.map(e=>[c.id,...headers.slice(1).map(k=>e[k as keyof FatEvidence])].map(v=>csv(v as string|number|boolean)).join(',')))].join('\r\n')+'\r\n';
}
