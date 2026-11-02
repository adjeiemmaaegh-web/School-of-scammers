/** Educational, deterministic 24 V wiring board. No current/thermal/arc simulation. */
import {solveDiscrete24V, type Circuit, type CircuitResult} from './electrical';
export type PartKind='supply'|'fuse'|'switch'|'relay'|'load'|'plc-input'|'plc-output'|'relay-contact';
export interface Part {id:string;kind:PartKind;label:string;x:number;y:number;closed?:boolean;controlledBy?:string}
export interface Wire {id:string;from:string;to:string}
export interface Board {parts:readonly Part[];wires:readonly Wire[]}
export type BoardChange={kind:'connect';from:string;to:string}|{kind:'disconnect';id:string}|{kind:'toggle';id:string}|{kind:'add';part:Part};
export const newBoard=():Board=>({parts:[
 {id:'PS',kind:'supply',label:'24V DC',x:20,y:30},
 {id:'F1',kind:'fuse',label:'F1 Fuse',x:220,y:30,closed:true},
 {id:'S1',kind:'switch',label:'S1 Switch',x:420,y:30,closed:true},
 {id:'K1',kind:'relay',label:'K1 Coil',x:420,y:220},
 {id:'L1',kind:'load',label:'L1 Lamp',x:220,y:220},
 {id:'I0',kind:'plc-input',label:'PLC I0.2',x:20,y:220}
 ],wires:[]});
export const terminals=(p:Part):readonly string[]=>p.kind==='supply'?[`${p.id}.P`,`${p.id}.M`]:p.kind==='plc-input'?[`${p.id}.IN`,`${p.id}.COM`]:[`${p.id}.A`,`${p.id}.B`];
export function changeBoard(board:Board,change:BoardChange,energized:boolean):Board {
 if(energized)throw new Error('Isolate simulated supply before editing wires or components');
 if(change.kind==='connect'){
  const valid=new Set(board.parts.flatMap(p=>terminals(p)));
  if(!valid.has(change.from)||!valid.has(change.to)||change.from===change.to)throw new Error('Invalid wire terminals');
  if(board.wires.some(w=>(w.from===change.from&&w.to===change.to)||(w.from===change.to&&w.to===change.from)))throw new Error('Duplicate wire');
  return {...board,wires:[...board.wires,{id:`w${board.wires.reduce((m,w)=>Math.max(m,Number(w.id.slice(1))||0),0)+1}`,from:change.from,to:change.to}]};
 }
 if(change.kind==='disconnect')return {...board,wires:board.wires.filter(w=>w.id!==change.id)};
 if(change.kind==='toggle')return {...board,parts:board.parts.map(p=>p.id===change.id&&['switch','fuse'].includes(p.kind)?{...p,closed:!p.closed}:p)};
 if(board.parts.some(p=>p.id===change.part.id)||!Number.isFinite(change.part.x)||!Number.isFinite(change.part.y))throw new Error('Invalid component');
 return {...board,parts:[...board.parts,change.part]};
}
export interface BoardReading {result:CircuitResult;plcInputs:Readonly<Record<string,boolean>>;relayCoils:readonly string[]}
export function evaluateBoard(board:Board,powerOn:boolean,plcOutputs:Readonly<Record<string,boolean>>={}):BoardReading {
 const supplies=board.parts.filter(p=>p.kind==='supply');
 const diagnostics:string[]=[];
 if(supplies.length!==1)diagnostics.push('Exactly one supply required');
 const devices:import('./electrical').Device[]=[{id:'supply',kind:'supply',positive:`${supplies[0]?.id??'PS'}.P`,negative:`${supplies[0]?.id??'PS'}.M`,volts:24}];
 for(const p of board.parts){if(p.kind==='supply')continue;
  const [a,b]=terminals(p);
  if(p.kind==='fuse'||p.kind==='switch'||p.kind==='plc-output'||p.kind==='relay-contact')devices.push({id:p.id,kind:'switch',a,b,closed:p.kind==='plc-output'?plcOutputs[p.label.replace(/^PLC\s+/, '')]===true:p.kind==='relay-contact'?!!p.controlledBy && plcOutputs[p.controlledBy]===true:!!p.closed});
  else devices.push({id:p.id,kind:'load',positive:a,negative:b,nominalVolts:24});
 }
 const result=solveDiscrete24V({devices,wires:board.wires.map(w=>[w.from,w.to])});
 if(!powerOn)return {result:{voltage:Object.fromEntries(Object.keys(result.voltage).map(t=>[t,0])),energizedLoads:[],diagnostics:[...diagnostics,'Supply isolated']},plcInputs:{},relayCoils:[]};
 return {result:{...result,diagnostics:[...diagnostics,...result.diagnostics]},plcInputs:Object.fromEntries(board.parts.filter(p=>p.kind==='plc-input').map(p=>[p.label.replace(/^PLC\s+/,''),result.energizedLoads.includes(p.id)])),relayCoils:board.parts.filter(p=>p.kind==='relay'&&result.energizedLoads.includes(p.id)).map(p=>p.id)};
}
