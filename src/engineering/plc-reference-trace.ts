/** Compare a bounded external PLC trace against the educational ladder interpreter.
 * The caller MUST provide measurements from a genuine, identified reference
 * PLC to count as independent verification. This function never claims source authenticity.
 */
import {executeLadder,validateLadder,type LadderDocument,type LadderMemory} from './ladder';
export type ReferenceMismatch={scan:number;tag:string;expected:boolean;actual:boolean};
export type ReferenceComparison={
 scans:number;checks:number;matches:number;mismatches:number;
 firstMismatches:readonly ReferenceMismatch[];
 outcomes:readonly {scan:number;timeMs:number;passed:boolean;mismatchCount:number}[];
 sourceVerified:false;
};
const tagName=/^[A-Za-z][A-Za-z0-9_.]{0,79}$/;
const booleanCell=(s:string):boolean=>{
 if(s==='1'||s.toUpperCase()==='TRUE')return true;
 if(s==='0'||s.toUpperCase()==='FALSE')return false;
 throw new SyntaxError('Boolean PLC trace values must be 0, 1, TRUE or FALSE');
};
export function referenceTraceTemplate(program:LadderDocument):string{
 const errs=validateLadder(program);if(errs.length)throw Error('Invalid ladder program: '+errs.join('; '));
 const outputs=program.rungs.map(r=>r.coil);
 const inputTags=new Set<string>();
 for(const rung of program.rungs)for(const element of rung.elements){
  for(const path of element.type==='contact'?[[element]]:element.alternatives)
   for(const contact of path)if(!outputs.includes(contact.tag))inputTags.add(contact.tag);
 }
 return ['scan','delta_ms',...[...inputTags].sort().map(x=>'input:'+x),...outputs.map(x=>'output:'+x)].join(',')+'\n';
}
export function compareReferenceCsv(program:LadderDocument,csv:string):ReferenceComparison{
 const errs=validateLadder(program);if(errs.length)throw Error('Invalid ladder program: '+errs.join('; '));
 if(typeof csv!=='string'||csv.length>200000)throw RangeError('Reference trace exceeds 200 KB');
 if(csv.includes('"')||csv.includes('\0'))throw Error('Reference CSV must use unquoted numeric/boolean cells');
 const lines=csv.replace(/\r\n/g,'\n').trim().split('\n');
 if(lines.length<2||lines.length>2002)throw RangeError('Provide 1..2000 PLC scan rows');
 const header=lines[0].split(',').map(x=>x.trim());
 if(header[0]!=='scan'||header[1]!=='delta_ms'||header.length<3||header.length>130)throw Error('Invalid reference header');
 const seen=new Set<string>(),inputs:{tag:string;index:number}[]=[],outputs:{tag:string;index:number}[]=[];
 const coils=new Set(program.rungs.map(r=>r.coil));
 header.forEach((name,i)=>{
  if(seen.has(name))throw Error('Duplicate reference column '+name);seen.add(name);
  if(i<2)return;
  const [scope,tag,...unexpected]=name.split(':');
  if(unexpected.length||!tagName.test(tag)||!['input','output'].includes(scope))throw Error('Invalid reference signal column '+name);
  if(scope==='input')inputs.push({tag,index:i});
  else {if(!coils.has(tag))throw Error('Reference output not present in ladder: '+tag);outputs.push({tag,index:i});}
 });
 if(!outputs.length)throw Error('Reference trace must include at least one PLC output');
 const missing=program.rungs.map(r=>r.coil).filter(x=>!outputs.some(y=>y.tag===x));
 if(missing.length)throw Error('Reference trace omits output(s): '+missing.join(', '));
 let previous:Readonly<Record<string,boolean>>={},memory:LadderMemory={},timeMs=0,matches=0;
 const firstMismatches:ReferenceMismatch[]=[],outcomes:ReferenceComparison['outcomes'][number][]=[];
 for(const [index,line] of lines.slice(1).entries()){
  const cells=line.split(',').map(x=>x.trim());
  const scan=index+1;
  if(cells.length!==header.length||cells[0]!==String(scan))throw Error('Nonsequential or incomplete PLC scan '+scan);
  const delta=Number(cells[1]);if(!Number.isSafeInteger(delta)||delta<1||delta>1000)throw RangeError('Invalid PLC scan interval '+scan);
  const sampled:Record<string,boolean>={};
  for(const x of inputs)sampled[x.tag]=booleanCell(cells[x.index]);
  const expected:Record<string,boolean>={};
  for(const x of outputs)expected[x.tag]=booleanCell(cells[x.index]);
  const result=executeLadder(program,sampled,previous,memory,delta);
  let errors=0;
  for(const x of outputs){
   if(result.outputs[x.tag]===expected[x.tag])matches++;
   else{errors++;if(firstMismatches.length<100)firstMismatches.push({scan,tag:x.tag,expected:expected[x.tag],actual:result.outputs[x.tag]});}
  }
  previous=result.outputs;memory=result.memory;timeMs+=delta;
  outcomes.push({scan,timeMs,passed:errors===0,mismatchCount:errors});
 }
 return {scans:outcomes.length,checks:outcomes.length*outputs.length,matches,mismatches:outcomes.length*outputs.length-matches,firstMismatches,outcomes,sourceVerified:false};
}
