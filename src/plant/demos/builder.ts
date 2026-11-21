/**
 * Integrated demonstration projects. A demo is an ordinary, editable ProjectFile: placed equipment, real 24V wiring to a PLC16,
 * device settings and a Structured Text program. Nothing here animates the plant; the worker runs the same scan engine, wiring
 * solver and plant physics as any learner project, so a demo can be loaded, edited, faulted and re-run.
 */
import type {ComponentKind} from '../../components/registry';
import type {PlacedComponent,ProjectFile,Wire} from '../../sim/signals';

const px=(mm:number)=>Math.max(0,Math.min(910,Math.round(mm/10+455)));
const py=(mm:number)=>Math.max(0,Math.min(450,Math.round(mm/10+225)));

export class DemoBuilder{
 readonly components:PlacedComponent[]=[];readonly wires:Wire[]=[];readonly params:Record<string,Record<string,number>>={};
 readonly io:{inputs:Record<string,string>;outputs:Record<string,string>}={inputs:{},outputs:{}};
 private readonly powered=new Set<string>();private readonly returned=new Set<string>();private n=0;
 constructor(readonly plc='plc',readonly supply='ps'){
  this.components.push({id:plc,kind:'plc16',x:10,y:10,pressed:false},{id:supply,kind:'supply',x:10,y:200,pressed:false});
  this.wire(supply+'.P24',plc+'.L+');this.wire(supply+'.M0',plc+'.M');
 }
 wire(from:string,to:string){this.wires.push({id:'w'+(this.n++),from,to});}
 /** Place a device at floor millimetres; `settings` are its inspector settings. */
 place(id:string,kind:ComponentKind,xMm:number,yMm:number,settings:Record<string,number>={},yawDeg:0|90|180|270=0,elevationMm=0):this{
  this.components.push({id,kind,x:px(xMm),y:py(yMm),pressed:false,...(yawDeg?{yawDeg}:{}),...(elevationMm?{elevationMm}:{})});
  if(Object.keys(settings).length)this.params[id]={...settings};
  return this;
 }
 /** Supply a sensing device (its L+ / M terminals). */
 power(id:string):this{
  if(!this.powered.has(id)){this.powered.add(id);this.wire(this.supply+'.P24',id+'.L+');this.wire(this.supply+'.M0',id+'.M');}
  return this;
 }
 /** PLC output (0-15) drives a device command channel: Q<n> -> CMD_<command>+, device M- to the supply common. */
 drive(out:number,id:string,command:string,tag?:string):this{
  if(tag)this.io.outputs[`Q${Math.floor(out/8)}.${out%8}`]=tag;
  this.wire(`${this.plc}.Q${Math.floor(out/8)}.${out%8}`,`${id}.CMD_${command}+`);
  if(!this.returned.has(id)){this.returned.add(id);this.wire(id+'.M-',this.supply+'.M0');}
  return this;
 }
 /** Device digital signal feeds PLC input (0-15); the device is powered. */
 sense(id:string,signal:string,input:number,tag?:string):this{
  if(tag)this.io.inputs[`I${Math.floor(input/8)}.${input%8}`]=tag;
  this.power(id);this.wire(`${id}.OUT_${signal}`,`${this.plc}.I${Math.floor(input/8)}.${input%8}`);
  return this;
 }
 /** Continuously enable a device command from the supply (hard-wired, no PLC). */
 hardEnable(id:string,command:string):this{
  this.wire(this.supply+'.P24',`${id}.CMD_${command}+`);
  if(!this.returned.has(id)){this.returned.add(id);this.wire(id+'.M-',this.supply+'.M0');}
  return this;
 }
 /** A minimal valid ladder document over the demo's own tag names (the project runs in Structured Text; this is never executed). */
 private placeholderLadder(){
  const input=Object.values(this.io.inputs)[0]??'In0',output=Object.values(this.io.outputs)[0]??'Out0';
  return {id:'demo',version:'1',rungs:[{id:'rung-1',elements:[{type:'contact' as const,tag:input}],coil:output}]};
 }
 build(st:string):ProjectFile{
  // The ladder document is empty: this demo is programmed in Structured Text, whose tags are named by plcIo below.
  return {formatVersion:1,components:this.components,wires:this.wires,program:this.placeholderLadder(),language:'st',stSource:st,
   ...(Object.keys(this.params).length?{params:this.params}:{}),
   ...(Object.keys(this.io.inputs).length||Object.keys(this.io.outputs).length?{plcIo:{[this.plc]:this.io}}:{})};
 }
}
