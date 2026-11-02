/** Compare baseline and faulted PLC output states at every simulated scan. */
import {executeLadder,validateLadder,type LadderDocument,type LadderMemory} from './ladder';
import {injectInputFault,type InputFault} from './input-fault-campaign';
import type {VectorStep} from './ladder-sequences';
export type ScanFaultDifference={scan:number;output:string;baseline:boolean;faulted:boolean;baselineInputs:Record<string,boolean>;faultedInputs:Record<string,boolean>};
export type FaultImpactWindow={output:string;startScan:number;endScan:number;durationScans:number;extendsBeyondFault:boolean};
export type ScanFaultTrace={totalScans:number;differentScans:number;firstDifferenceScan:number|null;differences:ScanFaultDifference[];truncated:boolean;impactWindows:FaultImpactWindow[];postFaultDifferentScans:number;recoveredByEnd:boolean;faultEndScan:number};
function expand(steps:readonly VectorStep[]):Record<string,boolean>[]{
 const rows:Record<string,boolean>[]=[];let state:Record<string,boolean>={};
 for(const step of steps){state={...state,...step.inputs};for(let n=0;n<step.scans;n++)rows.push({...state});}
 return rows;
}
export function traceInputFaultScans(doc:LadderDocument,steps:readonly VectorStep[],fault:InputFault,maxEvidence=200,deltaMs=20):ScanFaultTrace{
 const errors=validateLadder(doc);if(errors.length)throw Error(errors.join('; '));
 if(!Number.isSafeInteger(maxEvidence)||maxEvidence<1||maxEvidence>1000)throw RangeError('Evidence cap must be 1..1000');
 if(!Number.isSafeInteger(deltaMs)||deltaMs<1||deltaMs>1000)throw RangeError('Scan interval must be 1..1000 ms');
 const injected=injectInputFault(steps,fault);
 const base=expand(steps),altered=expand(injected);
 if(base.length!==altered.length)throw Error('Fault injection changed the scan count');
 const outputTags=new Set(doc.rungs.map(r=>r.coil));
 for(const [i,step] of steps.entries())for(const tag of Object.keys(step.inputs))if(outputTags.has(tag))throw Error(`Step ${i+1}: cannot force output ${tag}`);
 let aOut:Record<string,boolean>={},bOut:Record<string,boolean>={},aMem:LadderMemory={},bMem:LadderMemory={};
 let differentScans=0,firstDifferenceScan:number|null=null,truncated=false;
 const differences:ScanFaultDifference[]=[];
 const impactWindows:FaultImpactWindow[]=[];
 const active=new Map<string,number>();
 const faultEndScan=fault.startScan+fault.durationScans-1;
 let postFaultDifferentScans=0;
 for(let i=0;i<base.length;i++){
  const a=executeLadder(doc,base[i],aOut,aMem,deltaMs),b=executeLadder(doc,altered[i],bOut,bMem,deltaMs);
  aOut=a.outputs;bOut=b.outputs;aMem=a.memory;bMem=b.memory;
  let changed=false;
  for(const output of outputTags){
   const differs=(aOut[output]??false)!==(bOut[output]??false);
   if(differs){
   changed=true;
   if(!active.has(output))active.set(output,i+1);
   if(differences.length<maxEvidence)differences.push({scan:i+1,output,baseline:aOut[output]??false,faulted:bOut[output]??false,baselineInputs:{...base[i]},faultedInputs:{...altered[i]}});
   else truncated=true;
   }else if(active.has(output)){
    const startScan=active.get(output)!;
    impactWindows.push({output,startScan,endScan:i,durationScans:i-startScan+1,extendsBeyondFault:i>faultEndScan});
    active.delete(output);
   }
  }
  if(changed){differentScans++;if(i+1>faultEndScan)postFaultDifferentScans++;if(firstDifferenceScan===null)firstDifferenceScan=i+1;}
 }
 for(const [output,startScan] of active)impactWindows.push({output,startScan,endScan:base.length,durationScans:base.length-startScan+1,extendsBeyondFault:base.length>faultEndScan});
 impactWindows.sort((a,b)=>a.startScan-b.startScan||a.output.localeCompare(b.output));
 return {totalScans:base.length,differentScans,firstDifferenceScan,differences,truncated,impactWindows,postFaultDifferentScans,recoveredByEnd:active.size===0,faultEndScan};
}
export function scanFaultTraceCsv(trace:ScanFaultTrace):string{
 const cell=(v:unknown)=>`"${String(v).replace(/"/g,'""')}"`;
 return [['scan','output','baseline','faulted','baseline_inputs','faulted_inputs'].map(cell).join(','),...trace.differences.map(d=>[d.scan,d.output,d.baseline,d.faulted,JSON.stringify(d.baselineInputs),JSON.stringify(d.faultedInputs)].map(cell).join(','))].join('\r\n');
}

/** All impact windows are computed from full scan comparisons, even when detail evidence is capped. */
export function faultImpactCsv(trace:ScanFaultTrace):string{
 const cell=(v:unknown)=>`"${String(v).replace(/"/g,'""')}"`;
 return [['output','start_scan','end_scan','duration_scans','extends_beyond_fault'].map(cell).join(','),...trace.impactWindows.map(w=>[w.output,w.startScan,w.endScan,w.durationScans,w.extendsBeyondFault].map(cell).join(','))].join('\r\n');
}
