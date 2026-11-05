/** Bounded PLCopen TC6 2.01 Structured Text POU interchange.
 * Supports only one program POU, elementary BOOL/INT/DINT/REAL/LREAL variables,
 * and the separately documented teaching ST grammar. Never silently drops
 * unsupported LD/FBD/SFC, multi-POU, tasks or vendor-specific nodes.
 * Not a general-purpose XML parser or an IEC/PLCopen conformance claim.
 */
import {compileStructuredText,type STDeclaration,type STType} from './structured-text';
export const PLCOPEN_XML_NAMESPACE='http://www.plcopen.org/xml/tc6_0201';
type Node={name:string;attrs:Record<string,string>;children:Node[];text:string};
const nameOK=/^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const xmlEscape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function xmlDecode(s:string):string {
 const pattern=/&(?:amp|lt|gt|quot|apos|#(?:x[0-9a-fA-F]+|[0-9]+));/g;
 if(s.replace(pattern,'').includes('&'))throw Error('Malformed or unsupported XML entity');
 const decoded=s.replace(pattern,v=>{
  if(v==='&amp;')return '&';if(v==='&lt;')return '<';if(v==='&gt;')return '>';
  if(v==='&quot;')return '"';if(v==='&apos;')return "'";
  const hex=v.startsWith('&#x'),n=parseInt(v.slice(hex?3:2,-1),hex?16:10);
  if(n===0||n>0x10ffff||(n>=0xd800&&n<=0xdfff)||n<32&&n!==9&&n!==10&&n!==13)throw Error('Invalid numeric XML entity');
  return String.fromCodePoint(n);
 });
 return decoded;
}
function parseSmallXml(input:string):Node{
 if(typeof input!=='string'||input.length>150000)throw RangeError('PLCopen interchange XML must be at most 150 KB');
 let xml=input.trim().replace(/^<\?xml\s+version="1\.0"\s+encoding="UTF-8"\s*\?>\s*/i,'');
 if(/<!|<\?/.test(xml))throw Error('DTD, entities, CDATA, comments and processing instructions are not supported');
 const parts=xml.match(/<[^>]*>|[^<]+/g)??[];
 if(parts.join('')!==xml||parts.length>2500)throw Error('Malformed or oversized XML');
 const stack:Node[]=[],roots:Node[]=[];
 for(const token of parts){
  if(!token.startsWith('<')){
   if(!stack.length){if(token.trim())throw Error('Text outside XML root');}
   else stack[stack.length-1].text+=xmlDecode(token);
   continue;
  }
  if(token.startsWith('</')){
   const m=/^<\/([A-Za-z_][\w:.-]*)\s*>$/.exec(token);
   if(!m||stack.at(-1)?.name!==m[1])throw Error('Unbalanced XML closing tag');
   stack.pop();continue;
  }
  const m=/^<([A-Za-z_][\w:.-]*)([\s\S]*?)(\/?)>$/.exec(token);
  if(!m)throw Error('Malformed XML open tag');
  const node:Node={name:m[1],attrs:{},children:[],text:''};
  let attributes=m[2].trim();
  const attr=/^([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"(?:\s+|$)/;
  while(attributes){
   const matched=attr.exec(attributes+' ');
   if(!matched)throw Error('Unsupported or malformed XML attribute');
   if(Object.prototype.hasOwnProperty.call(node.attrs,matched[1]))throw Error('Duplicate XML attribute');
   node.attrs[matched[1]]=xmlDecode(matched[2]);
   attributes=attributes.slice(matched[0].trimEnd().length).trimStart();
  }
  if(stack.length){if(stack.length>24)throw RangeError('Excessive XML depth');stack.at(-1)!.children.push(node);}
  else roots.push(node);
  if(m[3]!=='/')stack.push(node);
 }
 if(stack.length||roots.length!==1)throw Error('Unbalanced XML document');
 return roots[0];
}
function one(node:Node,name:string):Node{
 const found=node.children.filter(n=>n.name===name);
 if(found.length!==1)throw Error('Expected one '+name);
 return found[0];
}
function allowed(node:Node,names:readonly string[]):void{
 const found=node.children.find(x=>!names.includes(x.name));
 if(found)throw Error('Unsupported PLCopen element: '+found.name);
 if(node.text.trim())throw Error('Unexpected text in '+node.name);
}
function formatInitial(value:STDeclaration['initial']):string{return typeof value==='boolean'?(value?'TRUE':'FALSE'):String(value);}
function varsOf(items:readonly STDeclaration[],scope:STDeclaration['scope'],element:string):string{
 const variables=items.filter(x=>x.scope===scope);
 if(!variables.length)return '';
 return '<'+element+'>'+variables.map(item=>{
  let extra='';
  if(scope!=='input')extra='<initialValue><simpleValue value="'+xmlEscape(String(item.initial))+'"/></initialValue>';
  return '<variable name="'+xmlEscape(item.name)+'"><type><'+item.type+'/></type>'+extra+'</variable>';
 }).join('')+'</'+element+'>';
}
export function exportPlcopenStructuredText(source:string,pouName='TrainingProgram'):string{
 if(!nameOK.test(pouName))throw TypeError('PLCopen POU name must be an IEC-style identifier');
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(source))throw Error('XML control characters are not permitted');
 const program=compileStructuredText(source);
 const declarations=program.declarations;
 const iface='<interface>'+varsOf(declarations,'input','inputVars')+varsOf(declarations,'output','outputVars')+varsOf(declarations,'local','localVars')+'</interface>';
 return '<?xml version="1.0" encoding="UTF-8"?>\n'+
  '<project xmlns="'+PLCOPEN_XML_NAMESPACE+'" xmlns:xhtml="http://www.w3.org/1999/xhtml">'+
  '<fileHeader companyName="PLC Skills Lab" productName="PLC Skills Lab" productVersion="educational-subset"/>'+
  '<contentHeader name="'+xmlEscape(pouName)+'"><coordinateInfo><fbd><scaling x="1" y="1"/></fbd><ld><scaling x="1" y="1"/></ld><sfc><scaling x="1" y="1"/></sfc></coordinateInfo></contentHeader>'+
  '<types><dataTypes/><pous><pou name="'+xmlEscape(pouName)+'" pouType="program">'+iface+
  '<body><ST><xhtml:p>'+xmlEscape(program.bodySource.trim())+'</xhtml:p></ST></body>'+
  '</pou></pous></types><instances><configurations/></instances></project>\n';
}
export function importPlcopenStructuredText(xml:string):{name:string;source:string}{
 const root=parseSmallXml(xml);
 if(root.name!=='project'||root.attrs.xmlns!==PLCOPEN_XML_NAMESPACE||root.attrs['xmlns:xhtml']!=='http://www.w3.org/1999/xhtml')throw Error('Unsupported PLCopen XML namespace');
 allowed(root,['fileHeader','contentHeader','types','instances']);
 const types=one(root,'types');allowed(types,['dataTypes','pous']);
 const pous=one(types,'pous');allowed(pous,['pou']);
 const pou=one(pous,'pou');if(pou.attrs.pouType!=='program'||!nameOK.test(pou.attrs.name??''))throw Error('Only one named PROGRAM POU is supported');
 allowed(pou,['interface','body']);
 const iface=one(pou,'interface');allowed(iface,['inputVars','outputVars','localVars']);
 const blocks:{tag:string;st:string;type:STDeclaration['scope']}[]=[
  {tag:'inputVars',st:'VAR_INPUT',type:'input'}, {tag:'outputVars',st:'VAR_OUTPUT',type:'output'}, {tag:'localVars',st:'VAR',type:'local'}
 ];
 let declarations='';
 const names=new Set<string>();
 for(const block of blocks){
  const containers=iface.children.filter(n=>n.name===block.tag);
  if(containers.length>1)throw Error('Repeated variable scope');
  if(!containers.length)continue;
  const container=containers[0];allowed(container,['variable']);
  if(container.children.length>128)throw RangeError('Too many PLCopen variables');
  const lines:string[]=[];
  for(const variable of container.children){
   allowed(variable,['type','initialValue']);
   const name=variable.attrs.name;
   if(!name||!nameOK.test(name)||names.has(name.toUpperCase()))throw Error('Duplicate or malformed XML variable');
   names.add(name.toUpperCase());
   const typed=one(variable,'type');
   if(typed.children.length!==1||typed.text.trim())throw Error('Unsupported XML variable data type');
   const type=typed.children[0].name as STType;
   if(!['BOOL','INT','DINT','REAL','LREAL'].includes(type)||typed.children[0].children.length)throw Error('Unsupported XML variable type');
   let initial='';
   const initialNodes=variable.children.filter(n=>n.name==='initialValue');
   if(initialNodes.length>1)throw Error('Invalid variable initializer');
   if(initialNodes.length){
    if(block.type==='input')throw Error('Input initializers are unsupported');
    const init=initialNodes[0],simple=one(init,'simpleValue');
    if(init.children.length!==1||simple.children.length||simple.text.trim())throw Error('Unsupported initializer');
    const value=simple.attrs.value;
    if(value===undefined||!/^(?:true|false|TRUE|FALSE|[+-]?(?:\d+(?:\.\d+)?|\.\d+))$/.test(value))throw Error('Unsupported initializer literal');
    initial=' := '+value;
   }
   lines.push(' '+name+' : '+type+initial+';');
  }
  if(lines.length)declarations+=block.st+'\n'+lines.join('\n')+'\nEND_VAR\n';
 }
 const body=one(pou,'body');allowed(body,['ST']);
 const st=one(body,'ST');allowed(st,['xhtml:p']);
 if(!st.children.length)throw Error('Missing XHTML Structured Text body');
 let text='';
 for(const paragraph of st.children){if(paragraph.children.length)throw Error('Nested markup in Structured Text body is unsupported');text+=paragraph.text+'\n';}
 if(!text.trim())throw Error('Structured Text program is empty');
 const source=declarations+text.trim()+'\n';
 compileStructuredText(source); // fail closed for unsupported syntax, POU types and declarations
 return {name:pou.attrs.name,source};
}
