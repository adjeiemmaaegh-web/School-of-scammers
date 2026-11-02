import {SIGNALS,type Recorder,type ScanSample} from './scan-instruments';

/** PLC-scan-based diagnostic rules. This module never advances the machine. */
export type Rule={id:string;label:string;kind:'stuck-high'|'stuck-low'|'mismatch'|'threshold';signal:string;compareSignal?:string;threshold?:number;durationMs:number;severity:'warning'|'critical'};
export type Alarm={id:string;ruleId:string;label:string;severity:'warning'|'critical';firstScan:number;lastScan:number;firstTimeMs:number;lastTimeMs:number;durationMs:number;active:boolean};
export type DiagnosticResult={alarms:Alarm[];evaluatedScans:number};
export const DEFAULT_RULES:readonly Rule[]=[
 {id:'motor-belt',label:'Motor energized without belt movement',kind:'mismatch',signal:'motor',compareSignal:'belt',durationMs:200,severity:'critical'},
 {id:'run-feedback',label:'Run command differs from contactor feedback',kind:'mismatch',signal:'run',compareSignal:'contactor',durationMs:200,severity:'warning'},
 {id:'photoeye-high',label:'Product photoeye continuously active',kind:'stuck-high',signal:'photoeye',durationMs:2000,severity:'warning'},
 {id:'sensor-low',label:'SensorOK continuously inactive',kind:'stuck-low',signal:'sensor',durationMs:1000,severity:'warning'},
 {id:'diverter-extended',label:'Diverter held extended',kind:'threshold',signal:'diverter',threshold:95,durationMs:3000,severity:'warning'},
];
const known=new Set(SIGNALS.map(s=>s.id));
export function validateRules(rules:readonly Rule[]):void{
 const ids=new Set<string>();
 for(const r of rules){
  if(!r.id||ids.has(r.id))throw Error('Duplicate or missing diagnostic rule ID');ids.add(r.id);
  if(!known.has(r.signal))throw Error('Unknown diagnostic signal');
  if(!Number.isSafeInteger(r.durationMs)||r.durationMs<0||r.durationMs>3600000)throw Error('Invalid diagnostic duration');
  if(r.kind==='mismatch'&&(!r.compareSignal||!known.has(r.compareSignal)))throw Error('Missing comparison signal');
  if(r.kind==='threshold'&&!Number.isFinite(r.threshold))throw Error('Invalid diagnostic threshold');
 }
}
function matches(r:Rule,s:ScanSample):boolean{
 const v=s.values[r.signal];
 if(!Number.isFinite(v))throw Error('Invalid recorded signal');
 if(r.kind==='stuck-high')return v===1;
 if(r.kind==='stuck-low')return v===0;
 if(r.kind==='mismatch')return v!==s.values[r.compareSignal!];
 return v>=r.threshold!;
}
/** Recompute from bounded scan history. A gap or reset ends the preceding episode. */
export function evaluateDiagnostics(recorder:Recorder,rules:readonly Rule[]=DEFAULT_RULES):DiagnosticResult{
 validateRules(rules);
 const samples=recorder.samples;const alarms:Alarm[]=[];
 for(let i=1;i<samples.length;i++)if(samples[i].scan<=samples[i-1].scan||samples[i].timeMs<=samples[i-1].timeMs)throw Error('Nonmonotonic scan history');
 for(const rule of rules){let start=-1;
  const close=(end:number,active:boolean)=>{if(start<0)return;
   const first=samples[start],last=samples[end],durationMs=last.timeMs-first.timeMs;
   if(durationMs>=rule.durationMs)alarms.push({id:`${rule.id}:${first.scan}`,ruleId:rule.id,label:rule.label,severity:rule.severity,firstScan:first.scan,lastScan:last.scan,firstTimeMs:first.timeMs,lastTimeMs:last.timeMs,durationMs,active});
   start=-1;
  };
  for(let i=0;i<samples.length;i++){
   if(matches(rule,samples[i])){if(start<0)start=i;}
   else if(start>=0)close(i-1,false);
  }
  if(start>=0)close(samples.length-1,true);
 }
 return {alarms:alarms.sort((a,b)=>b.lastTimeMs-a.lastTimeMs||a.ruleId.localeCompare(b.ruleId)),evaluatedScans:samples.length};
}
export function diagnosticsCsv(result:DiagnosticResult):string{
 const rows=['rule_id,severity,first_scan,last_scan,first_time_ms,last_time_ms,duration_ms,active'];
 for(const a of result.alarms)rows.push([a.ruleId,a.severity,a.firstScan,a.lastScan,a.firstTimeMs,a.lastTimeMs,a.durationMs,a.active].join(','));
 return rows.join('\r\n')+'\r\n';
}
