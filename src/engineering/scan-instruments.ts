import type {WorkcellState} from './workcell';

/** Pure scan-driven signal recorder. Sampling a historical state never changes the PLC. */
export type SignalKind='digital'|'analog';
export type SignalDefinition={id:string;label:string;unit:string;kind:SignalKind};
export const SIGNALS:readonly SignalDefinition[]=[
 {id:'power',label:'24 V supply',unit:'V',kind:'analog'},
 {id:'motor',label:'Motor energized',unit:'boolean',kind:'digital'},
 {id:'belt',label:'Belt moving',unit:'boolean',kind:'digital'},
 {id:'sensor',label:'SensorOK input',unit:'boolean',kind:'digital'},
 {id:'run',label:'RunLatch output',unit:'boolean',kind:'digital'},
 {id:'photoeye',label:'Product photoeye',unit:'boolean',kind:'digital'},
 {id:'exit',label:'Exit photoeye',unit:'boolean',kind:'digital'},
 {id:'diverter',label:'Diverter extension',unit:'%',kind:'analog'},
 {id:'products',label:'Products on belt',unit:'count',kind:'analog'},
 {id:'completed',label:'Completed products',unit:'count',kind:'analog'},
 {id:'rejected',label:'Rejected products',unit:'count',kind:'analog'},
 {id:'contactor',label:'K1 feedback',unit:'boolean',kind:'digital'},
];
export type ScanSample={scan:number;timeMs:number;values:Record<string,number>};
export type Recorder={samples:readonly ScanSample[];capacity:number};
export type Edge={signal:string;scan:number;timeMs:number;direction:'rising'|'falling';from:number;to:number};
export const createRecorder=(capacity=500):Recorder=>{if(!Number.isSafeInteger(capacity)||capacity<2||capacity>10000)throw Error('Invalid recorder capacity');return {samples:[],capacity};};
const bit=(x:boolean)=>x?1:0;
export function sampleWorkcell(s:WorkcellState):ScanSample {
 const p=s.process;
 const values:Record<string,number>={power:s.powerOn?24:0,motor:bit(s.motor),belt:bit(p.motorFeedback),sensor:bit(Boolean(s.plcInputs.SensorOK)),run:bit(Boolean(s.plcOutputs.RunLatch)),photoeye:bit(p.photoeye),exit:bit(p.exitSensor),diverter:p.diverterPosition*100,products:p.products.length,completed:p.completed,rejected:p.rejected,contactor:bit(s.starter.feedback)};
 for(const v of Object.values(values))if(!Number.isFinite(v))throw Error('Non-finite instrument reading');
 return {scan:s.scan,timeMs:s.timeMs,values};
}
export function recordScan(recorder:Recorder,s:WorkcellState):Recorder {
 const sample=sampleWorkcell(s);const last=recorder.samples.at(-1);
 if(last&&sample.scan<=last.scan)throw Error('Recorder requires strictly increasing scan numbers');
 if(last&&sample.timeMs<=last.timeMs)throw Error('Recorder requires increasing simulated time');
 return {...recorder,samples:[...recorder.samples.slice(-(recorder.capacity-1)),sample]};
}
export function detectEdges(recorder:Recorder,signal:string):Edge[] {
 if(!SIGNALS.some(s=>s.id===signal&&s.kind==='digital'))throw Error('Unknown digital signal');
 const edges:Edge[]=[];for(let i=1;i<recorder.samples.length;i++){
  const a=recorder.samples[i-1],b=recorder.samples[i];const from=a.values[signal],to=b.values[signal];
  if(from!==to)edges.push({signal,scan:b.scan,timeMs:b.timeMs,direction:to>from?'rising':'falling',from,to});
 }return edges;
}
export function csvRecorder(recorder:Recorder,signalIds:readonly string[]):string {
 if(!signalIds.length||new Set(signalIds).size!==signalIds.length||signalIds.some(id=>!SIGNALS.some(s=>s.id===id)))throw Error('Invalid signal selection');
 const rows=[['scan','time_ms',...signalIds].join(',')];
 for(const sample of recorder.samples)rows.push([sample.scan,sample.timeMs,...signalIds.map(id=>sample.values[id])].join(','));
 return rows.join('\r\n')+'\r\n';
}
export function signalStats(recorder:Recorder,id:string){
 if(!SIGNALS.some(s=>s.id===id))throw Error('Unknown signal');
 const readings=recorder.samples.map(s=>s.values[id]);
 return readings.length?{min:Math.min(...readings),max:Math.max(...readings),last:readings.at(-1)!,count:readings.length}:null;
}
