/**
 * P3 isolated engineering-unit numeric signal bus for the worker.
 * An analog wire never conducts 24V. A typed plant sensor output may feed
 * one PLC16 AI0/AI1 only; no inferred 0–10V, 4–20mA, ADC or safety fidelity.
 */
import {COMPONENTS} from '../components/registry';
import {PLANT_EQUIPMENT} from '../plant/equipment';
import type {SceneRuntime} from '../plant/world/runner';
import type {PlacedComponent,ProjectFile,Wire} from './signals';
import type {PlcIoMap} from './plc-io';

export type NumericPoint={terminal:string;tag:string;value:number;unit:string;
 connected:boolean;source:string|null};
type Role='analog-input'|'analog-output';
const roleOf=(terminal:string,components:readonly PlacedComponent[]):Role|null=>{
 const dot=terminal.indexOf('.');
 if(dot<=0)return null;
 const device=components.find(c=>c.id===terminal.slice(0,dot));
 const term=device&&COMPONENTS[device.kind].terminals.find(t=>t.name===terminal.slice(dot+1));
 return term?.role==='analog-input'||term?.role==='analog-output'?term.role:null;
};
export const isPlantNumericWire=(wire:Pick<Wire,'from'|'to'>,parts:readonly PlacedComponent[]):boolean=>
 roleOf(wire.from,parts)!==null||roleOf(wire.to,parts)!==null;
export function plantNumericWireError(from:string,to:string,parts:readonly PlacedComponent[],
 wires:readonly Pick<Wire,'from'|'to'>[]):string|null{
 const a=roleOf(from,parts),b=roleOf(to,parts);
 if(!a&&!b)return null;
 if(!((a==='analog-output'&&b==='analog-input')||
      (b==='analog-output'&&a==='analog-input')))
  return 'Numeric signals must connect a process-output to an analog-input; never to a 24V node';
 const input=a==='analog-input'?from:to;
 const source=a==='analog-output'?from:to;
 const dot=input.indexOf('.');
 const owner=parts.find(c=>c.id===input.slice(0,dot));
 if(owner?.kind!=='plc16'||!['AI0','AI1'].includes(input.slice(dot+1)))
  return 'Numeric process sources currently connect only to PLC16 AI0/AI1';
 const sourceOwner=parts.find(c=>c.id===source.slice(0,source.indexOf('.')));
 if(!sourceOwner||!PLANT_EQUIPMENT[sourceOwner.kind]||
    !PLANT_EQUIPMENT[sourceOwner.kind].signals.some(ch=>ch.kind==='number'&&
      'AN_'+ch.name===source.slice(source.indexOf('.')+1)))
  return 'Numeric source is not a typed process measurement';
 if(wires.some(w=>w.from===input||w.to===input))
  return 'Only one numeric source is allowed per PLC input';
 return null;
}
export function sampleNumericInputs(project:Pick<ProjectFile,'components'|'wires'>,
 scene:SceneRuntime,plcId:string,io:PlcIoMap,powered:boolean,
 openWireIds:ReadonlySet<string>=new Set()):{values:Record<string,number>;points:NumericPoint[]}{
 const values:Record<string,number>={};
 const points:NumericPoint[]=[];
 for(const [pin,tag] of Object.entries(io.analogInputs??{})){
  const target=plcId+'.'+pin;
  const link=project.wires.find(w=>!openWireIds.has(w.id)&&
    (w.from===target||w.to===target)&&isPlantNumericWire(w,project.components));
  const source=link?(link.from===target?link.to:link.from):null;
  const id=source?.split('.')[0]??'';
  const part=project.components.find(c=>c.id===id);
  const def=part&&PLANT_EQUIPMENT[part.kind];
  const signal=source?.slice(source.indexOf('.')+1).replace(/^AN_/,'')??'';
  const channel=def?.signals.find(ch=>ch.kind==='number'&&ch.name===signal);
  const connected=!!source&&!!channel;
  let value=0;
  if(powered&&connected){
   const actual=scene.signals[id]?.[signal];
   if(typeof actual!=='number'||!Number.isFinite(actual)||Math.abs(actual)>1_000_000_000)
    throw new RangeError('Process numeric sensor has an invalid engineering-unit reading');
   value=actual;
  }
  values[tag]=value;
  points.push({terminal:pin,tag,value,unit:connected?channel?.unit??'':'',
    connected,source:connected?source:null});
 }
 return {values,points};
}
