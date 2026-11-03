/** Educational DC network analysis with fixed 24 V ideal source.
 * A bounded nodal conductance solver for passive resistors plus ideal wires/switches.
 * It does not represent real current limiting, heat, arc faults, protection devices,
 * semiconductor behavior, transients, distributed ground, or hazardous live wiring.
 */
export const DC_FORMAT='plc-dc-resistive-workcell' as const;
export const DC_KEY='plc-dc-resistive-workcell-v1';
export const DC_RECOVERY_KEY='plc-dc-resistive-workcell-recovery-v1';
export const DC_DAMAGED_KEY='plc-dc-resistive-workcell-damaged-primary-v1';
export type DcKind='resistor'|'switch'|'wire';
export type DcPart={id:string;kind:DcKind;a:string;b:string;ohms?:number;closed?:boolean};
export type DcCircuit={format:typeof DC_FORMAT;schemaVersion:1;name:string;nodes:string[];parts:DcPart[]};
export type DcReading={partId:string;kind:DcKind;voltageV:number|null;currentA:number|null;powerW:number|null};
export type DcAnalysis={volts:Readonly<Record<string,number|null>>;readings:readonly DcReading[];sourceCurrentA:number|null;sourcePowerW:number|null;shortCircuit:boolean;overcurrent:boolean;diagnostics:readonly string[]};
export type DcStorage={getItem(k:string):string|null;setItem(k:string,v:string):void};
const ID=/^[A-Za-z][A-Za-z0-9_-]{0,23}$/;
const NODE=/^[A-Z][A-Z0-9_]{0,11}$/;
const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
const round=(n:number)=>Math.abs(n)<1e-12?0:Math.round(n*1e9)/1e9;
const isObj=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const resistor=(id:string,a:string,b:string,ohms:number):DcPart=>({id,kind:'resistor',a,b,ohms});
export const DC_PRESETS=['divider','parallel','bridge','open','short'] as const;
export type DcPreset=(typeof DC_PRESETS)[number];
export function circuitPreset(name:DcPreset='divider'):DcCircuit{
 const base={format:DC_FORMAT,schemaVersion:1,name:'24 V DC · '+name,nodes:['P24','GND','N1','N2','N3']} as const;
 const parts:Record<DcPreset,DcPart[]>={
  divider:[resistor('R1','P24','N1',1000),resistor('R2','N1','GND',1000)],
  parallel:[resistor('R1','P24','GND',1000),resistor('R2','P24','GND',2000)],
  bridge:[resistor('R1','P24','N1',1000),resistor('R2','N1','GND',1000),resistor('R3','P24','N2',2000),resistor('R4','N2','GND',2000),resistor('R5','N1','N2',200)],
  open:[resistor('R1','P24','N1',1000)],
  short:[{id:'W1',kind:'wire',a:'P24',b:'GND'}]
 };
 return {...base,nodes:[...base.nodes],parts:parts[name].map(x=>({...x}))};
}
export function validateCircuit(value:unknown):DcCircuit{
 if(!isObj(value))throw Error('Invalid DC project object');
 const {format,schemaVersion,name,nodes,parts}=value;
 if(format!==DC_FORMAT||schemaVersion!==1||typeof name!=='string'||name.trim().length===0||name.length>64)throw Error('Invalid DC project header');
 if(!Array.isArray(nodes)||nodes.length<2||nodes.length>12||nodes[0]!=='P24'||nodes[1]!=='GND'||!nodes.every(x=>typeof x==='string'&&NODE.test(x))||new Set(nodes).size!==nodes.length)throw Error('Invalid or duplicate circuit nodes');
 if(!Array.isArray(parts)||parts.length>40)throw Error('Circuit component capacity exceeded (40)');
 const ids=new Set<string>(),output:DcPart[]=[];
 for(const valuePart of parts){
  if(!isObj(valuePart))throw Error('Invalid component object');
  const {id,kind,a,b,ohms,closed}=valuePart;
  if(typeof id!=='string'||!ID.test(id)||ids.has(id)||!['resistor','switch','wire'].includes(String(kind))||typeof a!=='string'||typeof b!=='string'||!nodes.includes(a)||!nodes.includes(b)||a===b)throw Error('Invalid component ID, type or terminals');
  ids.add(id);
  if(kind==='resistor'){
   if(!finite(ohms)||Number(ohms)<1||Number(ohms)>1e6)throw Error('Resistor must be 1–1,000,000 Ω');
   if(closed!==undefined)throw Error('Resistor cannot have switch state');
   output.push({id,kind,a,b,ohms:Number(ohms)});
  }else if(kind==='switch'){
   if(typeof closed!=='boolean'||ohms!==undefined)throw Error('Invalid switch state');
   output.push({id,kind,a,b,closed});
  }else{
   if(ohms!==undefined||closed!==undefined)throw Error('Ideal wire cannot have resistance or switch state');
   output.push({id,kind:'wire',a,b});
  }
 }
 return {format:DC_FORMAT,schemaVersion:1,name,nodes:[...nodes],parts:output};
}
export function parseCircuit(text:string):DcCircuit{
 if(typeof text!=='string'||text.length>30000)throw RangeError('DC project exceeds 30 KB');
 let object:unknown;try{object=JSON.parse(text)}catch{throw Error('Invalid circuit JSON')}
 return validateCircuit(object);
}
export function serializeCircuit(value:DcCircuit):string{return JSON.stringify(validateCircuit(value),null,2);}
export function addCircuitPart(circuit:DcCircuit,part:DcPart):DcCircuit{return validateCircuit({...validateCircuit(circuit),parts:[...circuit.parts,part]});}
export function updateCircuitPart(circuit:DcCircuit,id:string,changes:Partial<Pick<DcPart,'ohms'|'closed'|'a'|'b'>>):DcCircuit{
 const old=validateCircuit(circuit);
 if(!old.parts.some(p=>p.id===id))throw Error('Component not found');
 return validateCircuit({...old,parts:old.parts.map(p=>p.id===id?{...p,...changes}:p)});
}
export function removeCircuitPart(circuit:DcCircuit,id:string):DcCircuit{
 const old=validateCircuit(circuit);return validateCircuit({...old,parts:old.parts.filter(p=>p.id!==id)});
}
export function addCircuitNode(circuit:DcCircuit):DcCircuit{
 const old=validateCircuit(circuit);
 let n=1;while(old.nodes.includes('N'+n))n++;
 return validateCircuit({...old,nodes:[...old.nodes,'N'+n]});
}
export function removeCircuitNode(circuit:DcCircuit,node:string):DcCircuit{
 const old=validateCircuit(circuit);
 if(node==='P24'||node==='GND'||!old.nodes.includes(node))throw Error('Only user-created circuit nodes can be removed');
 return validateCircuit({...old,nodes:old.nodes.filter(n=>n!==node),parts:old.parts.filter(p=>p.a!==node&&p.b!==node)});
}
type Union={find:(s:string)=>string;join:(a:string,b:string)=>void};
const union=(nodes:readonly string[]):Union=>{
 const p=new Map(nodes.map(n=>[n,n]));
 const find=(n:string):string=>{const q=p.get(n);if(!q)throw Error('Unknown node');if(q===n)return n;const root=find(q);p.set(n,root);return root;};
 return {find,join:(a,b)=>{const ra=find(a),rb=find(b);if(ra!==rb)p.set(rb,ra);}};
};
/** Gaussian elimination with partial pivoting: the network is bounded to 12 nodes. */
function linearSolve(a:number[][],b:number[]):number[]{
 const n=b.length;
 for(let col=0;col<n;col++){
  let pivot=col;
  for(let row=col+1;row<n;row++)if(Math.abs(a[row][col])>Math.abs(a[pivot][col]))pivot=row;
  if(Math.abs(a[pivot][col])<1e-14)throw Error('Singular DC network');
  [a[col],a[pivot]]=[a[pivot],a[col]];
  [b[col],b[pivot]]=[b[pivot],b[col]];
  const factor=a[col][col];
  for(let j=col;j<n;j++)a[col][j]/=factor;b[col]/=factor;
  for(let row=0;row<n;row++)if(row!==col){
   const multiple=a[row][col];
   if(!multiple)continue;
   for(let j=col;j<n;j++)a[row][j]-=multiple*a[col][j];
   b[row]-=multiple*b[col];
  }
 }
 return b;
}
export function analyzeCircuit(input:DcCircuit):DcAnalysis{
 const dc=validateCircuit(input),sets=union(dc.nodes);
 for(const p of dc.parts)if(p.kind==='wire'||p.kind==='switch'&&p.closed)sets.join(p.a,p.b);
 const high=sets.find('P24'),low=sets.find('GND');
 if(high===low)return {volts:Object.fromEntries(dc.nodes.map(x=>[x,null])),readings:dc.parts.map(p=>({partId:p.id,kind:p.kind,voltageV:null,currentA:null,powerW:null})),sourceCurrentA:null,sourcePowerW:null,shortCircuit:true,overcurrent:true,diagnostics:['IDEAL SOURCE SHORT — isolate circuit; supply current cannot be calculated']};
 const groupedNodes=[...new Set(dc.nodes.map(n=>sets.find(n)))];
 const adj=new Map(groupedNodes.map(n=>[n,new Set<string>()]));
 const edges: {p:DcPart;ra:string;rb:string;g:number}[]=[];
 for(const p of dc.parts)if(p.kind==='resistor'){
  const ra=sets.find(p.a),rb=sets.find(p.b);
  if(ra!==rb){adj.get(ra)!.add(rb);adj.get(rb)!.add(ra);edges.push({p,ra,rb,g:1/p.ohms!});}
 }
 const v=new Map<string,number|null>();
 const visited=new Set<string>();
 for(const node of groupedNodes){
  if(visited.has(node))continue;
  const stack=[node],component:string[]=[];visited.add(node);
  while(stack.length){const n=stack.pop()!;component.push(n);for(const near of adj.get(n)??[])if(!visited.has(near)){visited.add(near);stack.push(near)}}
  const hasHigh=component.includes(high),hasLow=component.includes(low);
  if(!hasHigh&&!hasLow){for(const n of component)v.set(n,null);continue;}
  if(!hasHigh||!hasLow){for(const n of component)v.set(n,hasHigh?24:0);continue;}
  v.set(high,24);v.set(low,0);
  const unknowns=component.filter(n=>n!==high&&n!==low);
  const index=new Map(unknowns.map((n,i)=>[n,i]));
  const a=Array.from({length:unknowns.length},()=>Array(unknowns.length).fill(0) as number[]);
  const b=Array(unknowns.length).fill(0) as number[];
  for(const e of edges){
   if(!component.includes(e.ra)||!component.includes(e.rb))continue;
   const ia=index.get(e.ra),ib=index.get(e.rb);
   if(ia!==undefined){a[ia][ia]+=e.g;if(ib!==undefined)a[ia][ib]-=e.g;else b[ia]+=e.g*(e.rb===high?24:0);}
   if(ib!==undefined){a[ib][ib]+=e.g;if(ia!==undefined)a[ib][ia]-=e.g;else b[ib]+=e.g*(e.ra===high?24:0);}
  }
  const solution=linearSolve(a,b);
  unknowns.forEach((n,i)=>v.set(n,solution[i]));
 }
 const volts:Record<string,number|null>=Object.fromEntries(dc.nodes.map(n=>[n,v.get(sets.find(n))??null]));
 let sum=0;
 const readings:DcReading[]=dc.parts.map(p=>{
  if(p.kind!=='resistor')return {partId:p.id,kind:p.kind,voltageV:p.kind==='switch'&&!p.closed?volts[p.a]===null||volts[p.b]===null?null:round(volts[p.a]!-volts[p.b]!):0,currentA:null,powerW:null};
  const a=volts[p.a],b=volts[p.b];
  if(a===null||b===null)return {partId:p.id,kind:p.kind,voltageV:null,currentA:null,powerW:null};
  const drop=a-b,current=drop/p.ohms!;
  if(sets.find(p.a)===high)sum+=current;
  if(sets.find(p.b)===high)sum-=current;
  return {partId:p.id,kind:p.kind,voltageV:round(drop),currentA:round(current),powerW:round(current*current*p.ohms!)};
 });
 sum=round(sum);
 const overcurrent=sum>2;
 const diagnostics:string[]=[];
 if(dc.parts.length===0)diagnostics.push('No circuit parts installed');
 if(dc.parts.some(p=>p.kind==='switch'&&!p.closed))diagnostics.push('One or more switches open');
 if(Object.values(volts).some(x=>x===null))diagnostics.push('Floating unreferenced node(s); meter potential undefined');
 if(overcurrent)diagnostics.push('SOURCE OVERCURRENT > 2 A (teaching threshold); isolate before editing');
 if(!sum)diagnostics.push('No current flows from source to return');
 return {volts,readings,sourceCurrentA:sum,sourcePowerW:round(24*sum),shortCircuit:false,overcurrent,diagnostics};
}
export function measureDcVoltage(analysis:DcAnalysis,a:string,b:string):number|null{
 if(!Object.prototype.hasOwnProperty.call(analysis.volts,a)||!Object.prototype.hasOwnProperty.call(analysis.volts,b))throw Error('Unknown meter terminal');
 const x=analysis.volts[a],y=analysis.volts[b];return x===null||y===null?null:round(x-y);
}
export function measureDcContinuity(circuit:DcCircuit,a:string,b:string):boolean{
 const dc=validateCircuit(circuit);if(!dc.nodes.includes(a)||!dc.nodes.includes(b))throw Error('Unknown meter terminal');
 const s=union(dc.nodes);
 for(const p of dc.parts)if(p.kind==='wire'||p.kind==='switch'&&p.closed)s.join(p.a,p.b);
 return s.find(a)===s.find(b);
}
export function dcReadingsCsv(dc:DcCircuit,report:DcAnalysis):string{
 const quote=(v:unknown)=>'"'+String(v??'UNDEFINED').replace(/"/g,'""')+'"';
 const rows:[string,string,string,string,string,string,string][]=[
 ['component','kind','from','to','voltage_V','current_A','power_W'],
 ...dc.parts.map((p,i)=>[p.id,p.kind,p.a,p.b,report.readings[i].voltageV===null?'UNDEFINED':String(report.readings[i].voltageV),report.readings[i].currentA===null?'UNDEFINED':String(report.readings[i].currentA),report.readings[i].powerW===null?'UNDEFINED':String(report.readings[i].powerW)] as [string,string,string,string,string,string,string])
 ];
 return rows.map(row=>row.map(quote).join(',')).join('\r\n');
}
export function persistDc(store:DcStorage,value:DcCircuit):void{
 const next=serializeCircuit(value);
 const old=store.getItem(DC_KEY);
 if(old!==null){parseCircuit(old);store.setItem(DC_RECOVERY_KEY,old);}
 store.setItem(DC_KEY,next);
}
export function readDc(store:Pick<DcStorage,'getItem'>):{source:'primary'|'recovery'|'default';circuit:DcCircuit;warning:string|null}{
 for(const [key,source] of [[DC_KEY,'primary'],[DC_RECOVERY_KEY,'recovery']] as const){
  try{const text=store.getItem(key);if(text!==null)return {source,circuit:parseCircuit(text),warning:source==='recovery'?'Primary circuit damaged; reading recovery without modifying it.':null};}
  catch(error){if(source==='recovery')return {source:'default',circuit:circuitPreset(),warning:'Saved circuit unreadable or storage blocked; export a copy.'};}
 }
 return {source:'default',circuit:circuitPreset(),warning:null};
}
export function restoreDc(store:DcStorage):DcCircuit{
 const primary=store.getItem(DC_KEY);
 if(primary!==null){try{parseCircuit(primary);throw Error('Primary circuit is already valid');}catch(e){if(e instanceof Error&&e.message==='Primary circuit is already valid')throw e;}}
 const backup=store.getItem(DC_RECOVERY_KEY);if(backup===null)throw Error('No recovery copy available');
 const good=parseCircuit(backup);
 if(primary!==null)store.setItem(DC_DAMAGED_KEY,primary);
 store.setItem(DC_KEY,serializeCircuit(good));
 return good;
}
