/** Deterministic educational conveyor model. Distances are millimetres; time is simulated milliseconds. */
export interface Product { id:number; xMm:number; lane:'main'|'reject'; classified:boolean }
export interface ProcessFaults { photoeyeBlocked:boolean; photoeyeOpen:boolean; diverterJammed:boolean; beltSlipping:boolean; productJam:boolean; sensorLag:boolean }
export interface ProcessState { nextId:number; products:readonly Product[]; completed:number; rejected:number; photoeye:boolean; exitSensor:boolean; diverterExtended:boolean; diverterPosition:number; motorFeedback:boolean; faults:ProcessFaults; events:readonly string[] }
export interface ProcessCommand { motor:boolean; diverter:boolean; spawn?:boolean; rejectNext?:boolean }
export const PROCESS_LENGTH_MM=4000;
export const PRODUCT_CLEARANCE_MM=380;
export const DIVERTER_TRAVEL_MS=300;
export function initialProcess():ProcessState {return {nextId:1,products:[],completed:0,rejected:0,photoeye:false,exitSensor:false,diverterExtended:false,diverterPosition:0,motorFeedback:false,faults:{photoeyeBlocked:false,photoeyeOpen:false,diverterJammed:false,beltSlipping:false,productJam:false,sensorLag:false},events:[]};}
export function setProcessFault(state:ProcessState,fault:keyof ProcessFaults,active:boolean,powerIsolated:boolean):ProcessState {
 if(!powerIsolated)return {...state,events:[...state.events,`REJECTED ${fault}: isolate power first`].slice(-150)};
 return {...state,faults:{...state.faults,[fault]:active},events:[...state.events,`FAULT ${fault}=${active}`].slice(-150)};
}
export function advanceProcess(state:ProcessState,command:ProcessCommand,deltaMs:number):ProcessState {
 if(!Number.isSafeInteger(deltaMs)||deltaMs<1||deltaMs>1000)throw new RangeError('Invalid process scan interval');
 const events=[...state.events];let nextId=state.nextId;
 let products=state.products.map(p=>({...p}));
 if(command.spawn){
  if(products.length>=20||products.some(p=>p.xMm<PRODUCT_CLEARANCE_MM))events.push('REJECTED spawn: entry occupied or conveyor full');
  else {products.push({id:nextId++,xMm:0,lane:'main',classified:!!command.rejectNext});events.push(`PRODUCT ${nextId-1} introduced`);}
 }
 const target=command.diverter?1:0;
 const diverterPosition=state.faults.diverterJammed?state.diverterPosition:Math.max(0,Math.min(1,state.diverterPosition+Math.sign(target-state.diverterPosition)*Math.min(Math.abs(target-state.diverterPosition),deltaMs/DIVERTER_TRAVEL_MS)));
 const feedback=command.motor&&!state.faults.beltSlipping&&!state.faults.productJam;
 const move=feedback?500*deltaMs/1000:0;
 // A trailing package cannot overlap a leading package on the main belt.
 const ordered=[...products].sort((a,b)=>b.xMm-a.xMm||a.id-b.id);
 let leading=Infinity;
 const moved=ordered.map(p=>{
  const x=Math.min(PROCESS_LENGTH_MM+1,p.xMm+move,leading-PRODUCT_CLEARANCE_MM);
  const clamped=Math.max(p.xMm,x);
  leading=clamped;
  const lane=p.lane==='main'&&p.classified&&diverterPosition>=0.99&&p.xMm<=2600&&clamped>=2400?'reject':p.lane;
  return {...p,xMm:clamped,lane};
 });
 const exited=moved.filter(p=>p.xMm>=PROCESS_LENGTH_MM);
 for(const p of exited)events.push(`PRODUCT ${p.id} exited ${p.lane}`);
 products=moved.filter(p=>p.xMm<PROCESS_LENGTH_MM).sort((a,b)=>a.id-b.id);
 const detected=products.some(p=>p.xMm>=900&&p.xMm<=1150);
 const photoeye=state.faults.photoeyeBlocked||(!state.faults.photoeyeOpen&&(state.faults.sensorLag?state.photoeye:detected));
 const exitSensor=products.some(p=>p.xMm>=3700&&p.xMm<=3900);
 return {nextId,products,completed:state.completed+exited.filter(p=>p.lane==='main').length,rejected:state.rejected+exited.filter(p=>p.lane==='reject').length,photoeye,exitSensor,diverterExtended:diverterPosition>=0.99,diverterPosition,motorFeedback:feedback,faults:state.faults,events:events.slice(-150)};
}
