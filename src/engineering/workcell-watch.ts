/** Read-only typed evidence from the integrated virtual workcell's executed scans.
 * No PLC writes, field forcing, live hardware access, or safety certification.
 */
import {WORKCELL_INPUTS,WORKCELL_OUTPUTS} from './io-mapping';
import {initialWorkcell,type WorkcellState} from './workcell';
import type {LadderDocument} from './ladder';

export type WatchGroup='sampled-input'|'plc-coil'|'post-scan-feedback'|'plant'|'instruction-memory';
export type WatchType='BOOL'|'DINT'|'REAL'|'TIME';
export type WatchValue=boolean|number;
export interface WatchRow {
 readonly id:string;readonly tag:string;readonly group:WatchGroup;
 readonly type:WatchType;readonly value:WatchValue;readonly unit:string;
 readonly address:string;readonly description:string;readonly phase:string;
}
export interface WorkcellWatchFrame {
 readonly scan:number;readonly timeMs:number;readonly rows:readonly WatchRow[];
 readonly diagnostics:readonly {kind:'warning'|'info';message:string}[];
}
export type WatchChange={scan:number;timeMs:number;id:string;tag:string;group:WatchGroup;type:WatchType;unit:string;from:WatchValue;to:WatchValue;direction:'rising'|'falling'|'increasing'|'decreasing'};
export interface WatchTimeline {changes:readonly WatchChange[];firstScan:number;lastScan:number;truncated:boolean}
export const WATCH_HISTORY_LIMIT=200;
export const WATCH_CHANGE_LIMIT=240;

function asRow(id:string,tag:string,group:WatchGroup,type:WatchType,value:WatchValue,unit:string,address:string,description:string,phase:string):WatchRow{
 if(typeof value==='number'&&!Number.isFinite(value))throw new RangeError('Non-finite workcell watch value');
 return {id,tag,group,type,value,unit,address,description,phase};
}
const ordered=(map:Readonly<Record<string,boolean>>)=>Object.entries(map).sort(([a],[b])=>a.localeCompare(b));
/** Inputs are sampled before ladder execution; coil commands are written by the scan;
 * post-scan feedback and plant values must not be mistaken for sampled inputs.
 */
export function captureWorkcellWatch(state:WorkcellState,program:LadderDocument):WorkcellWatchFrame {
 const rows:WatchRow[]=[];
 const descriptions=program.symbols??{};
 const coils=new Set(program.rungs.map(r=>r.coil));
 const address=(tag:string,group:'input'|'output')=>descriptions[tag]?.address??(group==='input'?(WORKCELL_INPUTS as Record<string,string>)[tag]:(WORKCELL_OUTPUTS as Record<string,string>)[tag])??'';
 const describe=(tag:string)=>descriptions[tag]?.description??'';
 if(state.scan>0){
  for(const [tag,value] of ordered(state.plcInputs))rows.push(asRow('IN:'+tag,tag,'sampled-input','BOOL',value,'',address(tag,'input'),describe(tag),'Beginning-of-scan sampled input'));
  for(const [tag,value] of ordered(state.plcOutputs)){
   const written=coils.has(tag);
   rows.push(asRow('OUT:'+tag,tag,written?'plc-coil':'post-scan-feedback','BOOL',value,'',address(tag,'output'),describe(tag),written?'Ladder result after PLC scan':'Derived post-scan feedback (not a ladder coil)'));
  }
  for(const rung of program.rungs){
   const memory=state.ladderMemory[rung.id];
   if(!memory||!rung.operation)continue;
   const kind=rung.operation.kind;
   if(kind==='ton'||kind==='tof'||kind==='rto'||kind==='tp'){
    rows.push(asRow('MEM:'+rung.id+':elapsed',rung.id+'.ET','instruction-memory','TIME',memory.elapsedMs,'ms','','Retained '+kind.toUpperCase()+' elapsed simulation time','Instruction memory after PLC scan'));
    rows.push(asRow('MEM:'+rung.id+':done',rung.id+'.Q','instruction-memory','BOOL',memory.done,'','','Instruction completion bit','Instruction memory after PLC scan'));
   }else if(kind==='ctu'||kind==='ctd'){
    rows.push(asRow('MEM:'+rung.id+':count',rung.id+'.CV','instruction-memory','DINT',memory.count,'','','Retained '+kind.toUpperCase()+' count','Instruction memory after PLC scan'));
    rows.push(asRow('MEM:'+rung.id+':done',rung.id+'.Q','instruction-memory','BOOL',memory.done,'','','Instruction completion bit','Instruction memory after PLC scan'));
   }
  }
 }
 const physical:readonly [string,WatchType,WatchValue,string,string][]=[
  ['MotorRunning','BOOL',state.motor,'','Motor actually energized by the simulated starter'],
  ['RunRequest','BOOL',state.runLatch,'','Requested motor latch from the PLC'],
  ['K1AuxAfterScan','BOOL',state.starter.feedback,'','Contactor auxiliary after simulated actuation'],
  ['BeltFeedback','BOOL',state.process.motorFeedback,'','Conveyor device feedback after process update'],
  ['PhotoeyeAfterScan','BOOL',state.process.photoeye,'','Photoeye after process update (next scan samples this)'],
  ['GuardPhysicallyClosed','BOOL',state.guardClosed,'','Physical guard state in virtual plant'],
  ['SupplyAvailable','BOOL',state.powerOn,'','24V supply in virtual electrical circuit'],
  ['ProductCount','DINT',state.process.products.length,'items','Products currently on belt'],
  ['CompletedCount','DINT',state.process.completed,'items','Completed products'],
  ['RejectedCount','DINT',state.process.rejected,'items','Rejected products'],
  ['DiverterTravel','REAL',state.process.diverterPosition*100,'%','Simulated diverter position']
 ];
 for(const [tag,type,value,unit,description] of physical)rows.push(asRow('PLANT:'+tag,tag,'plant',type,value,unit,'',description,'Plant state after output actuation'));
 const diagnostics:{kind:'warning'|'info';message:string}[]=[];
 if(state.scan>0 && state.motor&&!state.runLatch)diagnostics.push({kind:'warning',message:'Motor running without PLC RunLatch request: inspect the virtual starter (including welded-contact fault). This is a modeled hazard indication.'});
 else if(state.scan>0 && state.runLatch&&!state.motor)diagnostics.push({kind:'info',message:'PLC RunLatch is TRUE but the motor is stopped: inspect supply, guard, starter and wiring conditions.'});
 if(state.scan>0&&state.plcInputs.K1Feedback!==undefined&&state.plcInputs.K1Feedback!==state.starter.feedback)diagnostics.push({kind:'info',message:'K1 feedback changed after the input sample. The sampled value belongs to the beginning of this scan, not its end.'});
 if(state.scan>0&&state.plcInputs.Photoeye!==undefined&&state.plcInputs.Photoeye!==state.process.photoeye)diagnostics.push({kind:'info',message:'Photoeye changed during plant update. The next PLC scan samples the new state.'});
 return {scan:state.scan,timeMs:state.timeMs,rows,diagnostics};
}
export function watchValue(value:WatchValue,type:WatchType,unit=''):string{
 if(type==='BOOL')return value===true?'TRUE':'FALSE';
 const number=Number(value);
 const printable=type==='REAL'?String(Number(number.toFixed(3))):String(number);
 return printable+(unit?' '+unit:'');
}
export function watchTimeline(history:readonly WorkcellState[],program:LadderDocument):WatchTimeline{
 const limited=history.slice(-WATCH_HISTORY_LIMIT);
 if(!limited.length)return {changes:[],firstScan:0,lastScan:0,truncated:history.length>0};
 let previousScan=0,previousTime=-1;
 for(const state of limited){
  if(!Number.isSafeInteger(state.scan)||state.scan<=previousScan||!Number.isSafeInteger(state.timeMs)||state.timeMs<=previousTime)throw new Error('Watch timeline requires increasing scanned states');
  previousScan=state.scan;previousTime=state.timeMs;
 }
 // First retained scan has no invented predecessor. Earlier discarded samples are never reconstructed.
 const changes:WatchChange[]=[];
 for(let i=1;i<limited.length;i++){
  const earlier=new Map(captureWorkcellWatch(limited[i-1],program).rows.map(row=>[row.id,row]));
  const current=captureWorkcellWatch(limited[i],program);
  for(const row of current.rows){
   const former=earlier.get(row.id);
   if(!former||former.type!==row.type||former.value===row.value)continue;
   const direction=row.type==='BOOL'?(row.value===true?'rising':'falling'):(Number(row.value)>Number(former.value)?'increasing':'decreasing');
   changes.push({scan:current.scan,timeMs:current.timeMs,id:row.id,tag:row.tag,group:row.group,type:row.type,unit:row.unit,from:former.value,to:row.value,direction});
  }
 }
 return {changes:changes.slice(-WATCH_CHANGE_LIMIT),firstScan:limited[0].scan,lastScan:limited.at(-1)!.scan,truncated:history.length>WATCH_HISTORY_LIMIT||limited[0].scan>1||changes.length>WATCH_CHANGE_LIMIT};
}
const csvCell=(value:unknown)=>{
 let s=String(value);
 if(/^\s*[=+\-@]/.test(s))s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
};
/** Evidence export does not alter the workcell or assert that observed states came from hardware. */
export function watchTimelineCsv(timeline:WatchTimeline):string{
 const head=['scan','simulated_ms','group','tag','type','from','to','direction','unit'];
 const rows=timeline.changes.map(e=>[e.scan,e.timeMs,e.group,e.tag,e.type,watchValue(e.from,e.type),watchValue(e.to,e.type),e.direction,e.unit]);
 return [head,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
