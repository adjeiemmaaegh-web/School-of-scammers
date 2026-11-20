/**
 * R20 factory infrastructure that takes part in the simulation: fence panels and interlocked guard doors.
 *
 * Both are BLOCKERS in the physics: while a panel is solid it physically stops conveyed bodies at its footprint (the same
 * mechanism the stopper uses), so material flow genuinely cannot pass a fence or a closed door. A guard door also publishes
 * a "closed" interlock contact that wiring or a PLC can use to gate machines (a safety-TRAINING interlock). Educational
 * only: none of this is a safety function, a rated interlock or a certified guard.
 */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,param,spec} from '../world/equipment';
import {q,vec} from '../world/math';

/** A fixed, always-solid fence panel: blocks conveyed material across its footprint (length x thickness, rotatable in quarter turns). */
export const safetyFence:EquipmentDef={
 kind:'safety-fence',label:'Safety fence panel',footprint:vec(1000,50,1800),
 commands:[],signals:[],
 params:[spec('lengthMm','Panel length','mm',200,3000,50,1000),spec('widthMm','Panel thickness','mm',50,400,50,50)],
 faults:[],
 fresh:()=>({...initial({}),engaged:true}),
 step:(s,w)=>({world:w,state:{...s,engaged:true}}),
 read:()=>({}),
 describe:(s,ctx)=>[draw(ctx,'fence','box',vec(param(ctx,'lengthMm',1000),Math.max(30,param(ctx,'widthMm',50)),1500),750,'#c9a227')],
};

/** An interlocked guard door: solid until fully open; publishes `closed` (interlock contact) and `open`. */
export const guardDoor:EquipmentDef={
 kind:'guard-door',label:'Interlocked guard door',footprint:vec(800,50,1800),
 commands:[{name:'open',kind:'bool'}],
 signals:[{name:'closed',kind:'bool'},{name:'open',kind:'bool'}],
 params:[spec('lengthMm','Door width','mm',200,2000,50,800),spec('widthMm','Door thickness','mm',50,400,50,50),
  spec('travelMs','Open/close time','ms',200,5000,100,1500)],
 faults:['door-jammed','interlock-stuck-closed'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const travel=param(ctx,'travelMs',1500);
  const wantOpen=flag(c,'open');
  let progress=s.progress;
  if(f!=='door-jammed')progress=Math.max(0,Math.min(1,progress+(wantOpen?dt:-dt)/travel));
  // The door is an obstruction until it is fully open.
  // phase 1 records a welded interlock contact for read(): it reports closed whatever the door is doing.
  return {world:w,state:{...s,progress:q(progress),engaged:progress<0.999,phase:f==='interlock-stuck-closed'?1:0,faulted:!!f}};
 },
 // The dangerous failure: an interlock contact welded closed keeps reporting "closed" with the door open.
 read:(s)=>({closed:s.phase===1||s.progress<=0.001,open:s.progress>=0.999}),
 describe:(s,ctx)=>[draw(ctx,'door','box',vec(param(ctx,'lengthMm',800)*(1-s.progress*0.9),Math.max(30,param(ctx,'widthMm',50)),1500),750,s.progress<0.001?'#b5651d':'#7a9f5b')],
};
