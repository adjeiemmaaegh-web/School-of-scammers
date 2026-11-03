/** Bounded deterministic teaching subset of IEC 61131-3 Structured Text.
 * This is NOT a vendor parser, real PLC runtime, or safety-rated controller. */
export type STValue=number|boolean;
export type STSignals=Readonly<Record<string,STValue>>;
type Token={value:string;offset:number};
type Expression={kind:'literal';value:STValue}|{kind:'read';name:string}|{kind:'unary';op:string;inner:Expression}|{kind:'binary';op:string;left:Expression;right:Expression};
type Statement={kind:'assign';name:string;expr:Expression}|{kind:'if';branches:{when:Expression;body:Statement[]}[];otherwise:Statement[]};
export type STProgram={source:string;statements:readonly Statement[];referencedInputs:string[];assignedOutputs:string[]};
export type STResult={outputs:Record<string,STValue>;signals:Record<string,STValue>;assignments:{tag:string;value:STValue}[]};
const keyword=(s:string)=>s.toUpperCase();
const identifier=/^[A-Za-z][A-Za-z0-9_]*$/;
const number=/^(?:\d+(?:\.\d+)?|\.\d+)$/;
const precedence:Readonly<Record<string,number>>={OR:1,XOR:2,AND:3,'=':4,'<>':4,'<':4,'<=':4,'>':4,'>=':4,'+':5,'-':5,'*':6,'/':6,MOD:6};
const RESERVED=new Set(['IF','THEN','ELSIF','ELSE','END_IF','AND','OR','XOR','NOT','TRUE','FALSE','MOD']);
function tokenize(source:string):Token[]{
 if(typeof source!=='string'||source.length>12000)throw new RangeError('Structured Text must be at most 12,000 characters');
 const tokens:Token[]=[];
 for(let i=0;i<source.length;){
  if(/\s/.test(source[i])){i++;continue;}
  if(source.slice(i,i+2)==='//'){const end=source.indexOf('\n',i+2);i=end<0?source.length:end+1;continue;}
  if(source.slice(i,i+2)==='(*'){const end=source.indexOf('*)',i+2);if(end<0)throw new SyntaxError(`Unterminated comment at ${i}`);i=end+2;continue;}
  const rest=source.slice(i);
  const match=/^(?:(?:\d+(?:\.\d+)?|\.\d+)(?![A-Za-z_])|[A-Za-z][A-Za-z0-9_]*|:=|<=|>=|<>|[=<>+*\/\-();])/.exec(rest);
  if(!match)throw new SyntaxError(`Unexpected character at ${i}: ${source[i]}`);
  tokens.push({value:match[0],offset:i});i+=match[0].length;
  if(tokens.length>3000)throw new RangeError('Structured Text token limit (3,000) exceeded');
 }
 tokens.push({value:'<EOF>',offset:source.length});return tokens;
}
export function compileStructuredText(source:string):STProgram{
 const tokens=tokenize(source);let pos=0;let statementCount=0;const reads=new Map<string,string>();const writes=new Map<string,string>();
 const peek=()=>tokens[pos].value, upper=()=>keyword(peek());
 const next=()=>tokens[pos++].value;
 const fail=(reason:string):never=>{throw new SyntaxError(`${reason} at offset ${tokens[Math.min(pos,tokens.length-1)].offset}`);};
 const accept=(value:string)=>{if(upper()===value){pos++;return true;}return false;};
 const requireToken=(value:string)=>{if(!accept(value))fail(`Expected ${value}, found ${peek()}`);};
 const readName=()=>{const t=peek();if(!identifier.test(t)||RESERVED.has(upper()))fail(`Expected variable name, found ${t}`);pos++;return t;};
 function expression(minPrec=1,depth=0):Expression{
  if(depth>40)throw new RangeError('Expression nesting limit exceeded');
  const t=next(),u=keyword(t);let left!:Expression;
  if(t==='('){left=expression(1,depth+1);requireToken(')');}
  else if(u==='NOT'||t==='+'||t==='-')left={kind:'unary',op:u,inner:expression(7,depth+1)};
  else if(u==='TRUE'||u==='FALSE')left={kind:'literal',value:u==='TRUE'};
  else if(number.test(t)){const value=Number(t);if(!Number.isFinite(value))fail('Nonfinite numeric literal');left={kind:'literal',value};}
  else if(identifier.test(t)&&!RESERVED.has(u)){reads.set(u,reads.get(u)??t);left={kind:'read',name:u};}
  else fail(`Expected expression, found ${t}`);
  while(true){const op=upper(),prec=precedence[op];if(prec===undefined||prec<minPrec)break;next();const right=expression(prec+1,depth+1);left={kind:'binary',op,left,right};}
  return left;
 }
 function statements(terminators:ReadonlySet<string>,depth=0):Statement[]{
  if(depth>16)throw new RangeError('IF nesting limit (16) exceeded');const result:Statement[]=[];
  while(peek()!=='<EOF>'&&!terminators.has(upper())){
   if(++statementCount>200)throw new RangeError('Statement limit (200) exceeded');
   if(accept('IF')){
    const branches:{when:Expression;body:Statement[]}[]=[];
    const first=expression();requireToken('THEN');branches.push({when:first,body:statements(new Set(['ELSIF','ELSE','END_IF']),depth+1)});
    while(accept('ELSIF')){const when=expression();requireToken('THEN');branches.push({when,body:statements(new Set(['ELSIF','ELSE','END_IF']),depth+1)});}
    const otherwise=accept('ELSE')?statements(new Set(['END_IF']),depth+1):[];
    requireToken('END_IF');requireToken(';');result.push({kind:'if',branches,otherwise});
   }else{
    const name=readName();requireToken(':=');const expr=expression();requireToken(';');const key=keyword(name);if(!writes.has(key))writes.set(key,name);result.push({kind:'assign',name:key,expr});
   }
  }
  return result;
 }
 const compiled=statements(new Set());
 if(peek()!=='<EOF>')fail(`Unexpected token ${peek()}`);
 if(!compiled.length)throw new SyntaxError('Structured Text requires at least one assignment or IF');
 const outputs=Array.from(writes.values());
 if(!outputs.length)throw new SyntaxError('Structured Text requires an output assignment');
 return {source,statements:compiled,referencedInputs:Array.from(reads.entries()).filter(([key])=>!writes.has(key)).map(([,name])=>name),assignedOutputs:outputs};
}
function numeric(v:STValue):number{if(typeof v!=='number')throw new TypeError('Arithmetic requires numeric operands');return v;}
function bool(v:STValue):boolean{if(typeof v!=='boolean')throw new TypeError('Boolean logic requires BOOL operands');return v;}
function evaluate(expr:Expression,signals:STSignals):STValue{
 if(expr.kind==='literal')return expr.value;
 if(expr.kind==='read'){
  if(!Object.prototype.hasOwnProperty.call(signals,expr.name))throw new Error(`Uninitialized tag ${expr.name}`);
  return signals[expr.name];
 }
 if(expr.kind==='unary'){
  const v=evaluate(expr.inner,signals);return expr.op==='NOT'?!bool(v):expr.op==='-'?-numeric(v):+numeric(v);
 }
 const left=evaluate(expr.left,signals);
 // IEC boolean expressions do not have JS side-effect semantics; short-circuit is valid here.
 if(expr.op==='AND')return bool(left)&&bool(evaluate(expr.right,signals));
 if(expr.op==='OR')return bool(left)||bool(evaluate(expr.right,signals));
 const right=evaluate(expr.right,signals);
 let output:STValue;
 switch(expr.op){
  case 'XOR':output=bool(left)!==bool(right);break;
  case '=':output=typeof left===typeof right&&left===right;break;
  case '<>':output=typeof left!==typeof right||left!==right;break;
  case '>':output=numeric(left)>numeric(right);break;
  case '>=':output=numeric(left)>=numeric(right);break;
  case '<':output=numeric(left)<numeric(right);break;
  case '<=':output=numeric(left)<=numeric(right);break;
  case '+':output=numeric(left)+numeric(right);break;
  case '-':output=numeric(left)-numeric(right);break;
  case '*':output=numeric(left)*numeric(right);break;
  case '/':if(numeric(right)===0)throw new RangeError('Division by zero');output=numeric(left)/numeric(right);break;
  case 'MOD':{
   const a=numeric(left),b=numeric(right);
   if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b))throw new TypeError('MOD requires safe integer operands');
   if(b===0)throw new RangeError('Division by zero');
   output=a%b;break;
  }
  default:throw new Error('Unsupported operator');
 }
 if(typeof output==='number'&&!Number.isFinite(output))throw new RangeError('Nonfinite arithmetic result');
 return output;
}
function assertSignals(input:STSignals):void{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length>128)throw new RangeError('Signals must be a map of at most 128 BOOL/REAL tags');
 const seen=new Set<string>();
 for(const [k,v] of Object.entries(input)){
  const key=keyword(k);
  if(!identifier.test(k)||RESERVED.has(key)||(typeof v!=='boolean'&&(typeof v!=='number'||!Number.isFinite(v))))throw new TypeError(`Invalid signal: ${k}`);
  if(seen.has(key))throw new TypeError(`Ambiguous signal aliases for ${k}`);
  seen.add(key);
 }
}
/** Each scan starts from last outputs, then samples current inputs; input tags cannot be overwritten. */
export function executeStructuredText(program:STProgram,inputs:STSignals,previousOutputs:STSignals={}):STResult{
 assertSignals(inputs);assertSignals(previousOutputs);
 if(!program||!Array.isArray(program.statements))throw new TypeError('Compile Structured Text before executing');
 // IEC-style tag identifiers ignore case; public outputs retain the program's first spelling.
 const values:Record<string,STValue>=Object.create(null);
 const displays=new Map<string,string>();
 for(const [tag,value] of Object.entries(previousOutputs)){const key=keyword(tag);values[key]=value;displays.set(key,tag);}
 for(const [tag,value] of Object.entries(inputs)){const key=keyword(tag);values[key]=value;displays.set(key,tag);}
 const inputKeys=new Set(Object.keys(inputs).map(keyword));
 const outputNames=new Map(program.assignedOutputs.map(tag=>[keyword(tag),tag]));
 const outputs:Record<string,STValue>={};const assignments:{tag:string;value:STValue}[]=[];
 let operations=0;
 const run=(statements:readonly Statement[],depth:number)=>{
  if(depth>16)throw new RangeError('Execution nesting limit exceeded');
  for(const statement of statements){
   if(++operations>400)throw new RangeError('Execution statement budget exceeded');
   if(statement.kind==='assign'){
    if(inputKeys.has(statement.name))throw new Error(`Cannot overwrite sampled input ${statement.name}`);
    const value=evaluate(statement.expr,values);values[statement.name]=value;
    const tag=outputNames.get(statement.name)??statement.name;outputs[tag]=value;assignments.push({tag,value});
   }else{
    let body:readonly Statement[]=statement.otherwise;
    for(const branch of statement.branches)if(bool(evaluate(branch.when,values))){body=branch.body;break;}
    run(body,depth+1);
   }
  }
 };
 run(program.statements,0);
 // Preserve state of declared outputs between scans, including unassigned IF branches.
 for(const [key,tag] of outputNames){
  if(Object.prototype.hasOwnProperty.call(values,key)){outputs[tag]=values[key];displays.set(key,tag);}
 }
 const signals=Object.fromEntries(Object.entries(values).map(([key,value])=>[displays.get(key)??key,value]));
 return {outputs,signals,assignments};
}
export function runStructuredTextScans(program:STProgram,steps:readonly {scans:number;inputs:STSignals}[],initialOutputs:STSignals={}):{rows:{scan:number;inputs:STSignals;outputs:STSignals}[];finalOutputs:STSignals}{
 if(!Array.isArray(steps)||steps.length<1||steps.length>100)throw new RangeError('Provide 1..100 scan steps');
 const total=steps.reduce((n,s)=>n+s.scans,0);if(total>5000)throw new RangeError('Sequence exceeds 5,000 scans');
 const rows:{scan:number;inputs:STSignals;outputs:STSignals}[]=[];let memory:STSignals={...initialOutputs};let sampled:Record<string,STValue>={};
 for(const step of steps){if(!Number.isSafeInteger(step.scans)||step.scans<1)throw new RangeError('Invalid scan count');assertSignals(step.inputs);
  // Later scan steps replace earlier case-variant spellings of the same tag.
  for(const tag of Object.keys(step.inputs)){
   const value=step.inputs[tag];
   const former=Object.keys(sampled).find(key=>keyword(key)===keyword(tag));
   if(former!==undefined)delete sampled[former];
   sampled[tag]=value;
  }
  for(let i=0;i<step.scans;i++){const result=executeStructuredText(program,sampled,memory);memory=result.outputs;rows.push({scan:rows.length+1,inputs:{...sampled},outputs:{...memory}});}}
 return {rows,finalOutputs:memory};
}
export const ST_DEMO=`(* PLC Skills Lab: teaching subset; not a vendor PLC runtime *)
IF NOT EStopOK OR NOT GuardClosed THEN
  Run := FALSE;
ELSIF Stop THEN
  Run := FALSE;
ELSIF Start THEN
  Run := TRUE;
END_IF;
`;