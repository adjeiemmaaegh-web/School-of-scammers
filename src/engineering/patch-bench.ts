/** Educational 24 V control bench: ideal conductors and discrete loads, not circuit-analysis software. */
import {solveDiscrete24V,type Circuit,type CircuitResult} from './electrical';
export const PATCH_PORTS=['PSU+','PSU-','F1:IN','F1:OUT','S1:IN','S1:OUT','H1:+','H1:-'] as const;
export type PatchPort=typeof PATCH_PORTS[number];
export type PatchLink=readonly [PatchPort,PatchPort];
export type PatchBenchState={
 supplyOn:boolean;switchClosed:boolean;fuseClosed:boolean;links:readonly PatchLink[];
 trips:number;events:readonly string[];
};
const ports=new Set<string>(PATCH_PORTS);
const key=(a:string,b:string)=>[a,b].sort().join('|');
const record=(state:PatchBenchState,msg:string):PatchBenchState=>({...state,events:[...state.events,msg].slice(-100)});
export function initialPatchBench():PatchBenchState{
 return {supplyOn:false,switchClosed:false,fuseClosed:true,
 links:[['PSU+','F1:IN'],['F1:OUT','S1:IN'],['S1:OUT','H1:+']],
 trips:0,events:['START: control supply isolated; lamp return is intentionally disconnected']};
}
export function benchCircuit(s:PatchBenchState):Circuit{
 return {devices:[
  {id:'PSU1',kind:'supply',positive:'PSU+',negative:'PSU-',volts:24},
  {id:'F1',kind:'switch',a:'F1:IN',b:'F1:OUT',closed:s.fuseClosed},
  {id:'S1',kind:'switch',a:'S1:IN',b:'S1:OUT',closed:s.switchClosed},
  {id:'H1',kind:'load',positive:'H1:+',negative:'H1:-',nominalVolts:24}
 ],wires:s.links};
}
export type PatchReading={supplyOn:boolean;lampOn:boolean;diagnostics:string[];voltage:Record<string,number|null>;trips:number};
export function inspectPatchBench(s:PatchBenchState):PatchReading{
 const r:CircuitResult=solveDiscrete24V(benchCircuit(s));
 const errors=r.diagnostics.filter(x=>x.startsWith('Supply short'));
 return {supplyOn:s.supplyOn,lampOn:s.supplyOn&&!errors.length&&r.energizedLoads.includes('H1'),
  diagnostics:errors.length?errors:!s.fuseClosed?['Fuse F1 is open']:[],
  voltage:Object.fromEntries(PATCH_PORTS.map(t=>[t,s.supplyOn?r.voltage[t]??null:0])),
  trips:s.trips};
}
function tripIfShort(s:PatchBenchState):PatchBenchState{
 if(s.supplyOn&&solveDiscrete24V(benchCircuit(s)).diagnostics.some(x=>x.startsWith('Supply short'))){
  return record({...s,supplyOn:false,fuseClosed:false,trips:s.trips+1},
   'SIMULATED SHORT: supply isolated and protective F1 marked open; this model does not calculate fault current');
 }
 return s;
}
export function setPatchSupply(s:PatchBenchState,on:boolean):PatchBenchState{
 if(typeof on!=='boolean')throw TypeError('Invalid supply command');
 return tripIfShort(record({...s,supplyOn:on},on?'Supply ON':'Supply ISOLATED'));
}
export function setPatchSwitch(s:PatchBenchState,closed:boolean):PatchBenchState{
 if(typeof closed!=='boolean')throw TypeError('Invalid switch command');
 return tripIfShort(record({...s,switchClosed:closed},'S1 '+(closed?'CLOSED':'OPEN')));
}
export function setPatchFuse(s:PatchBenchState,closed:boolean):PatchBenchState{
 if(s.supplyOn)throw Error('Isolate supply before resetting fuse F1');
 return record({...s,fuseClosed:closed},closed?'F1 reset under isolation':'F1 opened under isolation');
}
export function patchWire(s:PatchBenchState,a:PatchPort,b:PatchPort,connect:boolean):PatchBenchState{
 if(s.supplyOn)throw Error('Isolate simulated supply before rewiring');
 if(!ports.has(a)||!ports.has(b)||a===b)throw RangeError('Invalid patch terminals');
 const exists=s.links.some(l=>key(l[0],l[1])===key(a,b));
 if(connect&&exists)throw Error('Duplicate patch wire');
 if(connect&&s.links.length>=12)throw RangeError('Maximum 12 wires for this teaching bench');
 if(!connect&&!exists)throw Error('Patch wire is not connected');
 const links=connect?[...s.links,[a,b] as const]:s.links.filter(l=>key(l[0],l[1])!==key(a,b));
 return record({...s,links},(connect?'CONNECTED ':'REMOVED ')+a+' — '+b);
}
export function measurePatchVoltage(s:PatchBenchState,a:PatchPort,b:PatchPort):number|null{
 if(!ports.has(a)||!ports.has(b))throw RangeError('Unknown meter terminal');
 const result=inspectPatchBench(s);
 if(!s.supplyOn)return 0;
 const va=result.voltage[a],vb=result.voltage[b];
 return va===null||vb===null?null:va-vb;
}
/** Continuity is defined for ideal wires and closed switches only, with SUPPLY OFF. */
export function measurePatchContinuity(s:PatchBenchState,a:PatchPort,b:PatchPort):boolean{
 if(s.supplyOn)throw Error('Continuity is disabled when simulated supply is energized');
 if(!ports.has(a)||!ports.has(b))throw RangeError('Unknown meter terminal');
 const map=new Map<string,Set<string>>();
 const edge=(x:string,y:string)=>{if(!map.has(x))map.set(x,new Set());if(!map.has(y))map.set(y,new Set());map.get(x)!.add(y);map.get(y)!.add(x);};
 for(const [x,y] of s.links)edge(x,y);
 if(s.fuseClosed)edge('F1:IN','F1:OUT');
 if(s.switchClosed)edge('S1:IN','S1:OUT');
 const seen=new Set([a]), todo=[a];
 while(todo.length){for(const v of map.get(todo.pop()!)??[]){if(!seen.has(v)){seen.add(v);todo.push(v);}}}
 return seen.has(b);
}
export function patchEvidenceCsv(s:PatchBenchState):string{
 const rows=[['step','event'],...s.events.map((e,i)=>[String(i+1),e])];
 const q=(v:string)=>'"'+v.replace(/"/g,'""')+'"';
 return rows.map(r=>r.map(q).join(',')).join('\r\n');
}
