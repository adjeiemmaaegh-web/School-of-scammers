/** Strict, bounded PLCopen TC6 2.01 graphical LD interchange for teaching contacts/coils.
 * One PROGRAM POU; NO/NC contacts, series and parallel graphs, BOOL variables, plain coils.
 * Explicitly rejects timers, counters, function blocks, special coils, multiple POUs,
 * tasks, unknown nodes, dangling connections and unsupported metadata. No compliance claim.
 */
import {validateLadder,type LadderDocument,type Contact,type RungElement} from './ladder';
import {PLCOPEN_XML_NAMESPACE,parseSmallXml} from './plcopen-st-xml';

type X=ReturnType<typeof parseSmallXml>;
type Kind='leftPowerRail'|'contact'|'coil'|'rightPowerRail';
type NodeInfo={node:X;kind:Kind;id:string;refs:readonly string[];tag?:string;negated?:boolean;pos:number};
const identifier=/^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const lines=(parts:readonly string[])=>parts.join('');
function fail(reason:string):never{throw new Error('Unsupported PLCopen LD: '+reason);}
function only(n:X,name:string):X{const found=n.children.filter(child=>child.name===name);if(found.length!==1)fail('expected one '+name+' in '+n.name);return found[0];}
function children(n:X,names:readonly string[]):void{
 if(n.text.trim())fail('unexpected text in '+n.name);
 for(const c of n.children)if(!names.includes(c.name))fail('unknown '+c.name+' in '+n.name);
}
function attrs(n:X,expected:readonly string[]):void{
 for(const name of Object.keys(n.attrs))if(!expected.includes(name))fail('unknown attribute '+name+' in '+n.name);
}
function plainName(s:string,label:string):void{if(!identifier.test(s))fail(label+' must be a simple IEC identifier (letters, digits, underscore)');}
function localId(n:X):string{
 const id=n.attrs.localId;
 if(typeof id!=='string'||!/^(?:0|[1-9]\d{0,9})$/.test(id)||Number(id)>2147483647)fail('invalid localId for '+n.name);
 return id;
}
function placement(n:X):number{
 const pos=n.children.filter(x=>x.name==='position');
 if(pos.length>1)fail('duplicate position');
 if(!pos.length)return 0;
 children(pos[0],[]);attrs(pos[0],['x','y']);
 const y=Number(pos[0].attrs.y);
 if(!Number.isFinite(y))fail('invalid position coordinate');
 return y;
}
function refsFrom(n:X,required:boolean):string[]{
 const points=n.children.filter(x=>x.name==='connectionPointIn');
 if(points.length>1)fail('repeated connectionPointIn');
 if(!points.length){if(required)fail('missing incoming connection on '+n.name);return [];}
 const cp=points[0];
 children(cp,['connection','relPosition']);
 attrs(cp,[]);
 const refs:string[]=[];
 for(const child of cp.children){
  if(child.name==='relPosition'){children(child,[]);attrs(child,['x','y']);continue;}
  attrs(child,['refLocalId']);
  children(child,['position']);
  for(const pos of child.children){children(pos,[]);attrs(pos,['x','y']);}
  const ref=child.attrs.refLocalId;
  if(typeof ref!=='string'||!/^(?:0|[1-9]\d{0,9})$/.test(ref)||Number(ref)>2147483647||refs.includes(ref))fail('bad or duplicate refLocalId');
  refs.push(ref);
 }
 if(required&&(!refs.length||refs.length>16))fail('missing or excessive incoming references for '+n.name);
 return refs;
}
function validateDeclarations(pou:X):Map<string,'input'|'output'|'local'> {
 const iface=only(pou,'interface');
 children(iface,['inputVars','outputVars','localVars']);
 const declarations=new Map<string,'input'|'output'|'local'>();
 for(const [block,scope] of [['inputVars','input'],['outputVars','output'],['localVars','local']] as const){
  const scopes=iface.children.filter(x=>x.name===block);
  if(scopes.length>1)fail('repeated '+block);
  if(!scopes.length)continue;
  const container=scopes[0];children(container,['variable']);
  for(const variable of container.children){
   children(variable,['type']);attrs(variable,['name']);
   const name=variable.attrs.name;
   plainName(name??'', 'variable name');
   if(declarations.has(name.toUpperCase()))fail('duplicate declared variable '+name);
   const type=only(variable,'type');children(type,['BOOL']);
   if(type.children.length!==1)fail('only BOOL variable declarations are supported');
   children(type.children[0],[]);
   declarations.set(name.toUpperCase(),scope);
  }
 }
 return declarations;
}
function common(id:number,x:number,y:number,extra=''):string{return ' localId="'+id+'" height="20" width="40"'+extra+'><position x="'+x+'" y="'+y+'"/>'; }
function connector(source:readonly number[]):string{
 return '<connectionPointIn>'+source.map(id=>'<connection refLocalId="'+id+'"/>').join('')+'</connectionPointIn>';
}
function contactNode(id:number,tag:string,negated:boolean,x:number,y:number,from:readonly number[]):string{
 return '<contact'+common(id,x,y,(negated?' negated="true"':' negated="false"')+' storage="none" edge="none"')+
 connector(from)+'<connectionPointOut/><variable>'+esc(tag)+'</variable></contact>';
}
/** Export preserves execution topology/boolean semantics, not editor rung IDs,
 * coordinates, symbol descriptions, addresses or vendor-specific information.
 */
export function exportPlcopenLadder(doc:LadderDocument,pouName='TrainingLadder',options?:{allowSymbolMetadataLoss?:boolean}):string {
 const errors=validateLadder(doc);
 if(errors.length)throw Error('Invalid ladder document: '+errors.join('; '));
 plainName(pouName,'POU name');
 if(doc.rungs.length>200)fail('more than 200 rungs');
 if(doc.symbols&&Object.keys(doc.symbols).length&&!options?.allowSymbolMetadataLoss)fail('symbol descriptions/addresses are not preserved; use project JSON or explicitly confirm metadata loss');
 const outputTags=new Set(doc.rungs.map(r=>r.coil));
 const inputTags=new Set<string>();
 const machine:string[]=[];
 let counter=1,depth=0;
 for(const [ri,rung] of doc.rungs.entries()){
  if(rung.operation?.kind && rung.operation.kind!=='coil')fail('instruction '+rung.operation.kind.toUpperCase()+' on rung '+rung.id+' cannot be represented in this LD subset');
  for(const tag of [rung.coil,...rung.elements.flatMap(e=>e.type==='contact'?[e.tag]:e.alternatives.flatMap(path=>path.map(c=>c.tag)))])plainName(tag,'LD variable '+tag);
  const y=ri*130+20;
  const rail=counter++;machine.push('<leftPowerRail'+common(rail,0,y)+'<connectionPointOut/></leftPowerRail>');
  let sources=[rail],column=1;
  function insert(c:Contact,previous:readonly number[],extraY=0):number{
   if(!outputTags.has(c.tag))inputTags.add(c.tag);
   const id=counter++;
   machine.push(contactNode(id,c.tag,c.normallyClosed===true,35*column,y+extraY,previous));
   return id;
  }
  for(const element of rung.elements){
   if(element.type==='contact'){sources=[insert(element,sources)];}
   else {
    const result:number[]=[];
    for(const [i,path] of element.alternatives.entries()){
     let before=[...sources];
     for(const c of path)before=[insert(c,before,i*24)];
     result.push(before[0]);
    }
    sources=result;
   }
   column++;
  }
  const coil=counter++;
  machine.push('<coil'+common(coil,35*column+60,y,' negated="false" storage="none"')+
   connector(sources)+'<connectionPointOut/><variable>'+esc(rung.coil)+'</variable></coil>');
  const end=counter++;
  machine.push('<rightPowerRail'+common(end,35*column+100,y)+connector([coil])+'</rightPowerRail>');
  depth=Math.max(depth,column);
 }
 if(counter>1700||depth>81)fail('interchange exceeds bounded graph budget');
 const vars=(tags:readonly string[],scope:'inputVars'|'outputVars')=>!tags.length?'':'<'+scope+'>'+tags.map(tag=>
  '<variable name="'+esc(tag)+'"><type><BOOL/></type></variable>').join('')+'</'+scope+'>';
 const iface='<interface>'+vars([...inputTags].sort(),'inputVars')+vars([...outputTags].sort(),'outputVars')+'</interface>';
 const xml=lines([
 '<?xml version="1.0" encoding="UTF-8"?>\n',
 '<project xmlns="'+PLCOPEN_XML_NAMESPACE+'" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
 '<fileHeader companyName="PLC Skills Lab" productName="PLC Skills Lab" productVersion="educational-LD-subset"/>',
 '<contentHeader name="'+esc(pouName)+'"><coordinateInfo><fbd><scaling x="1" y="1"/></fbd><ld><scaling x="1" y="1"/></ld><sfc><scaling x="1" y="1"/></sfc></coordinateInfo></contentHeader>',
 '<types><dataTypes/><pous><pou name="'+esc(pouName)+'" pouType="program">',
 iface,'<body><LD>',...machine,'</LD></body></pou></pous></types>',
 '<instances><configurations/></instances></project>\n'
 ]);
 if(xml.length>150000)fail('generated XML exceeds 150 KB bound');
 parseSmallXml(xml); // refuse producing an export our bounded importer cannot read
 return xml;
}
/** Parse a restricted graphical LD DAG. Incoming references are OR junctions,
 * series contacts are AND. Expands to bounded disjunctive normal form, then
 * converts that semantic form to native editable ladder branch elements.
 */
export function importPlcopenLadder(xml:string):LadderDocument{
 const root=parseSmallXml(xml);
 if(root.name!=='project'||root.attrs.xmlns!==PLCOPEN_XML_NAMESPACE)fail('requires PLCopen TC6 2.01 namespace');
 attrs(root,['xmlns','xmlns:xhtml','xsi:schemaLocation','xmlns:xsi']);
 children(root,['fileHeader','contentHeader','types','instances']);
 const types=only(root,'types');children(types,['dataTypes','pous']);
 const pous=only(types,'pous');children(pous,['pou']);
 if(pous.children.length!==1)fail('exactly one PROGRAM POU is supported');
 const pou=only(pous,'pou');children(pou,['interface','body']);
 if(pou.attrs.pouType!=='program')fail('only PROGRAM POU is supported');
 const pouName=pou.attrs.name??'';plainName(pouName,'POU name');
 const declared=validateDeclarations(pou);
 const body=only(pou,'body');children(body,['LD']);
 const ld=only(body,'LD');children(ld,['leftPowerRail','rightPowerRail','contact','coil']);
 const byId=new Map<string,NodeInfo>(),coils:NodeInfo[]=[];
 const rails:NodeInfo[]=[];
 for(const n of ld.children){
  const kind=n.name as Kind,id=localId(n);
  if(byId.has(id))fail('duplicate LD localId '+id);
  const sourceRequired=kind==='contact'||kind==='coil';
  const accepted=kind==='contact'||kind==='coil'?
   ['localId','height','width','negated','storage','edge']:
   ['localId','height','width'];
  attrs(n,accepted);
  children(n,kind==='contact'||kind==='coil'?
   ['position','connectionPointIn','connectionPointOut','variable']:
   ['position','connectionPointIn','connectionPointOut']);
  let tag:string|undefined,negated=false;
  if(kind==='contact'||kind==='coil'){
   const variable=only(n,'variable');
   if(variable.children.length)fail('nested LD variable is unsupported');
   tag=variable.text.trim();plainName(tag,'LD symbol');
   if(n.attrs.storage!==undefined&&n.attrs.storage!=='none')fail('SET/RESET/storage coils or contacts are not supported');
   if(n.attrs.edge!==undefined&&n.attrs.edge!=='none')fail('edge contacts are not supported');
   if(n.attrs.negated!==undefined&&!['true','false'].includes(n.attrs.negated))fail('invalid negation attribute');
   negated=n.attrs.negated==='true';
   if(kind==='coil'&&negated)fail('inverted coils are unsupported');
  }
  const refs=refsFrom(n,sourceRequired);
  const info:NodeInfo={node:n,kind,id,refs,tag,negated,pos:placement(n)};
  byId.set(id,info);
  if(kind==='coil')coils.push(info);
  if(kind==='leftPowerRail')rails.push(info);
 }
 if(!coils.length||coils.length>200||byId.size>1600||rails.length===0)fail('no supported ladder topology or capacity exceeded');
 for(const n of byId.values()){
  if(n.kind==='leftPowerRail'&&n.refs.length)fail('power rail cannot have incoming connections');
  if(n.kind==='rightPowerRail'&&n.refs.some(ref=>byId.get(ref)?.kind!=='coil'))fail('right rail must receive only coil outputs');
 }
 const seen=new Set<string>();
 function upstream(id:string,stack:Set<string>,limit:number):Contact[][]{
  if(limit>80||stack.has(id))fail('cyclic or excessively deep LD connection graph');
  const n=byId.get(id);
  if(!n)fail('dangling refLocalId '+id);
  seen.add(id);
  if(n.kind==='leftPowerRail')return [[]];
  if(n.kind!=='contact')fail('non-contact source in ladder path: '+n.kind);
  const next=new Set(stack);next.add(id);
  const result:Contact[][]=[];
  for(const ref of n.refs){
   for(const path of upstream(ref,next,limit+1)){
    result.push([...path,{type:'contact',tag:n.tag!,...(n.negated?{normallyClosed:true}:{})}]);
    if(result.length>64)fail('parallel path expansion exceeds 64');
   }
  }
  return result;
 }
 const rungs=[] as {id:string;coil:string;elements:RungElement[]}[];
 const usedCoils=new Set<string>();
 for(const [i,coil] of coils.entries()){
  if(usedCoils.has(coil.tag!.toUpperCase()))fail('multiple writes to coil '+coil.tag);
  usedCoils.add(coil.tag!.toUpperCase());
  seen.add(coil.id);
  const paths:Contact[][]=[];
  for(const ref of coil.refs){
   for(const path of upstream(ref,new Set([coil.id]),0)){
    if(!path.length)fail('unconditional coil is not expressible in the teaching editor');
    const key=JSON.stringify(path);
    if(!paths.some(p=>JSON.stringify(p)===key))paths.push(path);
    if(paths.length>64)fail('more than 64 distinct parallel paths');
   }
  }
  if(!paths.length)fail('coil without power path');
  const elements:RungElement[]=paths.length===1?paths[0]:[{type:'branch',alternatives:paths}];
  rungs.push({id:'import-rung-'+(i+1),coil:coil.tag!,elements});
 }
 for(const n of byId.values())if((n.kind==='contact'||n.kind==='leftPowerRail')&&!seen.has(n.id))fail('orphan graph element '+n.id);
 const used=new Set(rungs.flatMap(r=>[r.coil,...r.elements.flatMap(e=>e.type==='contact'?[e.tag]:e.alternatives.flatMap(p=>p.map(c=>c.tag)))]).map(x=>x.toUpperCase()));
 for(const name of used)if(!declared.has(name))fail('undeclared BOOL variable '+name);
 for(const [name,scope] of declared){
  if(!used.has(name))fail('unused declared variable '+name+' cannot be silently dropped');
  if(usedCoils.has(name)&&scope==='input')fail('coil '+name+' cannot be a VAR_INPUT');
 }
 const result:LadderDocument={id:pouName,version:'1',rungs};
 const errors=validateLadder(result);
 if(errors.length)fail('imported ladder invalid: '+errors.join('; '));
 return result;
}
